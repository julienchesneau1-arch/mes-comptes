// V3.17 : dates limites, menus et agenda liés. Un produit à DLC (ou DDM) fait proposer un plat qui l'utilise avant la date, dans la
// semaine générée comme dans les idées (vos plats et recettes prêtes) ; un plat que l'agenda décale ne passe jamais après la DLC
// sans le dire (repas libre d'ici là, sinon échange avec un plat sans urgence, sinon ⚠️) ; la carte « personne » et l'aperçu d'un
// déplacement font de même.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, CURRY, NOW, MON } from './helpers.ts';
import { type Catalog, readCatalog } from '../src/core/catalog.ts';
import type { CatalogRecipe } from '../src/core/wikibook.ts';
import { proposeWeek, rank, discoveriesFor } from '../src/core/propose.ts';
import { fitBudget } from '../src/core/weekgen.ts';
import { type Feed, planAgenda, changeText } from '../src/core/agenda.ts';
import type { Occurrence } from '../src/core/ical.ts';
import { exceptions } from '../src/core/exceptions.ts';
import { deriveToday } from '../src/core/today.ts';
import { previewChange } from '../src/core/preview.ts';
import { limits, dishLimit, lateDishes } from '../src/core/limits.ts';
import type { DateDecl } from '../src/core/model.ts';

const TODAY = '2026-10-04', SUN = '2026-10-04', TUE = '2026-10-06', WED = '2026-10-07', THU = '2026-10-08';
const rec = (id: number, title: string, ingredients: string[], main: CatalogRecipe['main'] = null): CatalogRecipe => ({
  id: `wb${id}`, title, yield: 4, minutes: null, ingredients, steps: ['Cuire.'], tags: [], main, url: `https://fr.wikibooks.org/wiki/Livre_de_cuisine/${id}`, rev: 1 });
const CAT = readCatalog({ source: 'Wikilivres', sourceUrl: '', license: 'CC BY-SA 4.0', licenseUrl: '', note: '', generated: TODAY, count: 4, recipes: [
  rec(1, 'Hachis parmentier', ['600 g de bœuf haché', '1 kg de pommes de terre'], 'viande'),
  rec(2, 'Saumon en papillote', ['4 pavés de saumon', '1 citron'], 'poisson'),
  rec(3, 'Curry de lentilles', ['300 g de lentilles corail', '40 cl de lait de coco']),
  rec(4, 'Poulet basquaise', ['600 g de poulet', '3 poivrons'], 'volaille'),
] }) as Catalog;
const PATES = content('Pâtes au beurre', 2, ['200 g de pâtes', '20 g de beurre']);
const watch = (id: string, name: string, date: DateDecl, state: 'ferme' | 'ouvert' = 'ferme') =>
  ({ t: 'watch.save' as const, p: { id, name, qty: '', date, state, slot: null } });
const cook = (slot: string, prep: string, recipe: string) => ({ t: 'slot.cook' as const, p: { slot, prep, recipe, extra: 0 } });
const setup = () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: CURRY } }, { t: 'recipe.save', p: { recipe: 'pates001', content: PATES } });
  return a;
};
let n = 0;
const occ = (title: string, start: string, end: string): Occurrence => ({
  id: (++n).toString(16).padStart(16, '0'), title, allDay: false, start: Date.parse(start), end: Date.parse(end), days: null, busy: true, recurring: false, tzGuess: false });
const resto = (day: string): Feed => ({ cal: 'calfoyer', member: null, label: 'Agenda', occurrences: [occ('Restaurant', `${day}T20:00:00+02:00`, `${day}T22:30:00+02:00`)] });

test('dates qui comptent : DLC avant DDM, au jour près seulement ; produit ouvert ou date au mois : rien', () => {
  const a = setup();
  a.emit(watch('w1', 'Pâtes', { kind: 'DDM', value: '2026-10-05' }), watch('w2', 'Poulet', { kind: 'DLC', value: WED }),
    watch('w3', 'Riz', { kind: 'DDM', value: '2027-03' }), watch('w4', 'Crème', { kind: 'DLC', value: TUE }, 'ouvert'));
  assert.deepEqual(limits(a.s).map(l => [l.name, l.kind]), [['Poulet', 'DLC'], ['Pâtes', 'DDM']]);
});

test('semaine générée : un plat qui utilise le poulet est réservé au premier repas d\'ici la DLC, recette prête comprise', () => {
  const a = setup();
  a.emit(watch('w1', 'Poulet', { kind: 'DLC', value: TUE }));
  const props = proposeWeek(a.s, MON, TODAY, 12, CAT);
  const first = props.find(p => p.slot === `${MON}|soir`);                   // lundi midi : personne (dehors en semaine)
  assert.equal(first?.dish?.kind === 'new' ? first.dish.catalog.title : first?.dish?.kind, 'Poulet basquaise');
  assert.match(first?.reason ?? '', /^à utiliser : poulet \(DLC mar\. 6 oct\.\)/);
  assert.deepEqual(props.map(p => p.slot), [...props.map(p => p.slot)].sort()); // toujours dans l'ordre des repas
  // Budget impossible : le plat qui utilise le poulet n'est jamais celui qu'on remplace pour économiser.
  const fit = fitBudget(a.s, props, 1, 0, () => [{ ...first!, dish: { kind: 'cook', recipe: 'pates001', extra: 0 }, reason: 'moins cher' }]);
  assert.ok(!fit.swapped.includes(`${MON}|soir`));
  // Déjà utilisé à temps par un plat prévu : rien de plus.
  a.emit(cook(`${MON}|soir`, 'prep0001', 'curry001'));
  const again = proposeWeek(a.s, MON, TODAY, 12, CAT);
  assert.ok(!again.some(p => /à utiliser : poulet/.test(p.reason)), JSON.stringify(again.map(p => p.reason)));
});

test('« mes plats » : un de vos plats qui l\'utilise, aussi pour une DDM (« de préférence avant ») ; jamais une recette prête', () => {
  const a = setup();
  a.emit({ t: 'settings.set', p: { variety: 'mes-plats' } }, watch('w1', 'Pâtes', { kind: 'DDM', value: WED }));
  const props = proposeWeek(a.s, MON, TODAY, 12, CAT);
  const p = props.find(x => /à utiliser : pâtes/.test(x.reason));
  assert.ok(p && p.slot <= `${WED}|soir` && p.dish?.kind === 'cook' && p.dish.recipe === 'pates001', JSON.stringify(p));
  assert.match(p.reason, /de préférence avant le mer\. 7 oct\./);
  // Idées d'un repas : vos plats (+15 pour une DDM) et recettes prêtes (+30 pour une DLC) disent pourquoi.
  assert.match(rank(a.s, `${MON}|soir`, TODAY)[0]?.reason ?? '', /utilise pâtes \(de préférence avant le mer\. 7 oct\.\)/);
  a.emit(watch('w2', 'Poulet', { kind: 'DLC', value: TUE }));
  const idea = discoveriesFor(a.s, CAT, `${MON}|soir`)[0];
  assert.equal(idea?.recipe.title, 'Poulet basquaise');
  assert.match(idea?.reason ?? '', /utilise poulet \(DLC mar\. 6 oct\.\)/);
});

test('agenda : plus personne pour le curry → décalé au repas libre d\'ici la DLC du poulet, et le texte le dit', () => {
  const a = setup();
  a.emit(watch('w1', 'Poulet', { kind: 'DLC', value: WED }), cook(`${TUE}|soir`, 'prep0001', 'curry001'));
  assert.equal(dishLimit(a.s, `${TUE}|soir`, TODAY)?.name, 'Poulet');
  const plan = planAgenda(a.s, [resto(TUE)], NOW);
  assert.equal(changeText(a.s, plan.changes[0] as never), 'Alex et Sam absents mar. 6 oct. soir · Curry décalé à mer. 7 oct. soir, avant la DLC (poulet, mer. 7 oct.)');
  // Mercredi soir déjà pris : le repas libre le plus proche avant (lundi soir), jamais jeudi.
  const b = setup();
  b.emit(watch('w1', 'Poulet', { kind: 'DLC', value: WED }), cook(`${TUE}|soir`, 'prep0001', 'curry001'), cook(`${WED}|soir`, 'prep0002', 'pates001'));
  const p2 = planAgenda(b.s, [resto(TUE)], NOW);
  assert.equal(changeText(b.s, p2.changes[0] as never), 'Alex et Sam absents mar. 6 oct. soir · Curry décalé à lun. 5 oct. soir, avant la DLC (poulet, mer. 7 oct.)');
});

test('agenda : aucun repas libre d\'ici la DLC → un plat sans urgence laisse sa place ; impossible → décalé quand même, ⚠️', () => {
  const a = setup();
  a.emit(watch('w1', 'Poulet', { kind: 'DLC', value: WED }), cook(`${TUE}|soir`, 'prep0001', 'curry001'),
    cook(`${SUN}|soir`, 'prep0002', 'pates001'), cook(`${MON}|soir`, 'prep0003', 'pates001'), cook(`${WED}|soir`, 'prep0004', 'pates001'));
  const plan = planAgenda(a.s, [resto(TUE)], NOW);
  assert.equal(changeText(a.s, plan.changes[0] as never),
    'Alex et Sam absents mar. 6 oct. soir · Pâtes au beurre décalé à jeu. 8 oct. soir, pour laisser sa place · Curry décalé à mer. 7 oct. soir, avant la DLC (poulet, mer. 7 oct.)');
  a.emit(...(plan.changes[0]?.drafts ?? []));
  assert.equal(a.s.preps['prep0001']?.slot, `${WED}|soir`);
  assert.equal(a.s.preps['prep0004']?.slot, `${THU}|soir`);
  assert.equal(lateDishes(a.s, TODAY).size, 0);
  // Tous les repas d'ici la DLC portent un plat qui l'utilise aussi : rien à échanger, le curry part jeudi et c'est dit.
  const b = setup();
  b.emit(watch('w1', 'Poulet', { kind: 'DLC', value: TUE }), cook(`${TUE}|soir`, 'prep0001', 'curry001'),
    cook(`${SUN}|soir`, 'prep0002', 'curry001'), cook(`${MON}|soir`, 'prep0003', 'curry001'));
  const p2 = planAgenda(b.s, [resto(TUE)], NOW);
  assert.equal(changeText(b.s, p2.changes[0] as never), 'Alex et Sam absents mar. 6 oct. soir · ⚠️ Curry décalé à mer. 7 oct. soir, après la DLC (poulet, mar. 6 oct.)');
});

test('carte « personne » : seulement des repas d\'ici la DLC ; aperçu d\'un déplacement après la DLC : dit avant d\'enregistrer', () => {
  const a = setup();
  a.emit(watch('w1', 'Poulet', { kind: 'DLC', value: WED }), cook(`${TUE}|soir`, 'prep0001', 'curry001'),
    { t: 'slot.presence', p: { slot: `${TUE}|soir`, member: 'm1', presence: 'dehors' } }, { t: 'slot.presence', p: { slot: `${TUE}|soir`, member: 'm2', presence: 'dehors' } });
  const card = exceptions(a.r, deriveToday(a.r, NOW), 'm1', NOW).shown.find(e => e.code === 'personne');
  assert.ok(card && /Le déplacer avant la DLC \(poulet, mer\. 7 oct\.\)/.test(card.sub), card?.sub);
  const targets = card.actions.flatMap(x => ('drafts' in x ? x.drafts : [])).flatMap(d => (d.t === 'slot.move' ? [d.p.to] : []));
  assert.ok(targets.length && targets.every(k => k <= `${WED}|soir`), JSON.stringify(targets));
  const pv = previewChange(a.log, { dev: 'deva0001', by: 'm1', lc: a.r.maxLc, now: NOW }, [{ t: 'slot.move', p: { from: `${TUE}|soir`, to: '2026-10-09|soir', swap: false } }], TODAY, 12, a.r);
  assert.ok(pv.impacts.some(i => i.level === 'attention' && /après la DLC \(poulet, mer\. 7 oct\.\)/.test(i.text)), JSON.stringify(pv.impacts));
});
