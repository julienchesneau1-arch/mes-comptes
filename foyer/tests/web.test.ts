// Import d'une page web : formats schema.org rencontrés sur les sites de recettes (JSON-LD, @graph, sections, microdonnées).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractRecipe, decode } from '../src/core/recipe-web.ts';
import { fromWeb } from '../src/core/recipe-text.ts';

const page = (ld: string) => `<!doctype html><html><head><title>x</title><script type="application/ld+json">${ld}</script></head><body><h1>Recette</h1></body></html>`;

test('JSON-LD simple : nom, rendement, ingrédients, étapes HowToStep', () => {
  const r = extractRecipe(page(JSON.stringify({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'Curry de poulet', recipeYield: '4 personnes',
    recipeIngredient: ['600 g de blanc de poulet', '1 oignon', '40 cl de lait de coco'],
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Émincer l\'oignon.' }, { '@type': 'HowToStep', text: 'Cuire le poulet.' }] })), 'https://exemple.fr/curry');
  assert.deepEqual(r, { name: 'Curry de poulet', yieldText: '4 personnes', ingredients: ['600 g de blanc de poulet', '1 oignon', '40 cl de lait de coco'],
    steps: ['Émincer l\'oignon.', 'Cuire le poulet.'], source: 'https://exemple.fr/curry' });
  const p = fromWeb(r!);
  assert.equal(p.yield, 4);
  assert.deepEqual(p.ingredients.map(i => [i.line.name, i.line.qty, i.line.unit]), [['Blanc de poulet', '600', 'g'], ['Oignon', '1', 'piece'], ['Lait de coco', '40', 'cl']]);
});

test('@graph, type multiple, rendement en liste, entités HTML, sections d\'étapes', () => {
  const ld = `{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"Page"},{"@type":["Recipe","NewsArticle"],"name":"Gratin dauphinois","recipeYield":["6","6 parts"],
    "recipeIngredient":["1 kg de pommes de terre","50 cl de cr&egrave;me fra&icirc;che","1 gousse d&#39;ail"],
    "recipeInstructions":[{"@type":"HowToSection","name":"Préparation","itemListElement":[{"@type":"HowToStep","text":"Éplucher.<br>Trancher."}]},{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Cuire 1 h."}]}]}]}`;
  const r = extractRecipe(page(ld))!;
  assert.equal(r.name, 'Gratin dauphinois');
  assert.equal(r.yieldText, '6');
  assert.deepEqual(r.ingredients, ['1 kg de pommes de terre', '50 cl de crème fraîche', '1 gousse d\'ail']);
  assert.deepEqual(r.steps, ['Éplucher.\nTrancher.', 'Cuire 1 h.']);
});

test('étapes en un seul texte numéroté ; JSON avec virgule finale ; plusieurs blocs JSON-LD', () => {
  const html = `<script type="application/ld+json">{"@type":"Organization","name":"Site"}</script>
  <script type='application/ld+json'>{"@type":"Recipe","name":"Pâtes","recipeYield":2,"recipeIngredient":["200 g de pâtes",],"recipeInstructions":"1. Faire bouillir l'eau. 2. Cuire les pâtes.",}</script>`;
  const r = extractRecipe(html)!;
  assert.equal(r.yieldText, '2');
  assert.deepEqual(r.ingredients, ['200 g de pâtes']);
  assert.deepEqual(r.steps, ['Faire bouillir l\'eau.', 'Cuire les pâtes.']);
});

test('repli microdonnées ; page sans recette → rien', () => {
  const html = `<div itemscope itemtype="https://schema.org/Recipe"><h1 itemprop="name">Soupe</h1><meta itemprop="recipeYield" content="4">
    <li itemprop="recipeIngredient">1 kg de carottes</li><li itemprop="recipeIngredient">2 poireaux</li><div itemprop="recipeInstructions">Tout cuire.</div></div>`;
  assert.deepEqual(extractRecipe(html), { name: 'Soupe', yieldText: '4', ingredients: ['1 kg de carottes', '2 poireaux'], steps: ['Tout cuire.'], source: '' });
  assert.equal(extractRecipe('<html><body>Bonjour</body></html>'), null);
  assert.equal(extractRecipe(page('{"@type":"Article","name":"Pas une recette"}')), null);
  assert.equal(decode('&#x2F;&frac12;&inconnu;'), '/½&inconnu;');
});

test('la fonction serveur embarque exactement le même extracteur', () => {
  const a = readFileSync(new URL('../src/core/recipe-web.ts', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../supabase/functions/foyer-import/recipe-web.ts', import.meta.url), 'utf8');
  assert.equal(b, a);
});
