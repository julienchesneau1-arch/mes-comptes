// Budget : panier estimé sans rien saisir — prix payé lu sur une facture du drive d'abord, puis prix noté autrefois sur un produit
// retenu, puis prix relevé du produit conseillé, sinon prix moyen Insee —, montant payé, bilan.
import { addDays, paris, slotKey, SLOTS } from './dates.js';
import { deriveShopping, weekPreps } from './shopping.js';
import { packsFor, paidFor } from './drive.js';
import { ingredientKey } from './ingredients.js';
import { toPrepare, servings } from './plan.js';
import { cmp, mul, q, qFrom, ZERO } from './rational.js';
import { UNIT, toBase } from './units.js';
import { refFor, refCost } from './refprice.js';
import { groupFor, productOf } from './products.js';
import { nameKey } from './text.js';
export const RELIABLE = 0.8;
const SEASONINGS = new Set(['sel', 'poivre', 'sel poivre', 'poivre noir', 'gros sel', 'fleur de sel', 'sel fin', 'epice', 'muscade', 'noix de muscade',
    'cumin', 'curry', 'paprika', 'piment', 'piment d\'espelette', 'piment de cayenne', 'cannelle', 'curcuma', 'herbe de provence', 'thym', 'laurier',
    'feuille de laurier', 'romarin', 'origan', 'bouquet garni', 'clou de girofle', 'quatre-epice', 'ras el hanout', 'gingembre en poudre', 'sariette']
    .map(nameKey));
// « Sel, laurier, thym, romarin » : chaque partie doit être un assaisonnement.
export const isSeasoning = (name) => {
    const parts = name.split(/,| et /).map(x => nameKey(x)).filter(Boolean);
    return parts.length > 0 && parts.every(x => SEASONINGS.has(x));
};
// Au prix payé sur la dernière facture : au poids (prix au kg × quantité exacte) ou en articles entiers de la contenance achetée.
// Contenance inconnue ou d'une autre dimension que le besoin : pas de montant (on ne devine pas combien en prendre).
export function paidCost(pd, l) {
    if (!l.toBuy || cmp(l.toBuy, ZERO) <= 0)
        return null;
    if (pd.loose) {
        const per = pd.unit === 'l' ? 'l' : 'kg', g = refFor(l.name)?.pieceG;
        return refCost({ per, cents: pd.cents, ...(g ? { pieceG: g } : {}) }, l.dim, l.toBuy);
    }
    const packs = packsFor(l, pd);
    if (packs.n)
        return packs.n * pd.cents;
    // « 2 oignons » et un filet de 1 kg : pièces entières au poids moyen d'une pièce (USDA, comme pour les prix de référence).
    const u = pd.unit ? UNIT[pd.unit] : undefined, size = pd.size ? qFrom(pd.size) : null, g = refFor(l.name)?.pieceG;
    if (l.dim !== 'piece' || u?.dim !== 'masse' || !size || !g)
        return null;
    const x = l.toBuy.n / l.toBuy.d, packG = (size.n / size.d) * (u.toBase.n / u.toBase.d);
    return Math.ceil(Math.ceil(x) * g / packG) * pd.cents;
}
// Coût d'une ligne à acheter : paquets du produit retenu si sa contenance est connue (on achète des paquets entiers), sinon la quantité exacte.
export function lineCost(s, l) {
    if (!l.toBuy || cmp(l.toBuy, ZERO) <= 0)
        return null;
    const pd = paidFor(s, l.name, l.form), paid = pd ? paidCost(pd, l) : null;
    if (pd && paid !== null)
        return { cents: paid, how: 'facture', ref: null, group: null, product: null, qty: null, paid: pd };
    const p = s.products[ingredientKey(l.name, l.form)];
    const packs = p ? packsFor(l, p) : null;
    if (p?.price && packs?.n)
        return { cents: packs.n * p.price, how: 'noté', ref: null, group: null, product: null, qty: null, paid: null };
    const u = p?.unit ? UNIT[p.unit] : undefined, size = p?.size ? qFrom(p.size) : null;
    const qty = packs?.n && u && size && u.dim === l.dim ? mul(q(packs.n), toBase(size, u)) : l.toBuy;
    const g = groupFor(l.name), adv = g ? productOf(g, g.value ?? g.cheap) : null;
    const seen = g && adv?.price ? refCost({ per: g.per, cents: adv.price.perCents }, l.dim, qty) : null;
    if (seen !== null)
        return { cents: seen, how: 'relevé', ref: null, group: g, product: adv, qty, paid: null };
    const ref = refFor(l.name), cents = ref ? refCost(ref, l.dim, qty) : null;
    return ref && cents !== null ? { cents, how: 'référence', ref, group: g, product: null, qty, paid: null } : null;
}
export function cartEstimate(s, list) {
    let cents = 0, priced = 0, paid = 0, unpriced = 0, seasonings = 0;
    for (const l of list.lines) {
        if (l.pantry?.active && l.pantry.qty === 'all')
            continue;
        if (l.toBuy && cmp(l.toBuy, ZERO) <= 0 && !l.unknown.length)
            continue;
        if (isSeasoning(l.name)) {
            seasonings++;
            continue;
        }
        const c = lineCost(s, l);
        if (c) {
            cents += c.cents;
            priced++;
            if (c.how === 'facture')
                paid++;
        }
        else
            unpriced++;
    }
    unpriced += list.manual.filter(m => !isSeasoning(m.name)).length;
    const portions = weekPreps(s, list.week).reduce((n, p) => n + toPrepare(s, p), 0);
    const reliable = priced > 0 && priced / (priced + unpriced) >= RELIABLE;
    return { cents, priced, paid, unpriced, seasonings, portions, perPortion: reliable && portions ? Math.round(cents / portions) : null, partial: unpriced > 0, reliable };
}
// « ≈ 48 € » si tout est chiffré, « au moins 48 € » sinon ; vide si rien ne l'est encore.
export const cartText = (c, eur) => (c.priced ? `${c.partial ? 'au moins ' : '≈ '}${eur(c.cents)}` : '');
// « 9 articles chiffrés sur 33 » : ce que couvre le montant.
export const coverText = (c) => `${c.partial ? `${c.priced} article${c.priced > 1 ? 's' : ''} chiffré${c.priced > 1 ? 's' : ''} sur ${c.priced + c.unpriced}` : 'tous les articles chiffrés'}${c.seasonings ? ', hors sel et épices' : ''}`;
export function weekReport(r, week) {
    const s = r.state, days = Array.from({ length: 7 }, (_, i) => addDays(week, i)), last = days[6];
    let home = 0, outside = 0;
    for (const d of days)
        for (const sl of SLOTS) {
            const x = s.slots[slotKey(d, sl)]?.dish;
            if (x?.kind === 'outside')
                outside++;
            else if (x)
                home += servings(s, slotKey(d, sl));
        }
    let thrown = 0;
    for (const e of r.events.values()) {
        if (r.undone.has(e.id) || r.rejected.has(e.id))
            continue;
        const d = paris(new Date(e.at)).date;
        if (d < week || d > last)
            continue;
        if (e.t === 'prep.discard' && e.p.reason === 'jeté')
            thrown += e.p.n;
        if (e.t === 'watch.close' && e.p.outcome === 'jete')
            thrown++;
    }
    const estimate = cartEstimate(s, deriveShopping(s, week));
    const spent = s.shop[week]?.spent?.cents ?? null;
    const base = spent ?? (estimate.reliable ? estimate.cents : null);
    return { week, spent, estimate, home, outside, thrown, perPortion: base && estimate.portions ? Math.round(base / estimate.portions) : null, partial: spent === null && estimate.partial };
}
