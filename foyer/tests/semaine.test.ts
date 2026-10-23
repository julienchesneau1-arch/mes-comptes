// Semaine générée (spec « Approbation ») et budget tenu comme chez Pimzi : coût d'un plat, plats chers remplacés, brouillon partagé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, NOW, MON } from './helpers.ts';
import { validEvent } from '../src/core/model.ts';
import { setRefPrices, type Ref } from '../src/core/refprice.ts';
import { dishCost } from '../src/core/budget.ts';
import { type Proposal, proposeWeek, rank } from '../src/core/propose.ts';
import { alternativesFor, fitBudget, fromItems, propCost, toItems, plannedCost } from '../src/core/weekgen.ts';
import { deriveToday } from '../src/core/today.ts';
import { exceptions } from '../src/core/exceptions.ts';
import { replay } from '../src/core/reduce.ts';

const ref = (id: string, keys: string[], cents: number): Ref => ({ id, label: id, keys, per: 'kg', cents, period: '2026-08', series: 'x', method: 'mesuré' });
const REFS = { source: '', sourceUrl: '', license: '', weights: '', weightsUrl: '', generated: '', period: '2026-08',
  refs: [ref('boeuf', ['boeuf'], 1600), ref('lentille', ['lentille'], 300), ref('riz', ['riz'], 200), ref('poulet', ['poulet'], 1000)] };
const kitchen = () => {
  const { a, b } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'boeuf001', content: content('Bœuf mijoté', 2, ['500 g de boeuf']) } },
    { t: 'recipe.save', p: { recipe: 'lent0001', content: content('Dhal de lentilles', 2, ['200 g de lentilles']) } },
    { t: 'recipe.save', p: { recipe: 'riz00001', content: content('Riz sauté', 2, ['250 g de riz']) } });
  return { a, b };
};

test('coût d\'un plat : quantité utilisée au prix connu, proportionnel aux portions, sel et épices exclus', () => {
  setRefPrices(REFS);
  const { a } = kitchen();
  const c = dishCost(a.s, content('Bœuf mijoté', 4, ['500 g de boeuf', 'sel', '1 pincée de cumin']), 2);
  assert.deepEqual(c, { cents: 400, priced: 1, unpriced: 0, perPortion: 200, partial: false, reliable: true }); // 250 g à 16 €/kg
  assert.equal(dishCost(a.s, content('Sans rendement', null, ['500 g de boeuf']), 2), null);               // rendement inconnu : rien à calculer
  setRefPrices(null);
});

test('budget tenu : le plat le plus cher est remplacé par une alternative nettement moins chère, une fois par repas', () => {
  setRefPrices(REFS);
  const { a } = kitchen();
  const props: Proposal[] = [`${MON}|soir`, '2026-10-06|soir'].map((slot, i) => ({ slot, dish: { kind: 'cook', recipe: i ? 'riz00001' : 'boeuf001', extra: 0 }, reason: 'test', presence: {}, guests: 0 }));
  const cost = (p: Proposal) => propCost(a.s, props, p)?.cents;
  assert.deepEqual(props.map(cost), [800, 50]);                                   // 500 g de bœuf pour 2 ; 250 g de riz
  const alts = (p: Proposal, used: ReadonlySet<string>) => alternativesFor(a.s, null, p, MON, '2026-10-04', used);
  const fit = fitBudget(a.s, props, 500, 0, alts);
  assert.deepEqual(fit.swapped, [`${MON}|soir`]);
  const swapped = fit.props[0];
  assert.ok(swapped?.dish?.kind === 'cook' && swapped.dish.recipe === 'lent0001');   // dhal : 60 c, le seul plat libre et moins cher
  assert.match(swapped.reason, /moins cher, pour tenir le budget$/);
  assert.equal(fit.cents, 60 + 50);
  assert.deepEqual(fitBudget(a.s, props, 5000, 0, alts).swapped, []);             // sous le budget : rien ne bouge
  assert.deepEqual(fitBudget(a.s, props, 500, 0, alts), fit);                     // déterministe
  setRefPrices(null);
});

test('plats déjà prévus : leur coût compte dans le budget de la semaine', () => {
  setRefPrices(REFS);
  const { a } = kitchen();
  a.emit({ t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'pboeuf01', recipe: 'boeuf001', extra: 0 } });
  assert.equal(plannedCost(a.s, MON), 800);
  setRefPrices(null);
});

test('durées déclarées : rapide un soir de semaine, long écarté le mardi et bienvenu le week-end', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'vite0001', content: content('Omelette', 2, ['4 œufs'], { prepMin: 5, cookMin: 10 }) } },
    { t: 'recipe.save', p: { recipe: 'long0001', content: content('Pot-au-feu', 4, ['1 kg de boeuf'], { prepMin: 30, cookMin: 180 }) } });
  const tue = rank(a.s, '2026-10-06|soir', '2026-10-04'), sat = rank(a.s, '2026-10-10|soir', '2026-10-04');
  assert.equal(tue[0]?.recipe, 'vite0001');
  assert.match(tue[0]?.reason ?? '', /rapide \(15 min\)/);
  assert.equal(sat[0]?.recipe, 'long0001');
  assert.match(sat[0]?.reason ?? '', /plat du week-end/);
});

test('brouillon partagé : compact, validé, relu sans jamais écraser un repas rempli entre-temps', () => {
  const { a, b } = kitchen();
  const props: Proposal[] = [{ slot: `${MON}|soir`, dish: { kind: 'cook', recipe: 'boeuf001', extra: 0 }, reason: '', presence: {}, guests: 0 },
    { slot: '2026-10-06|midi', dish: { kind: 'from', source: `${MON}|soir`, prep: null }, reason: '', presence: {}, guests: 0 },
    { slot: '2026-10-07|soir', dish: { kind: 'cook', recipe: 'riz00001', extra: 0 }, reason: '', presence: {}, guests: 0 }];
  const items = toItems(props, new Set([`${MON}|soir`]));
  assert.deepEqual(items, [{ slot: `${MON}|soir`, kind: 'cook', ref: 'boeuf001', batch: true }, { slot: '2026-10-06|midi', kind: 'from', ref: `${MON}|soir` },
    { slot: '2026-10-07|soir', kind: 'cook', ref: 'riz00001' }]);
  a.emit({ t: 'week.draft', p: { week: MON, items } });
  assert.equal(a.s.drafts[MON]?.items.length, 3);
  const base = { id: 'evt000000009', lc: 99, dev: 'deva0001', by: 'm1', at: NOW.toISOString(), t: 'week.draft' };
  assert.equal(validEvent({ ...base, p: { week: MON, items: [{ slot: '2026-10-20|soir', kind: 'cook', ref: 'x' }] } }), null); // hors de la semaine
  assert.equal(validEvent({ ...base, p: { week: MON, items: [items[0], items[0]] } }), null);                                  // même repas deux fois
  b.receive(a);
  b.emit({ t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'pautre01', recipe: 'lent0001', extra: 0 } });   // l'autre téléphone a rempli lundi soir
  const back = fromItems(b.s, null, b.s.drafts[MON]?.items ?? [], '2026-10-04', 12);
  assert.deepEqual(back.props.map(p => p.slot), ['2026-10-06|midi', '2026-10-07|soir']); // lundi soir écarté ; la boîte de mardi reste celle du dîner de lundi
  assert.equal(back.dropped, 1);
  assert.equal(fromItems(b.s, null, [{ slot: '2026-10-06|midi', kind: 'from', ref: '2026-10-08|soir' }], '2026-10-04', 12).props.length, 0); // restes sans plat source : écartés
  a.emit({ t: 'week.discard', p: { week: MON } });
  assert.equal(a.s.drafts[MON], undefined);
});

test('À régler : un menu en attente remplace « repas sans plat » ; génération déterministe', () => {
  const { a } = kitchen();
  const r0 = a.r, t0 = deriveToday(r0, NOW), first = exceptions(r0, t0, 'm1', NOW);
  assert.ok([...first.shown, ...first.hidden].some(x => x.code === 'semaine'));
  const week = proposeWeek(a.s, '2026-09-28', '2026-10-04', 12);                   // semaine en cours (lundi 28 septembre)
  assert.deepEqual(proposeWeek(replay([...a.log].reverse()).state, '2026-09-28', '2026-10-04', 12), week);
  a.emit({ t: 'week.draft', p: { week: '2026-09-28', items: toItems(week, new Set()) } });
  const x = exceptions(a.r, deriveToday(a.r, NOW), 'm2', NOW), all = [...x.shown, ...x.hidden];
  const menu = all.find(e => e.code === 'menu');
  assert.ok(menu);
  assert.match(menu.title, /^Menu de la semaine proposé par Alex : \d+ repas à approuver$/);
  assert.equal(all.some(e => e.key === 'semaine:2026-10-04'), false);
});
