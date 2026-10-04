// Catalogue Wikilivres : lecture du wikitexte de vraies pages, tri de ce qui est exploitable, rien d'inventé.
// Pages tirées du « Livre de cuisine » de Wikilivres (https://fr.wikibooks.org/wiki/Livre_de_cuisine), licence CC BY-SA 4.0,
// auteurs : voir l'historique de chaque page. Texte reproduit tel que renvoyé par l'API le 4 octobre 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWikiRecipe, plain, normalizeLine, type WikiPage } from '../src/core/wikibook.ts';
import { parseIngredient } from '../src/core/ingredients.ts';

const cat = (...xs: string[]) => xs.map(x => `Catégorie:${x}`);
const BASQUAISE: WikiPage = { pageid: 18950, revid: 1, title: 'Livre de cuisine/Poulet basquaise', categories: cat('Plat principal', 'Cuisine française', 'Recettes de tous les jours', 'Recettes de cuisine à base de poulet'),
  content: "{{livre de cuisine}}\n==Ingrédients==\nPour 4 personnes :\n\n* 1 {{i|poulet}}\n* 2 {{i|poivron}}s : un rouge, un vert (à l'origine du piment doux du Pays basque).\n* 6 {{i|tomate|tomates}}\n* 2 {{i|'=oui|oignon|oignons}}\n* 4 gousses d'{{i|'=oui|ail}}\n* {{i|'=oui|huile|huile d'olive}}\n* sel et {{i|piment|piment d'Espelette}}.\n\n* 1 sauteuse ou un autocuiseur\n\n== Préparation ==\n\n* Découper le poulet\n* Passer les tomates quelques secondes dans l'eau bouillante pour pouvoir les peler facilement.\n* Faire revenir le poulet au fond de la sauteuse avec 3 cuillères à soupe d'[[huile d'olive]] (ou de graisse d'oie ou canard), une fois doré : égoutter le poulet sur une grille)\n* Pendant ce temps, dans l'ordre :\n** peler et couper les oignons\n** couper les poivrons\n:Dès qu'un des légumes est coupé, le mettre à revenir dans la sauteuse, avec le reste (avant, penser à ajouter des lardons de {{w|jambon de Bayonne}} de 1 cm sur 1cm et les faire dorer légèrement).\n* Saler, poivrer\n\n[[Catégorie:Plat principal]]\n[[Catégorie:Cuisine française|{{SUBPAGENAME}}]]" };
const YASSA: WikiPage = { pageid: 28170, revid: 744098, title: 'Livre de cuisine/Poulet yassa', categories: cat('Livre de cuisine (livre)', "Recettes de cuisine à base d'ail", 'Recettes de cuisine à base de poulet', 'Recettes de tous les jours'),
  content: "{{Livre de cuisine}}\n\n* Pour : 5 personnes\n* Durée : 2 h 15\n* Difficulté : facile\n\n== Ingrédients ==\n\n* 1 {{i|poulet}}\n* 5 gros {{i|'=oui|oignon}}s \n* 1 gousse d'{{i|'=oui|ail}}\n* 1 verre de {{i|moutarde}} \n* sel \n* {{i|poivre}}\n* {{i|noix de muscade}} \n* 3 cubes de {{i|bouillon}} de volaille \n* {{i|'=oui|huile d'arachide}}\n\n== Préparation ==\n\n# Préparer tous les ingrédients\n# Découper le poulet en 10 morceaux.\n# Bien mélanger et laisser mariner 30 minutes.\n\n[[Catégorie:Recettes de tous les jours|Poulet Yassa]]" };
const ARACHIDE: WikiPage = { pageid: 59659, revid: 647612, title: 'Livre de cuisine/Sauce arachide poulet', categories: cat('Cuisine ivoirienne', 'Plat principal', 'Recettes de cuisine à base de poulet'),
  content: "{{livre de cuisine}}\n[[File:Poulet sauce arachide - Chicken on peanut sauce.jpg|thumb|Sauce arachide poulet]]\nLa '''sauce arachide''' est un met africain. Temps de préparation: 20 min ; Temps de cuisson: 50 min.\n\n=== Ingrédients ===\nPour 4 personnes.\n* Un demi {{i|poulet}}, nettoyé et coupé en morceaux\n* Trois cuillerées à soupe de pâte d'{{i|'=oui|arachide}}\n* 100 ml d'{{i|'=oui|huile}} végétale ou d'huile d'arachide\n* Deux {{i|tomate|tomates}} fraîches, écrasées\n* Un {{i|piment rouge}} frais  (facultatif)\n\n=== Ustensiles ===\n* Une casserole profonde (car la soupe remonte lors de la cuisson)\n\n=== Préparation ===\n# Assaisonner le poulet avec le poivre noir et le sel ;\n# Faire chauffer l'huile végétale dans une casserole et frire le poulet jusqu'à ce qu’il soit brun.\n\n[[Catégorie:Plat principal|Sauce arachide poulet]]" };
const ROTI: WikiPage = { pageid: 32814, revid: 655720, title: 'Livre de cuisine/Poulet rôti', categories: cat('Recettes de cuisine à base de poulet'),
  content: "{{Livre de cuisine}}\n\n== Ingrédients ==\n\n* 1 {{i|poulet}} (environ 1 kg)\n* 3 gousses d'{{i|'=oui|ail}}\n* 2 gros {{i|'=oui|oignon}}s\n\n== Préparation ==\n\n# Préchauffer le four à 200°C.\n# Enfourner." };

test('wikitexte : modèles d\'ingrédient, liens, images et catégories ramenés au texte affiché', () => {
  assert.equal(plain("2 {{i|'=oui|oignon|oignons}} et {{w|jambon de Bayonne}} [[huile d'olive]] [[Fichier:x.jpg|thumb|y]] [[Catégorie:Plat]] '''gras'''"), "2 oignons et jambon de Bayonne huile d'olive   gras");
  assert.equal(plain('{{Autres projets\n|  commons = x\n}}{{Sur Wikipédia|risotto}}fin'), 'fin');
});

test('ligne d\'ingrédient : nombres en lettres, taille et précisions en remarque', () => {
  assert.equal(normalizeLine('Un demi poulet, nettoyé et coupé en morceaux'), '1/2 poulet (nettoyé et coupé en morceaux)');
  assert.equal(normalizeLine('Deux tomates fraîches, écrasées'), '2 tomates fraîches (écrasées)');
  assert.equal(normalizeLine('5 gros oignons '), '5 oignons (gros)');
  assert.equal(normalizeLine("2 poivrons : un rouge, un vert (à l'origine du piment doux du Pays basque)."), "2 poivrons (un rouge, un vert ; à l'origine du piment doux du Pays…)");
  assert.equal(normalizeLine('Pommes de terre, carottes ou potiron (au choix)'), 'Pommes de terre, carottes ou potiron (au choix)'); // sans quantité : laissée telle quelle
  assert.deepEqual(parseIngredient(normalizeLine('5 gros oignons')).line, { name: 'Oignons', qty: '5', unit: 'piece', form: null, note: 'gros' });
});

test('recette retenue : personnes, ingrédients chiffrés, étapes, durée, famille et adresse source', () => {
  const r = parseWikiRecipe(BASQUAISE);
  assert.ok(r.ok, r.ok ? '' : r.why);
  if (!r.ok) return;
  assert.equal(r.recipe.title, 'Poulet basquaise');
  assert.equal(r.recipe.yield, 4);
  assert.equal(r.recipe.main, 'volaille');
  assert.ok(!r.recipe.ingredients.some(l => /sauteuse/.test(l)));   // ustensile écarté
  assert.ok(r.recipe.ingredients.includes('4 gousses d\'ail'));
  assert.ok(r.recipe.steps.some(s => /^Dès qu'un des légumes/.test(s) === false && /jambon de Bayonne/.test(s)));
  assert.equal(r.recipe.url, 'https://fr.wikibooks.org/wiki/Livre_de_cuisine/Poulet_basquaise');
  const y = parseWikiRecipe(YASSA);
  assert.ok(y.ok && y.recipe.yield === 5 && y.recipe.minutes === 135 && !y.recipe.tags.includes('rapide'));
  const a = parseWikiRecipe(ARACHIDE);
  assert.ok(a.ok, a.ok ? '' : a.why);
  if (!a.ok) return;
  assert.equal(a.recipe.minutes, 70);
  assert.ok(!a.recipe.ingredients.some(l => /casserole/.test(l)));   // section Ustensiles ignorée
  assert.equal(a.recipe.ingredients[0], '1/2 poulet (nettoyé et coupé en morceaux)');
  assert.deepEqual(parseIngredient(a.recipe.ingredients[1] ?? '').line.unit, 'cs');
});

const HACHIS: WikiPage = { pageid: 18484, revid: 2, title: 'Livre de cuisine/Hachis parmentier', categories: cat("Recettes de cuisine à base d'œuf", 'Recettes de cuisine à base de bœuf', 'Recettes de cuisine à base de pomme de terre'),
  content: "{{Livre de cuisine}}\n\nLe '''hachis parmentier''' est un plat.\n\n== Recette du hachis parmentier ==\n\n=== Ingrédients ===\nPour 4 personnes :\n* {{i|bœuf|Bœuf}} pour pot-au-feu, haché (600 g)\n* 1 {{i|'=oui|œuf}}\n* {{i|persil|Persil}} haché (2 cuillerées à soupe)\n* {{i|pomme de terre|pomme de terre}} « farineuses » (1 kg)\n* {{i|lait|Lait}} (1 quart de litre)\n* {{i|beurre|Beurre}} (100 grammes)\n\n=== Matériel ===\n* {{ustensile|Poêle}} pour faire cuire la viande\n\n=== Préparation ===\n# Préchauffer le four.\n# Faire gratiner au four (environ 25 minutes)." };
const RATATOUILLE: WikiPage = { pageid: 14625, revid: 3, title: 'Livre de cuisine/Ratatouille', categories: cat('Cuisine provençale', 'Recettes de cuisine à base d\'aubergine', 'Recettes végétaliennes', 'Recettes végétariennes'),
  content: "{{Livre de cuisine}}\n== Ingrédients ==\n* 3 {{i|'=oui|aubergine|aubergines}},\n* 2 {{i|courgette|courgettes}},\n* 400 g de {{i|tomate|tomates}},\n* sel, {{i|laurier}}.\n\n=== Préparation ===\n# Couper les aubergines.\n# Cuire 20 minutes." };

test('quantité notée entre parenthèses remise en tête ; plat végétarien gardé ; sans nombre de personnes : à préciser', () => {
  const h = parseWikiRecipe(HACHIS);
  assert.ok(h.ok, h.ok ? '' : h.why);
  if (!h.ok) return;
  assert.equal(h.recipe.main, 'viande');
  assert.deepEqual(h.recipe.ingredients.slice(0, 5), ['600 g Bœuf pour pot-au-feu (haché)', '1 œuf', '2 cuillerées à soupe Persil haché', '1 kg pomme de terre « farineuses »', 'Lait (1 quart de litre)']);
  assert.deepEqual(parseIngredient(h.recipe.ingredients[0] ?? '').line, { name: 'Bœuf pour pot-au-feu', qty: '600', unit: 'g', form: null, note: 'haché' });
  const r = parseWikiRecipe(RATATOUILLE);
  assert.ok(r.ok && r.recipe.yield === null && r.recipe.tags.includes('végétarien') && r.recipe.main === null);
  const roti = parseWikiRecipe(ROTI);
  assert.ok(roti.ok && roti.recipe.yield === null);
});

test('recettes écartées, avec la raison : dessert, accompagnement, catégorie d\'ingrédient sans effet', () => {
  assert.ok(parseWikiRecipe({ ...BASQUAISE, categories: [...BASQUAISE.categories, 'Catégorie:Recettes de cuisine à base de sucre glace'] }).ok); // ingrédient, pas type de plat
  assert.deepEqual(parseWikiRecipe({ ...BASQUAISE, categories: [...BASQUAISE.categories, 'Catégorie:Desserts'] }), { ok: false, why: 'dessert, boisson ou cuisine historique' });
  assert.deepEqual(parseWikiRecipe({ ...BASQUAISE, categories: cat('Accompagnements', 'Recettes de cuisine à base d\'œuf') }), { ok: false, why: 'pas un plat de repas' });
});

test('desserts et préparations de base non rangés en catégorie : reconnus au titre ou au sucre, jamais un plat avec viande', () => {
  const veg = cat('Recettes végétariennes');
  const page = (title: string, lines: string[], categories = veg): WikiPage => ({ pageid: 1, revid: 1, title: `Livre de cuisine/${title}`, categories,
    content: `== Ingrédients ==\nPour 4 personnes :\n${lines.map(l => `* ${l}`).join('\n')}\n== Préparation ==\n# Mélanger.\n# Cuire.` });
  const why = (r: ReturnType<typeof parseWikiRecipe>) => (r.ok ? 'gardé' : r.why);
  assert.equal(why(parseWikiRecipe(page('Fondant au chocolat', ['200 g de chocolat', '4 œufs', '100 g de beurre']))), 'dessert ou préparation de base');
  assert.equal(why(parseWikiRecipe(page('Gâteau simple', ['200 g de farine', '150 g de sucre', '3 œufs']))), 'dessert ou préparation de base');
  assert.equal(why(parseWikiRecipe(page('Douceur du soir', ['200 g de farine', '150 g de sucre', '3 œufs']))), 'dessert ou préparation de base'); // au sucre
  assert.equal(why(parseWikiRecipe(page('Gâteau au yaourt', ['1 pot de yaourt', '3 œufs', '2 pots de farine'], cat('Recettes végétariennes', 'Recettes de cuisine à base d\'œuf')))), 'dessert ou préparation de base');
  assert.equal(why(parseWikiRecipe(page('Tarte à la rhubarbe', ['500 g de rhubarbe', '1 pâte brisée', '2 œufs']))), 'dessert ou préparation de base');
  assert.equal(why(parseWikiRecipe(page('Bouillon de légumes', ['2 carottes', '1 poireau', '2 l d\'eau']))), 'dessert ou préparation de base');
  assert.equal(why(parseWikiRecipe(page('Pizza margherita', ['250 g de farine', '1 pincée de sucre', '200 g de mozzarella']))), 'gardé');
  assert.equal(why(parseWikiRecipe(page('Porc au caramel', ['600 g de porc', '50 g de sucre', '2 c. à s. de nuoc-mâm'], cat('Plat principal', 'Recettes de cuisine à base de porc')))), 'gardé');
  assert.equal(why(parseWikiRecipe(page('Salade de macaronis', ['250 g de macaronis', '2 tomates', '1 poivron']))), 'gardé');
  const c = parseWikiRecipe({ ...page('Choucroute pour 4', ['1 kg de choucroute', '4 saucisses', '500 g de pommes de terre'], cat('Recettes de cuisine à base de saucisse')), content: '== Ingrédients ==\n* 1 kg de choucroute\n* 4 saucisses\n* 500 g de pommes de terre\n== Préparation ==\n# Cuire.\n# Servir.' });
  assert.ok(c.ok && c.recipe.yield === 4); // nombre de personnes lu dans le titre
});
