// Budget : panier estimé avec les prix que le foyer a notés (jamais lus sur un site), montant réellement payé, bilan des semaines.
import { type LocalDate, addDays, paris, slotKey, SLOTS } from './dates.ts';
import type { State } from './model.ts';
import type { Replay } from './reduce.ts';
import { type ShoppingList, deriveShopping, weekPreps } from './shopping.ts';
import { packsFor } from './drive.ts';
import { ingredientKey } from './ingredients.ts';
import { toPrepare, servings } from './plan.ts';
import { cmp, ZERO } from './rational.ts';

// partial : des articles n'ont pas de prix noté ; le montant est alors un minimum (affiché « ≥ »).
export interface Cart { cents: number; priced: number; unpriced: number; portions: number; perPortion: number | null; partial: boolean }

// Lignes à acheter (cochées ou non) dont le produit retenu a un prix et un nombre de paquets calculable.
// Une ligne sans prix, ou un article ajouté à la main, est compté « sans prix » : l'estimation ne l'invente pas.
export function cartEstimate(s: State, list: ShoppingList): Cart {
  let cents = 0, priced = 0, unpriced = 0;
  for (const l of list.lines) {
    if (l.pantry?.active && l.pantry.qty === 'all') continue;
    if (l.toBuy && cmp(l.toBuy, ZERO) <= 0 && !l.unknown.length) continue;
    const p = s.products[ingredientKey(l.name, l.form)];
    const packs = p ? packsFor(l, p) : null;
    if (p?.price && packs?.n) { cents += packs.n * p.price; priced++; } else unpriced++;
  }
  unpriced += list.manual.length;
  const portions = weekPreps(s, list.week).reduce((n, p) => n + toPrepare(s, p), 0);
  return { cents, priced, unpriced, portions, perPortion: priced && portions ? Math.round(cents / portions) : null, partial: unpriced > 0 };
}

export interface WeekReport {
  week: LocalDate;
  spent: number | null;      // montant payé noté
  estimate: Cart;
  home: number;              // portions servies à la maison ou en boîte, d'après le planning
  outside: number;           // repas notés « extérieur »
  thrown: number;            // portions déclarées jetées + produits surveillés jetés, cette semaine-là
  perPortion: number | null; // payé (sinon estimé) ÷ portions cuisinées
  partial: boolean;          // pas de montant payé et estimation incomplète : perPortion est un minimum
}

export function weekReport(r: Replay, week: LocalDate): WeekReport {
  const s = r.state, days = Array.from({ length: 7 }, (_, i) => addDays(week, i)), last = days[6] as LocalDate;
  let home = 0, outside = 0;
  for (const d of days) for (const sl of SLOTS) {
    const x = s.slots[slotKey(d, sl)]?.dish;
    if (x?.kind === 'outside') outside++;
    else if (x) home += servings(s, slotKey(d, sl));
  }
  let thrown = 0;
  for (const e of r.events.values()) {
    if (r.undone.has(e.id) || r.rejected.has(e.id)) continue;
    const d = paris(new Date(e.at)).date;
    if (d < week || d > last) continue;
    if (e.t === 'prep.discard' && e.p.reason === 'jeté') thrown += e.p.n;
    if (e.t === 'watch.close' && e.p.outcome === 'jete') thrown++;
  }
  const estimate = cartEstimate(s, deriveShopping(s, week));
  const spent = s.shop[week]?.spent?.cents ?? null;
  const base = spent ?? (estimate.priced ? estimate.cents : null);
  return { week, spent, estimate, home, outside, thrown, perPortion: base && estimate.portions ? Math.round(base / estimate.portions) : null, partial: spent === null && estimate.partial };
}
