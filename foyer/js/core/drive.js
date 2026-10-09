// Commande au drive Auchan, sans robot ni identifiant : Foyer ouvre la bonne page Auchan, la personne ajoute au panier elle-même.
// Auchan n'offre pas d'API publique de panier et ses CGU interdisent les robots d'extraction : rien n'est lu sur auchan.fr.
// Foyer retient seulement ce que le foyer saisit (lien du produit choisi, contenance) ; le nombre de paquets en découle, exactement.
import { q, mul, div, sub, cmp, parseQ, qFrom, qStr } from './rational.js';
import { UNIT, matchUnit, toBase, showQty } from './units.js';
import { PRODUCT_URL_RE } from './model.js';
import { lineQty, parseSig, checkSig, wholeUp } from './shopping.js';
import { ingredientKey } from './ingredients.js';
import { nameKey, capitalize } from './text.js';
export const DRIVE_HOME = 'https://www.auchan.fr/';
export const searchUrl = (name) => `https://www.auchan.fr/recherche?text=${encodeURIComponent(name.trim())}`;
// Lien collé (barre d'adresse, message) : seule l'adresse du produit est gardée, sans paramètre de suivi.
export function productLink(text) {
    const m = /https?:\/\/(?:www\.)?auchan\.fr\/([a-z0-9-]{1,200})\/(pr-[A-Za-z0-9]{1,20})(?![A-Za-z0-9-])/i.exec(text);
    if (!m)
        return null;
    const slug = (m[1] ?? '').toLowerCase();
    const url = `https://www.auchan.fr/${slug}/${m[2] ?? ''}`;
    if (!PRODUCT_URL_RE.test(url))
        return null;
    return { url, label: capitalize(slug.replace(/-+/g, ' ').trim()).slice(0, 120) };
}
// Contenance d'un paquet : « 300 g », « 1,5 kg », « 6 », « 6 pièces », « 4 x 125 g » (lot : contenance totale). Unité inconnue → refus, rien deviné.
export function parseSize(raw) {
    const s = raw.trim().replace(/\s+/g, ' ');
    const lot = /^(\d{1,3}) ?[x×*] ?(.+)$/i.exec(s);
    const count = lot ? Number(lot[1]) : 1;
    const m = /^(\d{1,7}(?:[.,]\d{1,4})?|\d{1,6}\/\d{1,6}) ?(.*)$/.exec(lot ? (lot[2] ?? '') : s);
    const n = m ? parseQ(m[1] ?? '') : null;
    if (!m || !n || n.n <= 0 || count < 1)
        return null;
    const words = (m[2] ?? '').split(' ').filter(Boolean);
    const u = words.length ? matchUnit(words) : null;
    if (words.length && (!u || u.used !== words.length))
        return null;
    return { size: mul(q(count), n), unit: u?.unit ?? UNIT['piece'] };
}
export const sizeText = (p) => {
    const u = p.unit ? UNIT[p.unit] : undefined, n = p.size ? qFrom(p.size) : null;
    return u && n ? showQty(toBase(n, u), u.dim, u) : '';
};
export const sizeDraft = (r) => ({ size: qStr(r.size), unit: r.unit.id });
export function packsFor(l, p) {
    const u = p.unit ? UNIT[p.unit] : undefined, size = p.size ? qFrom(p.size) : null;
    if (!u || !size)
        return { n: null, why: 'contenance non renseignée' };
    if (!l.toBuy || !l.dim)
        return { n: null, why: 'quantité de la recette non renseignée' };
    if (u.dim !== l.dim)
        return { n: null, why: 'contenance et besoin pas dans la même unité : à juger' };
    if (cmp(l.toBuy, q(0)) <= 0)
        return { n: null, why: 'rien à acheter' };
    const per = toBase(size, u);
    const r = div(l.toBuy, per);
    const n = (r.n - (r.n % r.d)) / r.d + (r.n % r.d ? 1 : 0); // arrondi au paquet supérieur, en entiers exacts
    const total = mul(q(n), per);
    const more = cmp(total, l.toBuy) > 0 ? ` · ${showQty(total, u.dim, u)} pour ${lineQty(l)}` : '';
    return { n, text: `${n} × ${showQty(per, u.dim, u)}${more}` };
}
// Dernier prix payé pour un ingrédient : sous sa clé exacte (avec la forme : surgelé, en conserve…), sinon sous son seul nom.
export const paidFor = (s, name, form) => s.paid[ingredientKey(name, form)] ?? s.paid[nameKey(name)] ?? null;
// Ce qui reste à commander, dans l'ordre de la liste (rayons du magasin).
export function driveItems(s, list) {
    const out = [];
    for (const l of list.lines) {
        if (l.done)
            continue;
        const productKey = ingredientKey(l.name, l.form), product = s.products[productKey] ?? null, paid = paidFor(s, l.name, l.form);
        const qty = lineQty(l), unk = l.unknown.length ? (qty ? ' + quantité à voir' : 'quantité à voir') : '';
        out.push({ id: `l:${l.key}`, week: list.week, name: `${l.name}${l.form ? ` (${l.form})` : ''}`, qty: `${qty}${unk}`, productKey, product, paid,
            url: product?.url ?? searchUrl(paid?.label ?? l.name), packs: product ? packsFor(l, product) : paid && !paid.loose ? packsFor(l, paid) : null });
    }
    for (const m of list.manual) {
        if (m.checked)
            continue;
        const productKey = nameKey(m.name), product = s.products[productKey] ?? null, paid = s.paid[productKey] ?? null;
        out.push({ id: `m:${m.id}`, week: list.week, name: m.name, qty: m.qty, productKey, product, paid, url: product?.url ?? searchUrl(paid?.label ?? m.name), packs: null });
    }
    return out;
}
export function cartChanges(s, list) {
    const out = [], checked = s.shop[list.week]?.checked ?? {};
    const shown = (v, dim) => (v && dim ? showQty(v, dim) : '');
    for (const l of list.lines) {
        const c = checked[l.key];
        if (!c || (l.pantry?.active && l.pantry.qty === 'all'))
            continue;
        if (l.check?.delta)
            out.push({ key: l.key, name: l.name, kind: 'plus', qty: shown(l.check.delta, l.dim), needAt: null });
        else if (l.check?.newUnknown)
            out.push({ key: l.key, name: l.name, kind: 'plus', qty: 'quantité à voir', needAt: null });
        else {
            const was = parseSig(c.needAt).need;
            const now = l.toBuy ? wholeUp(l.toBuy, l.dim) : null, then = was ? wholeUp(was, l.dim) : null;
            if (now && then && cmp(now, then) < 0)
                out.push({ key: l.key, name: l.name, kind: 'moins', qty: shown(sub(then, now), l.dim), needAt: checkSig(l) });
        }
    }
    for (const [key, c] of Object.entries(checked)) {
        if (list.lines.some(l => l.key === key))
            continue;
        const dim = key.slice(key.lastIndexOf('|') + 1);
        out.push({ key, name: c.name ?? capitalize(key.split('|')[0] ?? key), kind: 'retire', qty: shown(parseSig(c.needAt).need, dim !== '?' ? dim : null), needAt: null });
    }
    return out;
}
