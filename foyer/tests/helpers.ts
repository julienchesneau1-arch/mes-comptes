// Fabrique de foyers de test : journaux d'événements par appareil, fusion, rejeu.
import { type AnyEv, type RecipeContent, defaultRhythm } from '../src/core/model.ts';
import { type Draft, replay, stamp } from '../src/core/reduce.ts';
import { parseIngredient } from '../src/core/ingredients.ts';

export const NOW = new Date('2026-10-04T10:00:00Z'); // dimanche 4 octobre 2026, 12 h à Paris
export const MON = '2026-10-05';

export class Device {
  log: AnyEv[] = [];
  lc = 0;
  readonly dev: string;
  readonly by: string | null;
  constructor(dev: string, by: string | null) { this.dev = dev; this.by = by; }
  emit(...drafts: Draft[]): AnyEv[] {
    const lc = Math.max(this.lc, ...this.log.map(e => e.lc));
    const evs = stamp({ dev: this.dev, by: this.by, lc, now: NOW }, drafts);
    this.log.push(...evs); this.lc = lc + evs.length;
    return evs;
  }
  receive(other: Device): void {
    const ids = new Set(this.log.map(e => e.id));
    for (const e of other.log) if (!ids.has(e.id)) this.log.push(e);
  }
  get r() { return replay(this.log); }
  get s() { return this.r.state; }
}

// Foyer à deux : soir à la maison, midi en semaine dehors sauf réglages par créneau.
export function household(): { a: Device; b: Device } {
  const a = new Device('deva0001', 'm1'), b = new Device('devb0002', 'm2');
  a.emit({ t: 'household.init', p: { hid: 'foyer0001', members: [{ id: 'm1', name: 'Alex' }, { id: 'm2', name: 'Sam' }],
    settings: { weekStart: 0, rhythm: defaultRhythm(['m1', 'm2'], 'dehors', 'maison'), boxesFromDinner: true } } });
  b.receive(a);
  return { a, b };
}

export const content = (name: string, yieldN: number | null, lines: string[], extra: Partial<RecipeContent> = {}): RecipeContent => ({
  name, yield: yieldN, ingredients: lines.map(l => parseIngredient(l).line), steps: [], ahead: [], tags: [], note: '', ...extra,
});

export const CURRY = content('Curry', 4, ['600 g de poulet', '300 g riz cru', '400 ml de lait de coco']);
