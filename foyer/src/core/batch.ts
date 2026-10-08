// Rituel batch : courses finales un jour (drive), cuisine en une séance un autre jour, repas de la semaine prêts.
// Tout vient de ce que le foyer a déclaré (rituel, plats, portions). Foyer n'estime ni durée ni conservation :
// il montre seulement combien de jours séparent le batch de chaque repas (J+n).
import { type LocalDate, type SlotKey, addDays, daysBetween, parseSlot, slotOrder, weekday, weekOf } from './dates.ts';
import { type State, type Prep, type Ritual, current } from './model.ts';
import { type Draft } from './reduce.ts';
import { users, servings, eaters, portions } from './plan.ts';
import { prepTitle } from './status.ts';
import { type Q, ZERO, q, add, mul, div, qFrom } from './rational.ts';
import { UNIT, toBase, showQty } from './units.ts';
import { aisleOf, ingredientKey } from './ingredients.ts';

export const DEFAULT_RITUAL: Ritual = { shop: 5, shopAt: '1700', cook: 6, cookAt: '0900' }; // samedi 17 h, dimanche 9 h
export const ANSES_FROID = 'https://www.anses.fr/fr/content/comment-bien-conserver-ses-aliments-et-ne-pas-interrompre-la-chaine-du-froid';

// Prochaine occurrence d'un jour de la semaine (aujourd'hui compris) ; dernière occurrence au plus tard tel jour.
export const nextWeekday = (from: LocalDate, wd: number): LocalDate => addDays(from, (wd - weekday(from) + 7) % 7);
export const lastWeekday = (until: LocalDate, wd: number): LocalDate => addDays(until, -((weekday(until) - wd + 7) % 7));

// Jour du batch qui prépare une semaine : le dernier jour de batch au plus tard le premier jour de cette semaine.
export const batchDayFor = (r: Ritual, week: LocalDate): LocalDate => lastWeekday(week, r.cook);
// Jour des courses d'un batch : le dernier jour de courses au plus tard le jour du batch (le même jour si drive le matin).
export const shopDayFor = (r: Ritual, day: LocalDate): LocalDate => lastWeekday(day, r.shop);
// Semaine de courses d'un batch : celle de son premier lendemain (les plats cuisinés sont mangés ensuite).
export const shopWeekFor = (s: State, day: LocalDate): LocalDate => weekOf(addDays(day, 1), s.settings.weekStart);
// Repas qu'un batch peut couvrir : du jour même au sixième jour suivant. Par défaut : les cinq jours suivants.
export const WINDOW = 6, DEFAULT_SPAN = 5;
export const inWindow = (day: LocalDate, d: LocalDate): boolean => { const n = daysBetween(day, d); return n >= 0 && n <= WINDOW; };
export const defaultIn = (day: LocalDate, d: LocalDate): boolean => { const n = daysBetween(day, d); return n >= 1 && n <= DEFAULT_SPAN; };

export interface BatchServe { slot: SlotKey; n: number; offset: number; boxes: string[]; containers: number; eaten: boolean } // une boîte par personne qui emporte, un plat pour ceux à table
export interface BatchDish { prep: Prep; name: string; portions: number; serves: BatchServe[]; extra: number; done: boolean }
export interface BatchView {
  day: LocalDate; shopDay: LocalDate | null; week: LocalDate;
  dishes: BatchDish[];        // plats cuisinés à ce batch
  candidates: BatchDish[];    // plats à cuisiner dans la fenêtre, pas (encore) dans ce batch
  portions: number; containers: number; done: number;
}

function dish(s: State, prep: Prep, day: LocalDate): BatchDish {
  const serves = users(s, prep.id).map(k => {
    const d = parseSlot(k)?.date ?? day;
    const n = servings(s, k), boxes = eaters(s, k).filter(e => e.presence === 'boite').map(e => e.name);
    return { slot: k, n, offset: daysBetween(day, d), boxes, containers: (n > boxes.length ? 1 : 0) + boxes.length, eaten: !!s.slots[k]?.eaten };
  }).filter(x => x.n > 0);
  const pt = portions(s, prep);
  return { prep, name: prepTitle(s, prep), portions: pt.declared ?? pt.planned, serves, extra: pt.extra, done: !!prep.done };
}

export function batchView(s: State, day: LocalDate): BatchView {
  const r = s.settings.ritual;
  const dishes: BatchDish[] = [], candidates: BatchDish[] = [];
  const all = Object.values(s.preps).sort((a, b) => slotOrder(a.slot ?? '') - slotOrder(b.slot ?? '') || (a.id < b.id ? -1 : 1));
  for (const p of all) {
    if (p.batch === day) { dishes.push(dish(s, p, day)); continue; }
    const d = p.slot ? parseSlot(p.slot)?.date : undefined;
    if (!p.done && !p.batch && d && inWindow(day, d)) candidates.push(dish(s, p, day));
  }
  return {
    day, shopDay: r ? shopDayFor(r, day) : null, week: shopWeekFor(s, day), dishes, candidates,
    portions: dishes.reduce((n, x) => n + x.portions, 0),
    containers: dishes.reduce((n, x) => n + x.serves.filter(v => v.offset > 0).reduce((m, v) => m + v.containers, 0) + (x.extra ? 1 : 0), 0),
    done: dishes.filter(x => x.done).length,
  };
}

// Mettre des plats dans un batch, ou les en sortir.
export const batchDrafts = (s: State, day: LocalDate, prepIds: Iterable<string>, on: boolean): Draft[] =>
  [...prepIds].filter(id => { const p = s.preps[id]; return p && !p.done && (on ? p.batch !== day : p.batch === day); })
    .map(id => ({ t: 'prep.batch' as const, p: { prep: id, day: on ? day : null } }));

// Mise en place commune : les fruits et légumes de tous les plats du batch, additionnés (laver, éplucher, couper en une fois).
export interface PrepLine { name: string; qty: string; dishes: string[] }
export function miseEnPlace(s: State, dishes: readonly BatchDish[]): PrepLine[] {
  const lines = new Map<string, { name: string; need: Q | null; dim: string | null; unit: string | null; dishes: Set<string> }>();
  for (const d of dishes) {
    const r = s.recipes[d.prep.recipe];
    if (!r) continue;
    const c = current(r);
    for (const l of c.ingredients) {
      if (aisleOf(l.name, l.form, s.aisles) !== 'fruits-legumes') continue;
      const unit = l.unit ? UNIT[l.unit] : undefined, qty = l.qty ? qFrom(l.qty) : null;
      const part = unit && qty && c.yield ? toBase(div(mul(qty, q(d.portions)), q(c.yield)), unit) : null;
      const key = `${ingredientKey(l.name, l.form)}|${part && unit ? unit.dim : '?'}`;
      const x = lines.get(key) ?? { name: `${l.name}${l.form ? ` (${l.form})` : ''}`, need: part ? ZERO : null, dim: part && unit ? unit.dim : null, unit: l.unit, dishes: new Set<string>() };
      if (part && x.need) x.need = add(x.need, part);
      x.dishes.add(d.name);
      lines.set(key, x);
    }
  }
  return [...lines.values()].map(x => ({ name: x.name, qty: x.need && x.dim ? showQty(x.need, x.dim, x.unit ? UNIT[x.unit] : undefined) : '', dishes: [...x.dishes] }))
    .sort((a, b) => b.dishes.length - a.dishes.length || a.name.localeCompare(b.name, 'fr'));
}

// Ingrédients partagés entre plats du batch (un même produit sert plusieurs fois : moins de restes, moins d'achats).
export function sharedIngredients(s: State, dishes: readonly BatchDish[]): string[] {
  const seen = new Map<string, { name: string; n: Set<string> }>();
  for (const d of dishes) {
    const r = s.recipes[d.prep.recipe];
    for (const l of r ? current(r).ingredients : []) {
      const k = ingredientKey(l.name, l.form), x = seen.get(k) ?? { name: l.name, n: new Set<string>() };
      x.n.add(d.prep.recipe); seen.set(k, x);
    }
  }
  return [...seen.values()].filter(x => x.n.size > 1).map(x => x.name.toLowerCase()).sort((a, b) => a.localeCompare(b, 'fr'));
}

// Ce que le rituel demande aujourd'hui : choisir le menu, choisir les plats du batch, faire les courses, cuisiner.
export type RitualNow =
  | { kind: 'courses'; view: BatchView; menuEmpty: boolean }
  | { kind: 'batch'; view: BatchView }
  | { kind: 'choose'; view: BatchView }
  | { kind: 'menu'; view: BatchView };
export function ritualNow(s: State, today: LocalDate): RitualNow | null {
  const r = s.settings.ritual;
  if (!r) return null;
  const day = nextWeekday(today, r.cook), view = batchView(s, day);
  const menuEmpty = !view.dishes.length && !view.candidates.length;
  if (today === day && view.dishes.length) return { kind: 'batch', view };
  if (today === view.shopDay) return { kind: 'courses', view, menuEmpty };
  if (daysBetween(today, day) > 2) return null;
  if (menuEmpty) return { kind: 'menu', view };
  if (!view.dishes.length) return { kind: 'choose', view };
  return null;
}

// Batchs réussis d'affilée (au moins un plat du batch déclaré préparé), en remontant depuis le plus récent.
export function batchStreak(s: State, today: LocalDate): number {
  const r = s.settings.ritual;
  if (!r) return 0;
  const days = new Map<LocalDate, boolean>();
  for (const p of Object.values(s.preps)) if (p.batch) days.set(p.batch, (days.get(p.batch) ?? false) || !!p.done);
  let d = lastWeekday(today, r.cook);
  if (d === today && !days.get(d)) d = addDays(d, -7); // le batch du jour n'est pas encore fait : on ne casse pas la série
  let n = 0;
  while (days.get(d)) { n++; d = addDays(d, -7); }
  return n;
}
