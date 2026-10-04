// Fonction Supabase (Deno) : lit un agenda (adresse iCal secrète ou publique) et renvoie seulement les événements du mois.
// Le navigateur ne peut pas lire un agenda Google ou iCloud directement (CORS) : c'est la seule raison d'être de ce serveur.
// Rien n'est enregistré ni journalisé ; seuls les fournisseurs d'agenda connus sont contactés (jamais une adresse arbitraire).
import { readCalendar } from './ical.ts';
import { isDate, daysBetween } from './dates.ts';

const ORIGINS = ['https://julienchesneau1-arch.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const PUBLISHABLE = 'sb_publishable_tS8ihMgW6X1y4H6EkD-cuA_4hWlw7Fu';
const MAX = 12_000_000;
// Google Agenda, iCloud (calendrier public), Outlook / Microsoft 365, Proton, Yahoo.
export const AGENDA_HOST = /^(calendar\.google\.com|p\d{1,3}-(caldav|calendars|calendarws)\.icloud\.com|outlook\.(live|office365|office)\.com|calendar\.proton\.me|export\.calendar\.yahoo\.com)$/;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0] as string, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const allowed = (u: URL): boolean => u.protocol === 'https:' && !u.username && !u.password && !u.port && AGENDA_HOST.test(u.hostname.toLowerCase());

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Méthode non autorisée' }, 405);
  if (req.headers.get('apikey') !== PUBLISHABLE) return json(req, { error: 'Clé absente' }, 401);
  let body: { url?: unknown; from?: unknown; to?: unknown; cal?: unknown };
  try { body = await req.json(); } catch { return json(req, { error: 'Demande illisible' }, 400); }
  const { from, to, cal } = body;
  if (!isDate(from) || !isDate(to) || daysBetween(from, to) < 0 || daysBetween(from, to) > 62 || typeof cal !== 'string' || !/^[a-z0-9]{2,24}$/.test(cal)) return json(req, { error: 'Période ou agenda invalide' }, 400);
  let url: URL;
  try { url = new URL(String(body.url ?? '').trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return json(req, { error: 'Adresse invalide' }, 400); }
  if (!allowed(url)) return json(req, { error: 'Adresse non reconnue : Google Agenda, iCloud, Outlook, Proton ou Yahoo seulement' }, 400);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) { // redirections suivies une à une, chaque adresse revérifiée
      res = await fetch(url, { signal: ctrl.signal, redirect: 'manual', headers: { 'User-Agent': 'Foyer/1.0 (agenda)', 'Accept': 'text/calendar, text/plain;q=0.5' } });
      const loc = res.headers.get('location');
      if (res.status < 300 || res.status >= 400 || !loc) break;
      await res.body?.cancel();
      url = new URL(loc, url);
      if (!allowed(url)) return json(req, { error: 'L\'agenda renvoie vers une adresse non reconnue' }, 502);
    }
    if (!res || res.status === 404 || res.status === 410) return json(req, { error: 'Agenda introuvable : l\'adresse a peut-être été réinitialisée' }, 404);
    if (res.status === 401 || res.status === 403) return json(req, { error: 'Accès refusé par le fournisseur : adresse secrète ou calendrier public à vérifier' }, 403);
    if (!res.ok || !res.body) return json(req, { error: `Le fournisseur répond ${res.status}` }, 502);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      size += value.length;
      if (size > MAX) { await reader.cancel(); return json(req, { error: 'Agenda trop volumineux (plus de 12 Mo)' }, 413); }
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.length; }
    const r = readCalendar(new TextDecoder().decode(all), from, to, cal);
    if (!r.events && r.skipped.length) return json(req, { error: 'Ce lien ne renvoie pas un agenda (page de connexion ?)' }, 422);
    return json(req, { occurrences: r.occurrences, events: r.events, skipped: r.skipped.slice(0, 20), bytes: size });
  } catch (e) {
    return json(req, { error: e instanceof DOMException && e.name === 'AbortError' ? 'L\'agenda met trop de temps à répondre' : 'Agenda inaccessible' }, 502);
  } finally { clearTimeout(timer); }
});
