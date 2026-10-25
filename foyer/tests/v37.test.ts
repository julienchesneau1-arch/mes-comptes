// V3.7 : « on refait ? » après le repas (👍 favori, 👎 rangé et plus jamais proposé, sans avis), « Ça coince » (gênes notées sur
// le téléphone, jamais envoyées), mode essentiel (fonctions avancées masquées tant qu'elles ne servent pas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, NOW } from './helpers.ts';
import { deriveToday } from '../src/core/today.ts';
import { exceptions, avisKey, type Exception } from '../src/core/exceptions.ts';
import { current } from '../src/core/model.ts';
import { type Catalog, readCatalog, search } from '../src/core/catalog.ts';
import { readFrictions, addFriction, report, MAX_FRICTIONS, MAX_NOTE, type Friction } from '../src/core/coince.ts';
import { inUse, shown, readChoices } from '../src/core/modules.ts';

const SAT = '2026-10-03', THU = '2026-10-01';
const avis = (a: ReturnType<typeof household>['a']): Exception | undefined => {
  const x = exceptions(a.r, deriveToday(a.r, NOW), 'm1', NOW);
  return [...x.shown, ...x.hidden].find(e => e.code === 'avis');
};
const eaten = (day = SAT) => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: content('Curry', 2, ['600 g de poulet']) } },
    { t: 'slot.cook', p: { slot: `${day}|soir`, prep: 'pcurry01', recipe: 'curry001', extra: 0 } },
    { t: 'prep.done', p: { prep: 'pcurry01', yield: 2, planned: 2, version: 1 } },
    { t: 'slot.eaten', p: { slot: `${day}|soir`, n: 2 } });
  return a;
};
const act = (x: Exception, label: RegExp) => { const a = x.actions.find(y => label.test(y.label)); assert.ok(a && 'drafts' in a); return a.drafts; };

test('après le repas : « Curry : on refait ? » une fois ; 👍 = favori, la question ne revient plus', () => {
  const a = eaten();
  const x = avis(a);
  assert.equal(x?.title, 'Curry : on refait ?');
  assert.deepEqual(x?.actions.map(y => y.label), ['👍 À refaire', '👎 Plus jamais', 'Sans avis']);
  a.emit(...act(x!, /À refaire/));
  assert.ok(current(a.s.recipes['curry001']!).tags.includes('favori'));
  assert.equal(avis(a), undefined);
});

test('👎 : plat rangé, plus jamais proposé ni repris des recettes prêtes ; « Sans avis » : plus de question ; trop ancien : rien', () => {
  const a = eaten();
  a.emit(...act(avis(a)!, /Plus jamais/));
  assert.equal(a.s.recipes['curry001']?.archived, true);
  assert.equal(avis(a), undefined);
  const cat = readCatalog({ source: 'Wikilivres', sourceUrl: '', license: 'CC BY-SA 4.0', licenseUrl: '', note: '', generated: '2026-10-04', count: 1,
    recipes: [{ id: 'wb1', title: 'Curry', yield: 4, minutes: null, ingredients: ['600 g de poulet', '1 oignon', '20 cl de lait de coco'], steps: ['Couper.', 'Cuire.'], tags: [], main: 'volaille', url: 'https://fr.wikibooks.org/wiki/Livre_de_cuisine/Curry', rev: 1 }] }) as Catalog;
  assert.deepEqual(search(a.s, cat, 'curry', 'tout'), []);                   // rangé : la recette prête du même nom ne revient pas
  const b = eaten();
  b.emit(...act(avis(b)!, /Sans avis/));
  assert.equal(b.s.tasks[avisKey('curry001')]?.done, true);
  assert.equal(avis(b), undefined);
  assert.equal(avis(eaten(THU)), undefined);                                // mangé il y a 3 jours : on ne demande plus
});

test('« Ça coince » : note nettoyée et bornée, 100 au plus, liste relue sans entrée mal formée, texte à copier', () => {
  const f = (n: number, note = ''): Friction => ({ at: `0${n % 9}/10 12:00`, screen: 'Courses', kind: 'long', note, steps: ['pick', 'slot', 'pas une action !'] });
  let list: Friction[] = [];
  for (let i = 0; i < MAX_FRICTIONS + 5; i++) list = addFriction(list, f(i));
  assert.equal(list.length, MAX_FRICTIONS);
  const one = addFriction([], f(1, `  trop\nde   clics ${'x'.repeat(400)}`))[0]!;
  assert.equal(one.note.length, MAX_NOTE);
  assert.ok(one.note.startsWith('trop de clics'));
  assert.deepEqual(one.steps, ['pick', 'slot']);                             // seulement des noms d'actions
  assert.deepEqual(readFrictions([{ at: 'x', screen: 'Semaine', kind: 'inconnu', note: '', steps: [] }, 'n\'importe quoi', null]), []);
  const txt = report(addFriction(addFriction([], f(1, 'premier')), { ...f(2, 'second'), kind: 'flou', screen: 'Semaine' }), '3.7');
  assert.equal(txt.split('\n')[0], 'Foyer 3.7 · 2 gênes notées');
  assert.match(txt.split('\n')[1] ?? '', /^02\/10 12:00 · Semaine · Pas compris · « second » · après : pick › slot$/); // la plus récente d'abord
});

test('mode essentiel : fonctions avancées masquées tant qu\'elles ne servent pas ; un choix explicite l\'emporte', () => {
  const { a } = household();
  for (const m of ['batch', 'budget', 'agenda', 'factures', 'placard'] as const) assert.equal(shown(a.s, {}, m), false);
  a.emit({ t: 'settings.set', p: { budget: 15000 } });
  assert.equal(inUse(a.s, 'budget'), true);                                  // budget fixé (à l'accueil ou plus tard) : affiché
  assert.equal(shown(a.s, { budget: false }, 'budget'), false);             // masqué à la main : masqué
  assert.equal(shown(a.s, { placard: true }, 'placard'), true);
  assert.deepEqual(readChoices({ batch: true, budget: 'oui', autre: true }), { batch: true });
});
