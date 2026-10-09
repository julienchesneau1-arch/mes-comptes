// Rien à saisir : prix moyens Insee, étude qualité-prix (Open Food Facts + Open Prices), panier qui suit le menu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, MON, NOW } from './helpers.ts';
import { validEvent } from '../src/core/model.ts';
import { parseSdmx, titleUnit, buildRefPrices, setRefPrices, refFor, refCost } from '../src/core/refprice.ts';
import { quality, packAmount, toProduct, picks, buildGroup, setProducts, GROUP_DEFS, type Product } from '../src/core/products.ts';
import { cartEstimate, lineCost, isSeasoning } from '../src/core/budget.ts';
import { deriveShopping, checkSig } from '../src/core/shopping.ts';
import { cartChanges } from '../src/core/drive.ts';
import { q } from '../src/core/rational.ts';

const series = (id: string, title: string, obs: [string, string][]): string =>
  `<Series IDBANK="${id}" FREQ="M" TITLE_FR="${title}">${obs.map(([t, v]) => `<Obs TIME_PERIOD="${t}" OBS_VALUE="${v}" OBS_STATUS="A"/>`).join('')}</Series>`;
const PRICES = `<message:DataSet>${series('000641429', 'Prix moyens mensuels de vente au détail en métropole - Tomates (1 kg)', [['2026-07', '4.10'], ['2026-08', '4.26']])}
${series('000442490', 'Prix moyens mensuels de vente au détail en métropole - Beurre extra fin (250 g) - Série arrêtée', [['2019-11', '2.18'], ['2019-12', '2.2']])}
${series('000442470', 'Prix moyens mensuels de vente au détail en métropole - Thon au naturel en boite (160 g) - Série arrêtée', [['2020-02', '2.05'], ['2020-07', 'NaN']])}</message:DataSet>`;
const INDICES = `${series('011814941', 'Indice - Beurre', [['2019-12', '80.00'], ['2026-08', '109.60']])}${series('011814826', 'Indice - Poisson', [['2020-02', '90'], ['2026-08', '108']])}`;

test('Insee : lecture SDMX, unité du titre, valeurs non numériques écartées', () => {
  const m = parseSdmx(PRICES);
  assert.deepEqual(m.get('000442470')?.obs, [['2020-02', 2.05]]);           // « NaN » ignoré
  assert.deepEqual(titleUnit('… Tomates (1 kg)'), { per: 'kg', size: 1 });
  assert.deepEqual(titleUnit('… Beurre extra fin (250 g)'), { per: 'kg', size: 0.25 });
  assert.deepEqual(titleUnit('… Avocat (pièce)'), { per: 'piece', size: 1 });
  assert.deepEqual(titleUnit('… Huile (1 litre)'), { per: 'l', size: 1 });
});

test('Insee : prix mesuré au kg, prix arrêté actualisé par l\'indice de sa famille, garde-fou sur le titre', () => {
  const { data, problems } = buildRefPrices(PRICES, INDICES, '2026-10-09');
  const tomate = data.refs.find(r => r.id === 'tomate'), beurre = data.refs.find(r => r.id === 'beurre'), thon = data.refs.find(r => r.id === 'thon');
  assert.deepEqual([tomate?.cents, tomate?.per, tomate?.period, tomate?.method], [426, 'kg', '2026-08', 'mesuré']);
  assert.equal(beurre?.cents, Math.round(220 * (109.6 / 80) / 0.25));        // 2,20 € les 250 g en 2019 × 1,37 → 12,06 € le kg
  assert.equal(beurre?.method, 'actualisé');
  assert.deepEqual(beurre?.base, { period: '2019-12', cents: 880, index: '011814941' });
  assert.equal(thon?.base?.period, '2020-02');                                 // dernier relevé chiffré
  assert.ok(problems.some(p => p.startsWith('oignon')));                       // série absente du test : signalée, pas inventée
  assert.equal(data.period, '2026-08');
});

test('coût de référence : au poids, au volume, à la pièce, pièce pesée (USDA) ; sinon rien', () => {
  const { data } = buildRefPrices(PRICES.replace('</message:DataSet>', `${series('000641427', 'Prix moyens mensuels de vente au détail en métropole - Oignons (1 kg)', [['2026-08', '2.85']])}</message:DataSet>`), INDICES, '2026-10-09');
  setRefPrices(data);
  const tomate = refFor('Tomates bien mûres'), oignon = refFor('Oignon jaune');
  assert.ok(tomate && oignon);
  assert.equal(refCost(tomate, 'masse', q(500)), 213);                         // 0,5 kg × 4,26 €
  assert.equal(refCost(oignon, 'piece', q(3, 2)), Math.round(285 * 2 * 110 / 1000)); // 2 oignons entiers de 110 g
  assert.equal(refCost(tomate, 'cs', q(2)), null);                             // cuillères : pas de conversion inventée
  assert.equal(refFor('Lardons'), null);
  setRefPrices(null);
});

test('assaisonnements hors calcul ; panier chiffré sans aucune saisie', () => {
  assert.ok(isSeasoning('Sel') && isSeasoning('Sel, laurier, thym, romarin') && isSeasoning('Noix de muscade râpée'.replace(' râpée', '')));
  assert.ok(!isSeasoning('Noix') && !isSeasoning('Tomates'));
  setRefPrices(buildRefPrices(PRICES, INDICES, '2026-10-09').data);
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'salade01', content: content('Salade', 2, ['500 g de tomates', '50 g de beurre', 'sel', '200 g de lardons']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepsal1', recipe: 'salade01', extra: 0 } });
  const cart = cartEstimate(a.s, deriveShopping(a.s, MON));
  assert.equal(cart.seasonings, 1);
  assert.equal(cart.priced, 2);                                                // tomates + beurre
  assert.equal(cart.unpriced, 1);                                              // lardons : aucune série, compté non chiffré
  assert.equal(cart.cents, 213 + Math.round(1206 * 50 / 1000));
  assert.equal(cart.reliable, false);                                          // 2 sur 3 : pas de coût par portion
  setRefPrices(null);
});

// Données réelles relevées le 9 octobre 2026 (Open Food Facts « search-a-licious » + Open Prices), réduites à 3 produits.
const HITS = [
  { code: '3155251205548', product_name: 'Crème fraîche gastronomique', brands: ['Président'], quantity: '45 cl', nutriscore_grade: 'd', nova_group: 3, labels_tags: ['en:french-milk'] },
  { code: '3254550014704', product_name: 'Crème fraiche d’Isigny', brands: ['isigny sainte mère'], quantity: '20cl', nutriscore_grade: 'd', nova_group: 1, labels_tags: ['en:pdo'] },
  { code: '3596710420919', product_name: 'Crème entière épaisse30% Mat. Gr.', brands: ['Auchan'], quantity: '0.2 l', nutriscore_grade: 'd', nova_group: 3, labels_tags: ['en:french-milk'] },
];
const at = (brand: string) => ({ osm_brand: brand, osm_name: brand, osm_address_country_code: 'FR' });
const ROWS = [
  { product_code: '3254550014704', price: 2.07, date: '2026-09-30', currency: 'EUR', location: at('Intermarché') },
  { product_code: '3254550014704', price: 1.98, date: '2026-09-02', currency: 'EUR', location: at('E.Leclerc') },
  { product_code: '3596710420919', price: 0.96, date: '2026-04-03', currency: 'EUR', location: at('Auchan') },
  { product_code: '3596710420919', price: 0.99, date: '2026-05-01', currency: 'EUR', location: at('Carrefour') },
  { product_code: '3155251205548', price: 2.27, date: '2026-03-27', currency: 'EUR', location: at('E.Leclerc') },
  { product_code: '3155251205548', price: 9.99, date: '2026-03-28', currency: 'USD', location: at('E.Leclerc') },   // autre devise : ignoré
];

test('qualité : Nutri-Score, NOVA et labels comptés par règles fixes ; contenance lue sans deviner', () => {
  assert.deepEqual(quality('d', 1, ['en:pdo', 'en:organic']), { score: -1 + 2 + 1 + 1, why: ['Nutri-Score D', 'NOVA 1 (brut)', 'bio', 'AOP/IGP'], labels: ['bio', 'aop-igp'] });
  assert.equal(packAmount('45 cl', 'l'), 450);
  assert.equal(packAmount('200 g (20 cl)', 'kg'), 200);
  assert.equal(packAmount('4 x 125 g', 'kg'), 500);
  assert.equal(packAmount('6 œufs', 'piece'), 6);
  assert.equal(packAmount('x12', 'piece'), 12);
  assert.equal(packAmount('45 cl', 'kg'), null);                               // volume demandé au poids : rien
});

test('prix d\'un produit : relevé Auchan d\'abord, sinon médiane récente ; meilleur rapport qualité-prix', () => {
  const ps = HITS.map(h => toProduct(h, 'l', ROWS)) as Product[];
  const [president, isigny, auchan] = ps;
  assert.deepEqual(auchan?.price, { cents: 96, perCents: 480, date: '2026-04-03', where: 'Auchan', auchan: true, n: 2 });
  assert.equal(isigny?.price?.perCents, 1035);                                 // médiane des 2 relevés (2,07 € les 20 cl)
  assert.equal(president?.price?.n, 1);                                        // relevé en dollars écarté
  const p = picks(ps);
  assert.equal(p.cheap, '3596710420919');                                      // 4,80 €/l
  assert.equal(p.best, '3254550014704');                                       // NOVA 1 + AOP
  assert.equal(p.value, '3596710420919');                                      // Isigny : +3 points mais 116 % plus cher (15 points de prix)
  const g = buildGroup(GROUP_DEFS.find(d => d.id === 'creme')!, 'fr:cremes-fraiches', HITS, ROWS);
  assert.equal(g.value, '3596710420919');
  assert.equal(g.products.length, 3);
});

test('le panier estimé prend le prix relevé du produit conseillé avant la moyenne Insee', () => {
  setProducts({ source: '', license: '', generated: '2026-10-09', groups: [buildGroup(GROUP_DEFS.find(d => d.id === 'creme')!, 'fr:cremes-fraiches', HITS, ROWS)] });
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'gratin01', content: content('Gratin', 4, ['40 cl de crème fraîche']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepgra1', recipe: 'gratin01', extra: 0 } });
  const l = deriveShopping(a.s, MON).lines.find(x => x.name === 'Crème fraîche')!;
  const c = lineCost(a.s, l);
  assert.equal(c?.how, 'relevé');
  assert.equal(c?.cents, Math.round(480 * 200 / 1000));                        // 2 portions sur 4 : 20 cl à 4,80 €/l
  setProducts(null);
});

test('le panier suit le menu : à ajouter, en trop, plus au menu', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: content('Curry', 2, ['600 g de poulet', '300 g de riz']) } },
    { t: 'recipe.save', p: { recipe: 'soupe001', content: content('Soupe', 2, ['1 kg de carottes']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepcur1', recipe: 'curry001', extra: 0 } },
    { t: 'slot.cook', p: { slot: '2026-10-06|soir', prep: 'prepsou1', recipe: 'soupe001', extra: 0 } });
  const list = deriveShopping(a.s, MON);
  a.emit(...list.lines.map(l => ({ t: 'shop.check' as const, p: { week: MON, key: l.key, needAt: checkSig(l), name: l.name } })));
  assert.deepEqual(cartChanges(a.s, deriveShopping(a.s, MON)), []);           // tout au panier, rien n'a bougé
  a.emit({ t: 'slot.presence', p: { slot: `${MON}|soir`, member: 'm2', presence: 'dehors' } }, // le curry passe de 2 à 1 portion
    { t: 'slot.clear', p: { slot: '2026-10-06|soir' } },                                    // la soupe quitte le menu
    { t: 'prep.extra', p: { prep: 'prepcur1', extra: 2 } });                                // puis 2 portions de plus : 3 au total
  const ch = cartChanges(a.s, deriveShopping(a.s, MON));
  assert.deepEqual(ch.map(c => [c.name, c.kind, c.qty]).sort(), [['Carottes', 'retire', '1 kg'], ['Poulet', 'plus', '300 g'], ['Riz', 'plus', '150 g']].sort());
  a.emit({ t: 'prep.extra', p: { prep: 'prepcur1', extra: 0 } });                          // finalement 1 portion : 300 g de poulet en trop
  assert.deepEqual(cartChanges(a.s, deriveShopping(a.s, MON)).filter(c => c.name === 'Poulet').map(c => [c.kind, c.qty]), [['moins', '300 g']]);
  const ev = (p: unknown) => validEvent({ id: 'evt00001', lc: 1, dev: 'deva0001', by: null, at: NOW.toISOString(), t: 'shop.check', p });
  assert.ok(ev({ week: MON, key: 'poulet|masse', needAt: '600', name: 'Poulet' }));
  assert.equal(ev({ week: MON, key: 'poulet|masse', needAt: '600', name: 'x'.repeat(81) }), null);
});

test('à l\'unité : ce qui a été arrondi à l\'achat couvre une petite hausse', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'soupe002', content: content('Soupe', 8, ['5 oignons']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepsou2', recipe: 'soupe002', extra: 0 } });          // 2 portions : 1,25 oignon → 2 achetés
  const l = deriveShopping(a.s, MON).lines[0]!;
  a.emit({ t: 'shop.check', p: { week: MON, key: l.key, needAt: checkSig(l), name: l.name } });
  a.emit({ t: 'prep.extra', p: { prep: 'prepsou2', extra: 1 } });                                             // 3 portions : 1,875 → toujours 2
  assert.equal(deriveShopping(a.s, MON).lines[0]?.done, true);
  assert.deepEqual(cartChanges(a.s, deriveShopping(a.s, MON)), []);
  a.emit({ t: 'prep.extra', p: { prep: 'prepsou2', extra: 2 } });                                             // 4 portions : 2,5 → 3 : un de plus
  assert.deepEqual(cartChanges(a.s, deriveShopping(a.s, MON)).map(c => [c.kind, c.qty]), [['plus', '1 pièce']]);
});

test('qualité-prix : le nom du produit doit correspondre au groupe (catégories Open Food Facts trop larges)', () => {
  const sucre = GROUP_DEFS.find(d => d.id === 'sucre')!, sauce = GROUP_DEFS.find(d => d.id === 'sauce-tomate')!;
  const h = (code: string, product_name: string) => ({ code, product_name, quantity: '1 kg', nutriscore_grade: 'a', nova_group: 1, labels_tags: [] });
  const g = buildGroup(sucre, 'en:sugars', [h('3000000000001', 'Compote Pomme Vanille Sans Sucres Ajoutés'), h('3000000000002', 'Sucre en poudre')], []);
  assert.deepEqual(g.products.map(p => p.name), ['Sucre en poudre']);
  assert.deepEqual(buildGroup(sauce, 'en:tomato-sauces', [h('3000000000003', 'Ketchup'), h('3000000000004', 'Coulis de tomates')], []).products.map(p => p.name), ['Coulis de tomates']);
});
