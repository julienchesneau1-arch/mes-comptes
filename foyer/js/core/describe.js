// Phrase courte décrivant une action du journal : pour les conflits et l'historique (« Sam voulait prévoir les restes de Curry mardi midi »).
import { parseSlot, fmtDayShort } from './dates.js';
import { current } from './model.js';
const when = (k) => { const p = parseSlot(k); return p ? `${fmtDayShort(p.date)} ${p.slot}` : k; };
const recipe = (s, id) => { const r = s.recipes[id]; return r ? current(r).name : 'un plat'; };
const prepName = (s, id) => { const p = s.preps[id]; return p ? recipe(s, p.recipe) : 'un plat'; };
const member = (s, id) => s.members.find(m => m.id === id)?.name ?? 'quelqu\'un';
export function describeEvent(s, e) {
    switch (e.t) {
        case 'household.init': return 'créer le foyer';
        case 'members.set': return 'modifier les membres';
        case 'settings.set': return 'modifier les réglages';
        case 'recipe.save': return `enregistrer la recette ${e.p.content.name}`;
        case 'recipe.archive': return `${e.p.archived ? 'ranger' : 'ressortir'} ${recipe(s, e.p.recipe)}`;
        case 'slot.presence': return `noter ${member(s, e.p.member)} ${e.p.presence === 'dehors' ? 'absent·e' : e.p.presence === 'boite' ? 'en boîte' : 'présent·e'} ${when(e.p.slot)}`;
        case 'slot.guests': return `noter ${e.p.guests} invité(s) ${when(e.p.slot)}`;
        case 'slot.chef': return e.p.member ? `confier la cuisine ${when(e.p.slot)} à ${member(s, e.p.member)}` : `retirer le cuisinier ${when(e.p.slot)}`;
        case 'slot.cook': return `prévoir ${recipe(s, e.p.recipe)} ${when(e.p.slot)}`;
        case 'slot.from': return `prévoir les restes de ${prepName(s, e.p.prep)} ${when(e.p.slot)}`;
        case 'slot.outside': return `noter un repas extérieur ${when(e.p.slot)}`;
        case 'slot.clear': return `vider ${when(e.p.slot)}`;
        case 'slot.move': return `déplacer ${when(e.p.from)} vers ${when(e.p.to)}`;
        case 'slot.eaten': return `déclarer mangé ${when(e.p.slot)}`;
        case 'prep.recipe': return `changer le plat pour ${recipe(s, e.p.recipe)}`;
        case 'prep.extra': return `prévoir ${e.p.extra} portion(s) en plus de ${prepName(s, e.p.prep)}`;
        case 'prep.start': return `commencer ${prepName(s, e.p.prep)}`;
        case 'prep.done': return `déclarer ${prepName(s, e.p.prep)} préparé (${e.p.yield} portions)`;
        case 'prep.correct': return `corriger ${prepName(s, e.p.prep)} à ${e.p.yield} portions`;
        case 'prep.discard': return `jeter ${e.p.n} portion(s) de ${prepName(s, e.p.prep)}`;
        case 'task.set': return e.p.done ? 'cocher une tâche' : 'décocher une tâche';
        case 'shop.check': return 'cocher un article';
        case 'shop.pantry': return 'noter ce que vous avez déjà';
        case 'shop.item': return `ajouter ${e.p.name} aux courses`;
        case 'staple.set': return `mémoriser ${e.p.name}`;
        case 'aisle.set': return 'changer un rayon';
        case 'product.set': return e.p.url ? `retenir un produit Auchan (${e.p.label})` : 'oublier un produit Auchan';
        case 'agenda.set': return e.p.url ? `brancher l'agenda ${e.p.label}` : `débrancher l'agenda ${e.p.label}`;
        case 'agenda.rule': return e.p.effect === 'auto' ? 'appliquer automatiquement un événement d\'agenda' : e.p.effect === 'jamais' ? 'ignorer un événement d\'agenda' : 'oublier une décision d\'agenda';
        case 'agenda.mark': return e.p.presence ? `noter ${member(s, e.p.member)} ${e.p.presence === 'dehors' ? 'absent·e' : 'à la maison'} ${when(e.p.slot)} (agenda : ${e.p.title})` : `retirer « ${e.p.title} » ${when(e.p.slot)} (plus dans l'agenda)`;
        case 'watch.save': return `surveiller ${e.p.name}`;
        case 'watch.close': return 'retirer un produit surveillé';
        case 'conflict.ack': return 'marquer un conflit comme vu';
        case 'undo': return 'annuler une action';
    }
}
export function describe(r, id) {
    const e = r.events.get(id);
    return e ? describeEvent(r.state, e) : 'une action';
}
