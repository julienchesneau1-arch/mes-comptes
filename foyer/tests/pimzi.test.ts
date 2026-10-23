// Reprises Pimzi : allergies et refus (14 allergènes de l'annexe II du règlement (UE) n° 1169/2011), estimations calées sur vos
// factures, budget et allergies à l'accueil, « déjà au placard ? » pour le reste d'un paquet acheté la semaine précédente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, NOW, MON } from './helpers.ts';
import { validEvent, defaultRhythm } from '../src/core/model.ts';
import { allergensOf, dishBlocked, lineAlert, parseFoods, type Exclusions } from '../src/core/allergens.ts';
import { rank } from '../src/core/propose.ts';
import { type Catalog, readCatalog, discover } from '../src/core/catalog.ts';
import type { CatalogRecipe } from '../src/core/wikibook.ts';
import { setRefPrices, type Ref } from '../src/core/refprice.ts';
import { calibration, calibrationText, lineCost, unitCost } from '../src/core/budget.ts';
import { deriveShopping, checkSig } from '../src/core/shopping.ts';
import { surpluses } from '../src/core/placard.ts';
import { exceptions } from '../src/core/exceptions.ts';
import { deriveToday } from '../src/core/today.ts';
import type { Draft } from '../src/core/reduce.ts';
import { q } from '../src/core/rational.ts';

test('allergènes d\'après le nom : « contient », « étiquette à vérifier », et les faux amis', () => {
  const cases: [string, string[], string[]][] = [
    ['Pâtes', ['gluten'], []], ['pâtes sans gluten', [], []], ['farine de blé', ['gluten'], []], ['farine de sarrasin', [], []],
    ['lait de coco', [], []], ['Lait', ['lait'], []], ['noix de beurre', ['lait'], []], ['crème de coco', [], []],
    ['beurre de cacahuète', ['arachides'], []], ['noix de muscade', [], []], ['noix', ['fruits-a-coque'], []], ['poudre d\'amande', ['fruits-a-coque'], []],
    ['noix de Saint-Jacques', ['mollusques'], []], ['pignons de pin', [], []], ['œufs', ['oeufs'], []], ['œufs de lump', ['poissons'], []],
    ['pâté de campagne', [], ['gluten', 'oeufs', 'lait']], ['bouillon de volaille', [], ['celeri', 'gluten']], ['sauce soja', ['soja'], ['gluten']],
    ['vin blanc', ['sulfites'], []], ['vinaigre de vin', [], ['sulfites']], ['fruits de mer', ['crustaces', 'mollusques'], []],
    ['filets de cabillaud', ['poissons'], []], ['céleri-rave', ['celeri'], []], ['Moutarde de Dijon', ['moutarde'], []], ['huile d\'olive', [], []],
  ];
  for (const [name, sure, maybe] of cases) assert.deepEqual(allergensOf(name), { sure, maybe }, name);
});

test('exclusions du foyer : validées, rejouées ; aliments refusés lus mot à mot', () => {
  assert.deepEqual(parseFoods('porc, Coriandre ; champignons\nporc,  '), ['porc', 'Coriandre', 'champignons']);
  const base = { id: 'evt000000001', lc: 1, dev: 'deva0001', by: 'm1', at: NOW.toISOString(), t: 'settings.set' };
  const ok: Exclusions = { allergens: ['gluten', 'arachides'], foods: ['porc'] };
  assert.ok(validEvent({ ...base, p: { exclude: ok } }));
  for (const bad of [{ allergens: ['gluten', 'gluten'], foods: [] }, { allergens: ['amiante'], foods: [] }, { allergens: [], foods: ['porc, veau'] },
    { allergens: [], foods: [' porc'] }, { allergens: [], foods: Array.from({ length: 21 }, (_, i) => `x${i}`) }])
    assert.equal(validEvent({ ...base, p: { exclude: bad } }), null, JSON.stringify(bad));
  const { a } = household();
  a.emit({ t: 'settings.set', p: { exclude: ok } });
  assert.deepEqual(a.s.settings.exclude, ok);
  assert.deepEqual(dishBlocked(ok, ['200 g de riz', 'échine de porc']), { name: 'échine de porc', why: 'porc' });
  assert.equal(dishBlocked(ok, ['200 g de riz', 'porcini']), null);            // mot entier seulement
  assert.deepEqual(dishBlocked(ok, ['Cervelas pistachés'])?.why, 'porc');        // famille : charcuterie de porc
  assert.equal(dishBlocked(ok, ['jambon de dinde']), null);                       // autre animal nommé
  assert.deepEqual(dishBlocked(ok, ['haché porc et bœuf'])?.why, 'porc');        // le mot refusé lui-même l'emporte
  const alc: Exclusions = { allergens: [], foods: ['alcool'] };
  assert.deepEqual(dishBlocked(alc, ['20 cl de vin blanc'])?.why, 'alcool');
  assert.equal(dishBlocked(alc, ['vinaigre de vin', 'bière sans alcool']), null);
  assert.equal(lineAlert(ok, 'Spaghetti'), 'contient gluten : exclu chez vous');
  assert.equal(lineAlert(ok, 'cube de bouillon'), 'étiquette à vérifier : gluten');
  assert.equal(lineAlert(ok, 'Porc'), 'porc : refusé chez vous');
  assert.equal(lineAlert(ok, 'Riz'), '');
});

test('budget et allergies dès la création du foyer', () => {
  const { a } = household();
  const p = { hid: 'foyer0002', members: [{ id: 'm1', name: 'Alex' }], settings: { weekStart: 0, rhythm: defaultRhythm(['m1'], 'maison', 'maison'), boxesFromDinner: false,
    budget: 9000, exclude: { allergens: ['lait'], foods: [] } } };
  assert.ok(validEvent({ id: 'evt000000002', lc: 1, dev: 'deva0001', by: 'm1', at: NOW.toISOString(), t: 'household.init', p }));
  assert.equal(validEvent({ id: 'evt000000002', lc: 1, dev: 'deva0001', by: 'm1', at: NOW.toISOString(), t: 'household.init', p: { ...p, settings: { ...p.settings, exclude: { allergens: ['x'], foods: [] } } } }), null);
  assert.ok(a.s.settings.exclude === undefined); // foyer sans exclusion : rien d'écarté
});

const rec = (id: number, title: string, ingredients: string[]): CatalogRecipe => ({ id: `wb${id}`, title, yield: 4, minutes: null, ingredients, steps: ['Cuire.'],
  tags: [], main: null, url: `https://fr.wikibooks.org/wiki/Livre_de_cuisine/${id}`, rev: 1 });
const CAT = readCatalog({ license: 'CC BY-SA 4.0', recipes: [rec(1, 'Crêpes', ['250 g de farine', '3 œufs', '50 cl de lait']),
  rec(2, 'Soupe de légumes', ['1 kg de carottes', '1 cube de bouillon']), rec(3, 'Satay', ['200 g de poulet', '3 c. à s. de beurre de cacahuète'])] }) as Catalog;

test('propositions : un plat qui contient un allergène exclu ou un aliment refusé n\'est jamais proposé ; « à vérifier » l\'est', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'gratin01', content: content('Gratin', 4, ['1 kg de pommes de terre', '50 cl de crème fraîche']) } },
    { t: 'recipe.save', p: { recipe: 'curry001', content: content('Curry de porc', 4, ['600 g d\'échine de porc', '1 oignon']) } },
    { t: 'recipe.save', p: { recipe: 'riz00001', content: content('Riz cantonais', 4, ['300 g de riz', '2 œufs']) } },
    { t: 'settings.set', p: { exclude: { allergens: ['lait', 'arachides'], foods: ['porc'] } } });
  const slot = `${MON}|soir`;
  assert.deepEqual(rank(a.s, slot, '2026-10-04').map(r => r.recipe), ['riz00001']);
  const all = rank(a.s, slot, '2026-10-04', new Set(), new Map(), { keepBlocked: true });  // choix à la main : gardés, en dernier, signalés
  assert.equal(all[0]?.recipe, 'riz00001');
  assert.deepEqual(all.slice(1).map(r => r.blocked).sort(), ['lait (crème fraîche)', 'porc (échine de porc)']);
  const ctx = { week: MON, weekend: false, evening: true, neighbourFamilies: new Set<string>(), weekFresh: new Map<string, string>(), exclude: new Set<string>() };
  assert.deepEqual(discover(a.s, CAT, ctx).map(d => d.recipe.title), ['Soupe de légumes']); // crêpes (lait), satay (arachides) écartés ; bouillon : à vérifier
});

const ref = (id: string, per: Ref['per'], cents: number): Ref => ({ id, label: id, keys: [id], per, cents, period: '2026-08', series: 'x', method: 'mesuré' });
const REFS = { source: '', sourceUrl: '', license: '', weights: '', weightsUrl: '', generated: '', period: '2026-08',
  refs: [ref('tomate', 'kg', 300), ref('pate', 'kg', 200), ref('oignon', 'kg', 250), ref('carotte', 'kg', 180), ref('lait', 'l', 100), ref('beurre', 'kg', 1000), ref('courgette', 'kg', 280)] };
const paid = (key: string, cents: number, size: string | null, unit: string | null, loose = false): Draft =>
  ({ t: 'price.paid', p: { key, label: key, cents, size, unit, loose, day: '2026-10-03' } });

test('calage sur les factures : médiane payé ÷ Insee sur 5 articles comparables, appliquée aux seules estimations Insee', () => {
  setRefPrices(REFS);
  const { a } = household();
  a.emit(paid('tomate', 330, '1', 'kg', true), paid('pate', 90, '500', 'g'), paid('oignon', 225, '1', 'kg'), paid('carotte', 198, '1', 'kg'),
    paid('courgette|surgele', 50, '1', 'kg'));                                     // surgelé : pas le produit frais relevé par l'Insee
  assert.deepEqual(calibration(a.s).factor, null);                                  // 4 articles comparables : rien n'est corrigé
  assert.equal(calibrationText(calibration(a.s)), 'Calage sur vos factures : 4 articles comparables sur 5 nécessaires.');
  assert.equal(unitCost(a.s, 'beurre', null, 'masse', q(200)), 200);
  a.emit(paid('lait', 95, '1', 'l'));                                              // rapports 0,9 · 0,9 · 0,95 · 1,1 · 1,1 → médiane 0,95
  const c = calibration(a.s);
  assert.equal(c.factor, 0.95);
  assert.equal(c.n, 5);
  assert.equal(calibrationText(c), 'Estimations Insee calées sur vos factures : −5 % (médiane de 5 articles payés comparés au prix moyen Insee).');
  assert.equal(unitCost(a.s, 'beurre', null, 'masse', q(200)), 190);              // Insee 2 € → 1,90 €
  assert.equal(unitCost(a.s, 'tomate', null, 'masse', q(500)), 165);              // prix payé : jamais corrigé
  a.emit({ t: 'recipe.save', p: { recipe: 'beur0001', content: content('Beurre fondu', 2, ['200 g de beurre']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'pbeur001', recipe: 'beur0001', extra: 0 } });
  const line = deriveShopping(a.s, MON).lines.find(l => l.key === 'beurre|masse');
  assert.ok(line);
  assert.deepEqual([lineCost(a.s, line)?.how, lineCost(a.s, line)?.cents], ['référence', 190]);
  setRefPrices(null);
});

test('« Déjà au placard ? » : reste du paquet acheté la semaine précédente, un toucher pour le déduire', () => {
  const { a } = household();
  const prev = '2026-09-28';
  a.emit({ t: 'recipe.save', p: { recipe: 'spag0001', content: content('Spaghetti', 2, ['300 g de spaghetti']) } },
    { t: 'product.set', p: { key: 'spaghetti', url: 'https://www.auchan.fr/spaghetti-500g/pr-C1234567', label: 'Spaghetti 500 g', size: '500', unit: 'g' } },
    { t: 'slot.cook', p: { slot: `${prev}|soir`, prep: 'pspag001', recipe: 'spag0001', extra: 0 } });
  const was = deriveShopping(a.s, prev).lines.find(l => l.key === 'spaghetti|masse');
  assert.ok(was);
  a.emit({ t: 'shop.check', p: { week: prev, key: was.key, needAt: checkSig(was) } },   // un paquet de 500 g pris pour 300 g
    { t: 'slot.cook', p: { slot: '2026-10-06|soir', prep: 'pspag002', recipe: 'spag0001', extra: 0 } });
  const [x] = surpluses(a.s, MON);
  assert.ok(x);
  assert.equal(x.left.n / x.left.d, 200);
  const card = [...exceptions(a.r, deriveToday(a.r, NOW), 'm1', NOW).shown].find(e => e.code === 'placard');
  assert.ok(card);
  assert.equal(card.title, 'Spaghetti : il devrait en rester 200 g');
  assert.equal(card.sub, 'Paquet de 500 g pris pour la semaine du 28 au 4 oct., où il en fallait 300 g. Du 5 au 11 oct., il en faut 300 g.');
  assert.ok(validEvent({ id: 'evt000000003', lc: 1, dev: 'deva0001', by: 'm1', at: NOW.toISOString(), t: 'exc.snooze', p: { key: card.key, until: NOW.toISOString() } })); // « plus tard » possible
  const [yes, no] = card.actions;
  assert.ok(yes && 'drafts' in yes && no && 'drafts' in no);
  const { a: b } = household();
  b.log = [...a.log]; b.emit(...no.drafts);                                          // « Plus rien » : la carte part, rien n'est déduit
  assert.equal(exceptions(b.r, deriveToday(b.r, NOW), 'm1', NOW).shown.some(e => e.code === 'placard'), false);
  assert.equal(deriveShopping(b.s, MON).lines.find(l => l.key === 'spaghetti|masse')?.toBuy?.n, 300);
  a.emit(...yes.drafts);                                                            // « On en a » : 200 g déduits de la liste de la semaine
  const now = deriveShopping(a.s, MON).lines.find(l => l.key === 'spaghetti|masse');
  assert.equal((now?.toBuy?.n ?? 0) / (now?.toBuy?.d ?? 1), 100);
  assert.equal(exceptions(a.r, deriveToday(a.r, NOW), 'm1', NOW).shown.some(e => e.code === 'placard'), false);
});
