// Zéro redondance, un maximum de nouveautés, et les repères d'équilibre de la semaine (Santé publique France).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { household, content, MON, NOW } from './helpers.ts';
import { validEvent, current } from '../src/core/model.ts';
import { type Catalog, readCatalog } from '../src/core/catalog.ts';
import type { CatalogRecipe } from '../src/core/wikibook.ts';
import { proposeWeek, acceptDrafts, rank, nextDiscovery } from '../src/core/propose.ts';
import { weekBalance, balanceBonus, running, isMeat, isFish, isLegume, isCharc } from '../src/core/balance.ts';
import { dishType } from '../src/core/visual.ts';

const rec = (id: number, title: string, main: CatalogRecipe['main'], over: Partial<CatalogRecipe> = {}): CatalogRecipe => ({
  id: `wb${id}`, title, yield: 4, minutes: null, ingredients: ['600 g de poulet', '2 oignons', '20 cl de crème fraîche'], steps: ['Couper.', 'Cuire.'],
  tags: [], main, url: `https://fr.wikibooks.org/wiki/Livre_de_cuisine/${encodeURIComponent(title)}`, rev: 1, ...over });
const CAT = readCatalog({ source: 'Wikilivres', sourceUrl: '', license: 'CC BY-SA 4.0', licenseUrl: '', note: '', generated: '2026-10-04', count: 7, recipes: [
  rec(1, 'Poulet basquaise', 'volaille'), rec(2, 'Poulet yassa', 'volaille'), rec(3, 'Hachis parmentier', 'viande', { ingredients: ['600 g de bœuf haché', '1 kg de pommes de terre', '20 cl de lait'] }),
  rec(4, 'Saumon en papillote', 'poisson', { ingredients: ['4 pavés de saumon', '1 citron', '20 cl de crème fraîche'] }),
  rec(5, 'Ratatouille', null, { yield: null, tags: ['végétarien'], ingredients: ['3 aubergines', '2 courgettes', '400 g de tomates'] }),
  rec(6, 'Curry de lentilles', null, { tags: ['végétarien'], ingredients: ['300 g de lentilles corail', '40 cl de lait de coco', '1 oignon'] }),
  rec(7, 'Lapin moutarde', 'volaille', { ingredients: ['1 lapin', '2 c. à s. de moutarde', '20 cl de crème fraîche'] }),
] }) as Catalog;

test('réglage « Nouveautés » validé strictement ; absent = maximum', () => {
  const ev = (p: unknown) => validEvent({ id: 'evt00001', lc: 1, dev: 'deva0001', by: null, at: NOW.toISOString(), t: 'settings.set', p });
  assert.ok(ev({ variety: 'max' }) && ev({ variety: 'equilibre' }) && ev({ variety: 'mes-plats' }));
  assert.equal(ev({ variety: 'beaucoup' }), null);
  assert.equal(household().a.s.settings.variety, undefined);
});

test('maximum de nouveautés : une recette nouvelle à chaque repas tant que le catalogue en a, jamais deux fois la même', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'omelet01', content: content('Omelette', 2, ['6 œufs']) } },
    { t: 'recipe.save', p: { recipe: 'quiche01', content: content('Quiche', 4, ['3 œufs', '200 g de lardons']) } });
  const props = proposeWeek(a.s, MON, '2026-10-04', 12, CAT);
  const fresh = props.filter(p => p.dish?.kind === 'new').map(p => (p.dish as { catalog: CatalogRecipe }).catalog.id);
  assert.equal(fresh.length, 7);                          // tout le catalogue d'essai, y compris la page sans nombre de personnes
  assert.equal(new Set(fresh).size, 7);
  const own = props.filter(p => p.dish?.kind === 'cook').map(p => (p.dish as { recipe: string }).recipe);
  assert.deepEqual(own.sort(), ['omelet01', 'quiche01']); // vos plats complètent quand le catalogue est épuisé
  // Valider une recette sans nombre de personnes : le nombre choisi par le foyer est enregistré.
  const rata = props.find(p => p.dish?.kind === 'new' && p.dish.catalog.yield === null)!;
  const drafts = acceptDrafts(a.s, [{ ...rata, dish: { ...(rata.dish as { kind: 'new'; catalog: CatalogRecipe; extra: number }), yield: 4 } }]);
  a.emit(...drafts);
  assert.equal(current(Object.values(a.s.recipes).find(r => current(r).name === 'Ratatouille')!).yield, 4);
});

test('aucune redondance : un plat prévu il y a moins de 2 semaines laisse sa place, sauf s\'il ne reste rien d\'autre', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'curry001', content: content('Curry', 4, ['600 g de poulet'], { tags: ['favori', 'rapide'] }) } },
    { t: 'recipe.save', p: { recipe: 'soupe001', content: content('Soupe', 4, ['1 kg de carottes']) } },
    { t: 'slot.cook', p: { slot: '2026-09-25|soir', prep: 'prepcur1', recipe: 'curry001', extra: 0 } },  // il y a 10 jours
    { t: 'slot.cook', p: { slot: '2026-09-15|soir', prep: 'prepsou1', recipe: 'soupe001', extra: 0 } }); // il y a 20 jours
  const slot = `${MON}|soir`;
  assert.equal(rank(a.s, slot, '2026-10-04')[0]?.name, 'Curry');                                   // sans la règle : le favori rapide
  assert.equal(rank(a.s, slot, '2026-10-04', new Set(), new Map(), { noRepeat: true })[0]?.name, 'Soupe');
  a.emit({ t: 'settings.set', p: { variety: 'mes-plats' } });
  const props = proposeWeek(a.s, MON, '2026-10-04', 12);
  assert.equal((props[0]?.dish as { recipe: string }).recipe, 'soupe001');
  assert.equal(new Set(props.filter(p => p.dish?.kind === 'cook').map(p => (p.dish as { recipe: string }).recipe)).size, 2); // jamais deux fois le même
});

test('varier les genres de plats dans la semaine ; découvertes déjà vues en dernier', () => {
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'lasagn01', content: content('Lasagnes', 4, ['500 g de bœuf haché']) } },
    { t: 'recipe.save', p: { recipe: 'ratat001', content: content('Ratatouille', 4, ['3 courgettes']) } });
  assert.equal(dishType('Lasagnes'), dishType('Spaghettis bolognaise'));
  assert.equal(rank(a.s, `${MON}|soir`, '2026-10-04')[0]?.name, 'Lasagnes');
  assert.equal(rank(a.s, `${MON}|soir`, '2026-10-04', new Set(), new Map(), { types: new Map([[dishType('Pâtes au thon') as string, 1]]) })[0]?.name, 'Ratatouille');
  const first = nextDiscovery(a.s, CAT, `${MON}|soir`, MON, new Set());
  const other = nextDiscovery(a.s, CAT, `${MON}|soir`, MON, new Set(), new Set([first!.recipe.id]));
  assert.notEqual(other?.recipe.id, first?.recipe.id);
});

test('repères de la semaine : poisson, poisson gras, légumes secs, viande hors volaille et charcuterie par personne', () => {
  assert.ok(isMeat('bœuf haché') && isMeat('côtes de porc') && !isMeat('bouillon de bœuf') && !isMeat('blanc de poulet') && !isMeat('lardons'));
  assert.ok(isCharc('lardons') && isFish('pavés de saumon') && isLegume('lentilles corail') && !isLegume('haricots verts'));
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'saumon01', content: content('Saumon', 2, ['2 pavés de saumon']) } },
    { t: 'recipe.save', p: { recipe: 'chili001', content: content('Chili', 4, ['600 g de bœuf haché', '400 g de haricots rouges']) } },
    { t: 'recipe.save', p: { recipe: 'quiche01', content: content('Quiche', 4, ['200 g de lardons', '3 œufs']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepsau1', recipe: 'saumon01', extra: 0 } },
    { t: 'slot.cook', p: { slot: '2026-10-06|soir', prep: 'prepchi1', recipe: 'chili001', extra: 0 } },
    { t: 'slot.presence', p: { slot: '2026-10-07|midi', member: 'm1', presence: 'boite' } },
    { t: 'slot.from', p: { slot: '2026-10-07|midi', prep: 'prepchi1' } },
    { t: 'slot.cook', p: { slot: '2026-10-08|soir', prep: 'prepqui1', recipe: 'quiche01', extra: 0 } });
  const b = weekBalance(a.s, MON);
  assert.deepEqual([b.meals, b.fish, b.oily, b.legumes], [4, 1, 1, 1]);
  assert.equal(b.meat.g, 300);   // Alex : chili mardi soir (150 g) + boîte mercredi (150 g) ; Sam : 150 g
  assert.equal(b.meat.meals, 2);
  assert.equal(b.charc.g, 50);   // 200 g de lardons pour 4
  const run = running(b);
  assert.deepEqual(balanceBonus(run, ['pavés de cabillaud']), { score: 10, why: 'poisson de la semaine' });
  assert.deepEqual(balanceBonus(run, ['lentilles']), { score: 10, why: 'légumes secs de la semaine' });
  assert.equal(balanceBonus({ ...run, meatMeals: 4 }, ['bœuf'])?.score, -12);
});

test('courses : ce qui s\'achète à l\'unité est arrondi, le besoin exact reste visible', async () => {
  const { deriveShopping, lineQty, exactNeed } = await import('../src/core/shopping.ts');
  const { a } = household();
  a.emit({ t: 'recipe.save', p: { recipe: 'basq0001', content: content('Poulet basquaise', 4, ['1 poulet', '3 poivrons', '300 g de riz']) } },
    { t: 'slot.cook', p: { slot: `${MON}|soir`, prep: 'prepbas1', recipe: 'basq0001', extra: 0 } }); // 2 portions sur 4
  const l = (n: string) => deriveShopping(a.s, MON).lines.find(x => x.name === n)!;
  assert.deepEqual([lineQty(l('Poulet')), exactNeed(l('Poulet'))], ['1 pièce', 'il en faut 0,5 pièce']);
  assert.deepEqual([lineQty(l('Poivrons')), exactNeed(l('Poivrons'))], ['2 pièces', 'il en faut 1,5 pièce']);
  assert.deepEqual([lineQty(l('Riz')), exactNeed(l('Riz'))], ['150 g', '']); // au poids : exact
});
