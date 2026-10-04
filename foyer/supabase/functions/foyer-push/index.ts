// Fonction Supabase (Deno) : envoie les rappels Foyer arrivés à échéance, en notifications VIDES (Web Push + VAPID).
// Appelée toutes les 5 minutes par pg_cron, et par l'app pour connaître la clé publique VAPID (créée au premier appel).
// Le contenu des rappels reste chiffré en base : le téléphone le relit et le déchiffre lui-même.
import { PUSH_HOST, newKeys, signingKey, vapidJwt, pushHeaders } from './vapid.ts';

const ORIGINS = ['https://julienchesneau1-arch.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const PUBLISHABLE = 'sb_publishable_tS8ihMgW6X1y4H6EkD-cuA_4hWlw7Fu';
const SUB = 'https://julienchesneau1-arch.github.io/mes-comptes/foyer/';
const BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0] as string, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' } });
const rpc = (name: string, body: unknown) => fetch(`${BASE}/rest/v1/rpc/${name}`, { method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Méthode non autorisée' }, 405);
  if (req.headers.get('apikey') !== PUBLISHABLE) return json(req, { error: 'Clé absente' }, 401);
  if (!BASE || !SERVICE) return json(req, { error: 'Configuration serveur incomplète' }, 500);
  const r = await rpc('foyer_push_due', {});
  if (!r.ok) return json(req, { error: `Base indisponible (${r.status})` }, 502);
  const due = (await r.json()) as { pub: string | null; priv: string | null; endpoints: string[] };
  if (!due.pub || !due.priv) {
    // Premier appel : paire de clés VAPID créée ici, la privée part au coffre sans jamais quitter le serveur.
    const k = await newKeys();
    const init = await rpc('foyer_push_init', { pub: k.pub, priv: k.priv });
    return init.ok ? json(req, { pub: await init.json(), sent: 0 }) : json(req, { error: 'Clés de notification indisponibles' }, 502);
  }
  const key = await signingKey(due.priv);
  const gone: string[] = [];
  const status: Record<string, number> = {};
  let sent = 0;
  for (const ep of due.endpoints) {
    if (!PUSH_HOST.test(ep)) continue;
    try {
      const res = await fetch(ep, { method: 'POST', headers: pushHeaders(await vapidJwt(ep, key, SUB), due.pub) });
      status[res.status] = (status[res.status] ?? 0) + 1;
      if (res.ok) sent++;
      if (res.status === 404 || res.status === 410) gone.push(ep); // abonnement périmé : retiré
    } catch { status['réseau'] = (status['réseau'] ?? 0) + 1; }
  }
  if (gone.length) await rpc('foyer_push_gone', { endpoints: gone });
  return json(req, { pub: due.pub, sent, gone: gone.length, status });
});
