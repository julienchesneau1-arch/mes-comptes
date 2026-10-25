// Portions « en plus » reprises par un repas suivant (2 ce soir + 2 en plus, puis le même plat demain midi = 4, pas 6) ;
// usage compté sur le téléphone : raccourcis stables dans la journée, épinglés d'abord, rien d'inventé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, MON } from './helpers.ts';
import { setDish, setLeftovers, reusable } from '../src/core/commands.ts';
import { portions } from '../src/core/plan.ts';
import { acceptDrafts, type Proposal } from '../src/core/propose.ts';
import { emptyUsage, readUsage, record, counts, shortcuts, unused, top, KEEP_DAYS } from '../src/core/usage.ts';
import { addDays } from '../src/core/dates.ts';

const TUE = '2026-10-06';
const setup = () => {
  const { a } = household();   // midi en semaine dehors, soir à la maison (2 personnes)
  a.emit({ t: 'recipe.save', p: { recipe: 'spag0001', content: content('Spaghetti', 2, ['300 g de spaghetti']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'pspag001', recipe: 'spag0001', extra: 2 } },
    { t: 'slot.presence', p: { slot: `${TUE}|midi`, member: 'm1', presence: 'maison' } }, { t: 'slot.presence', p: { slot: `${TUE}|midi`, member: 'm2', presence: 'maison' } });
  return a;
};
const planned = (a: ReturnType<typeof setup>) => Object.values(a.s.preps).reduce((n, p) => n + portions(a.s, p).planned, 0);

test('portions en plus : le même plat le lendemain midi les reprend (4 portions, une seule préparation)', () => {
  const a = setup();
  assert.equal(planned(a), 4);                                                       // 2 ce soir + 2 en plus
  assert.equal(reusable(a.s, `${TUE}|midi`, 'spag0001')?.id, 'pspag001');
  a.emit(...setDish(a.s, `${TUE}|midi`, 'spag0001'));
  assert.equal(Object.keys(a.s.preps).length, 1);
  assert.deepEqual(a.s.slots[`${TUE}|midi`]?.dish, { kind: 'from', prep: 'pspag001' });
  assert.equal(a.s.preps['pspag001']?.extra, 0);
  assert.equal(planned(a), 4);                                                       // avant le correctif : 6
});

test('portions en plus : « cuisiner à nouveau » reste possible ; « en cuisiner plus » les reprend aussi ; au-delà de 6 jours, rien', () => {
  const a = setup();
  a.emit(...setDish(a.s, `${TUE}|midi`, 'spag0001', true));                         // le cuisiner quand même à nouveau
  assert.equal(Object.keys(a.s.preps).length, 2);
  assert.equal(planned(a), 6);
  const b = setup();
  b.emit(...setLeftovers(b.s, `${TUE}|midi`, 'pspag001'));                          // feuille « Choisir un plat » › Restes
  assert.equal(planned(b), 4);
  assert.equal(reusable(b.s, '2026-10-12|soir', 'spag0001'), null);                // 7 jours plus tard : pas de reprise
});

test('portions en plus : la semaine générée qui met des boîtes sur un plat déjà prévu les reprend une seule fois', () => {
  const a = setup();
  const props: Proposal[] = [{ slot: `${TUE}|midi`, dish: { kind: 'from', source: `${MON}|soir`, prep: null }, reason: '', presence: {}, guests: 0 }];
  a.emit(...acceptDrafts(a.s, props));
  assert.equal(a.s.preps['pspag001']?.extra, 0);
  assert.equal(planned(a), 4);
});

test('portions déjà prêtes : le même plat choisi plus tard reprend les restes libres, sans recuisiner', () => {
  const a = setup();
  a.emit({ t: 'prep.done', p: { prep: 'pspag001', yield: 4, planned: 4, version: 1 } });
  a.emit(...setDish(a.s, `${TUE}|midi`, 'spag0001'));
  assert.equal(Object.keys(a.s.preps).length, 1);
  assert.equal(portions(a.s, a.s.preps['pspag001']!).free, 0);
});

test('usage : compté par jour, gardé 60 jours, relu sans rien de mal formé', () => {
  const u = emptyUsage('2026-08-01');
  record(u, 'a:propose', '2026-08-01'); record(u, 'x:pas-une-cle', '2026-08-01'); record(u, 'r:spag0001', '2026-10-24');
  assert.deepEqual(Object.keys(u.days), ['2026-08-01', '2026-10-24'].filter(d => d >= addDays('2026-10-24', -KEEP_DAYS)));
  assert.equal(counts(u, '2026-10-25').get('r:spag0001'), 1);
  assert.equal(counts(u, '2026-10-24').get('r:spag0001'), undefined);              // aujourd'hui ne compte pas encore : stable dans la journée
  assert.equal(counts(u, '2026-10-24', 30, true).get('r:spag0001'), 1);
  const back = readUsage(JSON.parse(JSON.stringify({ ...u, days: { ...u.days, 'nimporte': { 'a:x': 1 }, '2026-10-23': { 'a:propose': -2, 'a:drive': 2 } } })), '2026-10-25');
  assert.deepEqual(back.days['2026-10-23'], { 'a:drive': 2 });
  assert.equal(back.days['nimporte'], undefined);
  assert.deepEqual(readUsage('n\'importe quoi', '2026-10-25'), emptyUsage('2026-10-25'));
});

test('raccourcis : épinglés d\'abord, puis ce qui sert au moins 3 fois en 30 jours ; 4 au plus ; jamais une recette disparue', () => {
  const u = emptyUsage('2026-09-01');
  const hit = (k: string, n: number, day = '2026-10-20') => { for (let i = 0; i < n; i++) record(u, k, day); };
  hit('r:spag0001', 6); hit('a:drive', 4); hit('a:invoice', 2); hit('r:gone0001', 9); hit('a:slot', 20); hit('a:discover', 3); hit('a:propose', 3);
  const ok = (id: string) => id !== 'gone0001';
  assert.deepEqual(shortcuts(u, '2026-10-25', [], ok).map(x => x.key), ['r:spag0001', 'a:drive', 'a:discover', 'a:propose']); // « a:slot » n'est pas un raccourci
  assert.deepEqual(shortcuts(u, '2026-10-25', ['a:invoice'], ok).map(x => [x.key, x.pinned]), [['a:invoice', true], ['r:spag0001', false], ['a:drive', false], ['a:discover', false]]);
  assert.deepEqual(shortcuts(emptyUsage('2026-10-25'), '2026-10-25', [], ok), []);  // rien de compté : aucune suggestion inventée
  assert.equal(top(u, '2026-10-25', 1)[0]?.[0], 'a:slot');
});

test('outils pas servis : seulement après deux semaines de mesure', () => {
  const u = emptyUsage('2026-10-20');
  record(u, 'a:propose', '2026-10-21');
  assert.equal(unused(u, '2026-10-25'), null);
  const later = unused(u, '2026-11-05');
  assert.ok(later && !later.some(f => f.key === 'a:propose') && later.some(f => f.key === 'a:invoice'));
});
