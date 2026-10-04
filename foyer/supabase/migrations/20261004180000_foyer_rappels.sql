-- Rappels Foyer sur le téléphone (Web Push), sans que le serveur lise les rappels.
-- Le téléphone dépose chaque rappel chiffré (clé tirée du code du foyer) avec son heure ; à l'heure dite, la fonction
-- foyer-push envoie une notification VIDE aux téléphones abonnés du foyer ; le service worker relit le rappel chiffré,
-- le déchiffre et l'affiche. Le serveur ne voit qu'une étiquette de foyer, des heures, des blocs illisibles et des
-- adresses d'abonnement (Apple, Google, Mozilla ou Microsoft uniquement).

create table if not exists public.foyer_push (
  endpoint   text primary key check (length(endpoint) <= 1000 and endpoint ~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/'),
  household  text not null check (household ~ '^[0-9a-f]{64}$'),
  device     text not null check (device ~ '^[a-z0-9]{8,24}$'),
  created_at timestamptz not null default now()
);
create index if not exists foyer_push_household on public.foyer_push (household);

create table if not exists public.foyer_rappel (
  household text not null check (household ~ '^[0-9a-f]{64}$'),
  rid       text not null check (rid ~ '^[0-9a-f]{16,64}$'),
  at        timestamptz not null,
  blob      text not null check (length(blob) between 20 and 4000),
  sent_at   timestamptz,
  primary key (household, rid)
);
create index if not exists foyer_rappel_due on public.foyer_rappel (at) where sent_at is null;

-- Clé publique VAPID (publique par nature) ; la clé privée est dans le coffre (vault), lue seulement par le serveur.
create table if not exists public.foyer_meta (k text primary key, v text not null);

alter table public.foyer_push enable row level security;
alter table public.foyer_rappel enable row level security;
alter table public.foyer_meta enable row level security;

drop policy if exists foyer_push_lire on public.foyer_push;
create policy foyer_push_lire on public.foyer_push for select to anon using (household = public.foyer_tag());
drop policy if exists foyer_push_ecrire on public.foyer_push;
create policy foyer_push_ecrire on public.foyer_push for insert to anon with check (household = public.foyer_tag());
drop policy if exists foyer_push_retirer on public.foyer_push;
create policy foyer_push_retirer on public.foyer_push for delete to anon using (household = public.foyer_tag());

drop policy if exists foyer_rappel_lire on public.foyer_rappel;
create policy foyer_rappel_lire on public.foyer_rappel for select to anon using (household = public.foyer_tag());
drop policy if exists foyer_rappel_ecrire on public.foyer_rappel;
create policy foyer_rappel_ecrire on public.foyer_rappel for insert to anon with check (household = public.foyer_tag());
drop policy if exists foyer_rappel_retirer on public.foyer_rappel;
create policy foyer_rappel_retirer on public.foyer_rappel for delete to anon using (household = public.foyer_tag() and sent_at is null);

drop policy if exists foyer_meta_lire on public.foyer_meta;
create policy foyer_meta_lire on public.foyer_meta for select to anon using (k = 'vapid_public');

revoke all on public.foyer_push, public.foyer_rappel, public.foyer_meta from anon, authenticated;
grant select (endpoint), insert (endpoint, household, device), delete on public.foyer_push to anon;
-- household lisible : exigé par « on conflict » (la règle d'accès limite toujours aux lignes de son foyer).
grant select (household, rid, at, blob, sent_at), insert (household, rid, at, blob), delete on public.foyer_rappel to anon;
grant select (k, v) on public.foyer_meta to anon;

-- Fonctions réservées au serveur (rôle service) : clés VAPID, rappels arrivés à échéance, abonnements périmés.
create or replace function public.foyer_push_init(pub text, priv text) returns text
  language plpgsql security definer set search_path = ''
as $$
declare existing text;
begin
  select v into existing from public.foyer_meta where k = 'vapid_public';
  if existing is not null then return existing; end if;
  perform vault.create_secret(priv, 'foyer_vapid_private', 'Clé privée VAPID de Foyer');
  insert into public.foyer_meta (k, v) values ('vapid_public', pub);
  return pub;
end $$;

create or replace function public.foyer_push_due() returns json
  language plpgsql security definer set search_path = ''
as $$
declare result json;
begin
  delete from public.foyer_rappel where at < now() - interval '2 days';
  with due as (
    update public.foyer_rappel set sent_at = now()
    where sent_at is null and at <= now() + interval '1 minute' and at > now() - interval '3 hours'
    returning household
  )
  select json_build_object(
    'pub', (select v from public.foyer_meta where k = 'vapid_public'),
    'priv', (select decrypted_secret from vault.decrypted_secrets where name = 'foyer_vapid_private'),
    'endpoints', coalesce((select json_agg(distinct p.endpoint) from public.foyer_push p where p.household in (select household from due)), '[]'::json)
  ) into result;
  return result;
end $$;

create or replace function public.foyer_push_gone(endpoints text[]) returns void
  language sql security definer set search_path = ''
as $$ delete from public.foyer_push where endpoint = any(endpoints) $$;

revoke all on function public.foyer_push_init(text, text), public.foyer_push_due(), public.foyer_push_gone(text[]) from public, anon, authenticated;
grant execute on function public.foyer_push_init(text, text), public.foyer_push_due(), public.foyer_push_gone(text[]) to service_role;

-- Toutes les 5 minutes : la fonction foyer-push envoie les rappels arrivés à échéance.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.schedule('foyer-rappels', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://ogdglcoixadgixnjtwmf.supabase.co/functions/v1/foyer-push',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_tS8ihMgW6X1y4H6EkD-cuA_4hWlw7Fu"}'::jsonb,
    body := '{}'::jsonb)
$$);

-- Chaque nuit : historique des exécutions planifiées limité à 7 jours.
select cron.schedule('foyer-menage', '17 3 * * *', $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$);
