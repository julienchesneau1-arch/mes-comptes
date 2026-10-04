// Courses : besoin = quantité de référence × portions à préparer / rendement de référence.
// On additionne seulement même ingrédient, même forme, même dimension. Ce qui est inconnu est montré comme inconnu.
import { ZERO, q, add, sub, mul, div, cmp, isZero, qStr, qFrom } from './rational.js';
import { addDays, parseSlot, slotOrder, fmtDayShort } from './dates.js';
import { current } from './model.js';
import { aisleOf, ingredientKey, AISLES, AISLE } from './ingredients.js';
import { UNIT, toBase, showQty } from './units.js';
import { toPrepare } from './plan.js';
const sig = (need, unknown) => `${need ? qStr(need) : 'na'}${unknown ? `+${unknown}` : ''}`;
function parseSig(s) {
    const [a, b] = s.split('+');
    return { need: a === 'na' || a === undefined ? null : qFrom(a), unknown: b ? Number(b) : 0 };
}
export const weekPreps = (s, week) => {
    const lo = slotOrder(`${week}|midi`), hi = slotOrder(`${addDays(week, 6)}|soir`);
    return Object.values(s.preps).filter(p => p.slot !== null && slotOrder(p.slot) >= lo && slotOrder(p.slot) <= hi)
        .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot) || (a.id < b.id ? -1 : 1));
};
export function deriveShopping(s, week) {
    const lines = new Map();
    const unknownByName = new Map();
    const incomplete = new Map();
    const preps = weekPreps(s, week);
    for (const prep of preps) {
        const r = s.recipes[prep.recipe];
        if (!r || prep.slot === null)
            continue;
        const version = prep.done ? prep.done.version : r.versions.length;
        const c = r.versions[version - 1] ?? current(r);
        const n = toPrepare(s, prep);
        if (n === 0)
            continue;
        const flag = (why) => {
            const x = incomplete.get(r.id) ?? { recipe: r.id, name: c.name, why, slots: [] };
            x.slots.push(prep.slot);
            incomplete.set(r.id, x);
        };
        if (!c.ingredients.length) {
            flag('ingrédients non renseignés');
            continue;
        }
        if (c.yield === null && c.ingredients.some(l => l.qty))
            flag('rendement de référence non renseigné');
        for (const l of c.ingredients) {
            const base = { prep: prep.id, recipe: r.id, recipeName: c.name, version, slot: prep.slot, portions: n, yield: c.yield, line: l, part: null, why: null };
            const unit = l.unit ? UNIT[l.unit] : undefined;
            const qty = l.qty ? qFrom(l.qty) : null;
            if (!qty || !unit) {
                base.why = 'quantité non renseignée';
                push(unknownByName, ingredientKey(l.name, l.form), base);
                continue;
            }
            if (c.yield === null) {
                base.why = 'rendement non renseigné';
                push(unknownByName, ingredientKey(l.name, l.form), base);
                continue;
            }
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
        const first = srcs[0];
        const line = target ?? newLine(s, `${ik}|?`, first.line, null);
        line.unknown.push(...srcs);
        line.sources.push(...srcs);
        lines.set(line.key, line);
    }
    const shop = s.shop[week];
    for (const line of lines.values()) {
        line.needAt = sig(line.need, line.unknown.length);
        const p = shop?.pantry[line.key];
        if (p) {
            const active = p.needAt === line.needAt;
            line.pantry = { qty: p.qty === 'all' ? 'all' : (qFrom(p.qty) ?? ZERO), active, by: p.by, at: p.at };
            if (active)
                line.have = p.qty === 'all' ? (line.need ?? ZERO) : minQ(qFrom(p.qty) ?? ZERO, line.need ?? ZERO);
        }
        line.toBuy = line.need ? sub(line.need, line.have) : null;
        const allHave = line.pantry?.active && line.pantry.qty === 'all';
        const c = shop?.checked[line.key];
        if (c) {
            const was = parseSig(c.needAt);
            const delta = line.toBuy && was.need ? sub(line.toBuy, was.need) : line.toBuy && !was.need ? line.toBuy : null;
            const grew = delta !== null && cmp(delta, ZERO) > 0;
            const newUnknown = line.unknown.length > was.unknown;
            line.check = { done: !grew && !newUnknown, delta: grew ? delta : null, newUnknown, by: c.by, at: c.at };
        }
        line.done = !!(allHave || line.check?.done || (line.toBuy && isZero(line.toBuy) && !line.unknown.length));
    }
    const order = new Map(AISLES.map((a, i) => [a.id, i]));
    const sorted = [...lines.values()].sort((a, b) => (order.get(a.aisle) ?? 99) - (order.get(b.aisle) ?? 99) || a.name.localeCompare(b.name, 'fr'));
    const manual = Object.entries(shop?.items ?? {}).map(([id, x]) => ({ id, name: x.name, qty: x.qty, aisle: x.aisle, checked: x.checked }))
        .sort((a, b) => (order.get(a.aisle) ?? 99) - (order.get(b.aisle) ?? 99) || a.name.localeCompare(b.name, 'fr'));
    return {
        week, days: Array.from({ length: 7 }, (_, i) => addDays(week, i)), lines: sorted, manual,
        incomplete: [...incomplete.values()], meals: preps.length,
        remaining: sorted.filter(l => !l.done).length + manual.filter(m => !m.checked).length,
    };
    function newLine(st, key, l, dim) {
        return { key, name: l.name, form: l.form, dim, aisle: aisleOf(l.name, l.form, st.aisles), need: null, unknown: [], sources: [], needAt: '',
            pantry: null, have: ZERO, toBuy: null, check: null, done: false };
    }
}
function push(m, k, v) { const l = m.get(k); if (l)
    l.push(v);
else
    m.set(k, [v]); }
const minQ = (a, b) => (cmp(a, b) <= 0 ? a : b);
/* ---------- Présentation ---------- */
export const lineQty = (l, which = 'toBuy') => {
    const v = which === 'need' ? l.need : l.toBuy;
    if (!v || !l.dim)
        return '';
    const hint = l.sources.find(x => x.line.unit && UNIT[x.line.unit]?.dim === l.dim)?.line.unit;
    return showQty(v, l.dim, hint ? UNIT[hint] : undefined);
};
// Calcul détaillé d'une ligne, pour « toucher affiche calcul et repas sources ».
export function explain(l) {
    return l.sources.map(x => {
        const p = parseSlot(x.slot);
        const when = p ? `${fmtDayShort(p.date)} ${p.slot}` : '';
        const unit = x.line.unit ? UNIT[x.line.unit] : undefined;
        const qty = x.line.qty ? qFrom(x.line.qty) : null;
        if (!x.part || !unit || !qty || !x.yield)
            return `${x.recipeName} (${when}) : ${x.why ?? 'non calculable'}`;
        const ref = showQty(toBase(qty, unit), unit.dim, unit);
        return `${x.recipeName} (${when}, version ${x.version}) : ${ref} pour ${x.yield} × ${x.portions} portions à préparer = ${showQty(x.part, unit.dim, unit)}`;
    });
}
// Signature à enregistrer quand on coche « pris » : ce qui restait à acheter à ce moment-là.
export const checkSig = (l) => sig(l.toBuy, l.unknown.length);
// Liste en texte, à partager par message ou à coller dans des notes.
export function shoppingText(list, title) {
    const out = [title];
    for (const a of AISLES) {
        const ls = list.lines.filter(l => l.aisle === a.id && !l.done);
        const ms = list.manual.filter(m => m.aisle === a.id && !m.checked);
        if (!ls.length && !ms.length)
            continue;
        out.push('', `${a.icon} ${a.label}`);
        for (const l of ls) {
            const qtxt = lineQty(l);
            const unk = l.unknown.length ? (qtxt ? ' + quantité à voir' : ' (quantité à voir)') : '';
            out.push(`☐ ${l.name}${l.form ? ` (${l.form})` : ''}${qtxt ? ` · ${qtxt}` : ''}${unk}`);
        }
        for (const m of ms)
            out.push(`☐ ${m.name}${m.qty ? ` · ${m.qty}` : ''}`);
    }
    if (list.incomplete.length)
        out.push('', `⚠️ Liste partielle : ${list.incomplete.map(x => x.name).join(', ')} (${list.incomplete.length > 1 ? 'ingrédients à compléter' : 'ingrédients à compléter'})`);
    return out.join('\n');
}
export const aisleLabel = (id) => AISLE[id]?.label ?? 'Autres';
