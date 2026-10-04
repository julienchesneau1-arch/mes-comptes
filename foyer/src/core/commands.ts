// Commandes métier → événements. Pures : elles lisent l'état et décrivent les changements ; l'aperçu les simule avant d'enregistrer.
import { type SlotKey, parseSlot, slotKey, addDays, daysBetween, slotOrder } from './dates.ts';
import { type State, current } from './model.ts';
import { type Draft, newId } from './reduce.ts';
import { dependents, portions, servings } from './plan.ts';

// « Plat entier » : on prépare toujours la recette complète ; ce qui dépasse les repas prévus devient des portions « en plus ».
export const WHOLE = 'plat entier';
export function wholeExtra(s: State, recipe: string, needed: number): number {
  const r = s.recipes[recipe];
  const c = r ? current(r) : null;
  return c && c.yield && c.tags.includes(WHOLE) ? Math.max(0, Math.min(30, c.yield - needed)) : 0;
}

// Poser un plat sur un créneau. Un plat pas encore préparé change simplement de recette : ses boîtes et restes liés suivent.
export function setDish(s: State, slot: SlotKey, recipe: string): Draft[] {
  const d = s.slots[slot]?.dish;
  if (d?.kind === 'cook') {
    const prep = s.preps[d.prep];
    if (prep && !prep.done) {
      if (prep.recipe === recipe) return [];
      const pt = portions(s, prep);
      return [{ t: 'prep.recipe', p: { prep: prep.id, recipe } }, { t: 'prep.extra', p: { prep: prep.id, extra: wholeExtra(s, recipe, pt.serve + pt.linked) } }];
    }
  }
  return [...(d ? [{ t: 'slot.clear', p: { slot } } as Draft] : []), { t: 'slot.cook', p: { slot, prep: newId(), recipe, extra: wholeExtra(s, recipe, servings(s, slot)) } }];
}

export function setLeftovers(s: State, slot: SlotKey, prep: string): Draft[] {
  const d = s.slots[slot]?.dish;
  return [...(d ? [{ t: 'slot.clear', p: { slot } } as Draft] : []), { t: 'slot.from', p: { slot, prep } }];
}

export function setOutside(s: State, slot: SlotKey, note: string, dependentsMode: 'detach' | 'keep' = 'keep'): Draft[] {
  return [...removeDish(s, slot, dependentsMode), { t: 'slot.outside', p: { slot, note } }];
}

// Retirer le plat d'un créneau. Les repas qui en dépendaient sont soit vidés (« détacher »), soit gardés avec un problème visible.
export function removeDish(s: State, slot: SlotKey, dependentsMode: 'detach' | 'keep' = 'keep'): Draft[] {
  const d = s.slots[slot]?.dish;
  if (!d) return [];
  const out: Draft[] = [];
  if (d.kind === 'cook' && dependentsMode === 'detach') {
    const prep = s.preps[d.prep];
    if (prep && !prep.done) for (const dep of dependents(s, prep.id)) out.push({ t: 'slot.clear', p: { slot: dep } });
  }
  out.push({ t: 'slot.clear', p: { slot } });
  // Un produit surveillé lié à ce repas reste suivi, simplement sans repas.
  for (const w of Object.values(s.watch)) if (w.slot === slot && !w.closed) out.push({ t: 'watch.save', p: { id: w.id, name: w.name, qty: w.qty, date: w.date, state: w.state, slot: null } });
  return out;
}

export type DependentsMode = 'keep' | 'follow' | 'detach';
// Déplacer (ou échanger) un repas. Les produits surveillés liés suivent le plat.
// Si un plat cuisiné passe après les repas qui en dépendent : garder (problème visible), les décaler d'autant, ou les détacher.
export function move(s: State, from: SlotKey, to: SlotKey, swap: boolean, mode: DependentsMode = 'keep'): Draft[] {
  const out: Draft[] = [{ t: 'slot.move', p: { from, to, swap } }];
  const d = s.slots[from]?.dish;
  if (d?.kind === 'cook') {
    const prep = s.preps[d.prep];
    if (prep && !prep.done) {
      const late = dependents(s, prep.id).filter(k => k !== to && slotOrder(k) <= slotOrder(to)); // la cible d'un échange n'est pas « décalée »
      const pf = parseSlot(from), pt = parseSlot(to);
      if (late.length && mode === 'detach') for (const k of late) out.push({ t: 'slot.clear', p: { slot: k } });
      if (late.length && mode === 'follow' && pf && pt) {
        const shift = daysBetween(pf.date, pt.date) * 2 + (pt.slot === pf.slot ? 0 : pt.slot === 'soir' ? 1 : -1);
        for (const k of late) {
          const target = shiftSlot(k, shift);
          if (target && !s.slots[target]?.dish) out.push({ t: 'slot.move', p: { from: k, to: target, swap: false } });
          else out.push({ t: 'slot.clear', p: { slot: k } });
        }
      }
    }
  }
  for (const w of Object.values(s.watch)) {
    if (w.closed) continue;
    const target = w.slot === from ? to : swap && w.slot === to ? from : null;
    if (target) out.push({ t: 'watch.save', p: { id: w.id, name: w.name, qty: w.qty, date: w.date, state: w.state, slot: target } });
  }
  return out;
}

export function shiftSlot(k: SlotKey, halfDays: number): SlotKey | null {
  const p = parseSlot(k);
  if (!p) return null;
  const idx = (p.slot === 'soir' ? 1 : 0) + halfDays;
  const days = Math.floor(idx / 2);
  return slotKey(addDays(p.date, days), idx - days * 2 === 1 ? 'soir' : 'midi');
}

// « On a mangé » : déclare la préparation si besoin (rendement demandé seulement s'il y a des portions liées ou en plus).
export function eat(s: State, slot: SlotKey, declaredYield: number | null): Draft[] | { needYield: true; planned: number; prep: string } {
  const d = s.slots[slot]?.dish;
  if (!d || d.kind === 'outside') return [];
  const prep = s.preps[d.prep];
  if (!prep) return [];
  const pt = portions(s, prep);
  const n = servings(s, slot);
  const out: Draft[] = [];
  if (!prep.done) {
    const simple = d.kind === 'cook' && pt.planned === n; // rien d'autre de prévu : pas de question
    if (declaredYield === null && !simple) return { needYield: true, planned: pt.planned, prep: prep.id };
    out.push({ t: 'prep.done', p: { prep: prep.id, yield: declaredYield ?? n, planned: pt.planned, version: s.recipes[prep.recipe]?.versions.length ?? 1 } });
  }
  out.push({ t: 'slot.eaten', p: { slot, n } });
  return out;
}

export function declarePrepared(s: State, prepId: string, declaredYield: number): Draft[] {
  const prep = s.preps[prepId];
  if (!prep) return [];
  return [{ t: 'prep.done', p: { prep: prepId, yield: declaredYield, planned: portions(s, prep).planned, version: s.recipes[prep.recipe]?.versions.length ?? 1 } }];
}
