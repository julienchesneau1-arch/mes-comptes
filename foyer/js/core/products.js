// Étude qualité-prix des produits vendus chez Auchan, sans rien saisir et sans IA (aucun token) :
// - qualité : base ouverte Open Food Facts (Nutri-Score, groupe NOVA de transformation, labels bio, Label Rouge, AOP/IGP) ;
// - prix : relevés datés de la base ouverte Open Prices (tickets et étiquettes photographiés par des contributeurs),
//   ceux d'un magasin Auchan d'abord. Ce ne sont pas les prix du site Auchan (ses CGU interdisent de les extraire).
// Le fichier produits.json est régénéré chaque mois par la CI (scripts/produits.mjs) ; l'app le lit tel quel, hors ligne.
import {} from './refprice.js';
import { parseSize } from './drive.js';
import { toBase } from './units.js';
import { nameKey, norm } from './text.js';
export const GROUP_DEFS = [
    { id: 'creme', label: 'Crème fraîche', keys: ['crème fraîche', 'crème fraîche épaisse', 'crème épaisse', 'crème'], tags: ['fr:cremes-fraiches'], per: 'l', name: /creme/, not: /dessert|glace|vanille|chocolat|caramel|marron/ },
    { id: 'creme-liquide', label: 'Crème liquide', keys: ['crème liquide', 'crème fleurette', 'crème fraîche liquide', 'crème entière liquide'], tags: ['en:uht-creams', 'en:unfermented-creams'], per: 'l', name: /creme/, not: /dessert|glace|vanille|chocolat|caramel/ },
    { id: 'beurre', label: 'Beurre', keys: ['beurre', 'beurre doux', 'beurre demi-sel'], tags: ['en:butters'], per: 'kg', name: /beurre/, not: /cacahuete|biscuit|sable|croissant|brioche|galette|pate/ },
    { id: 'lait', label: 'Lait demi-écrémé', keys: ['lait', 'lait demi-écrémé'], tags: ['en:semi-skimmed-milks'], per: 'l', name: /lait/, not: /coco|amande|avoine|soja|riz|chocolat|fermente|croissance/ },
    { id: 'oeufs', label: 'Œufs', keys: ['œuf', 'œufs', 'oeuf', 'oeufs', 'œuf frais', 'gros œuf'], tags: ['en:eggs', 'en:chicken-eggs'], per: 'piece', name: /oeuf/, not: /chocolat|paques|pate|nouille/ },
    { id: 'pates', label: 'Pâtes', keys: ['pâtes', 'pâte sèche', 'spaghetti', 'penne', 'tagliatelle', 'fusilli', 'coquillette', 'macaroni', 'farfalle', 'linguine', 'rigatoni'], tags: ['en:pastas', 'en:dry-pastas'], per: 'kg', not: /ravioli|raviole|tortellini|gnocchi|lasagne|sauce/ },
    { id: 'riz', label: 'Riz', keys: ['riz', 'riz basmati', 'riz long', 'riz thaï', 'riz rond'], tags: ['en:rices'], per: 'kg', name: /riz/, not: /galette|gateau|au lait|souffle|cake|boisson|creme/ },
    { id: 'farine', label: 'Farine de blé', keys: ['farine', 'farine de blé', 'farine t45', 'farine t55'], tags: ['en:wheat-flours'], per: 'kg', name: /farine/ },
    { id: 'sucre', label: 'Sucre', keys: ['sucre', 'sucre en poudre', 'sucre semoule'], tags: ['en:white-sugars', 'en:sugars'], per: 'kg', name: /sucre/, not: /sans sucre|sucres ajoutes|compote|confiture|sirop|boisson/ },
    { id: 'huile-olive', label: 'Huile d\'olive', keys: ['huile d\'olive', 'huile d\'olive vierge extra'], tags: ['en:extra-virgin-olive-oils', 'en:olive-oils'], per: 'l', name: /olive/ },
    { id: 'huile', label: 'Huile de tournesol', keys: ['huile', 'huile de tournesol', 'huile végétale', 'huile neutre'], tags: ['en:sunflower-oils'], per: 'l', name: /tournesol/ },
    { id: 'emmental', label: 'Emmental râpé', keys: ['emmental', 'emmental râpé', 'fromage râpé', 'gruyère râpé'], tags: ['en:grated-emmentaler', 'en:emmentaler'], per: 'kg', name: /emmental/ },
    { id: 'parmesan', label: 'Parmesan', keys: ['parmesan', 'parmigiano', 'parmigiano reggiano'], tags: ['en:parmigiano-reggiano'], per: 'kg', name: /parm/ },
    { id: 'mozzarella', label: 'Mozzarella', keys: ['mozzarella'], tags: ['en:mozzarella'], per: 'kg', name: /mozzarella/, not: /pizza|salade/ },
    { id: 'lardons', label: 'Lardons', keys: ['lardons', 'lardons fumés', 'lardon'], tags: ['en:lardons'], per: 'kg', name: /lardon/ },
    { id: 'jambon', label: 'Jambon blanc', keys: ['jambon', 'jambon blanc', 'jambon de paris', 'jambon cuit'], tags: ['en:white-hams', 'en:cooked-hams'], per: 'kg', name: /jambon/, not: /croque|pizza|sandwich|quiche|feuillete|crepe|cordon|melon|salade|wrap/ },
    { id: 'thon', label: 'Thon en boîte', keys: ['thon', 'thon au naturel', 'thon en boîte'], tags: ['en:canned-tunas'], per: 'kg', name: /thon/, not: /salade|rillette|pate|sauce|plat/ },
    { id: 'tomates-concassees', label: 'Tomates concassées', keys: ['tomates concassées', 'pulpe de tomate', 'tomates pelées', 'tomate concassée'], tags: ['en:crushed-tomatoes', 'en:peeled-tomatoes'], per: 'kg', name: /tomate/, not: /ketchup|sauce|soupe|gaspacho|sechee/ },
    { id: 'concentre', label: 'Concentré de tomate', keys: ['concentré de tomate', 'double concentré de tomate'], tags: ['en:tomato-pastes'], per: 'kg', name: /concentre/ },
    { id: 'sauce-tomate', label: 'Sauce tomate', keys: ['sauce tomate', 'coulis de tomate', 'passata'], tags: ['en:tomato-sauces'], per: 'kg', name: /tomate|coulis|passata/, not: /ketchup|soupe|gaspacho/ },
    { id: 'lentilles', label: 'Lentilles', keys: ['lentilles', 'lentilles vertes', 'lentilles corail'], tags: ['en:lentils'], per: 'kg', name: /lentille/, not: /soupe|salade|plat|cuisine/ },
    { id: 'pois-chiches', label: 'Pois chiches', keys: ['pois chiches'], tags: ['en:chickpeas'], per: 'kg', name: /pois chiche/, not: /houmous|hummus|salade|soupe/ },
    { id: 'lait-coco', label: 'Lait de coco', keys: ['lait de coco'], tags: ['en:coconut-milks'], per: 'l', name: /coco/, not: /boisson|dessert/ },
    { id: 'moutarde', label: 'Moutarde', keys: ['moutarde', 'moutarde de dijon'], tags: ['en:dijon-mustards', 'en:mustards'], per: 'kg', name: /moutarde/, not: /sauce|vinaigrette/ },
    { id: 'yaourt', label: 'Yaourt nature', keys: ['yaourt', 'yaourt nature'], tags: ['en:plain-yogurts'], per: 'kg', name: /yaourt|yogourt/, not: /fruit|vanille|sucre|aromatise|chocolat|citron|fraise/ },
    { id: 'fromage-blanc', label: 'Fromage blanc', keys: ['fromage blanc'], tags: ['en:fromages-blancs'], per: 'kg', name: /fromage blanc|faisselle/, not: /fruit|vanille|sucre|aromatise/ },
    { id: 'poulet', label: 'Filets de poulet', keys: ['blanc de poulet', 'filet de poulet', 'filets de poulet', 'escalope de poulet'], tags: ['en:chicken-breasts', 'fr:filets-de-poulet'], per: 'kg', name: /poulet/, not: /pane|nugget|cordon|roti|sandwich|salade|wrap/ },
    { id: 'steak-hache', label: 'Steaks hachés', keys: ['steak haché', 'bœuf haché', 'viande hachée', 'haché de bœuf'], tags: ['en:ground-beef-steaks'], per: 'kg', name: /hache/, not: /vegetal|soja/ },
    { id: 'pate-feuilletee', label: 'Pâte feuilletée', keys: ['pâte feuilletée'], tags: ['en:puff-pastry-sheets'], per: 'kg', name: /feuillet/ },
    { id: 'pate-brisee', label: 'Pâte brisée', keys: ['pâte brisée'], tags: ['en:shortcrust-pastry'], per: 'kg', name: /brisee/ },
    { id: 'chocolat', label: 'Chocolat noir', keys: ['chocolat noir', 'chocolat noir pâtissier', 'chocolat pâtissier'], tags: ['en:dark-chocolates'], per: 'kg', name: /chocolat/, not: /au lait|blanc|orange|amande|noisette|caramel|menthe|fourre|praline|biscuit|barre|cookie/ },
];
/* ---------- Qualité : règles fixes, affichées telles quelles ---------- */
const NS = { a: 2, b: 1, c: 0, d: -1, e: -2 };
const NOVA = { 1: 2, 2: 1, 3: 0, 4: -2 };
const NOVA_TEXT = { 1: 'NOVA 1 (brut)', 2: 'NOVA 2', 3: 'NOVA 3 (transformé)', 4: 'NOVA 4 (ultra-transformé)' };
export function quality(ns, nova, labelsTags) {
    let score = 0;
    const why = [], labels = [];
    if (ns && NS[ns] !== undefined) {
        score += NS[ns];
        why.push(`Nutri-Score ${ns.toUpperCase()}`);
    }
    if (nova && NOVA[nova] !== undefined) {
        score += NOVA[nova];
        why.push(NOVA_TEXT[nova]);
    }
    if (labelsTags.includes('en:organic')) {
        score++;
        labels.push('bio');
        why.push('bio');
    }
    if (labelsTags.includes('fr:label-rouge')) {
        score++;
        labels.push('label-rouge');
        why.push('Label Rouge');
    }
    if (labelsTags.includes('en:pdo') || labelsTags.includes('en:pgi')) {
        score++;
        labels.push('aop-igp');
        why.push('AOP/IGP');
    }
    return { score, why, labels };
}
// Quantité d'un paquet (texte Open Food Facts : « 45 cl », « 200 g (20 cl) », « 4 x 125 g », « 6 œufs ») → g, ml ou pièces.
export function packAmount(qty, per) {
    const s = qty.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/(?:œ|oe)ufs?|pi[eè]ces?|unit[eé]s?/g, 'pièces').replace(/\s+/g, ' ').trim();
    const eggs = /^(?:x\s*)?(\d{1,2})(?:\s*pièces)?$/.exec(s);
    if (per === 'piece')
        return eggs ? Number(eggs[1]) : null;
    const p = parseSize(s);
    if (!p)
        return null;
    const b = toBase(p.size, p.unit), n = b.n / b.d;
    if (per === 'kg' && p.unit.dim === 'masse')
        return n;
    if (per === 'l' && p.unit.dim === 'volume')
        return n;
    return null;
}
// Prix à l'unité de comparaison (centimes par kg, par litre ou par pièce).
export const perUnit = (cents, amount, per) => Math.round(per === 'piece' ? cents / amount : cents * 1000 / amount);
/* ---------- Choix affichés ---------- */
// Le moins cher (prix connu), le mieux noté, et le meilleur rapport qualité-prix : chaque point de qualité justifie
// jusqu'à 20 % de prix en plus que le moins cher (à l'unité de comparaison). Valeur = points − écart de prix ÷ 20 %.
export const VALUE_POINT = 0.2;
export const valueOf = (p, cheapest) => p.score - ((p.price?.perCents ?? Infinity) / cheapest - 1) / VALUE_POINT;
export function picks(products) {
    const priced = products.filter(p => p.price).sort((a, b) => (a.price?.perCents ?? 0) - (b.price?.perCents ?? 0));
    const cheap = priced[0] ?? null;
    const better = (a, b) => b.score - a.score || (a.price?.perCents ?? Infinity) - (b.price?.perCents ?? Infinity);
    const best = [...products].sort(better)[0] ?? null;
    const c0 = cheap?.price?.perCents ?? 0;
    const value = cheap ? [...priced].sort((a, b) => valueOf(b, c0) - valueOf(a, c0) || (a.price?.perCents ?? 0) - (b.price?.perCents ?? 0))[0] ?? cheap : null;
    return { value: value?.code ?? null, cheap: cheap?.code ?? null, best: best?.code ?? null };
}
const s = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : Array.isArray(v) && typeof v[0] === 'string' ? v[0].trim().slice(0, max) : '');
export function toProduct(h, per, rows) {
    const code = s(h.code, 20), name = s(h.product_name, 90), qty = s(h.quantity, 40);
    if (!/^\d{8,14}$/.test(code) || !name)
        return null;
    const ns = typeof h.nutriscore_grade === 'string' && /^[a-e]$/.test(h.nutriscore_grade) ? h.nutriscore_grade : null;
    const nova = typeof h.nova_group === 'number' && h.nova_group >= 1 && h.nova_group <= 4 ? h.nova_group : null;
    const q = quality(ns, nova, Array.isArray(h.labels_tags) ? h.labels_tags.filter((x) => typeof x === 'string') : []);
    const amount = qty ? packAmount(qty, per) : null;
    // Relevés en France, en euros ; un magasin Auchan d'abord (le plus récent), sinon la médiane des 5 plus récents.
    const fr = rows.filter(r => r.product_code === code && r.currency === 'EUR' && typeof r.price === 'number' && r.price > 0 && typeof r.date === 'string'
        && r.location?.osm_address_country_code === 'FR').sort((a, b) => (a.date < b.date ? 1 : -1));
    const isAuchan = (r) => /auchan/i.test(`${s(r.location?.osm_brand)} ${s(r.location?.osm_name)}`);
    const au = fr.filter(isAuchan);
    let price = null;
    if (amount && fr.length) {
        const pick = au[0] ?? [...fr.slice(0, 5)].sort((a, b) => a.price - b.price)[Math.floor(Math.min(fr.length, 5) / 2)];
        const cents = Math.round(pick.price * 100);
        price = { cents, perCents: perUnit(cents, amount, per), date: pick.date, where: au[0] ? 'Auchan' : (s(pick.location?.osm_brand) || s(pick.location?.osm_name) || 'autre magasin'), auchan: !!au[0], n: fr.length };
    }
    return { code, name, brand: s(h.brands, 60).split(',')[0]?.trim() ?? '', qty, ns, nova, labels: q.labels, score: q.score, why: q.why, price };
}
export function buildGroup(d, tag, hits, rows) {
    const fits = (h) => { const n = norm(s(h.product_name, 200)); return (!d.name || d.name.test(n)) && !(d.not && d.not.test(n)); };
    const products = hits.filter(fits).map(h => toProduct(h, d.per, rows)).filter((p) => !!p);
    // Gardés : les 8 premiers (popularité Open Food Facts) plus tout produit chiffré, pour un fichier court.
    const kept = products.filter((p, i) => i < 8 || p.price).slice(0, 14);
    return { id: d.id, label: d.label, keys: [...d.keys], tag, per: d.per, products: kept, ...picks(kept) };
}
/* ---------- Lecture (app) ---------- */
export function readProducts(v) {
    if (!v || typeof v !== 'object')
        return null;
    const o = v;
    if (typeof o['generated'] !== 'string' || !Array.isArray(o['groups']))
        return null;
    const groups = o['groups'].filter((g) => {
        if (!g || typeof g !== 'object')
            return false;
        const x = g;
        return typeof x['id'] === 'string' && typeof x['label'] === 'string' && Array.isArray(x['keys']) && Array.isArray(x['products'])
            && (x['per'] === 'kg' || x['per'] === 'l' || x['per'] === 'piece')
            && x['products'].every(p => !!p && typeof p === 'object' && typeof p['code'] === 'string' && typeof p['name'] === 'string');
    });
    return { source: typeof o['source'] === 'string' ? o['source'] : '', license: typeof o['license'] === 'string' ? o['license'] : '', generated: o['generated'], groups };
}
let loaded = null;
export function setProducts(d) {
    loaded = d ? { data: d, byKey: new Map(d.groups.flatMap(g => g.keys.map(k => [nameKey(k), g]))) } : null;
}
export const productsData = () => loaded?.data ?? null;
export const groupFor = (name) => loaded?.byKey.get(nameKey(name)) ?? null;
export const productOf = (g, code) => (code ? g.products.find(p => p.code === code) ?? null : null);
