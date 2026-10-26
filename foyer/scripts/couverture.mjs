// Couverture des prix (sans réseau) : part des ingrédients des 424 recettes prêtes et des produits du quotidien qui ont une source de
// prix sans facture — relevé Open Prices (produit conseillé chiffré, produits.json) ou prix moyen Insee (prix.json) — et les
// ingrédients sans prix les plus fréquents (à couvrir en priorité). Sel, poivre et épices exclus, comme dans le panier.
// Lancer depuis foyer/ : node scripts/couverture.mjs [nombre de manques à lister, 30 par défaut]
import { readFileSync } from 'node:fs';
import { setRefPrices, refFor } from '../src/core/refprice.ts';
import { setProducts, groupFor, productOf } from '../src/core/products.ts';
import { parseIngredient } from '../src/core/ingredients.ts';
import { isSeasoning } from '../src/core/budget.ts';
import { RESTOCK } from '../src/core/restock.ts';
import { restockCost } from '../src/core/budget.ts';
import { emptyState } from '../src/core/model.ts';
import { nameKey } from '../src/core/text.ts';

const read = f => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
setRefPrices(read('prix.json'));
setProducts(read('produits.json'));
const source = name => {
  const g = groupFor(name), adv = g ? productOf(g, g.value ?? g.cheap) : null;
  return adv?.price ? 'relevé' : refFor(name) ? 'Insee' : null;
};
const tally = (names) => {
  const n = { relevé: 0, Insee: 0, aucun: 0 }, missing = new Map();
  for (const name of names) {
    if (isSeasoning(name) || !/\p{L}{2}/u.test(name)) continue; // assaisonnements, eau ; « 1 », « 2 » : lignes mal lues du catalogue
    const s = source(name);
    if (s) n[s]++; else { n.aucun++; const k = nameKey(name); missing.set(k, (missing.get(k) ?? 0) + 1); }
  }
  const all = n.relevé + n.Insee + n.aucun;
  return { n, all, pct: all ? Math.round(100 * (n.relevé + n.Insee) / all) : 0, missing: [...missing].sort((a, b) => b[1] - a[1]) };
};
const lines = read('catalogue.json').recipes.flatMap(r => r.ingredients.map(t => parseIngredient(t).line?.name).filter(Boolean));
const rec = tally(lines);
// Produits du quotidien : la vraie fonction de prix (nom, mots-clés, contenance), sans facture ni prix noté.
const st = emptyState(), daily = { n: { relevé: 0, Insee: 0, aucun: 0 }, missing: [] };
for (const d of RESTOCK) { const c = restockCost(st, d.id); if (c?.how === 'relevé') daily.n.relevé++; else if (c?.how === 'référence') daily.n.Insee++; else { daily.n.aucun++; daily.missing.push([nameKey(d.name), 1]); } }
daily.all = RESTOCK.length; daily.pct = Math.round(100 * (daily.n.relevé + daily.n.Insee) / daily.all);
const top = Number(process.argv[2] ?? 30);
console.log(`recettes prêtes : ${rec.pct} % des lignes d'ingrédients chiffrées (${rec.n.relevé} relevé, ${rec.n.Insee} Insee, ${rec.n.aucun} sans prix, sur ${rec.all})`);
console.log(`produits du quotidien : ${daily.pct} % chiffrés (${daily.n.relevé} relevé, ${daily.n.Insee} Insee, ${daily.n.aucun} sans prix, sur ${daily.all})`);
console.log(`ingrédients sans prix les plus fréquents : ${rec.missing.slice(0, top).map(([k, n]) => `${k} (${n})`).join(', ')}`);
console.log(`produits du quotidien sans prix : ${daily.missing.map(([k]) => k).join(', ')}`);
