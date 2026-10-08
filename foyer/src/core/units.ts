// Unités : on ne convertit qu'à l'intérieur d'une même dimension et seulement par des facteurs exacts (kg → g, cl → ml).
// Une cuillère, une gousse, une boîte restent chacune leur propre dimension : aucune conversion inventée.
import { type Q, q, mul, div, cmp, showQ } from './rational.ts';
import { norm } from './text.ts';

export interface Unit { readonly id: string; readonly one: string; readonly many: string; readonly dim: string; readonly toBase: Q }

const u = (id: string, one: string, many: string, dim: string, toBase: Q = q(1)): Unit => ({ id, one, many, dim, toBase });

export const UNITS: readonly Unit[] = [
  u('g', 'g', 'g', 'masse'), u('kg', 'kg', 'kg', 'masse', q(1000)), u('mg', 'mg', 'mg', 'masse', q(1, 1000)),
  u('ml', 'ml', 'ml', 'volume'), u('cl', 'cl', 'cl', 'volume', q(10)), u('dl', 'dl', 'dl', 'volume', q(100)), u('l', 'l', 'l', 'volume', q(1000)),
  u('piece', 'pièce', 'pièces', 'piece'),
  u('cs', 'c. à s.', 'c. à s.', 'cs'), u('cc', 'c. à c.', 'c. à c.', 'cc'), u('pincee', 'pincée', 'pincées', 'pincee'),
  u('gousse', 'gousse', 'gousses', 'gousse'), u('tranche', 'tranche', 'tranches', 'tranche'), u('boite', 'boîte', 'boîtes', 'boite'),
  u('sachet', 'sachet', 'sachets', 'sachet'), u('botte', 'botte', 'bottes', 'botte'), u('brin', 'brin', 'brins', 'brin'),
  u('feuille', 'feuille', 'feuilles', 'feuille'), u('paquet', 'paquet', 'paquets', 'paquet'), u('pot', 'pot', 'pots', 'pot'),
  u('verre', 'verre', 'verres', 'verre'), u('filet', 'filet', 'filets', 'filet'), u('poignee', 'poignée', 'poignées', 'poignee'),
  u('cube', 'cube', 'cubes', 'cube'), u('bouquet', 'bouquet', 'bouquets', 'bouquet'), u('branche', 'branche', 'branches', 'branche'),
  u('tablette', 'tablette', 'tablettes', 'tablette'), u('barquette', 'barquette', 'barquettes', 'barquette'),
  u('bocal', 'bocal', 'bocaux', 'bocal'), u('brique', 'brique', 'briques', 'brique'), u('bouteille', 'bouteille', 'bouteilles', 'bouteille'),
  u('rouleau', 'rouleau', 'rouleaux', 'rouleau'), u('pave', 'pavé', 'pavés', 'pave'), u('tasse', 'tasse', 'tasses', 'tasse'),
  u('cuillere', 'cuillère', 'cuillères', 'cuillere'), // « 1 cuillère de miel » : ni c. à s. ni c. à c., on ne devine pas
];
export const UNIT: Readonly<Record<string, Unit>> = Object.fromEntries(UNITS.map(x => [x.id, x]));

// Alias saisis → unité. Comparés mot à mot sur le texte normalisé (sans accent, minuscules).
const ALIASES: Record<string, readonly string[]> = {
  g: ['g', 'g.', 'gr', 'gr.', 'gramme', 'grammes'], kg: ['kg', 'kilo', 'kilos', 'kilogramme', 'kilogrammes'], mg: ['mg', 'milligramme', 'milligrammes'],
  ml: ['ml', 'millilitre', 'millilitres'], cl: ['cl', 'centilitre', 'centilitres'], dl: ['dl', 'decilitre', 'decilitres'],
  l: ['l', 'litre', 'litres', 'lt'],
  piece: ['piece', 'pieces', 'pc', 'pcs', 'unite', 'unites'],
  cs: ['cs', 'c.s', 'c.s.', 'cas', 'c.a.s', 'c.a.s.', 'c. a s.', 'c. a s', 'c a s', 'c. a soupe', 'c.a soupe', 'cuil. a soupe', 'cuill. a soupe',
    'cuillere a soupe', 'cuilleres a soupe', 'cuilleree a soupe', 'cuillerees a soupe', 'cuiller a soupe', 'cuillers a soupe', 'cuillere soupe', 'cuilleres soupe', 'tbsp'],
  cc: ['cc', 'c.c', 'c.c.', 'cac', 'c.a.c', 'c.a.c.', 'c. a c.', 'c. a c', 'c a c', 'c. a cafe', 'c.a cafe', 'cuil. a cafe', 'cuill. a cafe',
    'cuillere a cafe', 'cuilleres a cafe', 'cuilleree a cafe', 'cuillerees a cafe', 'cuiller a cafe', 'cuillers a cafe', 'cuillere cafe', 'cuilleres cafe', 'tsp'],
};
for (const x of UNITS) if (!ALIASES[x.id]) ALIASES[x.id] = [norm(x.one), norm(x.many)];
ALIASES['pincee'] = ['pincee', 'pincees', 'pince'];

// Alias découpés en mots, du plus long au plus court : « cuillère à soupe » passe avant « cuillère ».
const ALIAS_TOKENS: readonly { unit: Unit; tokens: readonly string[] }[] = Object.entries(ALIASES)
  .flatMap(([id, list]) => list.map(a => ({ unit: UNIT[id] as Unit, tokens: a.split(' ') })))
  .sort((a, b) => b.tokens.length - a.tokens.length || b.tokens.join(' ').length - a.tokens.join(' ').length);

// Cherche une unité au début d'une suite de mots ; renvoie l'unité et le nombre de mots consommés.
export function matchUnit(words: readonly string[]): { unit: Unit; used: number } | null {
  const nw = words.map(norm);
  for (const a of ALIAS_TOKENS) {
    if (a.tokens.length > nw.length) continue;
    if (a.tokens.every((t, i) => nw[i] === t)) return { unit: a.unit, used: a.tokens.length };
  }
  return null;
}

export const toBase = (qty: Q, unit: Unit): Q => mul(qty, unit.toBase);

// Affichage d'une quantité exprimée dans l'unité de base de sa dimension.
export function showQty(base: Q, dim: string, unitHint?: Unit): string {
  if (dim === 'masse') return cmp(base, q(1000)) >= 0 ? `${showQ(div(base, q(1000)), 3)} kg` : `${showQ(base, 1)} g`;
  if (dim === 'volume') return cmp(base, q(1000)) >= 0 ? `${showQ(div(base, q(1000)), 3)} l` : `${showQ(base, 1)} ml`;
  // Accord français : pluriel à partir de 2 (« 1,5 pièce », « 2 pièces »).
  if (dim === 'piece') return `${showQ(base, 2)} ${cmp(base, q(2)) >= 0 ? 'pièces' : 'pièce'}`;
  const unit = unitHint ?? UNIT[dim];
  if (!unit) return showQ(base, 2);
  return `${showQ(base, 2)} ${cmp(base, q(2)) >= 0 ? unit.many : unit.one}`;
}
