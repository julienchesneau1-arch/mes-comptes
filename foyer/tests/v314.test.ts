// V3.14 : dates lues sur l'emballage (texte scanné : « Scanner le texte » de l'iPhone), et dates utiles : un plat prévu après la DLC
// s'avance d'un toucher ; un produit qu'aucun plat prévu n'utilise fait proposer un de vos plats qui le contient.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, CURRY, NOW } from './helpers.ts';
import { readPrinted, matchesProduct } from '../src/core/printed.ts';
import { dlcAdvice } from '../src/core/dlc.ts';
import { exceptions } from '../src/core/exceptions.ts';
import { deriveToday } from '../src/core/today.ts';
import { nameKey } from '../src/core/text.ts';
import type { Draft } from '../src/core/reduce.ts';

const TODAY = '2026-10-04', SAT = '2026-10-10';
const read = (t: string, today = TODAY) => { const r = readPrinted(t, today); return r ? [r.kind, r.value, r.guessedYear] : null; };

test('date imprimée : formats français courants, mention DLC ou DDM, précision du mois ou de l\'année', () => {
  assert.deepEqual(read('A consommer jusqu\'au : 28/10/2026'), ['DLC', '2026-10-28', false]);
  assert.deepEqual(read('À CONSOMMER JUSQU\'AU 07.10.26  L1234  4,2°C'), ['DLC', '2026-10-07', false]);
  assert.deepEqual(read('A consommer de préférence avant le 12/03/2027'), ['DDM', '2027-03-12', false]);
  assert.deepEqual(read('À consommer de préférence avant fin : 03/2027'), ['DDM', '2027-03', false]);
  assert.deepEqual(read('DDM fin 2027'), ['DDM', '2027', false]);
  assert.deepEqual(read('Best before 12 JAN 2027'), ['DDM', '2027-01-12', false]);
  assert.deepEqual(read('10/2027'), ['DDM', '2027-10', false]);                 // sans jour : jamais une DLC
  assert.deepEqual(read('28 OCT 2026'), ['inconnu', '2026-10-28', false]);      // sans mention : type à choisir
});

test('date imprimée : emballage et ponte écartés, confusions de l\'OCR, année absente, rien d\'inventé', () => {
  assert.deepEqual(read('Emballé le 01/10/2026 A consommer jusqu\'au 08/10/2026'), ['DLC', '2026-10-08', false]);
  assert.deepEqual(read('Pondu le 01/10/2026 — à consommer de préférence avant le 29/10/2026'), ['DDM', '2026-10-29', false]);
  assert.deepEqual(read('A consommer jusqu\'au 1O/1O/2O26'), ['DLC', '2026-10-10', false]);
  assert.deepEqual(read('DLC 28/10'), ['DLC', '2026-10-28', true]);                       // année déduite, signalée
  assert.deepEqual(read('DLC 03/01', '2026-12-28'), ['DLC', '2027-01-03', true]);          // passage d'année
  assert.deepEqual(read('01/10/2026 08/10/2026'), ['inconnu', '2026-10-08', false]);       // la plus tardive
  assert.equal(read('Lot 280926 · 1.5 L · matière grasse 3.5 %'), null);
  assert.equal(read('A consommer jusqu\'au 31/02/2027'), null);                           // date impossible
  assert.equal(read('Fabriqué en 1998 · 15/06/1998'), null);                               // hors des années plausibles
  assert.equal(read('lot l0t ol'), null);
});

test('produit surveillé ↔ ingrédient : mots du plus court dans le plus long, pas les sous-chaînes', () => {
  const m = (ing: string, prod: string) => matchesProduct(nameKey(ing), nameKey(prod));
  assert.equal(m('blanc de poulet', 'Poulet'), true);
  assert.equal(m('600 g de poulet', 'Filets de poulet x2 300g'), true);
  assert.equal(m('crème fraîche', 'Crème fraîche épaisse 30 %'), true);
  assert.equal(m('oeuf', 'Bœuf haché'), false);
  assert.equal(m('carottes', 'Poulet'), false);
});

const setup = () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } },
    { t: 'recipe.save', p: { recipe: 'pates001', content: content('Pâtes au beurre', 2, ['200 g de pâtes', '20 g de beurre']) } },
    { t: 'watch.save', p: { id: 'poulet01', name: 'Poulet', qty: '', date: { kind: 'DLC', value: '2026-10-06' }, state: 'ferme', slot: null } });
  return a;
};
const dlcCard = (a: ReturnType<typeof setup>) => exceptions(a.r, deriveToday(a.r, NOW), 'm1', NOW).shown.find(e => e.code === 'dlc');
const draftsOf = (x: unknown): Draft[] => (x as { drafts?: Draft[] }).drafts ?? [];

test('plat prévu après la DLC : « Avancer » au repas le plus proche de la DLC, un toucher ; la carte disparaît', () => {
  const a = setup();
  a.emit({ t: 'slot.cook', p: { slot: `${SAT}|soir`, prep: 'prepcur1', recipe: 'curry001', extra: 0 } });
  const adv = dlcAdvice(a.s, TODAY, 12);
  assert.equal(adv.length, 1);
  assert.equal(adv[0]?.late?.slot, `${SAT}|soir`);
  assert.equal(adv[0]?.targets[0], '2026-10-06|soir');                     // le soir de la DLC, au plus près
  const card = dlcCard(a);
  assert.ok(card && /Poulet : à consommer avant le mar\. 6 oct\., mais Curry est prévu/.test(card.title), card?.title);
  const move = card.actions.find(x => x.label.startsWith('Avancer'));
  assert.ok(move);
  a.emit(...draftsOf(move));
  assert.equal(a.s.preps['prepcur1']?.slot, '2026-10-06|soir');
  assert.equal(dlcAdvice(a.s, TODAY, 12).length, 0);
  assert.equal(dlcCard(a), undefined);
});

test('aucun plat prévu ne l\'utilise : un de vos plats qui le contient, sur un repas libre d\'ici la DLC ; « Déjà utilisé » ferme', () => {
  const a = setup();
  const adv = dlcAdvice(a.s, TODAY, 12);
  assert.deepEqual(adv[0]?.recipes, ['curry001']);                           // pas les pâtes
  const card = dlcCard(a);
  assert.ok(card && /Vos plats qui en ont : Curry/.test(card.sub), card?.sub);
  const plan = card.actions.find(x => x.label.startsWith('Curry'));
  assert.ok(plan);
  a.emit(...draftsOf(plan));
  assert.equal(dlcAdvice(a.s, TODAY, 12).length, 0);                          // cuisiné à temps
  const b = setup();
  const used = dlcCard(b)?.actions.find(x => x.label === 'Déjà utilisé');
  b.emit(...draftsOf(used));
  assert.equal(b.s.watch['poulet01']?.closed, 'utilise');
});

test('rien ne presse : DDM, produit ouvert, DLC lointaine ou dépassée, plat cuisiné en batch avant la DLC', () => {
  const a = setup();
  const set = (date: { kind: 'DLC' | 'DDM'; value: string }, state: 'ferme' | 'ouvert' = 'ferme') =>
    a.emit({ t: 'watch.save', p: { id: 'poulet01', name: 'Poulet', qty: '', date, state, slot: null } });
  set({ kind: 'DDM', value: '2026-10-06' }); assert.equal(dlcAdvice(a.s, TODAY, 12).length, 0);
  set({ kind: 'DLC', value: '2026-10-06' }, 'ouvert'); assert.equal(dlcAdvice(a.s, TODAY, 12).length, 0);
  set({ kind: 'DLC', value: '2026-10-09' }); assert.equal(dlcAdvice(a.s, TODAY, 12).length, 0);
  set({ kind: 'DLC', value: '2026-10-03' }); assert.equal(dlcAdvice(a.s, TODAY, 12).length, 0);
  set({ kind: 'DLC', value: '2026-10-06' });
  a.emit({ t: 'slot.cook', p: { slot: `${SAT}|soir`, prep: 'prepcur1', recipe: 'curry001', extra: 0 } }, { t: 'prep.batch', p: { prep: 'prepcur1', day: '2026-10-05' } });
  assert.equal(dlcAdvice(a.s, TODAY, 12).length, 0);                         // cuisiné lundi, avant la DLC
});
