// Visuel d'un plat : un emoji et une couleur de fond, choisis par règles fixes sur le nom (puis les ingrédients).
// Aucune photo ni image téléchargée : rendu immédiat, hors ligne, identique sur les deux téléphones.
import { norm } from './text.ts';

export type Theme = 'tomato' | 'sun' | 'basil' | 'ocean' | 'berry' | 'grape' | 'choco' | 'cream' | 'none';
export interface Look { emoji: string; theme: Theme }

// L'ordre compte : « gratin de pâtes » est un gratin, « curry de poulet » un curry, « pâtes au thon » des pâtes.
const RULES: readonly [RegExp, string, Theme][] = [
  [/\bpizzas?\b/, '🍕', 'tomato'],
  [/\b(burgers?|hamburgers?)\b/, '🍔', 'sun'],
  [/\b(tacos?|fajitas?|burritos?|quesadillas?|nachos)\b/, '🌮', 'sun'],
  [/\b(sushis?|makis?|poke)\b/, '🍣', 'ocean'],
  [/\b(curry|dahl?|tikka|masala)\b/, '🍛', 'sun'],
  [/\b(soupes?|veloute|potage|bouillon|pho|ramen|minestrone|gaspacho)\b/, '🍲', 'basil'],
  [/\b(gratin|raclette|fondue|tartiflette|croque|mac and cheese)\b/, '🧀', 'sun'],
  [/\b(lasagnes?|pates?|spaghettis?|tagliatelles?|penne|macaronis?|carbonara|bolognaise|gnocchis?|raviolis?|nouilles|wok)\b/, '🍝', 'tomato'],
  [/\b(couscous|tajine|paella|chili|blanquette|bourguignon|pot au feu|ragout|mijote|cassoulet|choucroute)\b/, '🥘', 'choco'],
  [/\b(riz|risotto|biryani|cantonais)\b/, '🍚', 'cream'],
  [/\b(omelettes?|oeufs?|frittata|shakshuka)\b/, '🍳', 'sun'],
  [/\b(crepes?|galettes?|pancakes?)\b/, '🥞', 'cream'],
  [/\b(tartes?|tourtes?|quiches?|feuillete)\b/, '🥧', 'choco'],
  [/\b(salades?|taboule|bowl|buddha)\b/, '🥗', 'basil'],
  [/\b(sandwichs?|wraps?|paninis?|hot dogs?|kebab)\b/, '🥪', 'cream'],
  [/\b(poissons?|saumon|cabillaud|thon|colin|merlu|truite|sardines?|moules|crevettes?|fruits de mer|lieu|dorade|bar)\b/, '🐟', 'ocean'],
  [/\b(poulet|volaille|dinde|canard|pintade)\b/, '🍗', 'tomato'],
  [/\b(boeuf|steak|veau|agneau|roti|hachis|parmentier|boulettes|cote)\b/, '🥩', 'berry'],
  [/\b(porc|saucisses?|jambon|lardons|chorizo|travers)\b/, '🥓', 'berry'],
  [/\b(legumes?|ratatouille|courgettes?|aubergines?|poivrons?|brocolis?|epinards?|veggie|vegetarien|lentilles|pois chiches)\b/, '🥦', 'basil'],
  [/\b(pommes? de terre|frites|puree|patates?)\b/, '🥔', 'cream'],
  [/\b(gateau|cake|dessert|clafoutis|crumble)\b/, '🍰', 'grape'],
];
const FALLBACK: readonly Look[] = [{ emoji: '🍲', theme: 'grape' }, { emoji: '🥘', theme: 'choco' }, { emoji: '🍽️', theme: 'ocean' }, { emoji: '🫕', theme: 'sun' }];

const match = (text: string): Look | null => {
  const t = norm(text).replace(/[^a-z0-9]+/g, ' ');
  for (const [re, emoji, theme] of RULES) if (re.test(t)) return { emoji, theme };
  return null;
};

// Type de plat (pizza, curry, soupe, gratin, pâtes…) : sert aussi à varier la semaine. null = type non reconnu.
export function dishType(name: string, ingredients: readonly string[] = []): string | null {
  const m = match(name) ?? ingredients.slice(0, 4).map(match).find(Boolean) ?? null;
  return m ? m.emoji : null;
}

// Nom d'abord ; sinon les premiers ingrédients ; sinon un visuel stable tiré du nom (le même plat garde toujours le sien).
export function dishLook(name: string, ingredients: readonly string[] = []): Look {
  const byName = match(name);
  if (byName) return byName;
  for (const i of ingredients.slice(0, 4)) { const m = match(i); if (m) return m; }
  let h = 0;
  for (const ch of norm(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length] as Look;
}
