// V3.19 : un plat cuisiné le soir nourrit aussi le midi du lendemain (boîtes ou restes, +2 portions la veille). La semaine se
// compte en plats à cuisiner, pas en repas : 7 plats pour 14 repas quand le foyer cuisine ainsi. Réglage « le midi = restes du
// dîner » (accueil, Décisions automatiques, bandeau du bilan) ; chaque dîner posé relie tout seul le midi du lendemain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, CURRY, MON } from './helpers.ts';
import { defaultRhythm, validEvent } from '../src/core/model.ts';
import { coverage, coverageText, coverageFixes } from '../src/core/coverage.ts';
import { withLunch } from '../src/core/commands.ts';
import { fedByDinner, portions } from '../src/core/plan.ts';
import { proposeWeek } from '../src/core/propose.ts';

const TODAY = '2026-10-04', TUE = '2026-10-06', WED = '2026-10-07';
const home = () => {                                                          // tout le monde à la maison, midi et soir
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } }, { t: 'settings.set', p: { rhythm: defaultRhythm(['m1', 'm2'], 'maison', 'maison') } });
  return a;
};
const cov = (a: ReturnType<typeof home>) => coverage(a.s, MON, TODAY, 12);
const cook = (slot: string, prep: string, extra = 0) => ({ t: 'slot.cook' as const, p: { slot, prep, recipe: 'curry001', extra } });
const lunchOn = { t: 'settings.set' as const, p: { lunchFromDinner: true } };

test('sans le réglage : 14 plats à cuisiner, et le bilan propose « le midi = restes du dîner » ; avec : 7 plats pour 14 repas', () => {
  const a = home();
  const before = cov(a);
  assert.equal(before.meals.length, 14);
  assert.equal(before.missing.length, 14);
  assert.equal(coverageText(a.s, before, TODAY)?.hint, 7);
  a.emit(lunchOn);
  const c = cov(a);
  assert.deepEqual([c.meals.length, c.missing.length, c.fed.length], [14, 7, 7]);
  assert.ok(c.missing.every(k => k.endsWith('|soir')));
  assert.deepEqual(coverageText(a.s, c, TODAY), { level: 'manque', title: 'Pas assez de plats : il manque 7 plats à cuisiner pour finir la semaine',
    detail: 'demain soir, mardi soir, mercredi soir et 4 autres (14 portions). 7 midis suivent le dîner de la veille (portions en plus le soir).', hint: 0 });
});

test('le réglage vaut pour tous les midis où l\'on mange, maison ou boîte ; sans dîner la veille, le midi se cuisine', () => {
  const a = home();
  assert.equal(fedByDinner(a.s, `${TUE}|midi`), false);
  a.emit(lunchOn);
  assert.equal(fedByDinner(a.s, `${TUE}|midi`), true);
  assert.equal(fedByDinner(a.s, `${TUE}|soir`), false);
  // Personne ne dîne lundi soir : le midi de mardi n'est plus « nourri », il se cuisine.
  a.emit(...['m1', 'm2'].map(m => ({ t: 'slot.presence' as const, p: { slot: `${MON}|soir`, member: m, presence: 'dehors' as const } })));
  assert.ok(cov(a).missing.includes(`${TUE}|midi`));
});

test('poser un dîner relie le midi du lendemain : +2 portions la veille, rien de plus à cuisiner ; portions « en plus » reprises', () => {
  const a = home();
  a.emit(lunchOn);
  const w = withLunch(a.s, `${MON}|soir`, [cook(`${MON}|soir`, 'prep0001', 3)]);
  assert.deepEqual([w.lunch, w.n], [`${TUE}|midi`, 2]);
  assert.deepEqual(w.drafts, [cook(`${MON}|soir`, 'prep0001', 1), { t: 'slot.from', p: { slot: `${TUE}|midi`, prep: 'prep0001' } }]);
  a.emit(...w.drafts);
  const p = a.s.preps['prep0001'];
  assert.ok(p);
  assert.equal(portions(a.s, p).planned, 5);                                  // 2 ce soir + 2 demain midi + 1 encore en plus
  assert.ok(cov(a).fed.includes(`${TUE}|midi`) && !cov(a).missing.includes(`${TUE}|midi`));
  // Rien à relier : un midi, un midi déjà prévu, ou le réglage éteint (midis de semaine dehors).
  assert.equal(withLunch(a.s, `${TUE}|midi`, [cook(`${TUE}|midi`, 'prep0002')]).lunch, null);
  assert.equal(withLunch(a.s, `${MON}|soir`, [cook(`${MON}|soir`, 'prep0003')]).lunch, null);
  const { a: b } = household();
  b.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } });
  assert.equal(withLunch(b.s, `${MON}|soir`, [cook(`${MON}|soir`, 'prep0001')]).lunch, null);
});

test('dîner posé avant le réglage : le bilan relie le midi d\'un toucher (+2 portions la veille)', () => {
  const a = home();
  a.emit(cook(`${MON}|soir`, 'prep0001'), lunchOn);
  const c = cov(a);
  assert.deepEqual(c.boxes, [{ slot: `${TUE}|midi`, prep: 'prep0001' }]);
  const fix = coverageFixes(a.s, c, TODAY);
  assert.equal(fix[0]?.label, '♻️ Curry aussi mardi midi (+2 portions la veille)');
  a.emit(...(fix[0]?.drafts ?? []));
  assert.equal(a.s.slots[`${TUE}|midi`]?.dish?.kind, 'from');
  assert.deepEqual(cov(a).boxes, []);
});

test('semaine générée : chaque midi reprend le dîner de la veille, 7 plats proposés pour 14 repas', () => {
  const a = home();
  a.emit(...['Pâtes', 'Gratin', 'Soupe', 'Risotto', 'Omelette', 'Chili', 'Quiche', 'Tajine'].map((n, i) =>
    ({ t: 'recipe.save' as const, p: { recipe: `rec0000${i}`, content: content(n, 4, ['200 g de riz']) } })));
  a.emit(lunchOn, cook(`${TODAY}|soir`, 'prep0000'));                         // dimanche soir prévu : il nourrit lundi midi
  const props = proposeWeek(a.s, MON, TODAY, 12);
  const midis = props.filter(p => p.slot.endsWith('|midi'));
  assert.equal(midis.length, 7);
  assert.ok(midis.every(p => p.dish?.kind === 'from' && p.reason === 'midi : restes du dîner de la veille'), JSON.stringify(midis.map(p => p.dish)));
  const first = midis[0]?.dish;
  assert.deepEqual(first?.kind === 'from' ? [first.source, first.prep] : null, [`${TODAY}|soir`, 'prep0000']);
  assert.equal(props.filter(p => p.dish && p.dish.kind !== 'from').length, 7);
  assert.ok(props.some(p => p.slot === `${WED}|midi` && p.dish?.kind === 'from' && p.dish.source === `${TUE}|soir`));
});

test('réglage : accepté seulement en booléen, et ignoré par un ancien appareil qui ne le connaît pas', () => {
  const base = { id: 'ev000001', lc: 1, dev: 'deva0001', by: 'm1', at: '2026-10-04T10:00:00.000Z', t: 'settings.set' };
  assert.ok(validEvent({ ...base, p: { lunchFromDinner: true } }));
  assert.equal(validEvent({ ...base, p: { lunchFromDinner: 'oui' } }), null);
  const a = home();
  assert.equal(a.s.settings.lunchFromDinner, undefined);
  a.emit(lunchOn, { t: 'settings.set', p: { boxesFromDinner: false } });     // un autre réglage ne l'efface pas
  assert.equal(a.s.settings.lunchFromDinner, true);
});
