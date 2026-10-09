// Régénère produits.json : produits vendus chez Auchan (Open Food Facts, recherche « search-a-licious ») et leurs prix relevés (Open Prices).
// Bases ouvertes (ODbL), lues avec un User-Agent identifié et sans dépasser leurs quotas. Rien n'est lu sur auchan.fr.
// Lancer depuis foyer/ avec un accès réseau : node scripts/produits.mjs (la CI le fait chaque semaine : .github/workflows/prix.yml).
import { writeFileSync } from 'node:fs';
import { GROUP_DEFS, buildGroup } from '../src/core/products.ts';

const UA = 'Foyer/1.0 (https://github.com/julienchesneau1-arch/mes-comptes)';
const SEARCH = 'https://search.openfoodfacts.org/search';
const PRICES = 'https://prices.openfoodfacts.org/api/v1/prices';
const FIELDS = 'code,product_name,brands,quantity,nutriscore_grade,nova_group,labels_tags';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);

async function json(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (r.ok) return r.json();
    await sleep(4000 * attempt); // serveur chargé : on attend, poliment
  }
  throw new Error(`indisponible : ${url}`);
}

const groups = [], problems = [];
for (const d of GROUP_DEFS) {
  let hits = [], tag = '';
  for (const t of d.tags) {
    const q = `categories_tags:"${t}" AND stores:auchan AND countries_tags:"en:france"`;
    const j = await json(`${SEARCH}?${new URLSearchParams({ q, langs: 'fr', page_size: '40', sort_by: '-unique_scans_n', fields: FIELDS })}`);
    await sleep(1500);
    if (Array.isArray(j.hits) && j.hits.length) { hits = j.hits; tag = t; break; }
  }
  if (!hits.length) { problems.push(`${d.id} : aucun produit Auchan pour ${d.tags.join(', ')}`); continue; }
  const codes = hits.map(h => h.code).filter(c => typeof c === 'string' && /^\d{8,14}$/.test(c));
  const rows = [];
  for (let i = 0; i < codes.length; i += 40) {
    const j = await json(`${PRICES}?${new URLSearchParams({ product_code__in: codes.slice(i, i + 40).join(','), currency: 'EUR', date__gte: since, size: '100', order_by: '-date' })}`);
    if (Array.isArray(j.items)) rows.push(...j.items);
    await sleep(1500);
  }
  const g = buildGroup(d, tag, hits, rows);
  groups.push(g);
  console.log(`${d.id.padEnd(20)} ${tag.padEnd(28)} produits ${String(g.products.length).padStart(2)} · chiffrés ${g.products.filter(p => p.price).length}`);
}
for (const p of problems) console.log(`  écart : ${p}`);
if (groups.length < GROUP_DEFS.length * 0.6) { console.error(`trop peu de groupes (${groups.length}/${GROUP_DEFS.length}) : produits.json inchangé`); process.exit(1); }
writeFileSync(new URL('../produits.json', import.meta.url), `${JSON.stringify({
  source: 'Open Food Facts (produits vendus chez Auchan) et Open Prices (prix relevés)', license: 'ODbL, © contributeurs Open Food Facts',
  generated: new Date().toISOString().slice(0, 10), groups,
})}\n`);
console.log(`groupes : ${groups.length}/${GROUP_DEFS.length}`);
