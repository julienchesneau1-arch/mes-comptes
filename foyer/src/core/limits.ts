// Dates limites des produits surveillés, partagées par les menus proposés, l'agenda et les déplacements de plats.
// DLC (« à consommer jusqu'au ») : impérative, un plat qui l'utilise ne passe jamais après sans le dire. DDM (« de préférence
// avant ») : indicative, elle fait seulement préférer un plat. Seules les dates au jour près comptent (une DDM « 03/2027 » ne presse
// jamais) ; un produit ouvert, utilisé ou jeté ne compte plus. Le rapprochement produit ↔ ingrédient est celui des suggestions DLC.
import { type LocalDate, type SlotKey, fmtDayShort, parseSlot } from './dates.ts';
import { type State, type WatchItem, current } from './model.ts';
import { matchesProduct } from './printed.ts';
import { nameKey } from './text.ts';

export interface Limit { watch: WatchItem; key: string; name: string; date: LocalDate; kind: 'DLC' | 'DDM' }

// Toutes les dates qui comptent, la plus pressante d'abord : DLC avant DDM, puis la plus proche.
export function limits(s: State): Limit[] {
  const out: Limit[] = [];
  for (const w of Object.values(s.watch)) {
    if (w.closed || w.state !== 'ferme' || !w.date || (w.date.kind !== 'DLC' && w.date.kind !== 'DDM') || w.date.value.length !== 10) continue;
    out.push({ watch: w, key: nameKey(w.name), name: w.name, date: w.date.value, kind: w.date.kind });
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'DLC' ? -1 : 1) || a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'fr'));
}
export const pressing = (s: State, from: LocalDate, until: LocalDate): Limit[] => limits(s).filter(l => l.date >= from && l.date <= until);

export const usesLimit = (names: readonly string[], l: Limit): boolean => names.some(n => matchesProduct(nameKey(n), l.key));
// La date la plus pressante parmi celles des produits qu'utilise une liste d'ingrédients.
export const limitFor = (ls: readonly Limit[], names: readonly string[]): Limit | null => ls.find(l => usesLimit(names, l)) ?? null;

// Plat prévu à un repas et cuisiné ce jour-là (pas en batch, pas commencé) : la DLC à venir la plus proche d'un produit qu'il utilise.
// C'est la date qu'un déplacement ne doit pas dépasser.
export function dishLimit(s: State, k: SlotKey, today: LocalDate): Limit | null {
  const d = s.slots[k]?.dish;
  if (d?.kind !== 'cook') return null;
  const p = s.preps[d.prep], r = p ? s.recipes[p.recipe] : undefined;
  if (!p || !r || p.done || p.batch || p.status !== 'planned') return null;
  return limitFor(limits(s).filter(l => l.kind === 'DLC' && l.date >= today), current(r).ingredients.map(l => l.name));
}
// Un repas tombe-t-il au plus tard le jour de la date ?
export const before = (k: SlotKey, l: Limit): boolean => (parseSlot(k)?.date ?? '9') <= l.date;
// Plats prévus après la DLC d'un produit qu'ils utilisent (repas à venir) : ce qu'un changement ne doit pas créer sans le dire.
export function lateDishes(s: State, today: LocalDate): Map<SlotKey, Limit> {
  const out = new Map<SlotKey, Limit>();
  for (const k of Object.keys(s.slots)) {
    if ((parseSlot(k)?.date ?? '') < today) continue;
    const l = dishLimit(s, k, today);
    if (l && !before(k, l)) out.set(k, l);
  }
  return out;
}

// « DLC mer. 7 oct. » ; « de préférence avant le mer. 7 oct. ».
export const limitText = (l: Limit): string => (l.kind === 'DLC' ? `DLC ${fmtDayShort(l.date)}` : `de préférence avant le ${fmtDayShort(l.date)}`);
