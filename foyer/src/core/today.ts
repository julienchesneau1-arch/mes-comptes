// Écran « Aujourd'hui » : le prochain repas, l'action suivante, les tâches courtes, et seulement les problèmes utiles à ces repas.
import { type LocalDate, type SlotKey, slotKey, addDays, parseSlot, fmtSlot, weekOf, weekday, SLOTS, paris } from './dates.ts';
import { type State, type Prep, current } from './model.ts';
import { portions, servings, eaters, dependents } from './plan.ts';
import { type Replay } from './reduce.ts';
import { type SlotView, type Problem, slotView, problems, prepTitle } from './status.ts';
import { deriveShopping } from './shopping.ts';
import { type Ranked, type Leftover, rank, leftovers, isUpcoming } from './propose.ts';

export interface Task { key: string; text: string; done: boolean; hint: string }
export interface Card { label: string; view: SlotView; detail: string | null }
export interface Today {
  date: LocalDate; hour: number;
  cards: Card[];
  tasks: Task[];
  toBuy: { slot: SlotKey; names: string[] }[];
  checks: Problem[];
  empty: number;          // créneaux à venir cette semaine où quelqu'un mange et rien n'est prévu
  nextWeekEmpty: boolean;
  ideas: { leftovers: Leftover[]; recipes: Ranked[] } | null;
}

const who = (s: State, k: SlotKey): string => {
  const boxes = eaters(s, k).filter(e => e.presence === 'boite').map(e => e.name);
  return boxes.length ? ` (boîte ${boxes.join(', ')})` : '';
};

// « Préparer 4 portions : 2 ce soir, 1 pour demain midi (boîte Alex), 1 en plus. »
export function portionsDetail(s: State, prep: Prep, at: SlotKey, today: LocalDate): string {
  const pt = portions(s, prep);
  const deps = dependents(s, prep.id);
  const parts: string[] = [];
  if (prep.slot) parts.push(`${pt.serve} ${fmtSlot(prep.slot, today)}`);
  for (const d of deps) parts.push(`${servings(s, d)} pour ${fmtSlot(d, today)}${who(s, d)}`);
  if (pt.extra) parts.push(`${pt.extra} en plus`);
  if (!prep.done) {
    if (prep.slot !== at) return `Restes de ${prepTitle(s, prep)} (${prep.slot ? fmtSlot(prep.slot, today) : 'déjà préparé'}) · pas encore déclaré préparé`;
    return pt.planned === pt.serve ? `${pt.planned} portion${pt.planned > 1 ? 's' : ''}` : `Préparer ${pt.planned} portions : ${parts.join(', ')}`;
  }
  const res = pt.reservations.map(r => `${r.n} ${fmtSlot(r.slot, today)}`).join(', ');
  const free = pt.free ?? 0;
  return `${pt.declared} portion${(pt.declared ?? 0) > 1 ? 's' : ''} déclarée${(pt.declared ?? 0) > 1 ? 's' : ''}${pt.eaten ? ` · ${pt.eaten} mangée${pt.eaten > 1 ? 's' : ''}` : ''}${res ? ` · réservées : ${res}` : ''}${free > 0 ? ` · ${free} libre${free > 1 ? 's' : ''}` : free < 0 ? ` · il en manque ${-free}` : ''}`;
}

export function deriveToday(r: Replay, now: Date): Today {
  const s = r.state;
  const { date: today, hour } = paris(now);
  const tomorrow = addDays(today, 1);

  // Les deux prochains repas où quelqu'un mange ou qui ont un plat.
  const cards: Card[] = [];
  let k = slotKey(today, hour < 15 ? 'midi' : 'soir');
  for (let i = 0; i < 5 && cards.length < 2; i++) {
    const v = slotView(s, k, today, hour);
    if (v.servings > 0 || s.slots[k]?.dish) {
      const label = fmtSlot(k, today);
      const prep = v.prep;
      cards.push({ label: label.charAt(0).toUpperCase() + label.slice(1), view: v, detail: prep ? portionsDetail(s, prep, k, today) : null });
    }
    const p = parseSlot(k);
    if (!p) break;
    k = p.slot === 'midi' ? slotKey(p.date, 'soir') : slotKey(addDays(p.date, 1), 'midi');
  }

  // Tâches renseignées : « à faire la veille » / « le matin », et les boîtes à préparer.
  const tasks: Task[] = [];
  const cookAt = (d: LocalDate) => SLOTS.map(sl => slotKey(d, sl)).map(x => ({ k: x, d: s.slots[x]?.dish })).filter(x => x.d?.kind === 'cook');
  const addAhead = (slotK: SlotKey, prepId: string, when: 'veille' | 'matin', hint: string) => {
    const prep = s.preps[prepId];
    if (!prep || prep.done || s.slots[slotK]?.eaten) return;
    const rc = s.recipes[prep.recipe];
    if (!rc) return;
    current(rc).ahead.forEach((a, i) => {
      if (a.when !== when) return;
      const key = `ahead:${prepId}:${i}:${a.label}`;
      tasks.push({ key, text: a.label, done: !!s.tasks[key]?.done, hint: `${hint} · ${current(rc).name} ${fmtSlot(slotK, today)}` });
    });
  };
  for (const x of cookAt(tomorrow)) if (x.d?.kind === 'cook') addAhead(x.k, x.d.prep, 'veille', "aujourd'hui pour demain");
  for (const x of cookAt(today)) if (x.d?.kind === 'cook') { addAhead(x.k, x.d.prep, 'matin', 'ce matin'); addAhead(x.k, x.d.prep, 'veille', 'prévu hier'); }
  const boxSlots = [slotKey(tomorrow, 'midi'), ...(hour < 12 ? [slotKey(today, 'midi')] : [])];
  for (const bk of boxSlots) {
    const d = s.slots[bk]?.dish;
    if (!d || d.kind === 'outside' || s.slots[bk]?.eaten) continue;
    for (const e of eaters(s, bk).filter(x => x.presence === 'boite')) {
      const key = `box:${bk}:${e.id}`;
      tasks.push({ key, text: `Préparer la boîte de ${e.name}`, done: !!s.tasks[key]?.done, hint: `${prepTitle(s, s.preps[d.prep])} · ${fmtSlot(bk, today)}` });
    }
  }

  // Courses pas encore prises pour les repas d'aujourd'hui et demain.
  const soon = new Set([slotKey(today, 'midi'), slotKey(today, 'soir'), slotKey(tomorrow, 'midi'), slotKey(tomorrow, 'soir')].filter(x => isUpcoming(x, today, hour)));
  const weeks = [...new Set([...soon].map(x => weekOf(parseSlot(x)?.date ?? today, s.settings.weekStart)))];
  const bySlot = new Map<SlotKey, Set<string>>();
  for (const w of weeks) for (const l of deriveShopping(s, w).lines) {
    if (l.done) continue;
    for (const src of l.sources) if (soon.has(src.slot)) { const set = bySlot.get(src.slot) ?? new Set(); set.add(l.name); bySlot.set(src.slot, set); }
  }
  const toBuy = [...bySlot.entries()].map(([slot, names]) => ({ slot, names: [...names] }));

  // À vérifier : problèmes liés aux repas affichés, produits dont la DLC arrive, conflits de synchro.
  const shown = new Set(cards.map(c => c.view.key));
  const shownPreps = new Set(cards.map(c => c.view.prep?.id).filter(Boolean));
  const checks = problems(r, today, hour).filter(p => p.event || p.watch || (p.slot && (shown.has(p.slot) || soon.has(p.slot))) || (p.prep && shownPreps.has(p.prep)));

  // Ce qui reste à décider.
  const week = weekOf(today, s.settings.weekStart);
  let empty = 0;
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const x = slotKey(addDays(week, i), sl);
    if (isUpcoming(x, today, hour) && !s.slots[x]?.dish && servings(s, x) > 0) empty++;
  }
  const next = addDays(week, 7);
  const nextWeekEmpty = weekday(today) >= 4 && !Object.entries(s.slots).some(([x, v]) => v.dish && (parseSlot(x)?.date ?? '') >= next && (parseSlot(x)?.date ?? '') < addDays(next, 7));

  const first = cards[0];
  const near = new Set(Object.values(s.preps).filter(p => { const d = p.slot ? parseSlot(p.slot)?.date : undefined; return d && d >= addDays(today, -2) && d <= addDays(today, 6); }).map(p => p.recipe));
  const ideas = first && !first.view.prep && first.view.status === 'vide'
    ? { leftovers: leftovers(s, today), recipes: rank(s, first.view.key, today, near).slice(0, 3) }
    : null;

  return { date: today, hour, cards, tasks, toBuy, checks, empty, nextWeekEmpty, ideas };
}
