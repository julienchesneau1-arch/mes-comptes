// V3.11 : desserts du quotidien, fruits à croquer, boissons, goûter ; drive complet (produits du quotidien dans la commande
// guidée) et panier estimé qui compte leurs achats (facture, prix noté, prix de référence rapporté à la contenance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, MON, CURRY } from './helpers.ts';
import { AISLE } from '../src/core/ingredients.ts';
import { productName } from '../src/core/invoice.ts';
import { setRefPrices } from '../src/core/refprice.ts';
import { deriveShopping } from '../src/core/shopping.ts';
import { cartEstimate, lineCost, restockCost } from '../src/core/budget.ts';
import { driveItems } from '../src/core/drive.ts';
import { RESTOCK, RESTOCK_DEF, restockFor, restockFromInvoice, pairWithRecipes } from '../src/core/restock.ts';

const follow = (ids: string[]) => {
  const { a } = household();
  for (const id of ids) a.emit({ t: 'restock.set', p: { id, on: true, day: MON } });
  return a;
};

test('desserts, fruits, boissons, goûter : rien d\'office, chaque produit dans un vrai rayon ; yaourts rangés en desserts', () => {
  const groups = ['desserts', 'fruits', 'boissons', 'gouter'];
  const added = RESTOCK.filter(d => groups.includes(d.group));
  assert.ok(added.length >= 20);
  assert.ok(added.every(d => !d.on && d.aisle && AISLE[d.aisle]));
  assert.equal(RESTOCK_DEF['yaourts']?.group, 'desserts');
  assert.equal(RESTOCK_DEF['glaces']?.aisle, 'surgeles');
  assert.equal(RESTOCK_DEF['pommes']?.aisle, 'fruits-legumes');
  assert.equal(new Set(RESTOCK.map(d => d.id)).size, RESTOCK.length);
});

test('facture : pommes ≠ pommes de terre, eau ≠ eau de Javel ni gazeuse, tablette ≠ chocolat en poudre, chips ≠ biscuits', () => {
  const a = follow(['pommes', 'eau', 'eaugazeuse', 'tablette', 'chocolat', 'biscuits', 'chips', 'fruitssecs', 'fruitsaison', 'sodas', 'compotes']);
  const read = (label: string): string[] => restockFromInvoice(a.s, [productName(label)]).sort();
  assert.deepEqual(read('Pommes Golden 1kg'), ['pommes']);
  assert.deepEqual(read('Pommes de terre 2,5kg'), []);
  assert.deepEqual(read('Eau minérale naturelle 6x1,5L'), ['eau']);
  assert.deepEqual(read('Eau gazeuse 6x1L'), ['eaugazeuse']);
  assert.deepEqual(read('Eau de Javel 2L'), []);
  assert.deepEqual(read('Chocolat noir 70% 100g'), ['tablette']);
  assert.deepEqual(read('Chocolat en poudre 400g'), ['chocolat']);
  assert.deepEqual(read('Biscuits apéritif 100g'), ['chips']);
  assert.deepEqual(read('Petits beurre 200g'), ['biscuits']);
  assert.deepEqual(read('Raisins secs 250g'), ['fruitssecs']);
  assert.deepEqual(read('Raisin blanc 500g'), ['fruitsaison']);
  assert.deepEqual(read('COCA-COLA Soda au cola 6x33cl'), ['sodas']);                                   // la marque en capitales s'efface
  assert.deepEqual(read('Compote pomme 4x100g'), ['compotes']);
});

test('prix d\'un achat : facture rapportée à la contenance, au poids, un par personne, prix noté ; sinon rien', () => {
  const a = follow(['lait', 'dentifrice', 'brosseadents', 'pommes', 'cafe', 'sucre', 'gelwc']);
  a.emit({ t: 'price.paid', p: { key: 'lait', label: 'Lait demi-écrémé UHT 1L', cents: 105, size: '1', unit: 'l', loose: false, day: '2026-10-03' } },
    { t: 'price.paid', p: { key: 'dentifrice', label: 'Dentifrice 75ml', cents: 215, size: '75', unit: 'ml', loose: false, day: '2026-10-03' } },
    { t: 'price.paid', p: { key: 'brosse a dent', label: 'Brosse à dents souple', cents: 250, size: null, unit: null, loose: false, day: '2026-10-03' } },
    { t: 'price.paid', p: { key: 'pomme', label: 'Pommes Golden vrac', cents: 249, size: '1', unit: 'kg', loose: true, day: '2026-10-03' } },
    { t: 'product.set', p: { key: 'cafe', url: 'https://www.auchan.fr/cafe-moulu/pr-C1234', label: 'Café moulu', size: '250', unit: 'g', price: 399 } });
  assert.deepEqual([restockCost(a.s, 'lait')?.cents, restockCost(a.s, 'lait')?.how], [630, 'facture']);   // pack de 6 L : 6 briques
  assert.equal(restockCost(a.s, 'dentifrice')?.cents, 215);                                              // contenance du produit inconnue : un article
  assert.equal(restockCost(a.s, 'brosseadents')?.cents, 500);                                            // une par personne, deux personnes
  assert.equal(restockCost(a.s, 'pommes')?.cents, 249);                                                  // au kg, 1 kg
  assert.deepEqual([restockCost(a.s, 'cafe')?.cents, restockCost(a.s, 'cafe')?.how], [399, 'noté']);
  assert.equal(restockCost(a.s, 'gelwc'), null);                                                        // aucune source : rien d'inventé
  setRefPrices({ source: '', sourceUrl: '', license: '', weights: '', weightsUrl: '', generated: '', period: '2026-08',
    refs: [{ id: 'sucre', label: 'Sucre', keys: ['sucre'], per: 'kg', cents: 129, period: '2026-08', series: 'x', method: 'mesuré' }] });
  assert.deepEqual([restockCost(a.s, 'sucre')?.cents, restockCost(a.s, 'sucre')?.how], [129, 'référence']); // prix moyen Insee × 1 kg
  setRefPrices(null);
});

test('panier estimé et commande guidée : produits du quotidien comptés et commandés ; la ligne d\'une recette commande le paquet', () => {
  const a = follow(['lait', 'dentifrice', 'gelwc']);
  for (const id of ['lait', 'dentifrice', 'gelwc']) a.emit({ t: 'restock.due', p: { id, due: MON, day: MON } });
  a.emit({ t: 'recipe.save', p: { recipe: 'gratin', content: { ...CURRY, name: 'Gratin', ingredients: [...CURRY.ingredients, { name: 'Lait', qty: '50', unit: 'cl', form: null, note: '' }] } } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'pgratin', recipe: 'gratin', extra: 0 } },
    { t: 'price.paid', p: { key: 'lait', label: 'Lait demi-écrémé UHT 1L', cents: 105, size: '1', unit: 'l', loose: false, day: '2026-10-03' } },
    { t: 'price.paid', p: { key: 'dentifrice', label: 'Dentifrice 75ml', cents: 215, size: '75', unit: 'ml', loose: false, day: '2026-10-03' } });
  const list = deriveShopping(a.s, MON), rs = restockFor(a.s, MON, MON, MON), pair = pairWithRecipes(rs, list.lines);
  const byLine = new Map([...pair].map(([id, key]) => [key, rs.find(r => r.id === id)!]));
  const part = { todo: rs.filter(r => !r.done && !pair.has(r.id)), byLine };
  assert.deepEqual(part.todo.map(r => r.id).sort(), ['dentifrice', 'gelwc']);
  const without = cartEstimate(a.s, list), withR = cartEstimate(a.s, list, part);
  const milk0 = lineCost(a.s, list.lines.find(l => l.name === 'Lait')!)?.cents ?? 0;
  assert.equal(milk0, 105);                                                                             // la recette seule : une brique
  assert.equal(withR.cents, without.cents - milk0 + 630 + 215);                                         // le pack de lait au lieu d'une brique, + dentifrice
  assert.equal(withR.unpriced, without.unpriced + 1);                                                   // nettoyant WC : prix inconnu, dit
  assert.deepEqual([withR.perPortion, withR.reliable], [without.perPortion, without.reliable]);        // par portion : les recettes seules
  const items = driveItems(a.s, list, part), milk = items.find(i => i.name === 'Lait');
  assert.ok(milk?.qty.startsWith('6 briques d\'1 L (réserve du quotidien, dont'), milk?.qty);
  assert.equal(milk?.restock, 'lait');
  assert.deepEqual(items.filter(i => i.id.startsWith('r:')).map(i => [i.name, i.restock]), [['Dentifrice', 'dentifrice'], ['Nettoyant WC', 'gelwc']]);
});
