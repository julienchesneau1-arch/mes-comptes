// Plats à découvrir (catalogue Wikilivres) : vos plats d'abord, une découverte par semaine, rien d'ajouté sans « Accepter ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, CURRY, MON, content } from './helpers.ts';
import { type Catalog, readCatalog, search, toContent } from '../src/core/catalog.ts';
import type { CatalogRecipe } from '../src/core/wikibook.ts';
import { proposeWeek, acceptDrafts, nextDiscovery } from '../src/core/propose.ts';
import { deriveShopping } from '../src/core/shopping.ts';
import { current } from '../src/core/model.ts';

const rec = (id: number, title: string, main: CatalogRecipe['main'], over: Partial<CatalogRecipe> = {}): CatalogRecipe => ({
  id: `wb${id}`, title, yield: 4, minutes: null, ingredients: ['600 g de poulet', '2 oignons', '20 cl de crème fraîche'], steps: ['Couper.', 'Cuire.'],
  tags: [], main, url: `https://fr.wikibooks.org/wiki/Livre_de_cuisine/${encodeURIComponent(title)}`, rev: 1, ...over });
const CAT: Catalog = readCatalog({ source: 'Wikilivres', sourceUrl: 'https://fr.wikibooks.org/wiki/Livre_de_cuisine', license: 'CC BY-SA 4.0', licenseUrl: '', note: '', generated: '2026-10-04', count: 7, recipes: [
  rec(1, 'Poulet basquaise', 'volaille'), rec(2, 'Poulet yassa', 'volaille'), rec(3, 'Hachis parmentier', 'viande', { ingredients: ['600 g de bœuf haché', '1 kg de pommes de terre', '20 cl de lait'] }),
  rec(4, 'Saumon en papillote', 'poisson', { minutes: 25, tags: ['rapide'], ingredients: ['4 pavés de saumon', '1 citron', '20 cl de crème fraîche'] }),
  rec(5, 'Ratatouille', null, { yield: null, tags: ['végétarien'], ingredients: ['3 aubergines', '2 courgettes', '400 g de tomates'] }), rec(6, 'Curry de lentilles', null, { tags: ['végétarien'], ingredients: ['300 g de lentilles corail', '40 cl de lait de coco', '1 oignon'] }),
  rec(7, 'Lapin moutarde', 'volaille', { ingredients: ['1 lapin', '2 c. à s. de moutarde', '20 cl de crème fraîche'] }),
  { id: 'pirate', title: 'X', yield: 4 } as unknown as CatalogRecipe, // mal formé : ignoré
] }) as Catalog;

test('catalogue relu : entrée mal formée ignorée ; recherche par texte, par famille, sans vos plats', () => {
  assert.equal(CAT.count, 7);
  const { a } = household();
  assert.deepEqual(search(a.s, CAT, 'poulet', 'tout').map(r => r.title), ['Poulet basquaise', 'Poulet yassa']);
  assert.deepEqual(search(a.s, CAT, '', 'poisson').map(r => r.title), ['Saumon en papillote']);
  assert.deepEqual(search(a.s, CAT, 'lentilles', 'végétarien').map(r => r.title), ['Curry de lentilles']);
  a.emit({ t: 'recipe.save', p: { recipe: 'basq0001', content: content('Poulet basquaise', 4, ['1 poulet']) } });
  assert.deepEqual(search(a.s, CAT, 'poulet', 'tout').map(r => r.title), ['Poulet yassa']); // déjà dans vos plats : masqué
});

test('réglage « équilibré », aucun plat encore : 3 découvertes variées au plus, jamais sans nombre de personnes', () => {
  const { a } = household();
  a.emit({ t: 'settings.set', p: { variety: 'equilibre' } });
  const props = proposeWeek(a.s, MON, '2026-10-04', 12, CAT);
  const fresh = props.filter(p => p.dish?.kind === 'new').map(p => p.dish?.kind === 'new' ? p.dish.catalog : null) as CatalogRecipe[];
  assert.equal(fresh.length, 3); // au-delà : trop d'achats inhabituels, les autres repas restent à choisir
  assert.ok(!fresh.some(r => r.yield === null));                         // Ratatouille (personnes non indiquées) jamais proposée d'office
  assert.equal(new Set(fresh.map(r => r.id)).size, fresh.length);         // pas deux fois la même
  // Varier : les trois premiers soirs, jamais la même famille (volaille, viande, poisson) deux soirs de suite.
  const dinners = ['2026-10-05', '2026-10-06', '2026-10-07'].map(d => { const p = props.find(x => x.slot === `${d}|soir`); return p?.dish?.kind === 'new' ? p.dish.catalog.main : 'absent'; });
  for (let i = 1; i < dinners.length; i++) assert.ok(dinners[i] === null || dinners[i] !== dinners[i - 1], `soirs : ${dinners.join(', ')}`);
  assert.deepEqual(proposeWeek(a.s, MON, '2026-10-04', 12, CAT), props);  // déterministe
});

test('réglage « équilibré », avec vos plats : une seule découverte par semaine, à la place de la proposition la moins convaincante', () => {
  const { a } = household();
  a.emit({ t: 'settings.set', p: { variety: 'equilibre' } });
  const names = ['Curry', 'Lasagnes', 'Omelette', 'Gratin', 'Tarte poireaux', 'Chili', 'Risotto', 'Quiche', 'Soupe', 'Pâtes bolo'];
  a.emit(...names.map((n, i) => ({ t: 'recipe.save' as const, p: { recipe: `rec${String(i).padStart(4, '0')}`, content: i === 0 ? CURRY : content(n, 4, ['500 g de légumes']) } })));
  const props = proposeWeek(a.s, MON, '2026-10-04', 12, CAT);
  assert.equal(props.filter(p => p.dish?.kind === 'new').length, 1);
  assert.ok(props.filter(p => p.dish?.kind === 'cook').length >= 5);
  assert.equal(proposeWeek(a.s, MON, '2026-10-04', 12, null).filter(p => p.dish?.kind === 'new').length, 0); // sans catalogue : comme avant
});

test('accepter une découverte : le plat entre dans « Nos plats » avec sa source, et les courses le comptent', () => {
  const { a } = household();
  const props = proposeWeek(a.s, MON, '2026-10-04', 12, CAT).filter(p => p.slot === `${MON}|soir`);
  assert.equal(props[0]?.dish?.kind, 'new');
  a.emit(...acceptDrafts(a.s, props));
  const r = Object.values(a.s.recipes)[0];
  assert.ok(r);
  const c = current(r!);
  assert.match(c.note, /Wikilivres, licence CC BY-SA 4\.0 : https:\/\/fr\.wikibooks\.org\/wiki\//);
  assert.ok(deriveShopping(a.s, MON).lines.length >= 2);
  const first = props[0]?.dish?.kind === 'new' ? props[0].dish.catalog : null;
  assert.deepEqual(toContent(first!).ingredients, c.ingredients);
  // « Autre idée » : jamais une recette déjà vue ou déjà dans vos plats.
  const alt = nextDiscovery(a.s, CAT, `${MON}|soir`, MON, new Set(['wb2', 'wb3']));
  assert.ok(alt && !['wb2', 'wb3', first?.id].includes(alt.recipe.id) && alt.recipe.yield !== null);
});
