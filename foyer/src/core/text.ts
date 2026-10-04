// Normalisation des noms : « Pommes de terre » et « pomme de terre » sont la même ligne de courses.

export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

// Mots dont le « s », le « x » ou le « z » final n'est pas une marque de pluriel.
const INVARIANT = new Set(['riz', 'noix', 'pois', 'mais', 'anis', 'jus', 'radis', 'ananas', 'cassis', 'brebis', 'frais', 'gras',
  'paris', 'couscous', 'panais', 'salsifis', 'os', 'dos', 'chips', 'tapas', 'repas', 'bois', 'prix', 'tex-mex', 'lys', 'pastis',
  'gratis', 'cervelas', 'souris', 'colis', 'avis', 'fois', 'mois', 'temps', 'poids', 'corps']);
const X_PLURAL = /(eau|eu|au|ou)x$/; // « choux » → « chou », « poireaux » → « poireau »

export function singular(word: string): string {
  if (word.length <= 3 || INVARIANT.has(word)) return word;
  if (X_PLURAL.test(word)) return word.slice(0, -1);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

const ARTICLE = /^(?:de la |de l'|des |du |de |d'|la |le |les |l'|un |une )/;
const LINK = new Set(['de', 'du', 'des', "d'", 'a', 'au', 'aux', 'en', 'la', 'le', 'et']);

// Clé d'agrégation d'un ingrédient : sans article, sans accent, au singulier mot à mot.
export function nameKey(name: string): string {
  let s = norm(name).replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim();
  let prev = '';
  while (prev !== s) { prev = s; s = s.replace(ARTICLE, ''); }
  return s.split(' ').filter(Boolean).map(w => (LINK.has(w) ? w : singular(w))).join(' ');
}

export const capitalize = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1) : s);

export const plural = (n: number, one: string, many = `${one}s`): string => `${String(n).replace('.', ',')} ${Math.abs(n) >= 2 ? many : one}`;

// Échappement HTML de tout texte saisi ou reçu par synchro : rien n'est injecté tel quel dans la page.
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
