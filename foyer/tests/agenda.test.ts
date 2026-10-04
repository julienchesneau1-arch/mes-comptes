// Agenda → repas : quels événements changent quels repas, décision puis automatisme, retour arrière quand l'événement
// disparaît, la main l'emporte, pas de ping-pong entre deux événements, plat décalé quand plus personne ne le mange.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, CURRY, NOW } from './helpers.ts';
import { type Feed, planAgenda, classify, ruleKey, onceKey, changeText } from '../src/core/agenda.ts';
import type { Occurrence } from '../src/core/ical.ts';
import { presence } from '../src/core/plan.ts';
import { defaultRhythm } from '../src/core/model.ts';
import type { Draft } from '../src/core/reduce.ts';

let n = 0;
const occ = (title: string, start: string, end: string, extra: Partial<Occurrence> = {}): Occurrence => ({
  id: (++n).toString(16).padStart(16, '0'), title, allDay: false, start: Date.parse(start), end: Date.parse(end), days: null, busy: true, recurring: false, tzGuess: false, ...extra,
});
const day = (title: string, from: string, to: string): Occurrence => occ(title, `${from}T00:00:00+02:00`, `${to}T00:00:00+02:00`, { allDay: true, days: [from, to] });
const feed = (member: string | null, ...occurrences: Occurrence[]): Feed => ({ cal: member ? `cal${member}` : 'calfoyer', member, label: 'Agenda', occurrences });
const all = (ds: Draft[][]): Draft[] => ds.flat();

test('quels événements changent quels repas (heure du repas, mots du titre, journées entières, passé jamais touché)', () => {
  const { a } = household();
  const plan = planAgenda(a.s, [feed('m1',
    occ('Foot', '2026-10-06T19:30:00+02:00', '2026-10-06T21:30:00+02:00'),            // occupé pendant le dîner
    occ('Réunion tardive', '2026-10-07T18:00:00+02:00', '2026-10-07T19:30:00+02:00'), // 30 min sur 2 h 30 : le dîner reste
    occ('Resto avec Paul', '2026-10-08T20:45:00+02:00', '2026-10-08T23:00:00+02:00'), // parle de repas : dès qu'il touche
    occ('Télétravail', '2026-10-05T09:00:00+02:00', '2026-10-05T18:00:00+02:00'),     // midi à la maison (d'habitude dehors)
    day('Anniversaire de Léa', '2026-10-09', '2026-10-10'),                            // journée entière sans absence : rien
    day('Vacances Bretagne', '2026-10-10', '2026-10-12'),                              // samedi et dimanche, tous les repas
    occ('Dîner à la maison avec les Martin', '2026-10-17T20:00:00+02:00', '2026-10-17T23:00:00+02:00'),
    occ('Penser au pain', '2026-10-13T19:00:00+02:00', '2026-10-13T21:00:00+02:00', { busy: false }), // « disponible » : rien
    occ('Déjà commencé', '2026-10-04T12:00:00+02:00', '2026-10-04T14:00:00+02:00'),   // ce midi : repas en cours, jamais touché
  )], NOW);
  assert.deepEqual(plan.changes.map(c => [c.title, c.kind, c.sure, c.slots, c.auto]), [
    ['Foot', 'dehors', false, ['2026-10-06|soir'], false],
    ['Resto avec Paul', 'dehors', true, ['2026-10-08|soir'], false],
    ['Télétravail', 'maison', true, ['2026-10-05|midi'], false],
    ['Vacances Bretagne', 'dehors', true, ['2026-10-10|midi', '2026-10-10|soir', '2026-10-11|midi', '2026-10-11|soir'], false],
    ['Dîner à la maison avec les Martin', 'invites', true, ['2026-10-17|soir'], false],
  ]);
  assert.equal(changeText(a.s, plan.changes[0] as never), 'Alex absent·e mar. 6 oct. soir');
  assert.equal(plan.changes[4]?.drafts.length, 0); // le nombre d'invités est demandé, jamais deviné
  assert.equal(classify(day('Congés', '2026-10-20', '2026-10-21'))?.kind, 'maison');
  assert.deepEqual(plan.reverts, []);
});

test('décider une fois, puis automatique ; événement supprimé → retour à l\'habitude ; réglage à la main prioritaire', () => {
  const { a, b } = household();
  const foot6 = occ('Foot', '2026-10-06T19:30:00+02:00', '2026-10-06T21:30:00+02:00');
  const foot13 = occ('Foot', '2026-10-13T19:30:00+02:00', '2026-10-13T21:30:00+02:00');
  let plan = planAgenda(a.s, [feed('m1', foot6, foot13)], NOW);
  // Première fois : appliquer le 6 et retenir « pareil les prochaines fois ».
  a.emit(...(plan.changes[0]?.drafts ?? []), { t: 'agenda.rule', p: { key: ruleKey('Foot'), effect: 'auto' } });
  assert.equal(presence(a.s, '2026-10-06|soir', 'm1'), 'dehors');
  plan = planAgenda(a.s, [feed('m1', foot6, foot13)], NOW);
  assert.deepEqual(plan.changes.map(c => [c.slots[0], c.auto]), [['2026-10-13|soir', true]]); // le 13 : appliqué seul
  a.emit(...all(plan.changes.filter(c => c.auto).map(c => c.drafts)));
  // L'autre téléphone applique la même chose en même temps : rien de plus, rien en double.
  b.receive(a); b.emit(...(planAgenda(b.s, [feed('m1', foot6, foot13)], NOW).changes.flatMap(c => c.drafts)));
  a.receive(b);
  assert.deepEqual(planAgenda(a.s, [feed('m1', foot6, foot13)], NOW).changes, []);
  // Le foot du 13 est supprimé de l'agenda : Alex dîne à nouveau à la maison ce soir-là.
  plan = planAgenda(a.s, [feed('m1', foot6)], NOW);
  assert.deepEqual(plan.reverts.map(r => r.text), ['« Foot » n\'est plus dans l\'agenda : Alex comme d\'habitude mar. 13 oct. soir']);
  a.emit(...all(plan.reverts.map(r => r.drafts)));
  assert.equal(presence(a.s, '2026-10-13|soir', 'm1'), 'maison');
  assert.equal(a.s.agenda.marks['2026-10-13|soir|m1'], undefined);
  // Agenda illisible cette fois (pas dans les flux relus) : on ne défait rien.
  assert.deepEqual(planAgenda(a.s, [], NOW).reverts, []);
  // Sam corrige à la main le 6 (« Alex sera là finalement ») : l'agenda ne revient plus dessus, ni retour arrière.
  a.emit({ t: 'slot.presence', p: { slot: '2026-10-06|soir', member: 'm1', presence: 'maison' } });
  plan = planAgenda(a.s, [feed('m1', foot6, foot13)], NOW);
  assert.deepEqual(plan.changes.map(c => c.slots[0]), ['2026-10-13|soir']);
  assert.deepEqual(planAgenda(a.s, [feed('m1')], NOW).reverts.map(r => r.text), []);
});

test('réglage fait à la main avant l\'agenda : proposé, jamais appliqué seul ; « jamais » et « pas cette fois »', () => {
  const { a } = household();
  a.emit({ t: 'slot.presence', p: { slot: '2026-10-08|soir', member: 'm1', presence: 'maison' } },
    { t: 'agenda.rule', p: { key: ruleKey('Badminton'), effect: 'auto' } });
  const bad = occ('Badminton', '2026-10-08T19:00:00+02:00', '2026-10-08T21:00:00+02:00');
  assert.deepEqual(planAgenda(a.s, [feed('m1', bad)], NOW).changes.map(c => [c.manual, c.auto]), [[true, false]]);
  const yoga = occ('Yoga', '2026-10-07T19:00:00+02:00', '2026-10-07T21:00:00+02:00');
  const yoga2 = occ('Yoga', '2026-10-14T19:00:00+02:00', '2026-10-14T21:00:00+02:00');
  a.emit({ t: 'agenda.rule', p: { key: onceKey(yoga.id), effect: 'jamais' } });
  assert.deepEqual(planAgenda(a.s, [feed('m1', yoga, yoga2)], NOW).changes.map(c => c.slots[0]), ['2026-10-14|soir']);
  a.emit({ t: 'agenda.rule', p: { key: ruleKey('YOGA '), effect: 'jamais' } }); // même titre, casse et espaces près
  assert.deepEqual(planAgenda(a.s, [feed('m1', yoga, yoga2)], NOW).changes, []);
});

test('deux événements sur le même repas : un seul gagne, pas de ping-pong d\'une lecture à l\'autre', () => {
  const { a } = household();
  a.emit({ t: 'settings.set', p: { rhythm: defaultRhythm(['m1', 'm2'], 'boite', 'maison') } }, // midi en semaine : boîte
    { t: 'agenda.rule', p: { key: ruleKey('Télétravail'), effect: 'auto' } }, { t: 'agenda.rule', p: { key: ruleKey('Déjeuner client'), effect: 'auto' } });
  const f = feed('m1', occ('Télétravail', '2026-10-05T09:00:00+02:00', '2026-10-05T18:00:00+02:00'), occ('Déjeuner client', '2026-10-05T12:30:00+02:00', '2026-10-05T14:00:00+02:00'));
  for (let i = 0; i < 3; i++) a.emit(...planAgenda(a.s, [f], NOW).changes.filter(c => c.auto).flatMap(c => c.drafts));
  assert.equal(presence(a.s, '2026-10-05|midi', 'm1'), 'dehors'); // le repas dehors annoncé l'emporte
  assert.equal(a.log.filter(e => e.t === 'agenda.mark').length, 1);
  assert.deepEqual(planAgenda(a.s, [f], NOW).changes, []);
});

test('plus personne pour le plat prévu : il est décalé au prochain repas à la maison, avec l\'événement ou ensuite', () => {
  const { a, b } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } },
    { t: 'slot.cook', p: { slot: '2026-10-06|soir', prep: 'prep0001', recipe: 'curry001', extra: 0 } },
    { t: 'slot.cook', p: { slot: '2026-10-07|soir', prep: 'prep0002', recipe: 'curry001', extra: 0 } });
  // Agenda commun du foyer : restaurant à deux mardi soir → le curry passe au prochain soir libre (jeudi ; mercredi est pris).
  const resto = occ('Restaurant', '2026-10-06T20:00:00+02:00', '2026-10-06T22:30:00+02:00');
  const plan = planAgenda(a.s, [feed(null, resto)], NOW);
  assert.equal(changeText(a.s, plan.changes[0] as never), 'Alex et Sam absents mar. 6 oct. soir · Curry décalé à jeu. 8 oct. soir');
  a.emit(...(plan.changes[0]?.drafts ?? []));
  assert.equal(a.s.slots['2026-10-08|soir']?.dish?.kind, 'cook');
  assert.equal(a.s.slots['2026-10-06|soir']?.dish ?? null, null);
  // Deux agendas séparés, appliqués l'un après l'autre : le second vide le repas et emporte le plat.
  const s1 = occ('Foot', '2026-10-07T19:30:00+02:00', '2026-10-07T21:30:00+02:00'), s2 = occ('Soirée Julie', '2026-10-07T20:00:00+02:00', '2026-10-07T23:30:00+02:00');
  b.receive(a);
  a.emit(...(planAgenda(a.s, [feed('m1', s1)], NOW).changes[0]?.drafts ?? []));
  assert.equal(a.s.slots['2026-10-07|soir']?.dish?.kind, 'cook'); // Sam mange encore
  // Pendant ce temps, l'autre téléphone (pas encore synchronisé) applique la soirée de Sam : chacun croit que l'autre mange.
  b.emit(...(planAgenda(b.s, [feed('m2', s2)], NOW).changes[0]?.drafts ?? []));
  a.receive(b);
  assert.equal(a.s.slots['2026-10-07|soir']?.dish?.kind, 'cook'); // plus personne, plat encore là
  const after = planAgenda(a.s, [feed('m1', s1), feed('m2', s2)], NOW);
  assert.deepEqual(after.changes.map(c => [c.kind, c.auto, changeText(a.s, c)]), [['deplacer', true, 'Curry : plus personne mer. 7 oct. soir → décalé à ven. 9 oct. soir']]);
  a.emit(...(after.changes[0]?.drafts ?? []));
  assert.equal(a.s.slots['2026-10-09|soir']?.dish?.kind, 'cook');
  assert.deepEqual(planAgenda(a.s, [feed('m1', s1), feed('m2', s2)], NOW).changes, []);
});

test('jours fériés (Code du travail) : Pâques juste, férié en semaine = midi à la maison à confirmer, une décision pour tous', async () => {
  const { easter, holidays, holidayOccurrences } = await import('../src/core/feries.ts');
  assert.deepEqual([2024, 2025, 2026, 2027].map(easter), ['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28']);
  assert.equal(holidays(2026).length, 11);
  assert.deepEqual(holidays(2026).filter(h => /Ascension|Pentecôte/.test(h.name)).map(h => h.date), ['2026-05-14', '2026-05-25']);
  const { a } = household();
  a.emit({ t: 'settings.set', p: { rhythm: defaultRhythm(['m1', 'm2'], 'boite', 'maison') } });
  const fer = holidayOccurrences('2026-10-04', '2026-11-30');
  assert.deepEqual(fer.map(o => o.title), ['Jour férié (Toussaint)', 'Jour férié (Armistice)']);
  const plan = planAgenda(a.s, [{ cal: 'feries', member: null, label: 'Jours fériés', occurrences: fer }], NOW, 60);
  // Toussaint = dimanche (déjà à la maison) : rien ; Armistice = mercredi : midi à la maison pour les deux, au lieu de la boîte.
  assert.deepEqual(plan.changes.map(c => [c.kind, c.slots, changeText(a.s, c)]), [['maison', ['2026-11-11|midi'], 'Alex et Sam à la maison mer. 11 nov. midi']]);
  assert.equal(ruleKey('Jour férié (Noël)'), ruleKey('Jour férié (Armistice)'));
  assert.equal(ruleKey('Foot (décalé)'), ruleKey('Foot'));
});
