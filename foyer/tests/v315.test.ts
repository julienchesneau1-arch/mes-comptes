// V3.15 : couverture des prix sans rien aspirer — nom d'achat d'un ingrédient (« oignon haché » s'achète comme des oignons),
// eau du robinet gratuite, nouveaux groupes Open Prices (catégories vérifiées par la CI), contenances des produits du quotidien,
// ticket de caisse « scanné » lu comme une facture, part payée (sûre) dite dans le budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyKeys, refFor, setRefPrices } from '../src/core/refprice.ts';
import { GROUP_DEFS, groupFor, setProducts } from '../src/core/products.ts';
import { isSeasoning } from '../src/core/budget.ts';
import { RESTOCK_DEF } from '../src/core/restock.ts';
import { parseSize } from '../src/core/drive.ts';
import { parseInvoice } from '../src/core/invoice.ts';

test('nom d\'achat : la préparation ne change pas ce qu\'on achète ; un jaune d\'œuf s\'achète comme un œuf', () => {
  assert.deepEqual(buyKeys('Oignon haché'), ['oignon hache', 'oignon']);
  assert.deepEqual(buyKeys('Comté râpé'), ['comte rape', 'comte']);
  assert.deepEqual(buyKeys('Ail écrasées'), ['ail ecrasee', 'ail']);
  assert.deepEqual(buyKeys('Oignon finement haché'), ['oignon finement hache', 'oignon']);
  assert.deepEqual(buyKeys('Vin blanc sec'), ['vin blanc sec', 'vin blanc']);
  assert.deepEqual(buyKeys('Carottes coupées en dés'), ['carotte coupee en des', 'carotte coupee', 'carotte']);
  assert.deepEqual(buyKeys('Jaunes d\'œufs'), ['jaune d\'oeuf', 'oeuf']);
  assert.deepEqual(buyKeys('Lait demi-écrémé'), ['lait demi-ecreme']);          // rien à retirer
  setRefPrices({ source: '', sourceUrl: '', license: '', weights: '', weightsUrl: '', generated: '', period: '2026-09',
    refs: [{ id: 'oignon', label: 'Oignons', keys: ['oignon'], per: 'kg', cents: 250, period: '2026-09', series: 'x', method: 'mesuré' }] });
  assert.equal(refFor('Oignon haché')?.id, 'oignon');
  assert.equal(refFor('Oignons émincés')?.id, 'oignon');
  assert.equal(refFor('Oignon de Roscoff'), null);                                 // pas de rapprochement hasardeux
  setRefPrices(null);
});

test('groupes : les mots-clés du code valent tout de suite, avant la régénération de produits.json', () => {
  const vin = GROUP_DEFS.find(g => g.id === 'vin');
  assert.ok(vin);
  setProducts({ source: '', license: '', generated: '2026-10-26', groups: [{ id: 'vin', label: 'Vin', keys: ['vin'], per: 'l', tag: 'en:wines', products: [], value: null, cheap: null, best: null }] as never });
  assert.equal(groupFor('Vin blanc sec')?.id, 'vin');                               // clé du code + nom d'achat
  assert.equal(groupFor('Vin rouge')?.id, 'vin');
  setProducts(null);
  assert.equal(new Set(GROUP_DEFS.map(g => g.id)).size, GROUP_DEFS.length);
  assert.ok(GROUP_DEFS.every(g => g.tags.length && g.tags.every(t => /^(?:en|fr):[a-z0-9-]+$/.test(t))));
});

test('gratuit ou négligeable : eau du robinet, bouquet garni, poivre du moulin ; pas l\'eau en bouteille', () => {
  for (const n of ['Eau', 'Eau tiède', 'Garni', 'Sel et poivre du moulin']) assert.equal(isSeasoning(n), true, n);
  for (const n of ['Eau gazeuse', 'Eau en bouteille', 'Vin blanc']) assert.equal(isSeasoning(n), false, n);
});

test('produits du quotidien : contenance reprise de l\'hypothèse écrite, lisible', () => {
  for (const [id, size] of [['confiture', '370 g'], ['miel', '500 g'], ['tartiner', '400 g'], ['cereales', '500 g'], ['vinaigre', '50 cl'], ['sirop', '75 cl'], ['sodas', '6 x 33 cl'], ['biscuits', '200 g'], ['moutarde', '200 g']] as const) {
    assert.equal(RESTOCK_DEF[id]?.size, size, id);
    assert.ok(parseSize(size), size);
  }
});

test('ticket de caisse scanné (texte fictif, format générique) : lignes, total vérifié, date ; quantité seule ignorée', () => {
  const r = parseInvoice(['MAGASIN EXEMPLE', '12/10/2026 18:42', 'LAIT 1/2 ECREME 1L        1,05', 'BEURRE DOUX 250G          2,39', '2 X 1,49',
    'YAOURT NATURE X8          2,98', 'POULET FILET 400G         6,49', 'TOTAL                    12,91', 'CB                       12,91']);
  assert.equal(r.day, '2026-10-12');
  assert.equal(r.total, 1291);
  assert.equal(r.sum, 1291);
  assert.deepEqual(r.lines.map(l => [l.label, l.cents]), [['LAIT 1/2 ECREME 1L', 105], ['BEURRE DOUX 250G', 239], ['YAOURT NATURE X8', 298], ['POULET FILET 400G', 649]]);
});
