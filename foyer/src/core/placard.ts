// « Déjà au placard ? » (comme le « Already have it » de Pimzi, mais calculé) : au drive on achète des paquets entiers ; ce que le
// paquet avait en plus du besoin de la semaine précédente reste probablement au placard. Quand la semaine suivante en redemande,
// « À régler » le propose d'un toucher : « on en a » est noté pour cette liste seulement, comme une vérification faite à la main.
// Estimation : on suppose que les plats ont été cuisinés comme prévu. Rien n'est déduit sans la réponse du foyer.
import { type LocalDate, addDays } from './dates.ts';
import type { State } from './model.ts';
import { type Q, ZERO, cmp, mul, q, qFrom, sub } from './rational.ts';
import { type ShopLine, deriveShopping, parseSig } from './shopping.ts';
import { packsFor, paidFor } from './drive.ts';
import { ingredientKey } from './ingredients.ts';
import { UNIT, type Unit, toBase } from './units.ts';

export interface Surplus {
  line: ShopLine;        // ligne de la semaine qui en redemande (pas encore prise ni vérifiée)
  left: Q;               // reste estimé (unité de base de la ligne)
  pack: Q; unit: Unit;   // contenance d'un paquet
  bought: Q;             // besoin couvert par l'achat de la semaine précédente
  from: LocalDate;       // semaine de l'achat
}
export const placardKey = (week: LocalDate, lineKey: string): string => `placard:${week}:${lineKey}`.slice(0, 120);

export function surpluses(s: State, week: LocalDate): Surplus[] {
  const prev = addDays(week, -7), bought = s.shop[prev]?.checked ?? {}, out: Surplus[] = [];
  if (!Object.keys(bought).length) return out;
  const before = new Map(deriveShopping(s, prev).lines.map(l => [l.key, l]));
  for (const l of deriveShopping(s, week).lines) {
    const c = bought[l.key], was = before.get(l.key);
    if (!c || !was || l.done || l.pantry || l.check || !l.toBuy || cmp(l.toBuy, ZERO) <= 0 || s.tasks[placardKey(week, l.key)]?.done) continue;
    const p = s.products[ingredientKey(l.name, l.form)], pd = paidFor(s, l.name, l.form);
    const size = p?.size && p.unit ? p : pd && !pd.loose && pd.size && pd.unit ? pd : null;
    const need = parseSig(c.needAt).need, u = size?.unit ? UNIT[size.unit] : undefined, n = size?.size ? qFrom(size.size) : null;
    if (!size || !need || !u || !n || u.dim !== l.dim) continue;
    const packs = packsFor({ ...was, toBuy: need }, size);
    if (!packs.n) continue;
    const per = toBase(n, u), left = sub(mul(q(packs.n), per), need);
    if (cmp(left, ZERO) > 0) out.push({ line: l, left, pack: per, unit: u, bought: need, from: prev });
  }
  return out;
}
