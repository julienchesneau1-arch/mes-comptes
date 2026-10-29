// Semaine générée (spec « Approbation ») : générer = préparer un lot de propositions, jamais modifier le planning avant approbation.
// Budget tenu comme chez Pimzi : tant que la semaine dépasse, le plat le plus cher est remplacé par la première alternative nettement
// moins chère (dans l'ordre de préférence habituel). Déterministe : même état, même catalogue → même semaine. Aucun appel réseau.
// Le brouillon voyage entre les deux téléphones sous forme compacte (week.draft) : un repas = un identifiant.
import { addDays, parseSlot } from './dates.js';
import { current } from './model.js';
import { presence, toPrepare } from './plan.js';
import { rank, nextDiscovery, isUpcoming } from './propose.js';
import { toContent } from './catalog.js';
import { dishCost } from './budget.js';
export const idOf = (p) => (p.dish?.kind === 'cook' ? p.dish.recipe : p.dish?.kind === 'new' ? `n:${p.dish.catalog.id}` : '');
const cooks = (p) => p.dish?.kind === 'cook' || p.dish?.kind === 'new';
// Portions d'un plat proposé : ceux qui mangent au repas, plus les repas de restes (boîtes) qui en dépendent, plus « en plus ».
export function propPortions(s, props, p) {
    const at = (k) => {
        const x = props.find(y => y.slot === k);
        return s.members.filter(m => (x?.presence[m.id] ?? presence(s, k, m.id)) !== 'dehors').length + (x?.guests || s.slots[k]?.guests || 0);
    };
    const extra = p.dish?.kind === 'cook' || p.dish?.kind === 'new' ? p.dish.extra : 0;
    return at(p.slot) + props.filter(x => x.dish?.kind === 'from' && x.dish.source === p.slot).reduce((n, x) => n + at(x.slot), 0) + extra;
}
export function propContent(s, p) {
    if (p.dish?.kind === 'cook') {
        const r = s.recipes[p.dish.recipe];
        return r ? current(r) : null;
    }
    if (p.dish?.kind === 'new')
        return toContent(p.dish.catalog, p.dish.yield ?? p.dish.catalog.yield);
    return null;
}
export const propCost = (s, props, p) => {
    const c = propContent(s, p);
    return c ? dishCost(s, c, propPortions(s, props, p)) : null;
};
// Plats déjà prévus cette semaine (pas encore préparés) : ce qu'ils coûtent compte dans le budget.
export function plannedCost(s, week) {
    const end = addDays(week, 6);
    let cents = 0;
    for (const p of Object.values(s.preps)) {
        const d = p.slot ? parseSlot(p.slot)?.date : undefined, r = s.recipes[p.recipe];
        if (!d || d < week || d > end || p.done || !r)
            continue;
        cents += dishCost(s, current(r), toPrepare(s, p))?.cents ?? 0;
    }
    return cents;
}
// Autres idées pour un repas, dans l'ordre de préférence : découvertes d'abord en « maximum de nouveautés », vos plats sinon.
export function alternativesFor(s, cat, p, week, today, used, seen = new Set(), n = 6) {
    const own = rank(s, p.slot, today, new Set([...used].filter(x => !x.startsWith('n:'))), new Map(), { noRepeat: true }).slice(0, n)
        .map(r => ({ ...p, dish: { kind: 'cook', recipe: r.recipe, extra: 0 }, reason: r.reason }));
    const fresh = [];
    if (cat) {
        const ex = new Set([...used].filter(x => x.startsWith('n:')).map(x => x.slice(2)));
        for (let i = 0; i < n; i++) {
            const f = nextDiscovery(s, cat, p.slot, week, ex, seen);
            if (!f)
                break;
            ex.add(f.recipe.id);
            fresh.push({ ...p, dish: { kind: 'new', catalog: f.recipe, extra: 0 }, reason: f.reason });
        }
    }
    return (s.settings.variety ?? 'max') === 'max' ? [...fresh, ...own] : [...own, ...fresh];
}
export const CHEAPER = 0.85; // une alternative doit coûter au moins 15 % de moins pour remplacer un plat
// Tenir le budget : chaque repas est remplacé une fois au plus, jamais par un plat dont le prix est mal connu (moins de 80 % chiffré).
export function fitBudget(s, props, budget, fixed, alts) {
    let cur = [...props];
    const total = () => fixed + cur.reduce((n, p) => n + (propCost(s, cur, p)?.cents ?? 0), 0);
    const tried = new Set(), swapped = [];
    for (let guard = 0; guard < 14 && total() > budget; guard++) {
        // Un plat qui utilise un produit avant sa date n'est pas remplacé pour économiser : le jeter coûterait plus.
        const victim = cur.filter(p => cooks(p) && !tried.has(p.slot) && !p.reason.startsWith('à utiliser : ') && propCost(s, cur, p)?.reliable)
            .sort((a, b) => (propCost(s, cur, b)?.cents ?? 0) - (propCost(s, cur, a)?.cents ?? 0) || (a.slot < b.slot ? -1 : 1))[0];
        if (!victim)
            break;
        tried.add(victim.slot);
        const vc = propCost(s, cur, victim)?.cents ?? 0, used = new Set(cur.map(idOf).filter(Boolean));
        const better = alts(victim, used).find(a => { const c = propCost(s, cur, a); return !!c?.reliable && c.cents <= vc * CHEAPER; });
        if (!better)
            continue;
        cur = cur.map(p => (p === victim ? { ...better, reason: `${better.reason} · moins cher, pour tenir le budget` } : p));
        swapped.push(victim.slot);
    }
    return { props: cur, swapped, cents: total() };
}
/* ---------- Brouillon partagé ---------- */
export function toItems(props, batch) {
    const out = [];
    for (const p of props) {
        const d = p.dish, b = batch.has(p.slot) ? { batch: true } : {};
        if (d?.kind === 'cook')
            out.push({ slot: p.slot, kind: 'cook', ref: d.recipe, ...b });
        else if (d?.kind === 'new')
            out.push({ slot: p.slot, kind: 'new', ref: d.catalog.id, ...(d.yield ? { n: d.yield } : {}), ...b });
        else if (d?.kind === 'from')
            out.push({ slot: p.slot, kind: 'from', ref: d.source });
    }
    return out.slice(0, 14);
}
// Brouillon relu : un repas déjà rempli entre-temps (l'autre téléphone a planifié) ou passé est écarté, jamais écrasé ;
// une recette disparue (archivée, absente du catalogue) aussi. Les restes dont la source a disparu suivent.
export function fromItems(s, cat, items, today, hour) {
    const props = [], batch = new Set();
    let dropped = 0;
    for (const x of items) {
        if (s.slots[x.slot]?.dish || !isUpcoming(x.slot, today, hour)) {
            dropped++;
            continue;
        }
        const base = { slot: x.slot, reason: 'menu proposé', presence: {}, guests: 0 };
        if (x.kind === 'cook') {
            const r = s.recipes[x.ref];
            if (!r || r.archived) {
                dropped++;
                continue;
            }
            props.push({ ...base, dish: { kind: 'cook', recipe: x.ref, extra: 0 } });
        }
        else if (x.kind === 'new') {
            const c = cat?.recipes.find(r => r.id === x.ref);
            if (!c) {
                dropped++;
                continue;
            }
            props.push({ ...base, dish: { kind: 'new', catalog: c, extra: 0, ...(x.n ? { yield: x.n } : {}) } });
        }
        else
            props.push({ ...base, dish: { kind: 'from', source: x.ref, prep: null } });
        if (x.batch)
            batch.add(x.slot);
    }
    const ok = props.filter(p => { const d = p.dish; return d?.kind !== 'from' || props.some(q => q.slot === d.source && cooks(q)) || s.slots[d.source]?.dish?.kind === 'cook'; });
    return { props: ok, batch, dropped: dropped + props.length - ok.length };
}
