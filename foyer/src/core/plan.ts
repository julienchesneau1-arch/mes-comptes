// Portions : qui mange, combien préparer, ce qui reste. Uniquement à partir de ce que le foyer a déclaré.
// Quantité libre = rendement déclaré − mangé − jeté − réservé ; rien n'est « disponible » avant « C'est préparé ».
import { type SlotKey, parseSlot, weekday, slotOrder } from './dates.ts';
import type { State, Presence, MemberId, Slot, Prep } from './model.ts';

export function presence(s: State, k: SlotKey, m: MemberId): Presence {
  const own = s.slots[k]?.presence[m];
  if (own) return own;
  const p = parseSlot(k);
  if (!p) return 'dehors';
  return s.settings.rhythm[weekday(p.date)]?.[p.slot][m] ?? 'maison';
}

// Portions à servir sur un créneau : personnes à la maison ou en boîte, plus les invités.
export function servings(s: State, k: SlotKey): number {
  let n = s.slots[k]?.guests ?? 0;
  for (const m of s.members) if (presence(s, k, m.id) !== 'dehors') n++;
  return n;
}

export const eaters = (s: State, k: SlotKey): { id: MemberId; name: string; presence: Presence }[] =>
  s.members.map(m => ({ id: m.id, name: m.name, presence: presence(s, k, m.id) }));

// Index des créneaux qui consomment chaque préparation (le créneau de cuisine compris). Calculé une fois par état.
const IDX = new WeakMap<State, Map<string, SlotKey[]>>();
export function users(s: State, prepId: string): SlotKey[] {
  let idx = IDX.get(s);
  if (!idx) {
    idx = new Map();
    for (const [k, slot] of Object.entries(s.slots)) {
      const d = slot.dish;
      if (d && (d.kind === 'cook' || d.kind === 'from')) { const l = idx.get(d.prep) ?? []; l.push(k); idx.set(d.prep, l); }
    }
    for (const l of idx.values()) l.sort((a, b) => slotOrder(a) - slotOrder(b));
    IDX.set(s, idx);
  }
  return idx.get(prepId) ?? [];
}
// À appeler après toute modification des créneaux pendant le rejeu (l'état est muté sur place à ce moment-là).
export const invalidate = (s: State): void => { IDX.delete(s); };
export const dependents = (s: State, prepId: string): SlotKey[] => users(s, prepId).filter(k => s.slots[k]?.dish?.kind === 'from');

export interface Portions {
  planned: number;            // à préparer : servies au créneau de cuisine + portions liées + en plus
  serve: number;              // servies au créneau de cuisine
  linked: number;             // portions liées à d'autres créneaux (boîtes, restes prévus)
  extra: number;              // sans destination
  declared: number | null;    // rendement réel déclaré ; null tant que « C'est préparé » n'est pas déclaré
  eaten: number;
  discarded: number;
  remaining: number | null;   // déclaré − mangé − jeté
  reservations: { slot: SlotKey; n: number }[];
  reserved: number;
  free: number | null;        // restant − réservé ; négatif = il manque des portions
}

export function portions(s: State, prep: Prep): Portions {
  const ks = users(s, prep.id);
  let serve = 0, linked = 0, eaten = 0, reserved = 0;
  const reservations: { slot: SlotKey; n: number }[] = [];
  for (const k of ks) {
    const slot = s.slots[k] as Slot;
    const n = servings(s, k);
    if (k === prep.slot) serve = n; else linked += n;
    if (slot.eaten) eaten += slot.eaten.n;
    else if (n > 0) { reservations.push({ slot: k, n }); reserved += n; }
  }
  const planned = prep.done ? prep.done.planned : serve + linked + prep.extra;
  const declared = prep.done ? prep.done.yield : null;
  const remaining = declared === null ? null : declared - eaten - prep.discarded;
  return { planned, serve, linked, extra: prep.extra, declared, eaten, discarded: prep.discarded, remaining, reservations, reserved,
    free: remaining === null ? null : remaining - reserved };
}

// Portions à préparer telles qu'utilisées pour les courses (figées au moment de « C'est préparé »).
export const toPrepare = (s: State, prep: Prep): number => portions(s, prep).planned;
