// Budget : panier estimé avec les prix que le foyer a notés (jamais lus sur un site), montant réellement payé, bilan des semaines.
import { addDays, paris, slotKey, SLOTS } from './dates.js';
import { deriveShopping, weekPreps } from './shopping.js';
import { packsFor } from './drive.js';
import { ingredientKey } from './ingredients.js';
import { toPrepare, servings } from './plan.js';
import { cmp, ZERO } from './rational.js';
// Lignes à acheter (cochées ou non) dont le produit retenu a un prix et un nombre de paquets calculable.
// Une ligne sans prix, ou un article ajouté à la main, est compté « sans prix » : l'estimation ne l'invente pas.
export function cartEstimate(s, list) {
    let cents = 0, priced = 0, unpriced = 0;
    for (const l of list.lines) {
        if (l.pantry?.active && l.pantry.qty === 'all')
            continue;
        if (l.toBuy && cmp(l.toBuy, ZERO) <= 0 && !l.unknown.length)
            continue;
        const p = s.products[ingredientKey(l.name, l.form)];
        const packs = p ? packsFor(l, p) : null;
        if (p?.price && packs?.n) {
            cents += packs.n * p.price;
            priced++;
        }
        else
            unpriced++;
    }
    unpriced += list.manual.length;
    const portions = weekPreps(s, list.week).reduce((n, p) => n + toPrepare(s, p), 0);
    return { cents, priced, unpriced, portions, perPortion: priced && portions ? Math.round(cents / portions) : null, partial: unpriced > 0 };
}
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
    const base = spent ?? (estimate.priced ? estimate.cents : null);
    return { week, spent, estimate, home, outside, thrown, perPortion: base && estimate.portions ? Math.round(base / estimate.portions) : null, partial: spent === null && estimate.partial };
}
