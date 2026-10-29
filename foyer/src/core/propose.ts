// « Qu'est-ce qu'on mange ? » : propositions tirées uniquement de VOS plats, avec une raison lisible.
// Règle déterministe (pas d'IA) : le plat le moins récemment prévu d'abord, bonus « rapide » en semaine, « week-end » le week-end,
// « favori », et un plat qui utilise un produit surveillé dont la DLC approche. Rien n'est appliqué sans votre accord.
import { type LocalDate, type SlotKey, slotKey, parseSlot, addDays, weekday, daysBetween, prevSlot, slotOrder, SLOTS, fmtDayShort, paris } from './dates.ts';
import { type State, type Presence, current } from './model.ts';
import { servings, portions, presence as presenceOf, fedByDinner } from './plan.ts';
import { nameKey } from './text.ts';
import { aisleOf } from './ingredients.ts';
import { type Draft, newId } from './reduce.ts';
import { wholeExtra } from './commands.ts';
import { prepTitle } from './status.ts';
import { type Catalog, discover, familiesOf, toContent, linesOf } from './catalog.ts';
import { type Limit, pressing, limitFor, usesLimit, limitText, before } from './limits.ts';
import type { CatalogRecipe } from './wikibook.ts';
import { defaultIn, lastWeekday } from './batch.ts';
import { dishType } from './visual.ts';
import { type Running, weekBalance, running, balanceBonus, addToRunning } from './balance.ts';
import { weekOf } from './dates.ts';
import { dishBlocked } from './allergens.ts';

export type ProposedDish =
  | { kind: 'cook'; recipe: string; extra: number }
  | { kind: 'new'; catalog: CatalogRecipe; extra: number; yield?: number } // plat à découvrir : ajouté à « Nos plats » à l'acceptation ; yield choisi si la page ne le dit pas
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

export interface Ranked { recipe: string; name: string; score: number; reason: string; blocked?: string } // blocked : « contient arachides »

// Aucune redondance : un plat prévu à moins de 2 semaines (avant ou après) n'est pas reproposé tant qu'il reste autre chose.
export const NO_REPEAT = 13;
const DATES = new WeakMap<State, Map<string, LocalDate[]>>();
function plannedDates(s: State): Map<string, LocalDate[]> {
  let m = DATES.get(s);
  if (!m) {
    m = new Map();
    for (const p of Object.values(s.preps)) {
      const d = p.slot ? parseSlot(p.slot)?.date : p.done ? paris(new Date(p.done.at)).date : undefined;
      if (d) m.set(p.recipe, [...(m.get(p.recipe) ?? []), d]);
    }
    DATES.set(s, m);
  }
  return m;
}
export interface RankOpts {
  noRepeat?: boolean;                    // écarter les plats prévus à moins de NO_REPEAT jours
  types?: ReadonlyMap<string, number>;   // types de plats déjà dans la semaine : on varie
  run?: Running;                         // repères d'équilibre de la semaine (poisson, légumes secs, viande)
  keepBlocked?: boolean;                 // choix à la main : garder les plats exclus (allergie, refus), en dernier et signalés
}
const typeOfRecipe = (s: State, id: string): string | null => { const r = s.recipes[id]; if (!r) return null; const c = current(r); return dishType(c.name, c.ingredients.map(l => l.name)); };

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

// Produits surveillés fermés dont la DLC ou la DDM tombe dans les 3 jours suivant le créneau : un plat qui les utilise est mis en
// avant (DLC : +30, DDM : +15), qu'il soit l'un de vos plats ou une recette prête.
const expiring = (s: State, day: LocalDate): Limit[] => pressing(s, day, addDays(day, 3));
function useBonus(ls: readonly Limit[], names: readonly string[]): { score: number; why: string } | null {
  const l = limitFor(ls, names);
  return l ? { score: l.kind === 'DLC' ? 30 : 15, why: `utilise ${l.name.toLowerCase()} (${limitText(l)})` } : null;
}
// Bonus d'une recette prête : repères d'équilibre de la semaine et produits à utiliser avant leur date.
function catalogBonus(s: State, slot: SlotKey, run: Running): (r: CatalogRecipe) => { score: number; why: string } | null {
  const exp = expiring(s, parseSlot(slot)?.date ?? '');
  return r => {
    const bs = [balanceBonus(run, r.ingredients), exp.length ? useBonus(exp, linesOf(r).map(l => l.name)) : null].filter((b): b is { score: number; why: string } => !!b);
    return bs.length ? { score: bs.reduce((n, b) => n + b.score, 0), why: bs.map(b => b.why).filter(Boolean).join(' · ') } : null;
  };
}

export function rank(s: State, slot: SlotKey, today: LocalDate, exclude: ReadonlySet<string> = new Set(), extra: Around = new Map(), opts: RankOpts = {}): Ranked[] {
  const p = parseSlot(slot);
  if (!p) return [];
  const dates = plannedDates(s);
  const run = opts.run ?? running(weekBalance(s, weekOf(p.date, s.settings.weekStart)));
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
    if (opts.noRepeat && (dates.get(r.id) ?? []).some(d => Math.abs(daysBetween(d, p.date)) <= NO_REPEAT)) continue;
    const c = current(r);
    const no = dishBlocked(s.settings.exclude, c.ingredients.map(l => l.name));
    if (no && !opts.keepBlocked) continue; // allergie ou refus du foyer : jamais proposé
    const tags = new Set(c.tags);
    const seen = last.get(r.id);
    const since = seen ? daysBetween(seen, today) : null;
    let score = since === null ? 40 : Math.min(Math.max(since, 0), 45);
    const why: string[] = [];
    const use = useBonus(exp, c.ingredients.map(l => l.name)); // « Poulet » ↔ « blanc de poulet »
    if (use) { score += use.score; why.push(use.why); }
    // Durées déclarées (préparation + cuisson) : mêmes règles que pour les découvertes du catalogue.
    const minutes = c.prepMin != null || c.cookMin != null ? (c.prepMin ?? 0) + (c.cookMin ?? 0) : null;
    if (!weekend && evening) {
      if (tags.has('rapide') || (minutes !== null && minutes <= 30)) { score += 10; why.push(minutes !== null ? `rapide (${minutes} min)` : 'rapide'); }
      else if (minutes !== null && minutes > 60) score -= 15; // pas un soir de semaine
    }
    if (tags.has('week-end') && weekend) { score += 10; why.push('plat du week-end'); }
    else if (weekend && minutes !== null && minutes > 45) { score += 5; why.push('plat du week-end'); }
    if (tags.has('favori')) { score += 8; why.push('favori'); }
    if (tags.has('batch') && batchSlot) { score += 10; why.push('se prépare à l\'avance'); }
    const type = dishType(c.name, c.ingredients.map(l => l.name)), same = type ? opts.types?.get(type) ?? 0 : 0;
    if (same) score -= 14 * same; // pas deux plats du même genre dans la semaine
    const b = balanceBonus(run, c.ingredients.map(l => l.name));
    if (b) { score += b.score; if (b.why) why.push(b.why); }
    // Réutiliser un produit frais déjà acheté pour un autre plat de la semaine : moins de restes de crème ou de coriandre.
    const shared = [...fresh(s, r.id)].filter(([k]) => weekFresh.has(k)).map(([, v]) => v);
    if (shared.length) { score += Math.min(12, 4 * shared.length); why.push(`réutilise ${shared.slice(0, 2).join(', ')}`); }
    // Varier : pas la même viande ou le même poisson deux jours de suite.
    const main = mainOf(s, r.id);
    if (main && neighbourMains.has(main)) score -= 15;
    if (since !== null && Math.abs(since) < 4) score -= 30; // pas deux fois en quelques jours
    why.push(since === null ? 'jamais encore au menu' : since < 0 ? `déjà prévu ${fmtDayShort(seen as string)}` : since === 0 ? 'prévu aujourd\'hui' : `pas au menu depuis ${since} j`);
    out.push({ recipe: r.id, name: c.name, score: no ? score - 1000 : score, reason: why.join(' · '), ...(no ? { blocked: `${no.why} (${no.name.toLowerCase()})` } : {}) });
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr') || (a.recipe < b.recipe ? -1 : 1));
}


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

// Types de plats déjà prévus dans une semaine (pour varier : pas deux soupes, deux gratins…).
function weekTypes(s: State, week: LocalDate): Map<string, number> {
  const types = new Map<string, number>();
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const d = s.slots[slotKey(addDays(week, i), sl)]?.dish;
    const t = d?.kind === 'cook' ? typeOfRecipe(s, s.preps[d.prep]?.recipe ?? '') : null;
    if (t) types.set(t, (types.get(t) ?? 0) + 1);
  }
  return types;
}

// « Autre idée » sur une découverte : la suivante pour ce créneau, hors celles déjà vues ou proposées ailleurs.
export function nextDiscovery(s: State, cat: Catalog, slot: SlotKey, week: LocalDate, exclude: ReadonlySet<string>, seen: ReadonlySet<string> = new Set()) {
  const run = running(weekBalance(s, week));
  return discover(s, cat, { ...discoveryContext(s, slot, week, new Map(), new Map(), exclude), types: weekTypes(s, week), seen,
    noYield: (s.settings.variety ?? 'max') === 'max', bonus: catalogBonus(s, slot, run) })[0];
}

// Recettes prêtes pour un repas (choix d'un plat, idées d'Aujourd'hui) : mêmes règles que la semaine générée — allergies et refus,
// variété, repères d'équilibre — et seulement celles qui disent pour combien de personnes (prévues sans question).
export function discoveriesFor(s: State, cat: Catalog, slot: SlotKey, n = 4, seen: ReadonlySet<string> = new Set()) {
  const d = parseSlot(slot)?.date;
  if (!d) return [];
  const week = weekOf(d, s.settings.weekStart), run = running(weekBalance(s, week));
  return discover(s, cat, { ...discoveryContext(s, slot, week, new Map(), new Map(), new Set()), types: weekTypes(s, week), seen, noYield: false,
    bonus: catalogBonus(s, slot, run) }).slice(0, n);
}

// Remplit les créneaux vides de la semaine où quelqu'un mange. Les créneaux déjà prévus ne bougent pas.
// Selon le réglage « Nouveautés » : « max » (défaut) = une recette nouvelle à chaque repas tant que le catalogue en a, vos plats ensuite ;
// « equilibre » = vos plats d'abord, de 1 à 3 découvertes par semaine ; « mes-plats » = vos plats, découvertes seulement s'il n'en reste plus.
// Toujours : jamais deux fois le même plat, pas un plat prévu à moins de 2 semaines s'il reste autre chose, pas deux plats du même genre,
// pas la même viande deux jours de suite, et les repères d'équilibre de la semaine (poisson, légumes secs) mis en avant.
const MAX_NEW = 3;
export function proposeWeek(s: State, week: LocalDate, today: LocalDate, hour: number, cat: Catalog | null = null, seen: ReadonlySet<string> = new Set()): Proposal[] {
  const mode = s.settings.variety ?? 'max';
  const out: Proposal[] = [];
  const used = new Set<string>(), usedNew = new Set<string>();
  const newFamilies = new Map<LocalDate, string[]>();
  const scores = new Map<SlotKey, number>();
  const cooks = new Map<SlotKey, string | null>(); // créneau → préparation existante (null si seulement proposée)
  const proposed: Around = new Map();
  const types = weekTypes(s, week), run = running(weekBalance(s, week));
  const addType = (t: string | null) => { if (t) types.set(t, (types.get(t) ?? 0) + 1); };
  const pickNew = (k: SlotKey, only?: (r: CatalogRecipe) => boolean) => {
    const best = cat ? discover(s, cat, { ...discoveryContext(s, k, week, proposed, newFamilies, usedNew), types, seen, noYield: mode === 'max',
      bonus: catalogBonus(s, k, run) }).find(d => !only || only(d.recipe)) : undefined;
    if (!best) return null;
    usedNew.add(best.recipe.id);
    const d = parseSlot(k)?.date as LocalDate;
    if (best.recipe.main) newFamilies.set(d, [...(newFamilies.get(d) ?? []), best.recipe.main]);
    addType(dishType(best.recipe.title, best.recipe.ingredients)); addToRunning(run, best.recipe.ingredients);
    return best;
  };
  const pickOwn = (k: SlotKey, noRepeat: boolean, only?: (recipe: string) => boolean) => {
    const best = rank(s, k, today, used, proposed, { noRepeat, types, run }).find(x => !only || (!x.blocked && only(x.recipe)));
    if (!best) return null;
    const d = parseSlot(k)?.date as LocalDate, r = s.recipes[best.recipe];
    used.add(best.recipe);
    proposed.set(d, [...(proposed.get(d) ?? []), best.recipe]);
    addType(typeOfRecipe(s, best.recipe)); if (r) addToRunning(run, current(r).ingredients.map(l => l.name));
    return best;
  };
  const pushNew = (k: SlotKey, fresh: NonNullable<ReturnType<typeof pickNew>>, reason = fresh.reason) => { cooks.set(k, null); out.push({ slot: k, dish: { kind: 'new', catalog: fresh.recipe, extra: 0 }, reason, presence: {}, guests: 0 }); };
  const pushOwn = (k: SlotKey, best: Ranked, reason = best.reason) => { cooks.set(k, null); scores.set(k, best.score); out.push({ slot: k, dish: { kind: 'cook', recipe: best.recipe, extra: 0 }, reason, presence: {}, guests: 0 }); };
  const open = (k: SlotKey): boolean => isUpcoming(k, today, hour) && !s.slots[k]?.dish && servings(s, k) > 0 && !out.some(p => p.slot === k)
    && !fedByDinner(s, k);
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const k = slotKey(addDays(week, i), sl);
    const d = s.slots[k]?.dish;
    if (d?.kind === 'cook') { const p = s.preps[d.prep]; if (p) { used.add(p.recipe); cooks.set(k, p.id); } }
  }
  // Produits à utiliser avant leur date (DLC d'abord, puis DDM) : un plat qui les contient est réservé sur le premier repas libre
  // d'ici la date, avant de remplir le reste de la semaine ; rien si un plat déjà prévu (ou déjà réservé) les utilise à temps,
  // ni si aucun plat ne les contient (la carte « à consommer avant » d'Aujourd'hui le dit).
  const end = addDays(week, 6);
  for (const l of pressing(s, today > week ? today : week, end)) {
    if (usedInTime(s, l, today) || out.some(p => before(p.slot, l) && usesLimit(propNames(s, p), l))) continue;
    const k = [...Array(7).keys()].flatMap(i => SLOTS.map(sl => slotKey(addDays(week, i), sl))).find(x => before(x, l) && open(x));
    if (!k) continue;
    const why = `à utiliser : ${l.name.toLowerCase()} (${limitText(l)})`;
    const reasonOf = (r: string): string => [why, ...r.split(' · ').filter(x => !x.startsWith('utilise '))].join(' · ');
    const ownUses = (id: string): boolean => usesLimit(current(s.recipes[id]!).ingredients.map(x => x.name), l);
    const own = (): boolean => { const b = pickOwn(k, true, ownUses) ?? pickOwn(k, false, ownUses); if (b) pushOwn(k, b, reasonOf(b.reason)); return !!b; };
    const neu = (): boolean => { const f = pickNew(k, r => usesLimit(linesOf(r).map(x => x.name), l)); if (f) pushNew(k, f, reasonOf(f.reason)); return !!f; };
    if (mode === 'max') { if (!neu()) own(); } else if (!own() && mode === 'equilibre' && usedNew.size < MAX_NEW) neu(); // « mes plats » : vos plats seulement
  }
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const k = slotKey(addDays(week, i), sl);
    if (!isUpcoming(k, today, hour) || s.slots[k]?.dish || servings(s, k) === 0 || out.some(p => p.slot === k)) continue;
    if (fedByDinner(s, k)) {
      const src = prevSlot(k), prev = s.slots[src]?.dish; // dîner de la veille déjà prévu (semaine précédente comprise)
      if (!cooks.has(src) && prev?.kind === 'cook') cooks.set(src, prev.prep);
      if (cooks.has(src)) { out.push({ slot: k, dish: { kind: 'from', source: src, prep: cooks.get(src) ?? null }, reason: 'midi : restes du dîner de la veille', presence: {}, guests: 0 }); continue; }
      if (!s.settings.lunchFromDinner) continue; // boîtes sans dîner la veille : rien d'office
      // Pas de dîner la veille (personne, ou semaine précédente vide) : ce midi se cuisine.
    }
    if (mode === 'max') {
      const fresh = pickNew(k);
      if (fresh) { pushNew(k, fresh); continue; }
      const own = pickOwn(k, true) ?? pickOwn(k, false);
      if (own) pushOwn(k, own);
      continue;
    }
    const own = pickOwn(k, true);
    if (own) { pushOwn(k, own); continue; }
    const fresh = mode === 'mes-plats' || usedNew.size < MAX_NEW ? pickNew(k) : null;
    if (fresh) { pushNew(k, fresh); continue; }
    const again = pickOwn(k, false); // plus rien d'autre : un plat récent plutôt qu'un repas vide
    if (again) pushOwn(k, again);
  }
  if (mode === 'equilibre' && cat && !out.some(p => p.dish?.kind === 'new')) {
    const weakest = out.filter(p => p.dish?.kind === 'cook' && !p.reason.startsWith('à utiliser : ') && !out.some(x => x.dish?.kind === 'from' && x.dish.source === p.slot))
      .sort((a, b) => (scores.get(a.slot) ?? 0) - (scores.get(b.slot) ?? 0) || (a.slot < b.slot ? -1 : 1))[0];
    const fresh = weakest ? pickNew(weakest.slot) : null;
    if (weakest && fresh) out[out.indexOf(weakest)] = { ...weakest, dish: { kind: 'new', catalog: fresh.recipe, extra: 0 }, reason: fresh.reason };
  }
  return out.sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0)); // ordre des repas (« midi » < « soir »)
}

// Ingrédients d'une proposition (vos plats ou recette prête) ; aucun pour des restes.
function propNames(s: State, p: Proposal): string[] {
  const d = p.dish;
  if (d?.kind === 'cook') { const r = s.recipes[d.recipe]; return r ? current(r).ingredients.map(l => l.name) : []; }
  return d?.kind === 'new' ? linesOf(d.catalog).map(l => l.name) : [];
}
// Un plat déjà prévu l'utilise-t-il à temps (cuisiné au plus tard le jour de la date, batch compris) ?
function usedInTime(s: State, l: Limit, today: LocalDate): boolean {
  return Object.values(s.preps).some(p => {
    const day = p.batch ?? (p.slot ? parseSlot(p.slot)?.date : undefined), r = s.recipes[p.recipe];
    return !p.done && !!day && day >= today && day <= l.date && !!r && usesLimit(current(r).ingredients.map(x => x.name), l);
  });
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
      drafts.push({ t: 'recipe.save', p: { recipe, content: toContent(p.dish.catalog, p.dish.yield ?? null) } }, { t: 'slot.cook', p: { slot: p.slot, prep: id, recipe, extra: p.dish.extra } });
    }
    if (p.dish?.kind === 'outside') drafts.push({ t: 'slot.outside', p: { slot: p.slot, note: p.dish.note } });
  }
  // Restes d'un plat déjà prévu : ses portions « en plus » leur étaient destinées et baissent d'autant (une fois pour toutes).
  const extraLeft = new Map<string, number>();
  for (const p of proposals) {
    if (p.dish?.kind !== 'from') continue;
    const d = s.slots[p.dish.source]?.dish;
    const prep = p.dish.prep ?? prepAt.get(p.dish.source) ?? (d?.kind === 'cook' ? d.prep : null);
    if (!prep) continue;
    drafts.push({ t: 'slot.from', p: { slot: p.slot, prep } });
    const ex = s.preps[prep];
    if (ex && !ex.done && ex.extra > 0) extraLeft.set(prep, Math.max(0, (extraLeft.get(prep) ?? ex.extra) - people(p.slot)));
  }
  for (const [prep, extra] of extraLeft) if (extra !== s.preps[prep]?.extra) drafts.push({ t: 'prep.extra', p: { prep, extra } });
  // « Plat entier » proposé : le surplus au-delà du repas et de ses boîtes est compté « en plus ».
  for (const p of proposals) {
    if (p.dish?.kind !== 'cook' || p.dish.extra) continue;
    const needed = people(p.slot) + proposals.filter(x => x.dish?.kind === 'from' && x.dish.source === p.slot).reduce((n, x) => n + people(x.slot), 0);
    const extra = wholeExtra(s, p.dish.recipe, needed);
    const cook = drafts.find(x => x.t === 'slot.cook' && x.p.slot === p.slot);
    if (extra && cook && cook.t === 'slot.cook') cook.p.extra = extra;
  }
  return drafts;
  function p2(k: SlotKey): Proposal | undefined { return proposals.find(x => x.slot === k); }
  function people(k: SlotKey): number { return s.members.filter(m => (p2(k)?.presence[m.id] ?? presenceOf(s, k, m.id)) !== 'dehors').length + (p2(k)?.guests ?? 0); }
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
