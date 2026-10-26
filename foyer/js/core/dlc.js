// Dates limites utiles : un produit surveillé (fermé, DLC déclarée) qui arrive à échéance et que le menu n'utilise pas à temps.
// Deux cas, un geste chacun : un plat prévu qui l'utilise est cuisiné après la DLC → l'avancer (échange de créneaux) ;
// aucun plat prévu ne l'utilise → prévoir un de vos plats qui le contient sur un repas libre d'ici la DLC.
// La date qui compte est celle de la cuisson (jour du batch s'il y en a un), pas celle du repas. Rien n'est appliqué sans un toucher.
import { SLOTS, addDays, daysBetween, parseSlot, slotKey } from './dates.js';
import { current } from './model.js';
import { servings } from './plan.js';
import { isUpcoming } from './propose.js';
import { dishBlocked } from './allergens.js';
import { matchesProduct } from './printed.js';
import { nameKey } from './text.js';
export const DLC_HORIZON = 3; // jours : au-delà, rien ne presse
export const usesProduct = (s, recipe, product) => {
    const r = s.recipes[recipe], key = nameKey(product);
    return !!r && current(r).ingredients.some(l => matchesProduct(nameKey(l.name), key));
};
export function dlcAdvice(s, today, hour) {
    const out = [];
    const upcoming = [];
    for (let i = 0; i <= 14; i++)
        for (const sl of SLOTS) {
            const k = slotKey(addDays(today, i), sl);
            if (isUpcoming(k, today, hour))
                upcoming.push(k);
        }
    // Plats à cuisiner (pas encore préparés) : créneau, recette, jour de cuisson.
    const toCook = upcoming.flatMap(k => {
        const d = s.slots[k]?.dish, p = d?.kind === 'cook' ? s.preps[d.prep] : undefined;
        return p && !p.done && !s.slots[k]?.eaten ? [{ slot: k, recipe: p.recipe, cook: p.batch ?? parseSlot(k)?.date ?? today }] : [];
    });
    for (const w of Object.values(s.watch)) {
        if (w.closed || w.state !== 'ferme' || w.date?.kind !== 'DLC' || w.date.value.length !== 10)
            continue;
        const date = w.date.value, delta = daysBetween(today, date);
        if (delta < 0 || delta > DLC_HORIZON)
            continue; // dépassée : alerte existante (watch.ts) ; lointaine : rien ne presse
        if (w.slot && (parseSlot(w.slot)?.date ?? '9') <= date)
            continue; // relié par vous à un repas à temps
        const using = toCook.filter(c => usesProduct(s, c.recipe, w.name));
        if (using.some(c => c.cook <= date))
            continue; // déjà utilisé à temps
        const before = upcoming.filter(k => (parseSlot(k)?.date ?? '9') <= date && !s.slots[k]?.eaten && servings(s, k) > 0);
        const late = using.find(c => c.cook > date) ?? null;
        if (late) {
            // Échange possible avec un repas libre, ou un plat à cuisiner qui n'utilise pas lui-même un produit pressé.
            const targets = before.filter(k => { const d = s.slots[k]?.dish; return !d || (d.kind === 'cook' && toCook.some(c => c.slot === k && !usesProduct(s, c.recipe, w.name))); }).reverse().slice(0, 2);
            out.push({ watch: w, date, late, targets, recipes: [] });
            continue;
        }
        const recipes = Object.values(s.recipes).filter(r => !r.archived && usesProduct(s, r.id, w.name) && !dishBlocked(s.settings.exclude, current(r).ingredients.map(l => l.name)))
            .sort((a, b) => current(a).name.localeCompare(current(b).name, 'fr')).map(r => r.id).slice(0, 3);
        out.push({ watch: w, date, late: null, targets: before.filter(k => !s.slots[k]?.dish).slice(0, 2), recipes });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.watch.name.localeCompare(b.watch.name, 'fr'));
}
