-- Relais de synchro Foyer : une boîte aux lettres de paquets déjà chiffrés sur les téléphones.
-- Le serveur ne voit ni plats, ni prénoms, ni dates : seulement une étiquette de foyer (dérivée du code du foyer,
-- qui ne quitte jamais les téléphones), un identifiant d'appareil et des blocs illisibles.
-- Lecture et écriture réservées à qui présente l'étiquette dans l'en-tête « x-foyer » (RLS). Ni modification ni suppression.

create table if not exists public.foyer_relais (
  seq        bigint generated always as identity primary key,
  household  text not null check (household ~ '^[0-9a-f]{64}$'),
  device     text not null check (device ~ '^[a-z0-9]{8,24}$'),
  blob       text not null check (length(blob) between 20 and 2000000),
  created_at timestamptz not null default now()
);
create index if not exists foyer_relais_household_seq on public.foyer_relais (household, seq);

alter table public.foyer_relais enable row level security;

create or replace function public.foyer_tag() returns text
  language sql stable
  set search_path = ''
as $$ select coalesce(current_setting('request.headers', true)::json ->> 'x-foyer', '') $$;

drop policy if exists foyer_relais_lire on public.foyer_relais;
create policy foyer_relais_lire on public.foyer_relais for select to anon using (household = public.foyer_tag());
drop policy if exists foyer_relais_ecrire on public.foyer_relais;
create policy foyer_relais_ecrire on public.foyer_relais for insert to anon with check (household = public.foyer_tag());

revoke all on public.foyer_relais from anon, authenticated;
grant select (seq, device, blob), insert (household, device, blob) on public.foyer_relais to anon;
grant execute on function public.foyer_tag() to anon;
