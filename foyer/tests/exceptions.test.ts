// File d'exceptions (spec « Décisions par défaut ») : règles par défaut = réglages rejoués, exceptions = fonction pure de l'état.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, NOW } from './helpers.ts';
import { validEvent } from '../src/core/model.ts';
import { replay, type Replay } from '../src/core/reduce.ts';
import { deriveToday } from '../src/core/today.ts';
import { exceptions, MAX_SHOWN, type Exception } from '../src/core/exceptions.ts';

const SAT = '2026-10-03', SUN = '2026-10-04';
const exc = (r: Replay, me: string | null = 'm1', now = NOW) => exceptions(r, deriveToday(r, now), me, now);
const find = (r: Replay, code: string, me: string | null = 'm1', now = NOW): Exception | undefined => {
  const x = exc(r, me, now);
  return [...x.shown, ...x.hidden].find(e => e.code === code);
};
// Curry de 6 portions cuisiné samedi soir et mangé : 4 portions libres, aucun repas prévu pour elles.
function withLeftovers() {
  const { a, b } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: content('Curry', 4, ['600 g de poulet']) } },
    { t: 'slot.cook', p: { slot: `${SAT}|soir`, prep: 'pcurry01', recipe: 'curry001', extra: 0 } },
    { t: 'prep.done', p: { prep: 'pcurry01', yield: 6, planned: 2, version: 1 } },
    { t: 'slot.eaten', p: { slot: `${SAT}|soir`, n: 2 } });
  return { a, b };
}

test('règle des restes : réglage validé strictement, rejoué, « auto » par défaut', () => {
  const base = { id: 'evt000000001', lc: 1, dev: 'deva0001', by: 'm1', at: NOW.toISOString(), t: 'settings.set' };
  assert.ok(validEvent({ ...base, p: { leftovers: 'suggest' } }));
  assert.equal(validEvent({ ...base, p: { leftovers: 'toujours' } }), null);       // valeur inconnue : rejet, état inchangé
  const { a } = household();
  assert.equal(a.s.settings.leftovers, undefined);                                 // absent = « auto »
  a.emit({ t: 'settings.set', p: { leftovers: 'manual' } });
  assert.equal(a.s.settings.leftovers, 'manual');
});

test('restes : proposés d\'office au prochain déjeuner libre (auto), un toucher les place, l\'exception disparaît', () => {
  const { a } = withLeftovers();
  const x = find(a.r, 'restes');
  assert.ok(x);
  assert.equal(x.title, '4 portions de Curry en attente');
  assert.equal(x.sub, "Proposé d'office : ce midi · préparé il y a 1 j.");          // dimanche midi : tout le monde à la maison
  const first = x.actions[0];
  assert.ok(first && 'drafts' in first);
  assert.deepEqual(first.drafts, [{ t: 'slot.from', p: { slot: `${SUN}|midi`, prep: 'pcurry01' } }]);
  a.emit(...first.drafts);
  assert.equal(a.r.rejected.size, 0);                                             // créneau pré-validé : aucun conflit possible
  assert.equal(find(a.r, 'restes'), undefined);                                   // l'état est cohérent : plus d'exception
});

test('restes : « suggest » propose sans choisir, « manual » ne signale rien', () => {
  const { a } = withLeftovers();
  a.emit({ t: 'settings.set', p: { leftovers: 'suggest' } });
  assert.match(find(a.r, 'restes')?.sub ?? '', /^Placer où \?/);
  a.emit({ t: 'settings.set', p: { leftovers: 'manual' } });
  assert.equal(find(a.r, 'restes'), undefined);
});

test('plus tard : par personne, 24 h au plus, puis l\'exception revient ; 3 fois → proposer une règle', () => {
  const { a } = withLeftovers();
  const key = find(a.r, 'restes')?.key as string;
  a.emit({ t: 'exc.snooze', p: { key, until: new Date(NOW.getTime() + 7 * 864e5).toISOString() } }); // une semaine demandée
  assert.equal(find(a.r, 'restes', 'm1'), undefined);
  assert.ok(find(a.r, 'restes', 'm2'));                                           // l'autre personne la voit toujours
  assert.ok(find(a.r, 'restes', 'm1', new Date(NOW.getTime() + 24 * 3600e3 + 60e3))); // ramené à 24 h
  assert.equal(find(a.r, 'restes', 'm2')?.rule, false);
  a.emit({ t: 'exc.snooze', p: { key, until: new Date(NOW.getTime() + 3600e3).toISOString() } },
    { t: 'exc.snooze', p: { key, until: new Date(NOW.getTime() + 3600e3).toISOString() } });
  assert.equal(find(a.r, 'restes', 'm2')?.rule, true);
  assert.equal(validEvent({ id: 'evt000000002', lc: 9, dev: 'deva0001', by: 'm1', at: NOW.toISOString(), t: 'exc.snooze', p: { key: 'sans-code', until: NOW.toISOString() } }), null);
});

test('personne à la maison mais un plat prévu : déplacer ou retirer ; cuisiné pour des boîtes : rien à signaler', () => {
  const { a } = household();
  const MON = '2026-10-05';
  a.emit({ t: 'recipe.save', p: { recipe: 'gratin01', content: content('Gratin', 2, ['500 g de pommes de terre']) } },
    { t: 'slot.cook', p: { slot: `${MON}|midi`, prep: 'pgratin1', recipe: 'gratin01', extra: 0 } }); // lundi midi : tous dehors
  const x = find(a.r, 'personne');
  assert.ok(x);
  assert.equal(x.title, 'Personne à la maison demain midi, mais Gratin est prévu');
  const move = x.actions.find(y => y.label.startsWith('Déplacer'));
  assert.ok(move && 'drafts' in move);
  a.emit(...move.drafts);
  assert.equal(a.r.rejected.size, 0);
  assert.equal(find(a.r, 'personne'), undefined);
  a.emit({ t: 'slot.cook', p: { slot: `${MON}|midi`, prep: 'pgratin2', recipe: 'gratin01', extra: 2 } }); // 2 portions en plus : voulu
  assert.equal(find(a.r, 'personne'), undefined);
});

test('préparation commencée : « c\'est prêt » d\'un toucher avec les portions prévues', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: content('Curry', 4, ['600 g de poulet']) } },
    { t: 'slot.cook', p: { slot: `${SAT}|soir`, prep: 'pcurry01', recipe: 'curry001', extra: 1 } },
    { t: 'prep.start', p: { prep: 'pcurry01' } });
  const x = find(a.r, 'cuisson');
  assert.ok(x);
  const done = x.actions[0];
  assert.ok(done && 'drafts' in done);
  assert.deepEqual(done.drafts, [{ t: 'prep.done', p: { prep: 'pcurry01', yield: 3, planned: 3, version: 1 } }]);
  a.emit(...done.drafts);
  assert.equal(find(a.r, 'cuisson'), undefined);
});

test('déterminisme : rien n\'est enregistré, le rejeu du journal redonne exactement la même file ; plafond de 5 cartes', () => {
  const { a } = withLeftovers();
  const MON = '2026-10-05';
  for (let i = 0; i < 4; i++) a.emit({ t: 'slot.cook', p: { slot: `2026-10-0${6 + i}|midi`, prep: `pmidi00${i}`, recipe: 'curry001', extra: 0 } }); // 4 midis sans personne
  a.emit({ t: 'slot.cook', p: { slot: `${MON}|midi`, prep: 'pmidi009', recipe: 'curry001', extra: 0 } });
  const one = exc(a.r), two = exc(replay([...a.log].reverse()));
  assert.deepEqual(two, one);
  assert.equal(one.shown.length, MAX_SHOWN);
  assert.ok(one.hidden.length >= 1);
  const prios = [...one.shown, ...one.hidden].map(x => x.prio);
  assert.deepEqual(prios, [...prios].sort((x, y) => y - x));                      // triées par priorité
});
