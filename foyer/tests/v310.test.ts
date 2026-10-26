// V3.10 : petit-déjeuner et placard (café, thé, sucre, lait, huile, sel…) suivis comme les produits de la maison, chacun dans son
// rayon ; une seule ligne quand une recette de la semaine demande aussi le produit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, MON } from './helpers.ts';
import { AISLE } from '../src/core/ingredients.ts';
import { productName } from '../src/core/invoice.ts';
import { RESTOCK, RESTOCK_DEF, GROUPS, estimate, restockFor, pairWithRecipes, restockFromInvoice } from '../src/core/restock.ts';

test('catalogue : petit-déjeuner et placard, rien d\'office, chaque produit dans un vrai rayon', () => {
  const food = RESTOCK.filter(d => d.group === 'petitdej' || d.group === 'placard');
  assert.ok(food.length >= 25);
  assert.ok(food.every(d => !d.on), 'café ou thé : au foyer de cocher');
  assert.ok(food.every(d => d.keys?.length), 'chaque aliment peut rejoindre la ligne d\'une recette');
  assert.ok(RESTOCK.every(d => !d.aisle || AISLE[d.aisle]));
  assert.deepEqual([...new Set(RESTOCK.map(d => d.group))].sort(), [...GROUPS].sort());
  assert.deepEqual(['cafe', 'sucre', 'lait', 'sel'].map(id => estimate(RESTOCK_DEF[id], 2)), [9, 50, 12, 80]);
});

test('lignes de la semaine : rayon du produit ; produit ajouté par le foyer : rayon deviné d\'après son nom', () => {
  const { a } = household();
  for (const id of ['cafe', 'lait', 'dentifrice']) a.emit({ t: 'restock.set', p: { id, on: true, day: MON } }, { t: 'restock.due', p: { id, due: MON, day: MON } });
  a.emit({ t: 'restock.set', p: { id: 'pavoine01', on: true, day: MON, name: 'Lait d\'avoine', days: 7 } }, { t: 'restock.due', p: { id: 'pavoine01', due: MON, day: MON } });
  const by = Object.fromEntries(restockFor(a.s, MON, MON, MON).map(l => [l.id, l.aisle]));
  assert.deepEqual(by, { cafe: 'sucre', lait: 'cremerie', dentifrice: 'maison', pavoine01: 'boissons' });
});

test('une seule ligne : le produit dû va avec la ligne de recette encore à acheter, l\'acheté avec la ligne cochée', () => {
  const r = (id: string, done: boolean) => ({ id, name: RESTOCK_DEF[id]?.name ?? id, qty: '', aisle: '', due: MON, last: null, rhythm: { days: 10, basis: 'estimation' as const, gaps: [] }, done, late: false });
  const lines = [{ key: 'sucre|masse', name: 'Sucre', done: false }, { key: 'lait|volume', name: 'Lait', done: false },
    { key: 'cafe moulu|masse', name: 'Café moulu', done: false }, { key: 'sucre glace|masse', name: 'Sucre glace', done: false }, { key: 'beurre|masse', name: 'Beurre', done: true }];
  const pair = pairWithRecipes([r('sucre', false), r('lait', true), r('cafe', false), r('beurre', true), r('dentifrice', false)], lines);
  assert.deepEqual(Object.fromEntries(pair), { sucre: 'sucre|masse', cafe: 'cafe moulu|masse', beurre: 'beurre|masse' });
  // lait acheté mais ligne de recette encore à prendre : deux choses différentes, pas de fusion ; sucre glace : un autre produit.
});

test('facture : les aliments se lisent en tête du nom, sans confusion (lait de coco, chocolat au lait, filtres à café, sel lave-vaisselle)', () => {
  const { a } = household();
  for (const id of ['lait', 'cafe', 'sucre', 'sel', 'beurre', 'jusorange', 'filtrescafe', 'sellv']) a.emit({ t: 'restock.set', p: { id, on: true, day: MON } });
  const read = (label: string): string[] => restockFromInvoice(a.s, [productName(label)]).sort();
  assert.deepEqual(read('AUCHAN Lait demi-écrémé UHT 1L'), ['lait']);
  assert.deepEqual(read('LAIT 1/2 ECREME UHT 6X1L'), ['lait']);
  assert.deepEqual(read('Lait de coco 40cl'), []);
  assert.deepEqual(read('Chocolat au lait 100g'), []);
  assert.deepEqual(read('Brioche au lait'), []);
  assert.deepEqual(read('Café moulu arabica 250g'), ['cafe']);
  assert.deepEqual(read('Capsules café x10'), ['cafe']);
  assert.deepEqual(read('Filtres à café n°4'), ['filtrescafe']);
  assert.deepEqual(read('Sucre en poudre 1kg'), ['sucre']);
  assert.deepEqual(read('Sucre glace 500g'), []);
  assert.deepEqual(read('Gros sel de Guérande 1kg'), ['sel']);
  assert.deepEqual(read('Sel lave-vaisselle 2kg'), ['sellv']);
  assert.deepEqual(read('Beurre doux 250g'), ['beurre']);
  assert.deepEqual(read('Beurre de cacahuète'), []);
  assert.deepEqual(read('Pur jus d\'orange 1L'), ['jusorange']);
});
