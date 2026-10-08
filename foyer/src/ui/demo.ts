// Mode découverte : un foyer fictif autour d'aujourd'hui, en mémoire seulement. Rien n'est enregistré ni envoyé.
import { type AnyEv, type RecipeContent, defaultRhythm } from '../core/model.ts';
import { type Draft, stamp } from '../core/reduce.ts';
import { parseIngredient } from '../core/ingredients.ts';
import { addDays, slotKey, weekday, paris } from '../core/dates.ts';

const rc = (name: string, y: number | null, lines: string[], extra: Partial<RecipeContent> = {}): RecipeContent =>
  ({ name, yield: y, ingredients: lines.map(l => parseIngredient(l).line), steps: [], ahead: [], tags: [], note: '', ...extra });

export function demoLog(now: Date): AnyEv[] {
  const { date: today } = paris(now);
  const yesterday = addDays(today, -1), tomorrow = addDays(today, 1);
  const saturday = addDays(today, ((5 - weekday(today) + 7) % 7) || 7);
  const d: Draft[] = [
    { t: 'household.init', p: { hid: 'demo0001', members: [{ id: 'alex', name: 'Alex' }, { id: 'sam', name: 'Sam' }],
      settings: { weekStart: 0, rhythm: defaultRhythm(['alex', 'sam'], 'dehors', 'maison').map((day, i) => i < 5 ? { ...day, midi: { alex: 'boite', sam: 'dehors' } } : day), boxesFromDinner: true } } },
    { t: 'recipe.save', p: { recipe: 'curry', content: rc('Curry de poulet', 4, ['600 g de blanc de poulet', '300 g de riz basmati cru', '400 ml de lait de coco', '1 oignon', '2 c. à soupe de pâte de curry'],
      { tags: ['rapide', 'favori'], ahead: [{ label: 'Sortir le poulet du congélateur', when: 'veille' }], steps: ['Faire revenir l\'oignon émincé.', 'Ajouter le poulet en dés et la pâte de curry.', 'Verser le lait de coco, laisser mijoter.', 'Cuire le riz.'] }) } },
    { t: 'recipe.save', p: { recipe: 'lasagnes', content: rc('Lasagnes', 6, ['500 g de bœuf haché', '1 boîte de tomates concassées (400 g)', '12 feuilles de lasagne', '50 cl de lait', '50 g de beurre', '50 g de farine', '100 g de gruyère râpé'], { tags: ['week-end', 'plat entier'] }) } },
    { t: 'recipe.save', p: { recipe: 'soupe', content: rc('Soupe de légumes', 4, ['1 kg de carottes', '2 poireaux', '1 pomme de terre', '1 cube de bouillon'], { tags: ['plat entier'] }) } },
    { t: 'recipe.save', p: { recipe: 'chili', content: rc('Chili con carne', 4, ['400 g de bœuf haché', '1 boîte de haricots rouges', '1 boîte de tomates concassées', '1 oignon']) } },
    { t: 'recipe.save', p: { recipe: 'tacos', content: rc('Tacos', null, []) } },
    { t: 'recipe.save', p: { recipe: 'omelette', content: rc('Omelette', 2, ['6 œufs', '50 g de fromage râpé'], { tags: ['rapide'] }) } },
    // Hier : chili préparé pour 4, 2 mangées → 2 portions libres.
    { t: 'slot.cook', p: { slot: slotKey(yesterday, 'soir'), prep: 'pchili', recipe: 'chili', extra: 2 } },
    { t: 'prep.done', p: { prep: 'pchili', yield: 4, planned: 4, version: 1 } },
    { t: 'slot.eaten', p: { slot: slotKey(yesterday, 'soir'), n: 2 } },
    // Ce soir : curry pour 4 (2 + boîte d'Alex demain + 1 en plus).
    { t: 'slot.cook', p: { slot: slotKey(today, 'soir'), prep: 'pcurry', recipe: 'curry', extra: 1 } },
    { t: 'slot.presence', p: { slot: slotKey(tomorrow, 'midi'), member: 'alex', presence: 'boite' } },
    { t: 'slot.from', p: { slot: slotKey(tomorrow, 'midi'), prep: 'pcurry' } },
    { t: 'slot.cook', p: { slot: slotKey(tomorrow, 'soir'), prep: 'psoupe', recipe: 'soupe', extra: 2 } }, // soupe pour 4 : 2 ce soir-là, 2 en plus
    { t: 'slot.cook', p: { slot: slotKey(addDays(today, 2), 'soir'), prep: 'ptacos', recipe: 'tacos', extra: 0 } },
    { t: 'slot.cook', p: { slot: slotKey(saturday, 'midi'), prep: 'plasagnes', recipe: 'lasagnes', extra: 4 } },
    { t: 'slot.presence', p: { slot: slotKey(addDays(today, 3), 'soir'), member: 'sam', presence: 'dehors' } },
    { t: 'watch.save', p: { id: 'wpoulet', name: 'Blanc de poulet', qty: '600 g', date: { kind: 'DLC', value: tomorrow }, state: 'ferme', slot: slotKey(today, 'soir') } },
    { t: 'watch.save', p: { id: 'wcreme', name: 'Crème fraîche', qty: '20 cl', date: { kind: 'DLC', value: addDays(today, 4) }, state: 'ouvert', slot: null } },
    { t: 'staple.set', p: { key: 'cafe', name: 'Café', qty: '1 paquet', aisle: 'sucre', removed: false } },
    { t: 'staple.set', p: { key: 'papier toilette', name: 'Papier toilette', qty: '', aisle: 'maison', removed: false } },
    // Rituel batch (courses le samedi, batch le dimanche), budget et un prix noté au drive.
    { t: 'settings.set', p: { ritual: { shop: 5, shopAt: '1700', cook: 6, cookAt: '0900' }, budget: 9000 } },
    { t: 'product.set', p: { key: 'blanc de poulet', url: 'https://www.auchan.fr/auchan-filet-de-poulet/pr-C1000003', label: 'Auchan filet de poulet', size: '300', unit: 'g', price: 499 } },
  ];
  return stamp({ dev: 'demo0000', by: 'alex', lc: 0, now }, d);
}
