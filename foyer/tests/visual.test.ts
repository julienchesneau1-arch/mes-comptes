// Visuels de plats : chaque classique proposé à l'accueil a un visuel parlant ; même plat, même visuel ; jamais vide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dishLook } from '../src/core/visual.ts';
import { CLASSICS } from '../src/core/classics.ts';

test('les classiques ont un visuel parlant, choisi par le nom avant les ingrédients', () => {
  const expect: Record<string, string> = {
    'Pâtes bolognaise': '🍝', 'Curry de poulet': '🍛', 'Chili con carne': '🥘', 'Lasagnes': '🍝', 'Gratin dauphinois': '🧀', 'Quiche lorraine': '🥧',
    'Omelette': '🍳', 'Soupe de légumes': '🍲', 'Poulet rôti': '🍗', 'Pizza maison': '🍕', 'Tacos': '🌮', 'Burgers maison': '🍔', 'Saumon et légumes': '🐟',
    'Dahl de lentilles': '🍛', 'Riz cantonais': '🍚', 'Ratatouille': '🥦', 'Crêpes salées': '🥞', 'Steak et haricots verts': '🥩', 'Poisson pané et purée': '🐟',
  };
  for (const [name, emoji] of Object.entries(expect)) assert.equal(dishLook(name).emoji, emoji, name);
  for (const c of CLASSICS) assert.ok(dishLook(c).emoji && dishLook(c).theme, c);
  assert.equal(dishLook('Plat de mamie', ['500 g de cabillaud']).emoji, '🐟'); // nom muet : les ingrédients parlent
  assert.deepEqual(dishLook('Plat de mamie'), dishLook('plat de MAMIE'));   // stable
});
