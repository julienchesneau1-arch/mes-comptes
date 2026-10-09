// Régénère prix.json : prix moyens de vente au détail publiés chaque mois par l'Insee (Banque de données macro-économiques, SDMX, accès libre).
// Lancer depuis foyer/ avec un accès réseau : node scripts/prix.mjs (la CI le fait chaque mois : .github/workflows/prix.yml).
// Hors réseau : node scripts/prix.mjs --from <dossier contenant prix.xml et indices.xml>.
import { readFileSync, writeFileSync } from 'node:fs';
import { REF_DEFS, buildRefPrices } from '../src/core/refprice.ts';

const BDM = 'https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/';
const from = process.argv.indexOf('--from');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(ids) {
  const url = `${BDM}${[...new Set(ids)].join('+')}?startPeriod=2019-01`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(url, { headers: { Accept: 'application/xml', 'User-Agent': 'FoyerPrix/1.0 (https://github.com/julienchesneau1-arch/mes-comptes)' } });
    if (r.ok) return r.text();
    await sleep(3000 * attempt);
  }
  throw new Error(`Insee indisponible : ${url}`);
}

const prices = from > 0 ? readFileSync(`${process.argv[from + 1]}/prix.xml`, 'utf8') : await get(REF_DEFS.map(d => d.series));
const indices = from > 0 ? readFileSync(`${process.argv[from + 1]}/indices.xml`, 'utf8') : await get(REF_DEFS.flatMap(d => (d.index ? [d.index] : [])));
const { data, problems } = buildRefPrices(prices, indices, new Date().toISOString().slice(0, 10));
for (const p of problems) console.log(`  écart : ${p}`);
// Garde-fou : une réponse Insee anormale ne doit pas vider la table publiée.
if (data.refs.length < REF_DEFS.length * 0.8) { console.error(`trop peu de prix (${data.refs.length}/${REF_DEFS.length}) : prix.json inchangé`); process.exit(1); }
writeFileSync(new URL('../prix.json', import.meta.url), `${JSON.stringify(data, null, 1)}\n`);
console.log(`prix de référence : ${data.refs.length}/${REF_DEFS.length} · relevés de ${data.period}`);
