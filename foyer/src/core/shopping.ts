// Courses : besoin = quantité de référence × portions à préparer / rendement de référence.
// On additionne seulement même ingrédient, même forme, même dimension. Ce qui est inconnu est montré comme inconnu.
import { type Q, ZERO, q, add, sub, mul, div, cmp, isZero, qStr, qFrom } from './rational.ts';
import { type LocalDate, type SlotKey, addDays, parseSlot, slotOrder, fmtDayShort } from './dates.ts';
import { type State, type Prep, current } from './model.ts';
import { type IngredientLine, aisleOf, ingredientKey, AISLES, AISLE } from './ingredients.ts';
import { UNIT, toBase, showQty } from './units.ts';
import { toPrepare } from './plan.ts';

export interface Source {
  prep: string; recipe: string; recipeName: string; version: number; slot: SlotKey;
  portions: number; yield: number | null; line: IngredientLine;
  part: Q | null;            // contribution en unité de base ; null si non calculable
  why: string | null;        // pourquoi non calculable
}
export interface PantryView { qty: Q | 'all'; active: boolean; by: string | null; at: string }
export interface CheckView { done: boolean; delta: Q | null; newUnknown: boolean; by: string | null; at: string }
export interface ShopLine {
  key: string; name: string; form: string | null; dim: string | null; aisle: string;
  need: Q | null;            // somme des contributions connues
  unknown: Source[];         // contributions non calculables (quantité ou rendement non renseigné)
  sources: Source[];
  needAt: string;            // signature du besoin : sert à savoir si une vérification est encore valable
  pantry: PantryView | null;
  have: Q;                   // déduit d'une vérification active seulement
  toBuy: Q | null;
  check: CheckView | null;
  done: boolean;
}
export interface ManualLine { id: string; name: string; qty: string; aisle: string; checked: boolean }
export interface ShoppingList {
  week: LocalDate; days: LocalDate[];
  lines: ShopLine[]; manual: ManualLine[];
  incomplete: { recipe: string; name: string; why: string; slots: SlotKey[] }[];
  meals: number;             // plats cuisinés dans la semaine
  remaining: number;         // lignes encore à traiter
}

const sig = (need: Q | null, unknown: number): string => `${need ? qStr(need) : 'na'}${unknown ? `+${unknown}` : ''}`;
export function parseSig(s: string): { need: Q | null; unknown: number } {
  const [a, b] = s.split('+');
  return { need: a === 'na' || a === undefined ? null : qFrom(a), unknown: b ? Number(b) : 0 };
}

export const weekPreps = (s: State, week: LocalDate): Prep[] => {
  const lo = slotOrder(`${week}|midi`), hi = slotOrder(`${addDays(week, 6)}|soir`);
  return Object.values(s.preps).filter(p => p.slot !== null && slotOrder(p.slot) >= lo && slotOrder(p.slot) <= hi)
    .sort((a, b) => slotOrder(a.slot as string) - slotOrder(b.slot as string) || (a.id < b.id ? -1 : 1));
};

export function deriveShopping(s: State, week: LocalDate): ShoppingList {
  const lines = new Map<string, ShopLine>();
  const unknownByName = new Map<string, Source[]>();
  const incomplete = new Map<string, { recipe: string; name: string; why: string; slots: SlotKey[] }>();
  const preps = weekPreps(s, week);

  for (const prep of preps) {
    const r = s.recipes[prep.recipe];
    if (!r || prep.slot === null) continue;
    const version = prep.done ? prep.done.version : r.versions.length;
    const c = r.versions[version - 1] ?? current(r);
    const n = toPrepare(s, prep);
    if (n === 0) continue;
    const flag = (why: string) => {
      const x = incomplete.get(r.id) ?? { recipe: r.id, name: c.name, why, slots: [] };
      x.slots.push(prep.slot as SlotKey); incomplete.set(r.id, x);
    };
    if (!c.ingredients.length) { flag('ingrédients non renseignés'); continue; }
    if (c.yield === null && c.ingredients.some(l => l.qty)) flag('rendement de référence non renseigné');
    for (const l of c.ingredients) {
      const base: Source = { prep: prep.id, recipe: r.id, recipeName: c.name, version, slot: prep.slot, portions: n, yield: c.yield, line: l, part: null, why: null };
      const unit = l.unit ? UNIT[l.unit] : undefined;
      const qty = l.qty ? qFrom(l.qty) : null;
      if (!qty || !unit) { base.why = 'quantité non renseignée'; push(unknownByName, ingredientKey(l.name, l.form), base); continue; }
      if (c.yield === null) { base.why = 'rendement non renseigné'; push(unknownByName, ingredientKey(l.name, l.form), base); continue; }
      base.part = toBase(div(mul(qty, q(n)), q(c.yield)), unit);
      const key = `${ingredientKey(l.name, l.form)}|${unit.dim}`;
      const line = lines.get(key) ?? newLine(s, key, l, unit.dim);
      line.sources.push(base);
      line.need = add(line.need ?? ZERO, base.part);
      lines.set(key, line);
    }
  }
  // Contributions inconnues : rattachées à la ligne du même ingrédient si elle existe, sinon ligne à part.
  for (const [ik, srcs] of unknownByName) {
    const target = [...lines.values()].filter(l => l.key.startsWith(`${ik}|`)).sort((a, b) => (a.key < b.key ? -1 : 1))[0];
    const first = srcs[0] as Source;
    const line = target ?? newLine(s, `${ik}|?`, first.line, null);
    line.unknown.push(...srcs); line.sources.push(...srcs);
    lines.set(line.key, line);
  }

  const shop = s.shop[week];
  for (const line of lines.values()) {
    line.needAt = sig(line.need, line.unknown.length);
    const p = shop?.pantry[line.key];
    if (p) {
      const active = p.needAt === line.needAt;
      line.pantry = { qty: p.qty === 'all' ? 'all' : (qFrom(p.qty) ?? ZERO), active, by: p.by, at: p.at };
      if (active) line.have = p.qty === 'all' ? (line.need ?? ZERO) : minQ(qFrom(p.qty) ?? ZERO, line.need ?? ZERO);
    }
    line.toBuy = line.need ? sub(line.need, line.have) : null;
    const allHave = line.pantry?.active && line.pantry.qty === 'all';
    const c = shop?.checked[line.key];
    if (c) {
      const was = parseSig(c.needAt);
      // Ce qui s'achète à l'unité a été arrondi à l'achat : 1,75 oignon reste couvert par les 2 déjà pris.
      const delta = line.toBuy && was.need ? sub(wholeUp(line.toBuy, line.dim), wholeUp(was.need, line.dim)) : line.toBuy && !was.need ? line.toBuy : null;
      const grew = delta !== null && cmp(delta, ZERO) > 0;
      const newUnknown = line.unknown.length > was.unknown;
      line.check = { done: !grew && !newUnknown, delta: grew ? delta : null, newUnknown, by: c.by, at: c.at };
    }
    line.done = !!(allHave || line.check?.done || (line.toBuy && isZero(line.toBuy) && !line.unknown.length));
  }

  const order = aisleRank(s);
  const sorted = [...lines.values()].sort((a, b) => (order.get(a.aisle) ?? 99) - (order.get(b.aisle) ?? 99) || a.name.localeCompare(b.name, 'fr'));
  const manual: ManualLine[] = Object.entries(shop?.items ?? {}).map(([id, x]) => ({ id, name: x.name, qty: x.qty, aisle: x.aisle, checked: x.checked }))
    .sort((a, b) => (order.get(a.aisle) ?? 99) - (order.get(b.aisle) ?? 99) || a.name.localeCompare(b.name, 'fr'));
  return {
    week, days: Array.from({ length: 7 }, (_, i) => addDays(week, i)), lines: sorted, manual,
    incomplete: [...incomplete.values()], meals: preps.length,
    remaining: sorted.filter(l => !l.done).length + manual.filter(m => !m.checked).length,
  };

  function newLine(st: State, key: string, l: IngredientLine, dim: string | null): ShopLine {
    return { key, name: l.name, form: l.form, dim, aisle: aisleOf(l.name, l.form, st.aisles), need: null, unknown: [], sources: [], needAt: '',
      pantry: null, have: ZERO, toBuy: null, check: null, done: false };
  }
}

// Ordre des rayons : celui du magasin du foyer s'il est réglé, sinon l'ordre par défaut ; les rayons non classés à la fin.
export function aisleRank(s: State): Map<string, number> {
  const own = s.settings.aisleOrder ?? [];
  const ids = [...own, ...AISLES.map(a => a.id).filter(id => !own.includes(id))];
  return new Map(ids.map((id, i) => [id, i]));
}
export const orderedAisles = (s: State) => [...aisleRank(s).keys()].map(id => AISLES.find(a => a.id === id)).filter((a): a is (typeof AISLES)[number] => !!a);

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); }
const minQ = (a: Q, b: Q): Q => (cmp(a, b) <= 0 ? a : b);

/* ---------- Présentation ---------- */

// Ce qui s'achète à l'unité (oignons, poulet, boîtes, paquets…) : arrondi à l'unité supérieure, le besoin exact entre parenthèses.
export const wholeUp = (v: Q, dim: string | null): Q => (dim && BUY_WHOLE.has(dim) && v.d !== 1 ? q(Math.ceil(v.n / v.d)) : v);
const BUY_WHOLE = new Set(['piece', 'gousse', 'tranche', 'boite', 'sachet', 'botte', 'paquet', 'pot', 'filet', 'cube', 'bouquet', 'barquette', 'bocal', 'brique', 'bouteille', 'rouleau', 'pave', 'tablette']);
export const lineQty = (l: ShopLine, which: 'need' | 'toBuy' = 'toBuy'): string => {
  const v = which === 'need' ? l.need : l.toBuy;
  if (!v || !l.dim) return '';
  const hint = l.sources.find(x => x.line.unit && UNIT[x.line.unit]?.dim === l.dim)?.line.unit;
  const unit = hint ? UNIT[hint] : undefined;
  if (which === 'toBuy' && BUY_WHOLE.has(l.dim) && v.d !== 1 && v.n > 0) return showQty(q(Math.ceil(v.n / v.d)), l.dim, unit);
  return showQty(v, l.dim, unit);
};
// Besoin exact quand la quantité à acheter a été arrondie à l'unité (« il en faut 1,5 pièce »).
export const exactNeed = (l: ShopLine): string => {
  const v = l.toBuy;
  if (!v || !l.dim || !BUY_WHOLE.has(l.dim) || v.d === 1 || v.n <= 0) return '';
  const hint = l.sources.find(x => x.line.unit && UNIT[x.line.unit]?.dim === l.dim)?.line.unit;
  return `il en faut ${showQty(v, l.dim, hint ? UNIT[hint] : undefined)}`;
};

// Calcul détaillé d'une ligne, pour « toucher affiche calcul et repas sources ».
export function explain(l: ShopLine): string[] {
  return l.sources.map(x => {
    const p = parseSlot(x.slot);
    const when = p ? `${fmtDayShort(p.date)} ${p.slot}` : '';
    const unit = x.line.unit ? UNIT[x.line.unit] : undefined;
    const qty = x.line.qty ? qFrom(x.line.qty) : null;
    if (!x.part || !unit || !qty || !x.yield) return `${x.recipeName} (${when}) : ${x.why ?? 'non calculable'}`;
    const ref = showQty(toBase(qty, unit), unit.dim, unit);
    return `${x.recipeName} (${when}, version ${x.version}) : ${ref} pour ${x.yield} × ${x.portions} portions à préparer = ${showQty(x.part, unit.dim, unit)}`;
  });
}

// Signature à enregistrer quand on coche « pris » : ce qui restait à acheter à ce moment-là.
export const checkSig = (l: ShopLine): string => sig(l.toBuy, l.unknown.length);

// Liste en texte, à partager par message ou à coller dans des notes.
export function shoppingText(list: ShoppingList, title: string, s?: State): string {
  const out = [title];
  for (const a of s ? orderedAisles(s) : AISLES) {
    const ls = list.lines.filter(l => l.aisle === a.id && !l.done);
    const ms = list.manual.filter(m => m.aisle === a.id && !m.checked);
    if (!ls.length && !ms.length) continue;
    out.push('', `${a.icon} ${a.label}`);
    for (const l of ls) {
      const qtxt = lineQty(l);
      const unk = l.unknown.length ? (qtxt ? ' + quantité à voir' : ' (quantité à voir)') : '';
      out.push(`☐ ${l.name}${l.form ? ` (${l.form})` : ''}${qtxt ? ` · ${qtxt}` : ''}${unk}`);
    }
    for (const m of ms) out.push(`☐ ${m.name}${m.qty ? ` · ${m.qty}` : ''}`);
  }
  if (list.incomplete.length) out.push('', `⚠️ Liste partielle : ${list.incomplete.map(x => x.name).join(', ')} (${list.incomplete.length > 1 ? 'ingrédients à compléter' : 'ingrédients à compléter'})`);
  return out.join('\n');
}

export const aisleLabel = (id: string): string => AISLE[id]?.label ?? 'Autres';
