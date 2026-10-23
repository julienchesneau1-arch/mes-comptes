// Allergies et refus du foyer, comme chez Pimzi : les 14 allergènes à déclaration obligatoire (règlement (UE) n° 1169/2011,
// annexe II) et des aliments refusés. Lecture du NOM de l'ingrédient seulement, sans IA : « contient » quand l'ingrédient est
// l'allergène (beurre → lait), « à vérifier sur l'étiquette » quand un produit transformé en contient souvent (bouillon → céleri,
// gluten). Une recette qui « contient » un allergène exclu n'est plus proposée ; « à vérifier » reste proposé, avec l'alerte.
// Ce n'est pas un avis médical : la composition fait foi sur l'étiquette.
import { nameKey } from './text.js';
// Ordre et intitulés de l'annexe II.
export const ALLERGENS = [
    { id: 'gluten', label: 'Gluten', detail: 'blé, seigle, orge, avoine, épeautre, kamut' },
    { id: 'crustaces', label: 'Crustacés', detail: 'crevette, crabe, homard…' },
    { id: 'oeufs', label: 'Œufs', detail: '' },
    { id: 'poissons', label: 'Poissons', detail: '' },
    { id: 'arachides', label: 'Arachides', detail: 'cacahuète' },
    { id: 'soja', label: 'Soja', detail: '' },
    { id: 'lait', label: 'Lait', detail: 'beurre, crème, fromages…' },
    { id: 'fruits-a-coque', label: 'Fruits à coque', detail: 'amande, noisette, noix, cajou, pécan, noix du Brésil, pistache, macadamia' },
    { id: 'celeri', label: 'Céleri', detail: '' },
    { id: 'moutarde', label: 'Moutarde', detail: '' },
    { id: 'sesame', label: 'Sésame', detail: '' },
    { id: 'sulfites', label: 'Sulfites', detail: 'vin…' },
    { id: 'lupin', label: 'Lupin', detail: '' },
    { id: 'mollusques', label: 'Mollusques', detail: 'moule, calamar, saint-jacques…' },
];
const IDS = new Set(ALLERGENS.map(a => a.id));
export const isAllergen = (v) => typeof v === 'string' && IDS.has(v);
export const allergenLabel = (a) => ALLERGENS.find(x => x.id === a)?.label ?? a;
// Expression → [contient, à vérifier]. La plus longue l'emporte : « lait de coco » (rien) passe devant « lait » (lait),
// « noix de saint-jacques » (mollusques) devant « noix » (fruits à coque), « farine de sarrasin » (rien) devant « farine » (gluten).
const G = 'gluten', L = 'lait', O = 'oeufs', FC = 'fruits-a-coque', A = 'arachides', S = 'soja', P = 'poissons', C = 'crustaces', M = 'mollusques', CE = 'celeri', MO = 'moutarde', SE = 'sesame', SU = 'sulfites', LU = 'lupin';
const RULES = [
    // Sans allergène, malgré un mot qui ressemble.
    ['noix de coco', ''], ['lait de coco', ''], ['creme de coco', ''], ['farine de coco', ''], ['noix de muscade', ''], ['beurre de cacao', ''],
    ['creme de marron', ''], ['farine de riz', ''], ['farine de mais', ''], ['farine de sarrasin', ''], ['farine de ble noir', ''], ['ble noir', ''],
    ['farine de pois chiche', ''], ['farine de chataigne', ''], ['semoule de mais', ''], ['semoule de riz', ''], ['lait de riz', ''],
    ['nouille de riz', ''], ['vermicelle de riz', ''], ['galette de riz', ''], ['oeuf de lump', P], ['oeuf de saumon', P], ['oeuf de truite', P],
    ['germe de soja', '', S], ['pousse de soja', '', S], ['sel de celeri', CE], ['noix de veau', ''], ['noix de jambon', ''], ['noix de beurre', L],
    ['a la coque', ''], ['creme balsamique', '', SU], ['creme de balsamique', '', SU], ['creme de vinaigre balsamique', '', SU],
    ['lait d\'avoine', G], ['yaourt de soja', S], ['terrine', '', `${G} ${O} ${L}`],
    // Gluten.
    ['ble', G], ['farine', G], ['semoule', G], ['couscous', G], ['boulgour', G], ['epeautre', G], ['seigle', G], ['orge', G], ['avoine', G], ['kamut', G],
    ['malt', G], ['biere', G], ['pain', G], ['pain de mie', G, L], ['pain d\'epice', G, `${L} ${O}`], ['baguette', G], ['chapelure', G], ['biscotte', G],
    ['crouton', G], ['brioche', `${G} ${O} ${L}`], ['biscuit', G, `${L} ${O} ${FC}`], ['pate', G], ['pate fraiche', G, O],
    ['pate feuilletee', G, L], ['pate brisee', G, L], ['pate sablee', G, `${L} ${O}`], ['pate a pizza', G], ['pate d\'amande', FC],
    ['pate de curry', '', `${C} ${P}`], ['pate de sesame', SE], ['spaghetti', G], ['tagliatelle', G], ['penne', G], ['fusilli', G], ['coquillette', G],
    ['macaroni', G], ['farfalle', G], ['linguine', G], ['rigatoni', G], ['conchiglie', G], ['orzo', G], ['lasagne', G], ['cannelloni', G],
    ['ravioli', G, `${O} ${L}`], ['tortellini', G, `${O} ${L}`], ['gnocchi', G, O], ['nouille', G, O], ['vermicelle', G], ['tortilla', '', G], ['wrap', '', G],
    ['bechamel', `${L} ${G}`],
    // Lait.
    ['lait', L], ['beurre', L], ['creme', L], ['creme anglaise', `${L} ${O}`], ['fromage', L], ['fromage blanc', L], ['yaourt', L], ['yogourt', L],
    ['faisselle', L], ['petit-suisse', L], ['lactoserum', L], ['babeurre', L], ['kefir', L], ['ghee', L], ['skyr', L], ['parmesan', L], ['emmental', L],
    ['gruyere', L], ['comte', L], ['mozzarella', L], ['burrata', L], ['feta', L], ['ricotta', L], ['mascarpone', L], ['camembert', L], ['brie', L],
    ['roquefort', L], ['reblochon', L], ['raclette', L], ['chevre', L], ['cheddar', L], ['beaufort', L], ['cantal', L], ['mimolette', L], ['tomme', L],
    ['saint-nectaire', L], ['pecorino', L], ['gorgonzola', L], ['halloumi', L], ['coulommier', L], ['munster', L], ['morbier', L], ['bleu d\'auvergne', L],
    ['chocolat', '', `${L} ${S} ${FC}`], ['chocolat au lait', L, `${S} ${FC}`], ['pesto', L, FC],
    // Œufs.
    ['oeuf', O], ['mayonnaise', O, MO], ['meringue', O], ['aioli', O],
    // Fruits à coque (le pignon n'en est pas : il ne figure pas à l'annexe II).
    ['amande', FC], ['lait d\'amande', FC], ['noisette', FC], ['lait de noisette', FC], ['noix', FC], ['cajou', FC], ['noix de cajou', FC], ['pecan', FC],
    ['noix de pecan', FC], ['noix du bresil', FC], ['pistache', FC], ['macadamia', FC], ['noix de macadamia', FC], ['praline', FC], ['huile de noix', FC],
    ['huile de noisette', FC],
    // Arachides.
    ['arachide', A], ['cacahuete', A], ['beurre de cacahuete', A], ['beurre d\'arachide', A], ['huile d\'arachide', A],
    // Soja (l'huile de soja entièrement raffinée est exemptée : à vérifier).
    ['soja', S], ['sauce soja', S, G], ['lait de soja', S], ['creme de soja', S], ['tofu', S], ['tempeh', S], ['edamame', S], ['miso', S], ['tamari', S],
    ['huile de soja', '', S],
    // Poissons.
    ['poisson', P], ['sauce poisson', P], ['nuoc-mam', P], ['nuoc mam', P], ['sauce worcestershire', P, G], ['saumon', P], ['cabillaud', P], ['thon', P],
    ['merlan', P], ['sole', P], ['lotte', P], ['baudroie', P], ['colin', P], ['lieu', P], ['sardine', P], ['maquereau', P], ['truite', P], ['anchois', P],
    ['dorade', P], ['daurade', P], ['bar', P], ['hareng', P], ['eglefin', P], ['haddock', P], ['morue', P], ['fletan', P], ['tilapia', P], ['merlu', P],
    ['rouget', P], ['raie', P], ['turbot', P], ['sandre', P], ['brochet', P], ['carpe', P], ['espadon', P], ['surimi', P, `${O} ${G} ${C}`],
    ['tarama', P, `${O} ${L} ${G}`],
    // Crustacés et mollusques.
    ['crevette', C], ['gamba', C], ['langoustine', C], ['crabe', C], ['homard', C], ['ecrevisse', C], ['langouste', C], ['fruit de mer', `${C} ${M}`],
    ['moule', M], ['huitre', M], ['saint-jacques', M], ['noix de saint-jacques', M], ['coquille saint-jacques', M], ['calamar', M], ['calmar', M],
    ['encornet', M], ['seiche', M], ['poulpe', M], ['pieuvre', M], ['palourde', M], ['coque', M], ['bulot', M], ['bigorneau', M], ['escargot', M], ['praire', M],
    // Céleri, moutarde, sésame, lupin.
    ['celeri', CE], ['celeri-rave', CE], ['celeri branche', CE], ['bouillon', '', `${CE} ${G}`], ['cube de bouillon', '', `${CE} ${G}`],
    ['fond de veau', '', `${CE} ${G}`], ['fond de volaille', '', `${CE} ${G}`], ['curry', '', `${MO} ${CE}`],
    ['moutarde', MO], ['graine de moutarde', MO], ['vinaigrette', '', `${MO} ${SU}`],
    ['sesame', SE], ['graine de sesame', SE], ['huile de sesame', SE], ['tahini', SE], ['tahin', SE], ['houmous', SE], ['gomasio', SE], ['lupin', LU],
    // Sulfites.
    ['vin', SU], ['porto', SU], ['madere', SU], ['champagne', SU], ['xeres', SU], ['marsala', SU], ['vermouth', SU], ['cidre', '', SU],
    ['vinaigre', '', SU], ['vinaigre de vin', '', SU], ['vinaigre de vin blanc', '', SU], ['vinaigre de vin rouge', '', SU], ['abricot sec', '', SU], ['raisin sec', '', SU], ['fruit sec', '', SU],
    // Charcuteries : la recette varie d'un fabricant à l'autre.
    ['saucisse', '', `${G} ${L} ${MO} ${SU}`], ['chipolata', '', `${G} ${L} ${MO} ${SU}`], ['merguez', '', `${G} ${MO} ${SU}`], ['chorizo', '', `${L} ${G} ${SU}`],
];
// Mots d'un nom normalisé, l'apostrophe détachée : « poudre d'amande » → poudre, d', amande. « Pâté » (charcuterie) n'est pas
// « pâte » : il devient « terrine » avant que les accents ne soient retirés.
const words = (s) => nameKey(s.normalize('NFC').replace(/(^|[^a-zà-ÿ])pâtés?(?=$|[^a-zà-ÿ])/gi, '$1terrine'))
    .replace(/'/g, '\' ').split(' ').filter(Boolean);
const split = (x) => (x ?? '').split(' ').filter(isAllergen);
const BY_FIRST = new Map();
for (const [phrase, sure, maybe] of RULES) {
    const w = words(phrase), first = w[0];
    if (!first)
        continue;
    BY_FIRST.set(first, [...(BY_FIRST.get(first) ?? []), { w, sure: split(sure), maybe: split(maybe) }]);
}
for (const l of BY_FIRST.values())
    l.sort((a, b) => b.w.length - a.w.length);
const GLUTEN_FREE = words('sans gluten');
const contains = (hay, needle) => needle.length > 0 && hay.some((_, i) => needle.every((x, j) => hay[i + j] === x));
const CACHE = new Map();
// Allergènes d'un ingrédient d'après son nom : expressions les plus longues d'abord, de gauche à droite, sans chevauchement.
export function allergensOf(name) {
    const hit = CACHE.get(name);
    if (hit)
        return hit;
    const w = words(name), sure = new Set(), maybe = new Set();
    for (let i = 0; i < w.length;) {
        const r = (BY_FIRST.get(w[i]) ?? []).find(c => c.w.every((x, j) => w[i + j] === x));
        if (!r) {
            i++;
            continue;
        }
        for (const a of r.sure)
            sure.add(a);
        for (const a of r.maybe)
            maybe.add(a);
        i += r.w.length;
    }
    if (contains(w, GLUTEN_FREE)) {
        sure.delete('gluten');
        maybe.delete('gluten');
    } // « pâtes sans gluten »
    const out = { sure: [...sure], maybe: [...maybe].filter(a => !sure.has(a)) };
    if (CACHE.size > 5000)
        CACHE.clear();
    CACHE.set(name, out);
    return out;
}
export const MAX_FOODS = 20;
// « coriandre, porc ; champignons » → [« coriandre », « porc », « champignons »] (sans doublon, 20 au plus).
export function parseFoods(text) {
    const out = [], keys = new Set();
    for (const raw of text.split(/[,;\n]/)) {
        const f = raw.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40), k = words(f).join(' ');
        if (k && !keys.has(k)) {
            keys.add(k);
            out.push(f);
        }
    }
    return out.slice(0, MAX_FOODS);
}
// Familles : refuser « porc » écarte aussi la charcuterie de porc, « alcool » les vins et alcools. Un autre animal nommé
// (« jambon de dinde », « rillettes de thon ») ou « vinaigre », « sans alcool » l'emporte sur le mot de la famille, pas sur le mot refusé.
const FAMILIES = {
    porc: { words: ['cochon', 'lardon', 'jambon', 'bacon', 'saucisse', 'saucisson', 'chorizo', 'cervelas', 'rillettes', 'pancetta', 'coppa', 'andouille',
            'andouillette', 'boudin', 'chipolata', 'echine', 'travers', 'lard', 'saindoux', 'poitrine fumee', 'mortadelle', 'salami', 'prosciutto', 'speck', 'knack'],
        unless: ['dinde', 'volaille', 'poulet', 'boeuf', 'veau', 'agneau', 'mouton', 'canard', 'thon', 'saumon', 'sardine', 'poisson', 'vegetal', 'vegetale', 'soja'] },
    alcool: { words: ['vin', 'biere', 'cidre', 'calvados', 'rhum', 'cognac', 'armagnac', 'porto', 'madere', 'champagne', 'xeres', 'marsala', 'vermouth',
            'kirsch', 'whisky', 'vodka', 'liqueur', 'pastis', 'cointreau', 'grand marnier', 'gin', 'sake', 'mirin'], unless: ['vinaigre', 'sans alcool'] },
};
const FAMILY_WORDS = new Map(Object.entries(FAMILIES).map(([k, f]) => [words(k).join(' '), { words: f.words.map(words), unless: f.unless.map(words) }]));
const SANS = words('sans')[0];
// « bière sans alcool », « jambon sans porc » : le mot refusé précédé de « sans » ne compte pas.
const named = (w, fw) => fw.length > 0 && w.some((_, i) => w[i - 1] !== SANS && fw.every((x, j) => w[i + j] === x));
function refused(w, food) {
    const fw = words(food), fam = FAMILY_WORDS.get(fw.join(' '));
    if (named(w, fw))
        return true;
    return !!fam && fam.words.some(x => contains(w, x)) && !fam.unless.some(x => contains(w, x));
}
// Pourquoi un ingrédient est écarté : allergène exclu (« lait ») ou aliment refusé (« porc ») ; null s'il ne l'est pas.
export function blockedBy(ex, name) {
    if (!ex)
        return null;
    const a = allergensOf(name).sure.find(x => ex.allergens.includes(x));
    if (a)
        return { kind: 'allergene', what: allergenLabel(a).toLowerCase() };
    const w = words(name), f = ex.foods.find(x => refused(w, x));
    return f ? { kind: 'refus', what: f.toLowerCase() } : null;
}
// Plat écarté des propositions : un de ses ingrédients contient un allergène exclu ou un aliment refusé.
export function dishBlocked(ex, names) {
    if (!ex || (!ex.allergens.length && !ex.foods.length))
        return null;
    for (const n of names) {
        const b = blockedBy(ex, n);
        if (b)
            return { name: n, why: b.what };
    }
    return null;
}
// Alerte « à vérifier sur l'étiquette » : un allergène exclu possible dans un produit transformé (bouillon, sauce…).
export function labelCheck(ex, name) {
    if (!ex?.allergens.length)
        return [];
    return allergensOf(name).maybe.filter(a => ex.allergens.includes(a));
}
// Alerte d'une ligne de courses ou d'un article du drive ; vide si rien ne concerne le foyer.
export function lineAlert(ex, name) {
    const b = blockedBy(ex, name);
    if (b)
        return b.kind === 'allergene' ? `contient ${b.what} : exclu chez vous` : `${b.what} : refusé chez vous`;
    const m = labelCheck(ex, name);
    return m.length ? `étiquette à vérifier : ${m.map(a => allergenLabel(a).toLowerCase()).join(', ')}` : '';
}
// Allergènes d'un plat (« contient » et « à vérifier »), pour la fiche de la recette.
export function dishAllergens(names) {
    const sure = new Set(), maybe = new Set();
    for (const n of names) {
        const f = allergensOf(n);
        f.sure.forEach(a => sure.add(a));
        f.maybe.forEach(a => maybe.add(a));
    }
    const order = (xs) => ALLERGENS.map(a => a.id).filter(a => xs.has(a));
    return { sure: order(sure), maybe: order(maybe).filter(a => !sure.has(a)) };
}
