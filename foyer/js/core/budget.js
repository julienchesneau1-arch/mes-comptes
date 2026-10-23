// Budget : panier estimé sans rien saisir — prix payé lu sur une facture du drive d'abord, puis prix noté autrefois sur un produit
// retenu, puis prix relevé du produit conseillé, sinon prix moyen Insee —, montant payé, bilan.
import { addDays, paris, slotKey, SLOTS } from './dates.js';
import { deriveShopping, weekPreps } from './shopping.js';
import { packsFor, paidFor } from './drive.js';
import { ingredientKey } from './ingredients.js';
import { toPrepare, servings } from './plan.js';
import { cmp, mul, q, qFrom, ZERO } from './rational.js';
import { UNIT, toBase } from './units.js';
import { refFor, refCost, refPrices } from './refprice.js';
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
export const CALIB_MIN = 5;
export const CALIB_BOUNDS = [0.5, 2];
function paidPerRef(pd, ref) {
    if (pd.loose)
        return (pd.unit === 'kg' && ref.per === 'kg') || (pd.unit === 'l' && ref.per === 'l') ? pd.cents : null;
    const u = pd.unit ? UNIT[pd.unit] : undefined, size = pd.size ? qFrom(pd.size) : null;
    if (!u || !size || size.n <= 0)
        return null;
    const b = toBase(size, u), base = b.n / b.d;
    if ((ref.per === 'kg' && u.dim === 'masse') || (ref.per === 'l' && u.dim === 'volume'))
        return pd.cents * 1000 / base;
    return ref.per === 'piece' && u.dim === 'piece' ? pd.cents / base : null;
}
const CALIB = new WeakMap();
export function calibration(s) {
    const refs = refPrices(), hit = CALIB.get(s);
    if (hit && hit.refs === refs)
        return hit.cal;
    const ratios = [];
    for (const [key, pd] of Object.entries(s.paid)) {
        if (key.includes('|'))
            continue; // surgelé, en conserve… : pas le produit frais que relève l'Insee
        const ref = refFor(key), per = ref ? paidPerRef(pd, ref) : null;
        if (ref && per)
            ratios.push(per / ref.cents);
    }
    ratios.sort((a, b) => a - b);
    const n = ratios.length, mid = n % 2 ? ratios[(n - 1) / 2] : ((ratios[n / 2 - 1] ?? 0) + (ratios[n / 2] ?? 0)) / 2;
    const cal = { factor: n >= CALIB_MIN ? Math.min(CALIB_BOUNDS[1], Math.max(CALIB_BOUNDS[0], Math.round(mid * 100) / 100)) : null, n,
        low: n ? ratios[0] : null, high: n ? ratios[n - 1] : null };
    CALIB.set(s, { refs, cal });
    return cal;
}
// « Estimations Insee calées sur vos factures : −8 % (médiane de 7 articles) ».
export function calibrationText(c) {
    if (c.factor === null)
        return c.n ? `Calage sur vos factures : ${c.n} article${c.n > 1 ? 's' : ''} comparable${c.n > 1 ? 's' : ''} sur ${CALIB_MIN} nécessaires.` : '';
    const pct = Math.round((c.factor - 1) * 100);
    return `Estimations Insee calées sur vos factures : ${pct === 0 ? 'au même niveau' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`} (médiane de ${c.n} articles payés comparés au prix moyen Insee).`;
}
const calibrated = (s, cents) => { const f = calibration(s).factor; return f ? Math.round(cents * f) : cents; };
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
    return ref && cents !== null ? { cents: calibrated(s, cents), how: 'référence', ref, group: g, product: null, qty, paid: null } : null;
}
/* ---------- Coût d'un plat (proposition de la semaine, coût par portion) ---------- */
// Ce que coûte la quantité utilisée, au meilleur prix connu (payé, noté, relevé, Insee), sans arrondir au paquet entier :
// un paquet de pâtes sert plusieurs plats. Contenance d'une autre dimension : pièces pesées au poids moyen (USDA), sinon rien.
function proportional(pd, name, dim, qty) {
    const u = pd.unit ? UNIT[pd.unit] : undefined, size = pd.size ? qFrom(pd.size) : null;
    if (!u || !size || size.n <= 0)
        return null;
    const per = toBase(size, u), x = qty.n / qty.d, packBase = per.n / per.d;
    if (u.dim === dim)
        return Math.round(pd.cents * x / packBase);
    const g = refFor(name)?.pieceG;
    return dim === 'piece' && u.dim === 'masse' && g ? Math.round(pd.cents * Math.ceil(x) * g / packBase) : null;
}
export function unitCost(s, name, form, dim, qty) {
    const pd = paidFor(s, name, form), paid = pd ? proportional(pd, name, dim, qty) : null;
    if (paid !== null)
        return paid;
    const p = s.products[ingredientKey(name, form)], noted = p?.price ? proportional({ cents: p.price, size: p.size, unit: p.unit }, name, dim, qty) : null;
    if (noted !== null)
        return noted;
    const g = groupFor(name), adv = g ? productOf(g, g.value ?? g.cheap) : null;
    const seen = g && adv?.price ? refCost({ per: g.per, cents: adv.price.perCents }, dim, qty) : null;
    if (seen !== null)
        return seen;
    const ref = refFor(name), cents = ref ? refCost(ref, dim, qty) : null;
    return cents === null ? null : calibrated(s, cents);
}
// Coût d'un plat pour n portions ; null si le rendement de la recette n'est pas renseigné (pas de quantités à calculer).
export function dishCost(s, c, portions) {
    if (!c.yield || portions <= 0)
        return null;
    let cents = 0, priced = 0, unpriced = 0;
    for (const l of c.ingredients) {
        if (isSeasoning(l.name))
            continue;
        const u = l.unit ? UNIT[l.unit] : undefined, n = l.qty ? qFrom(l.qty) : null;
        const x = u && n ? unitCost(s, l.name, l.form, u.dim, mul(toBase(n, u), q(portions, c.yield))) : null;
        if (x === null)
            unpriced++;
        else {
            cents += x;
            priced++;
        }
    }
    return { cents, priced, unpriced, perPortion: priced ? Math.round(cents / portions) : null, partial: unpriced > 0,
        reliable: priced > 0 && priced / (priced + unpriced) >= RELIABLE };
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
