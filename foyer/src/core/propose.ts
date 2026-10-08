// « Qu'est-ce qu'on mange ? » : propositions tirées uniquement de VOS plats, avec une raison lisible.
// Règle déterministe (pas d'IA) : le plat le moins récemment prévu d'abord, bonus « rapide » en semaine, « week-end » le week-end,
// « favori », et un plat qui utilise un produit surveillé dont la DLC approche. Rien n'est appliqué sans votre accord.
import { type LocalDate, type SlotKey, slotKey, parseSlot, addDays, weekday, daysBetween, prevSlot, slotOrder, SLOTS, fmtDayShort, paris } from './dates.ts';
import { type State, type Presence, current } from './model.ts';
import { eaters, servings, portions, presence as presenceOf } from './plan.ts';
import { nameKey } from './text.ts';
import { aisleOf } from './ingredients.ts';
import { type Draft, newId } from './reduce.ts';
import { wholeExtra } from './commands.ts';
import { prepTitle } from './status.ts';
import { type Catalog, discover, familiesOf, toContent } from './catalog.ts';
import type { CatalogRecipe } from './wikibook.ts';
import { defaultIn, lastWeekday } from './batch.ts';

export type ProposedDish =
  | { kind: 'cook'; recipe: string; extra: number }
  | { kind: 'new'; catalog: CatalogRecipe; extra: number } // plat à découvrir : ajouté à « Nos plats » à l'acceptation
  | { kind: 'from'; source: SlotKey; prep: string | null }
  | { kind: 'outside'; note: string };
export interface Proposal { slot: SlotKey; dish: ProposedDish | null; reason: string; presence: Record<string, Presence>; guests: number }

export const TAGS = ['rapide', 'week-end', 'favori', 'plat entier', 'placard', 'végétarien', 'batch'] as const;

// Dernier jour où chaque plat a été prévu (cuisiné).
export function lastPlanned(s: State): Map<string, LocalDate> {
  const m = new Map<string, LocalDate>();
  for (const p of Object.values(s.preps)) {
    const d = p.slot ? parseSlot(p.slot)?.date : p.done ? paris(new Date(p.done.at)).date : undefined;
    if (d && (!m.has(p.recipe) || (m.get(p.recipe) as string) < d)) m.set(p.recipe, d);
  }
  return m;
}

export interface Ranked { recipe: string; name: string; score: number; reason: string }

// Produits frais d'un plat (ceux qu'on achète pour lui et qui ne se gardent pas au placard).
const FRESH = new Set(['fruits-legumes', 'cremerie', 'frais', 'boucherie', 'boulangerie']);
function fresh(s: State, recipe: string): Map<string, string> {
  const r = s.recipes[recipe];
  const m = new Map<string, string>();
  if (r) for (const l of current(r).ingredients) if (FRESH.has(aisleOf(l.name, l.form, s.aisles))) m.set(nameKey(l.name), l.name.toLowerCase());
  return m;
}
// Ingrédient principal : la première viande, le premier poisson ou la première charcuterie de la recette.
function mainOf(s: State, recipe: string): string | null {
  const r = s.recipes[recipe];
  if (!r) return null;
  const l = current(r).ingredients.find(x => { const a = aisleOf(x.name, x.form, s.aisles); return a === 'boucherie' || a === 'frais'; });
  return l ? nameKey(l.name).split(' ')[0] ?? null : null;
}
// Plats prévus autour d'un jour (planning existant + propositions en cours), pour varier et réutiliser.
export type Around = Map<LocalDate, string[]>;
function around(s: State, day: LocalDate, extra: Around): Around {
  const m: Around = new Map();
  for (const p of Object.values(s.preps)) {
    const d = p.slot ? parseSlot(p.slot)?.date : undefined;
    if (d && Math.abs(daysBetween(day, d)) <= 6) m.set(d, [...(m.get(d) ?? []), p.recipe]);
  }
  for (const [d, rs] of extra) m.set(d, [...(m.get(d) ?? []), ...rs]);
  return m;
}

// Produits surveillés fermés dont la DLC tombe dans les 3 jours suivant le créneau : un plat qui les utilise est mis en avant.
function expiring(s: State, day: LocalDate): Map<string, { name: string; date: LocalDate }> {
  const m = new Map<string, { name: string; date: LocalDate }>();
  for (const w of Object.values(s.watch)) {
    if (w.closed || !w.date || w.date.kind !== 'DLC' || w.state !== 'ferme') continue;
    const delta = daysBetween(day, w.date.value);
    if (delta >= 0 && delta <= 3) m.set(nameKey(w.name), { name: w.name, date: w.date.value });
  }
  return m;
}

export function rank(s: State, slot: SlotKey, today: LocalDate, exclude: ReadonlySet<string> = new Set(), extra: Around = new Map()): Ranked[] {
  const p = parseSlot(slot);
  if (!p) return [];
  const near = around(s, p.date, extra);
  const neighbours = [-1, 0, 1].flatMap(dd => near.get(addDays(p.date, dd)) ?? []);
  const neighbourMains = new Set(neighbours.map(r => mainOf(s, r)).filter((x): x is string => !!x));
  const weekFresh = new Map<string, string>();
  for (const rs of near.values()) for (const r of rs) for (const [k, v] of fresh(s, r)) weekFresh.set(k, v);
  const last = lastPlanned(s);
  const weekend = weekday(p.date) >= 5, evening = p.slot === 'soir';
  const rit = s.settings.ritual, batchSlot = !!rit && defaultIn(lastWeekday(addDays(p.date, -1), rit.cook), p.date);
  const exp = expiring(s, p.date);
  const out: Ranked[] = [];
  for (const r of Object.values(s.recipes)) {
    if (r.archived || exclude.has(r.id)) continue;
    const c = current(r);
    const tags = new Set(c.tags);
    const seen = last.get(r.id);
    const since = seen ? daysBetween(seen, today) : null;
    let score = since === null ? 40 : Math.min(Math.max(since, 0), 45);
    const why: string[] = [];
    const used = c.ingredients.map(l => exp.get(nameKey(l.name))).find(Boolean);
    if (used) { score += 30; why.push(`utilise ${used.name.toLowerCase()} (DLC ${fmtDayShort(used.date)})`); }
    if (tags.has('rapide') && !weekend && evening) { score += 10; why.push('rapide'); }
    if (tags.has('week-end') && weekend) { score += 10; why.push('plat du week-end'); }
    if (tags.has('favori')) { score += 8; why.push('favori'); }
    if (tags.has('batch') && batchSlot) { score += 10; why.push('se prépare à l\'avance'); }
    // Réutiliser un produit frais déjà acheté pour un autre plat de la semaine : moins de restes de crème ou de coriandre.
    const shared = [...fresh(s, r.id)].filter(([k]) => weekFresh.has(k)).map(([, v]) => v);
    if (shared.length) { score += Math.min(12, 4 * shared.length); why.push(`réutilise ${shared.slice(0, 2).join(', ')}`); }
    // Varier : pas la même viande ou le même poisson deux jours de suite.
    const main = mainOf(s, r.id);
    if (main && neighbourMains.has(main)) score -= 15;
    if (since !== null && Math.abs(since) < 4) score -= 30; // pas deux fois en quelques jours
    why.push(since === null ? 'pas encore prévu' : since < 0 ? `déjà prévu ${fmtDayShort(seen as string)}` : since === 0 ? 'prévu aujourd\'hui' : `pas au menu depuis ${since} j`);
    out.push({ recipe: r.id, name: c.name, score, reason: why.join(' · ') });
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr') || (a.recipe < b.recipe ? -1 : 1));
}

const onlyBoxes = (s: State, k: SlotKey): boolean => {
  const present = eaters(s, k).filter(e => e.presence !== 'dehors');
  return present.length > 0 && present.every(e => e.presence === 'boite') && !(s.slots[k]?.guests);
};

// Créneau encore à venir (on ne propose rien pour un repas passé).
export const isUpcoming = (k: SlotKey, today: LocalDate, hour: number): boolean => {
  const p = parseSlot(k);
  if (!p) return false;
  return p.date > today || (p.date === today && (p.slot === 'soir' ? hour < 21 : hour < 14));
};

// Contexte d'un créneau pour une découverte : familles (volaille, poisson…) des jours voisins, produits frais de la semaine.
function discoveryContext(s: State, slot: SlotKey, week: LocalDate, extra: Around, newFamilies: ReadonlyMap<LocalDate, string[]>, exclude: ReadonlySet<string>) {
  const p = parseSlot(slot) as { date: LocalDate; slot: 'midi' | 'soir' };
  const near = around(s, p.date, extra);
  const days = [-1, 0, 1].map(dd => addDays(p.date, dd));
  const neighbourFamilies = familiesOf(s, days.flatMap(d => near.get(d) ?? []));
  for (const d of days) for (const f of newFamilies.get(d) ?? []) neighbourFamilies.add(f);
  const weekFresh = new Map<string, string>();
  for (const rs of near.values()) for (const r of rs) for (const [k, v] of fresh(s, r)) weekFresh.set(k, v);
  return { week, weekend: weekday(p.date) >= 5, evening: p.slot === 'soir', neighbourFamilies, weekFresh, exclude };
}

// « Autre idée » sur une découverte : la suivante pour ce créneau, hors celles déjà vues ou proposées ailleurs.
export function nextDiscovery(s: State, cat: Catalog, slot: SlotKey, week: LocalDate, exclude: ReadonlySet<string>) {
  return discover(s, cat, discoveryContext(s, slot, week, new Map(), new Map(), exclude))[0];
}

// Remplit les créneaux vides de la semaine où quelqu'un mange. Les créneaux déjà prévus ne bougent pas.
// Avec le catalogue : vos plats d'abord ; une découverte quand il n'en reste plus (3 par semaine au plus : au-delà,
// trop d'achats inhabituels), et au moins une par semaine (à la place de la proposition la moins convaincante).
const MAX_NEW = 3;
export function proposeWeek(s: State, week: LocalDate, today: LocalDate, hour: number, cat: Catalog | null = null): Proposal[] {
  const out: Proposal[] = [];
  const used = new Set<string>(), usedNew = new Set<string>();
  const newFamilies = new Map<LocalDate, string[]>();
  const scores = new Map<SlotKey, number>();
  const cooks = new Map<SlotKey, string | null>(); // créneau → préparation existante (null si seulement proposée)
  const proposed: Around = new Map();
  const pickNew = (k: SlotKey) => {
    const best = cat ? discover(s, cat, discoveryContext(s, k, week, proposed, newFamilies, usedNew))[0] : undefined;
    if (!best) return null;
    usedNew.add(best.recipe.id);
    const d = parseSlot(k)?.date as LocalDate;
    if (best.recipe.main) newFamilies.set(d, [...(newFamilies.get(d) ?? []), best.recipe.main]);
    return best;
  };
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const k = slotKey(addDays(week, i), sl);
    const d = s.slots[k]?.dish;
    if (d?.kind === 'cook') { const p = s.preps[d.prep]; if (p) { used.add(p.recipe); cooks.set(k, p.id); } }
  }
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const k = slotKey(addDays(week, i), sl);
    if (!isUpcoming(k, today, hour) || s.slots[k]?.dish || servings(s, k) === 0) continue;
    if (sl === 'midi' && onlyBoxes(s, k) && s.settings.boxesFromDinner) {
      const src = prevSlot(k);
      if (cooks.has(src)) out.push({ slot: k, dish: { kind: 'from', source: src, prep: cooks.get(src) ?? null }, reason: 'boîte : restes du dîner de la veille', presence: {}, guests: 0 });
      continue;
    }
    const best = rank(s, k, today, used, proposed)[0];
    if (!best) {
      const fresh = usedNew.size < MAX_NEW ? pickNew(k) : null;
      if (fresh) { cooks.set(k, null); out.push({ slot: k, dish: { kind: 'new', catalog: fresh.recipe, extra: 0 }, reason: fresh.reason, presence: {}, guests: 0 }); }
      continue;
    }
    used.add(best.recipe);
    cooks.set(k, null); scores.set(k, best.score);
    proposed.set(addDays(week, i), [...(proposed.get(addDays(week, i)) ?? []), best.recipe]);
    out.push({ slot: k, dish: { kind: 'cook', recipe: best.recipe, extra: 0 }, reason: best.reason, presence: {}, guests: 0 });
  }
  if (cat && !out.some(p => p.dish?.kind === 'new')) {
    const weakest = out.filter(p => p.dish?.kind === 'cook' && !out.some(x => x.dish?.kind === 'from' && x.dish.source === p.slot))
      .sort((a, b) => (scores.get(a.slot) ?? 0) - (scores.get(b.slot) ?? 0) || (a.slot < b.slot ? -1 : 1))[0];
    const fresh = weakest ? pickNew(weakest.slot) : null;
    if (weakest && fresh) out[out.indexOf(weakest)] = { ...weakest, dish: { kind: 'new', catalog: fresh.recipe, extra: 0 }, reason: fresh.reason };
  }
  return out;
}

// Reprendre une autre semaine comme brouillon : plats, présences et invités ; jamais les états, coches, vérifications ni dates.
export function copyWeek(s: State, from: LocalDate, to: LocalDate): { proposals: Proposal[]; skipped: SlotKey[] } {
  const offset = daysBetween(from, to);
  const proposals: Proposal[] = [];
  const skipped: SlotKey[] = [];
  const lo = slotOrder(slotKey(from, 'midi')), hi = slotOrder(slotKey(addDays(from, 6), 'soir'));
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const src = slotKey(addDays(from, i), sl), dst = slotKey(addDays(to, i), sl);
    const slot = s.slots[src];
    if (!slot) continue;
    const base = { slot: dst, presence: { ...slot.presence }, guests: slot.guests };
    const d = slot.dish;
    if (d && s.slots[dst]?.dish) { skipped.push(dst); continue; }
    if (!d) { if (Object.keys(base.presence).length || base.guests) proposals.push({ ...base, dish: null, reason: 'présences copiées' }); continue; }
    if (d.kind === 'outside') { proposals.push({ ...base, dish: { kind: 'outside', note: d.note }, reason: 'repas extérieur copié' }); continue; }
    const p = s.preps[d.prep];
    if (!p) continue;
    if (d.kind === 'cook') { proposals.push({ ...base, dish: { kind: 'cook', recipe: p.recipe, extra: p.extra }, reason: 'copié' }); continue; }
    const ps = p.slot ? parseSlot(p.slot) : null;
    if (ps && p.slot && slotOrder(p.slot) >= lo && slotOrder(p.slot) <= hi)
      proposals.push({ ...base, dish: { kind: 'from', source: slotKey(addDays(ps.date, offset), ps.slot), prep: null }, reason: `restes de ${prepTitle(s, p)}` });
    else proposals.push({ ...base, dish: null, reason: 'restes d\'un plat hors de la semaine : à choisir' });
  }
  return { proposals, skipped };
}

// Événements pour accepter des propositions (préparations créées ici, liens vers les plats proposés résolus).
export function acceptDrafts(s: State, proposals: readonly Proposal[]): Draft[] {
  const drafts: Draft[] = [];
  const prepAt = new Map<SlotKey, string>();
  for (const p of proposals) {
    for (const [m, pr] of Object.entries(p.presence)) drafts.push({ t: 'slot.presence', p: { slot: p.slot, member: m, presence: pr } });
    if (p.guests) drafts.push({ t: 'slot.guests', p: { slot: p.slot, guests: p.guests } });
    if (p.dish?.kind === 'cook') { const id = newId(); prepAt.set(p.slot, id); drafts.push({ t: 'slot.cook', p: { slot: p.slot, prep: id, recipe: p.dish.recipe, extra: p.dish.extra } }); }
    if (p.dish?.kind === 'new') {
      const recipe = newId(), id = newId();
      prepAt.set(p.slot, id);
      drafts.push({ t: 'recipe.save', p: { recipe, content: toContent(p.dish.catalog) } }, { t: 'slot.cook', p: { slot: p.slot, prep: id, recipe, extra: p.dish.extra } });
    }
    if (p.dish?.kind === 'outside') drafts.push({ t: 'slot.outside', p: { slot: p.slot, note: p.dish.note } });
  }
  for (const p of proposals) {
    if (p.dish?.kind !== 'from') continue;
    const d = s.slots[p.dish.source]?.dish;
    const prep = p.dish.prep ?? prepAt.get(p.dish.source) ?? (d?.kind === 'cook' ? d.prep : null);
    if (prep) drafts.push({ t: 'slot.from', p: { slot: p.slot, prep } });
  }
  // « Plat entier » proposé : le surplus au-delà du repas et de ses boîtes est compté « en plus ».
  for (const p of proposals) {
    if (p.dish?.kind !== 'cook' || p.dish.extra) continue;
    const people = (k: SlotKey) => s.members.filter(m => (p2(k)?.presence[m.id] ?? presenceOf(s, k, m.id)) !== 'dehors').length + (p2(k)?.guests ?? 0);
    const needed = people(p.slot) + proposals.filter(x => x.dish?.kind === 'from' && x.dish.source === p.slot).reduce((n, x) => n + people(x.slot), 0);
    const extra = wholeExtra(s, p.dish.recipe, needed);
    const cook = drafts.find(x => x.t === 'slot.cook' && x.p.slot === p.slot);
    if (extra && cook && cook.t === 'slot.cook') cook.p.extra = extra;
  }
  return drafts;
  function p2(k: SlotKey): Proposal | undefined { return proposals.find(x => x.slot === k); }
}

// Portions déjà prêtes et libres : la meilleure idée pour un soir sans plan (rien à cuisiner).
export interface Leftover { prep: string; name: string; free: number; age: number }
export function leftovers(s: State, today: LocalDate): Leftover[] {
  const out: Leftover[] = [];
  for (const p of Object.values(s.preps)) {
    const pt = portions(s, p);
    if (!p.done || pt.free === null || pt.free <= 0) continue;
    const declared = paris(new Date(p.done.at)).date, cooked = p.slot ? parseSlot(p.slot)?.date ?? declared : declared;
    const made = cooked < declared ? cooked : declared; // cuisiné au plus tard à la déclaration
    out.push({ prep: p.id, name: prepTitle(s, p), free: pt.free, age: Math.max(0, daysBetween(made, today)) });
  }
  return out.sort((a, b) => a.age - b.age || a.name.localeCompare(b.name, 'fr'));
}
