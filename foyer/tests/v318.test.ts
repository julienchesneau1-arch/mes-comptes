// V3.18 : bilan de la semaine. Les repas où quelqu'un mange (présences, agenda appliqué, invités) face aux plats et portions
// prévus : « pas assez de plats » (repas sans plat), « trop de plats » (portions en plus, restes libres, plat posé sur un repas
// où personne ne mange) ; gestes d'un toucher pour reprendre les restes ou déplacer le plat en trop, sans rien cuisiner de plus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, CURRY, MON } from './helpers.ts';
import { coverage, coverageText, coverageFixes } from '../src/core/coverage.ts';

const TODAY = '2026-10-04', TUE = '2026-10-06', WED = '2026-10-07';
const setup = () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } }, { t: 'recipe.save', p: { recipe: 'pates001', content: content('Pâtes', 2, ['200 g de pâtes']) } });
  return a;
};
const cov = (a: ReturnType<typeof setup>) => coverage(a.s, MON, TODAY, 12);
const cook = (slot: string, prep: string, recipe: string, extra = 0) => ({ t: 'slot.cook' as const, p: { slot, prep, recipe, extra } });
const away = (slot: string) => ['m1', 'm2'].map(m => ({ t: 'slot.presence' as const, p: { slot, member: m, presence: 'dehors' as const } }));
const all = ['2026-10-05|soir', `${TUE}|soir`, `${WED}|soir`, '2026-10-08|soir', '2026-10-09|soir', '2026-10-10|midi', '2026-10-10|soir', '2026-10-11|midi', '2026-10-11|soir'];

test('pas assez de plats : les repas où quelqu\'un mange (midis de semaine dehors), sans plat, avec leurs portions', () => {
  const a = setup();
  const c = cov(a);
  assert.deepEqual(c.meals, all);
  assert.equal(c.need, 18);
  assert.deepEqual(coverageText(a.s, c, TODAY), { level: 'manque', title: 'Pas assez de plats : il manque 9 plats à cuisiner pour finir la semaine',
    detail: 'demain soir, mardi soir, mercredi soir et 6 autres (18 portions).', hint: 2 }); // midis du week-end : « le midi = restes du dîner » proposé
});

test('agenda : un repas où personne ne mange ne manque pas ; un plat qui y est posé est en trop, et se déplace d\'un toucher', () => {
  const a = setup();
  a.emit(...away(`${TUE}|soir`));                                            // présences posées par l'agenda (ou à la main)
  assert.ok(!cov(a).meals.includes(`${TUE}|soir`));
  a.emit(...all.filter(k => k !== `${TUE}|soir` && k !== `${WED}|soir`).map((k, i) => cook(k, `prep000${i}`, 'pates001')), cook(`${TUE}|soir`, 'prepcur1', 'curry001'));
  const c = cov(a);
  assert.deepEqual([c.missing, c.idle], [[`${WED}|soir`], [`${TUE}|soir`]]);
  assert.match(coverageText(a.s, c, TODAY)?.detail ?? '', /En trop : Curry mardi soir, où personne ne mange\. De quoi couvrir 1 repas sans rien cuisiner de plus\./);
  const fix = coverageFixes(a.s, c, TODAY);
  assert.equal(fix[0]?.label, 'Déplacer Curry à mercredi soir');
  a.emit(...(fix[0]?.drafts ?? []));
  assert.deepEqual(coverageText(a.s, cov(a), TODAY), { level: 'ok', title: 'Semaine couverte : 8 plats pour 8 repas, rien en trop', detail: '', hint: 0 });
});

test('trop de plats : portions en plus et restes libres ; reprises sur un repas sans plat, rien de plus à cuisiner', () => {
  const a = setup();
  a.emit(...all.filter(k => k !== `${WED}|soir`).map((k, i) => cook(k, `prep000${i}`, 'pates001')));
  a.emit({ t: 'prep.extra', p: { prep: 'prep0000', extra: 4 } });          // lundi soir : 4 portions en plus
  let c = cov(a);
  assert.equal(c.spare, 4);
  const fix = coverageFixes(a.s, c, TODAY);
  assert.equal(fix[0]?.label, '♻️ Pâtes mercredi soir');
  a.emit(...(fix[0]?.drafts ?? []));
  c = cov(a);
  assert.deepEqual([c.missing.length, c.spare], [0, 2]);                      // 2 reprises, 2 encore en trop
  assert.deepEqual(coverageText(a.s, c, TODAY), { level: 'trop', title: 'Trop de plats : 2 portions en trop', detail: 'Pâtes : 2 portions en plus. De quoi faire ≈ 1 repas de restes.', hint: 0 });
});
