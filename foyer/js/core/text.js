// Normalisation des noms : « Pommes de terre » et « pomme de terre » sont la même ligne de courses.
const NORMS = new Map(); // mêmes titres et lignes du catalogue relus à chaque repas proposé : gardés
export const norm = (s) => {
    let n = NORMS.get(s);
    if (n === undefined) {
        n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
        if (NORMS.size > 20000)
            NORMS.clear();
        NORMS.set(s, n);
    }
    return n;
};
// Mots dont le « s », le « x » ou le « z » final n'est pas une marque de pluriel.
const INVARIANT = new Set(['riz', 'noix', 'pois', 'mais', 'anis', 'jus', 'radis', 'ananas', 'cassis', 'brebis', 'frais', 'gras',
    'paris', 'couscous', 'panais', 'salsifis', 'os', 'dos', 'chips', 'tapas', 'repas', 'bois', 'prix', 'tex-mex', 'lys', 'pastis',
    'gratis', 'cervelas', 'souris', 'colis', 'avis', 'fois', 'mois', 'temps', 'poids', 'corps']);
const X_PLURAL = /(eau|eu|au|ou)x$/; // « choux » → « chou », « poireaux » → « poireau »
export function singular(word) {
    if (word.length <= 3 || INVARIANT.has(word))
        return word;
    if (X_PLURAL.test(word))
        return word.slice(0, -1);
    if (word.endsWith('s') && !word.endsWith('ss'))
        return word.slice(0, -1);
    return word;
}
const ARTICLE = /^(?:de la |de l'|des |du |de |d'|la |le |les |l'|un |une )/;
const LINK = new Set(['de', 'du', 'des', "d'", 'a', 'au', 'aux', 'en', 'la', 'le', 'et']);
// Clé d'agrégation d'un ingrédient : sans article, sans accent, au singulier mot à mot. Gardée une fois calculée :
// la semaine proposée la redemande des dizaines de milliers de fois pour les mêmes lignes du catalogue.
const KEYS = new Map();
export function nameKey(name) {
    let k = KEYS.get(name);
    if (k === undefined) {
        if (KEYS.size > 20000)
            KEYS.clear();
        k = keyOf(name);
        KEYS.set(name, k);
    }
    return k;
}
function keyOf(name) {
    let s = norm(name).replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim();
    let prev = '';
    while (prev !== s) {
        prev = s;
        s = s.replace(ARTICLE, '');
    }
    return s.split(' ').filter(Boolean).map(w => (LINK.has(w) ? w : singular(w))).join(' ');
}
export const capitalize = (s) => (s ? s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1) : s);
export const plural = (n, one, many = `${one}s`) => `${String(n).replace('.', ',')} ${Math.abs(n) >= 2 ? many : one}`;
// Échappement HTML de tout texte saisi ou reçu par synchro : rien n'est injecté tel quel dans la page.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
