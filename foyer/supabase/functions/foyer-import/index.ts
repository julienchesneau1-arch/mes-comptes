// Fonction Supabase (Deno) : télécharge une page de recette et en extrait les données schema.org « Recipe ».
// Le navigateur ne peut pas lire une page d'un autre site (CORS) : c'est la seule raison d'être de ce serveur.
// Ne renvoie que la recette extraite (jamais la page), refuse les adresses locales, limite taille et durée.
import { extractRecipe } from './recipe-web.ts';

const ORIGINS = ['https://julienchesneau1-arch.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const MAX = 3_000_000;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0] as string, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' } });

// Pas d'adresse IP brute ni de nom local : on ne sert pas de passerelle vers un réseau interne.
const forbidden = (h: string): boolean => h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^[\d.]+$/.test(h) || h.includes(':') || !h.includes('.');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Méthode non autorisée' }, 405);
  let url: URL;
  try { url = new URL(String((await req.json()).url ?? '')); } catch { return json(req, { error: 'Adresse invalide' }, 400); }
  if (!/^https?:$/.test(url.protocol) || forbidden(url.hostname.toLowerCase())) return json(req, { error: 'Adresse non autorisée' }, 400);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FoyerImport/1.0)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
    if (!res.ok || !res.body) return json(req, { error: `La page répond ${res.status}` }, 502);
    if (!/html/i.test(res.headers.get('content-type') ?? 'text/html')) return json(req, { error: 'Ce n\'est pas une page web' }, 415);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      size += value.length;
      if (size > MAX) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const html = new TextDecoder().decode(chunks.reduce((a, c) => { const n = new Uint8Array(a.length + c.length); n.set(a); n.set(c, a.length); return n; }, new Uint8Array()));
    const r = extractRecipe(html, url.href);
    return r ? json(req, r) : json(req, { error: 'Aucune recette lisible sur cette page (pas de données schema.org)' }, 422);
  } catch (e) {
    return json(req, { error: e instanceof DOMException && e.name === 'AbortError' ? 'La page met trop de temps à répondre' : 'Page inaccessible' }, 502);
  } finally { clearTimeout(timer); }
});
