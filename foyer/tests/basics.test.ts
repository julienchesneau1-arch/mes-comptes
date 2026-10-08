import { test } from 'node:test';
import assert from 'node:assert/strict';
import { q, add, parseQ, formatQ, showQ, mul, div, qStr, qFrom } from '../src/core/rational.ts';
import { nameKey } from '../src/core/text.ts';
import { parseIngredient, aisleOf, lineLabel } from '../src/core/ingredients.ts';
import { paris, addDays, weekOf, weekday, fmtSlot, slotOrder, prevSlot, isDate } from '../src/core/dates.ts';
import { showQty } from '../src/core/units.ts';

test('fractions exactes, jamais de flottant binaire', () => {
  assert.deepEqual(add(parseQ('0,1')!, parseQ('0.2')!), q(3, 10));
  assert.deepEqual(div(mul(q(600), q(5)), q(3)), q(1000));
  assert.deepEqual(parseQ('1 1/2'), q(3, 2));
  assert.deepEqual(parseQ('½'), q(1, 2));
  assert.deepEqual(parseQ('1½'), q(3, 2));
  assert.equal(parseQ('quelques'), null);
  assert.equal(parseQ('1/0'), null);
  assert.deepEqual(formatQ(q(5, 2)), { text: '2,5', exact: true });
  assert.equal(showQ(q(200, 3)), '≈ 66,67');
  assert.equal(qStr(q(3, 2)), '3/2');
  assert.deepEqual(qFrom('3/2'), q(3, 2));
  assert.throws(() => q(Number.MAX_SAFE_INTEGER + 2));
});

test('noms : même ingrédient malgré pluriel, accents, articles', () => {
  assert.equal(nameKey('Pommes de terre'), nameKey('pomme de terre'));
  assert.equal(nameKey('Œufs'), 'oeuf');
  assert.equal(nameKey('choux de Bruxelles'), 'chou de bruxelle');
  assert.equal(nameKey('du riz'), 'riz');
  assert.equal(nameKey('Petits pois'), 'petit pois');
  assert.equal(nameKey("d'ail"), 'ail');
  assert.equal(nameKey('Poireaux'), 'poireau');
  assert.equal(nameKey('Noix'), 'noix');
});

test('saisie d\'ingrédient sans IA, rien de deviné en silence', () => {
  const p = (s: string) => parseIngredient(s).line;
  assert.deepEqual(p('600 g de poulet'), { name: 'Poulet', qty: '600', unit: 'g', form: null, note: '' });
  assert.deepEqual(p('600g poulet'), { name: 'Poulet', qty: '600', unit: 'g', form: null, note: '' });
  assert.deepEqual(p('Poulet : 600 g'), { name: 'Poulet', qty: '600', unit: 'g', form: null, note: '' });
  assert.deepEqual(p('2 oignons'), { name: 'Oignons', qty: '2', unit: 'piece', form: null, note: '' });
  assert.deepEqual(p('1,5 kg de pommes de terre'), { name: 'Pommes de terre', qty: '3/2', unit: 'kg', form: null, note: '' });
  assert.deepEqual(p('300 g riz cru'), { name: 'Riz', qty: '300', unit: 'g', form: 'cru', note: '' });
  assert.deepEqual(p('1 c. à soupe de curry'), { name: 'Curry', qty: '1', unit: 'cs', form: null, note: '' });
  assert.deepEqual(p('2 cuillères à café de cumin'), { name: 'Cumin', qty: '2', unit: 'cc', form: null, note: '' });
  assert.deepEqual(p('1 cuillère de miel'), { name: 'Miel', qty: '1', unit: 'cuillere', form: null, note: '' });
  assert.deepEqual(p('3 gousses d\'ail'), { name: 'Ail', qty: '3', unit: 'gousse', form: null, note: '' });
  assert.deepEqual(p('2 gousses d’ail'), { name: 'Ail', qty: '2', unit: 'gousse', form: null, note: '' }); // apostrophe typographique (catalogue)
  assert.equal(p('2 cl d’huile d’olive').name, 'Huile d’olive');
  assert.deepEqual(p('- 1 boîte de tomates concassées (400 g)'), { name: 'Tomates concassées', qty: '1', unit: 'boite', form: null, note: '400 g' });
  assert.deepEqual(p('½ citron'), { name: 'Citron', qty: '1/2', unit: 'piece', form: null, note: '' });
  assert.deepEqual(p('Sel'), { name: 'Sel', qty: null, unit: null, form: null, note: '' });
  assert.deepEqual(p('20 cl de crème liquide'), { name: 'Crème liquide', qty: '20', unit: 'cl', form: null, note: '' });
  assert.deepEqual(p('épinards surgelés 450 g'), { name: 'Épinards', qty: '450', unit: 'g', form: 'surgelé', note: '' });
  assert.equal(lineLabel(p('600 g de poulet')), '600 g · Poulet');
});

test('rayons : dictionnaire, plus long mot-clé gagnant, choix du foyer prioritaire', () => {
  assert.equal(aisleOf('Lait de coco', null), 'epicerie');
  assert.equal(aisleOf('Lait', null), 'cremerie');
  assert.equal(aisleOf('Pommes de terre', null), 'fruits-legumes');
  assert.equal(aisleOf('Pâte feuilletée', null), 'frais');
  assert.equal(aisleOf('Pâtes', null), 'epicerie');
  assert.equal(aisleOf('Blanc de poulet', null), 'boucherie');
  assert.equal(aisleOf('Épinards', 'surgelé'), 'surgeles');
  assert.equal(aisleOf('Truc inconnu', null), 'autres');
  assert.equal(aisleOf('Lait', null, { lait: 'boissons' }), 'boissons');
  assert.equal(aisleOf('Sel lave-vaisselle', null), 'maison');
});

test('unités : conversion seulement dans la même dimension', () => {
  assert.equal(showQty(q(1500), 'masse'), '1,5 kg');
  assert.equal(showQty(q(450), 'masse'), '450 g');
  assert.equal(showQty(q(200), 'volume'), '200 ml');
  assert.equal(showQty(q(5, 2), 'piece'), '2,5 pièces');
  assert.equal(showQty(q(1, 2), 'piece'), '0,5 pièce');
  assert.equal(showQty(q(2), 'cs'), '2 c. à s.');
});

test('dates : heure de Paris, minuit et changement d\'heure', () => {
  assert.equal(paris(new Date('2026-10-04T21:59:00Z')).date, '2026-10-04'); // 23 h 59 à Paris (UTC+2)
  assert.equal(paris(new Date('2026-10-04T22:00:00Z')).date, '2026-10-05'); // minuit à Paris
  assert.equal(paris(new Date('2026-10-24T22:30:00Z')).date, '2026-10-25'); // nuit du changement d'heure, 0 h 30
  assert.equal(paris(new Date('2026-10-25T22:30:00Z')).date, '2026-10-25'); // UTC+1 désormais : 23 h 30
  assert.equal(paris(new Date('2026-03-29T00:30:00Z')).hour, 1);
  assert.equal(paris(new Date('2026-03-29T01:30:00Z')).hour, 3);           // passage à l'heure d'été
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(weekday('2026-10-05'), 0);
  assert.equal(weekOf('2026-10-04', 0), '2026-09-28');
  assert.equal(weekOf('2026-10-04', 6), '2026-10-04');
  assert.equal(fmtSlot('2026-10-05|soir', '2026-10-04'), 'demain soir');
  assert.equal(fmtSlot('2026-10-07|midi', '2026-10-04'), 'mercredi midi');
  assert.ok(slotOrder('2026-10-05|midi') < slotOrder('2026-10-05|soir'));
  assert.equal(prevSlot('2026-10-06|midi'), '2026-10-05|soir');
  assert.equal(isDate('2026-02-30'), false);
});

import { parseRecipeText, lineText } from '../src/core/recipe-text.ts';
test('coller une recette : nom, rendement, ingrédients, étapes ; aller-retour du texte éditable', () => {
  const r = parseRecipeText(`Curry de poulet (pour 4 personnes)

Ingrédients
- 600 g de blanc de poulet
- 1 oignon
- 2 c. à soupe de pâte de curry
- 40 cl de lait de coco
- sel

Préparation
1. Couper le poulet.
2. Faire revenir l'oignon puis ajouter le reste.`);
  assert.equal(r.name, 'Curry de poulet');
  assert.equal(r.yield, 4);
  assert.deepEqual(r.ingredients.map(i => [i.line.name, i.line.qty, i.line.unit]), [
    ['Blanc de poulet', '600', 'g'], ['Oignon', '1', 'piece'], ['Pâte de curry', '2', 'cs'], ['Lait de coco', '40', 'cl'], ['Sel', null, null]]);
  assert.deepEqual(r.steps, ['Couper le poulet.', 'Faire revenir l\'oignon puis ajouter le reste.']);
  const free = parseRecipeText('Salade express\n200 g de feta\n1 concombre\nCouper tout en dés et mélanger avec l\'huile.');
  assert.deepEqual([free.name, free.ingredients.length, free.steps.length], ['Salade express', 2, 1]);
  for (const s of ['600 g de poulet', '1,5 kg de pommes de terre', '300 g riz cru', '1 c. à soupe de curry', '½ citron', '1 boîte de tomates (400 g)', 'sel', '2 gousses d\'ail']) {
    const l = parseIngredient(s).line;
    assert.deepEqual(parseIngredient(lineText(l)).line, l, s);
  }
});
