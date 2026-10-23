// Allergies et refus du foyer (comme chez Pimzi) : les 14 allergènes à déclaration obligatoire et des aliments refusés.
// Les plats qui en contiennent ne sont plus proposés ; courses et drive signalent ce qui est à vérifier sur l'étiquette.
import { ALLERGENS, allergenLabel, dishBlocked, isAllergen, parseFoods } from '../../core/allergens.js';
import { current } from '../../core/model.js';
import { S, dispatch } from '../state.js';
import { openSheet, sheetHead, closeSheet, esc } from '../dom.js';
import { CLICK, SUBMIT } from '../registry.js';
export const NOT_MEDICAL = 'Lecture du nom de chaque ingrédient, sans IA : la composition fait foi sur l\'étiquette. Ce n\'est pas un avis médical.';
// Cases des 14 allergènes et champ des aliments refusés : mêmes champs à l'accueil et dans les Réglages.
export function exclusionFields(ex) {
    return `<fieldset><legend>Allergies ou intolérances</legend><div class="chips">${ALLERGENS.map(a => `<label class="tag-check"><input type="checkbox" name="allergen" value="${a.id}" ${ex?.allergens.includes(a.id) ? 'checked' : ''}>
    <span>${esc(a.label)}${a.detail ? `<span class="sr-only"> (${esc(a.detail)})</span>` : ''}</span></label>`).join('')}</div></fieldset>
    <label class="field">Aliments refusés<span class="hint">Séparés par des virgules : « porc, coriandre, champignons ». « Porc » écarte aussi la charcuterie de porc, « alcool » les vins et alcools.</span>
      <input type="text" name="foods" maxlength="400" autocomplete="off" value="${esc((ex?.foods ?? []).join(', '))}"></label>`;
}
export function readExclusions(data) {
    const allergens = ALLERGENS.map(a => a.id).filter(id => data.getAll('allergen').includes(id)).filter((a) => isAllergen(a));
    return { allergens, foods: parseFoods(String(data.get('foods') ?? '')) };
}
export function exclusionsSummary(ex) {
    const parts = [...(ex?.allergens ?? []).map(a => allergenLabel(a).toLowerCase()), ...(ex?.foods ?? [])];
    return parts.length ? `Jamais proposé : ${parts.join(', ')}` : 'Aucune allergie ni aliment refusé.';
}
export function openAllergies() {
    openSheet({ id: 'allergies', render: () => {
            const s = S(), ex = s.settings.exclude;
            const out = Object.values(s.recipes).filter(r => !r.archived).map(r => ({ name: current(r).name, no: dishBlocked(ex, current(r).ingredients.map(l => l.name)) }))
                .filter(x => x.no);
            return `${sheetHead('Allergies et refus', 'Pour tout le foyer.')}
    <form data-f="allergiesSave" class="stack">${exclusionFields(ex)}
      <button class="btn">Enregistrer</button></form>
    ${out.length ? `<section class="card stack"><h3 class="section-title">De vos plats, plus jamais proposés</h3><ul class="list">${out.map(x => `<li class="small">${esc(x.name)} · ${esc(x.no?.why ?? '')} (${esc(x.no?.name.toLowerCase() ?? '')})</li>`).join('')}</ul>
      <p class="small muted">Vous pouvez toujours les prévoir à la main : ils restent dans « Nos plats », signalés.</p></section>` : ''}
    <p class="small muted">Un plat qui en contient n'est plus proposé (vos plats comme les découvertes). Un produit transformé qui en contient souvent (bouillon, sauce, charcuterie) reste proposé, signalé « étiquette à vérifier » dans les courses et au drive. ${esc(NOT_MEDICAL)}</p>`;
        } });
}
CLICK['allergies'] = () => openAllergies();
SUBMIT['allergiesSave'] = data => {
    const ex = readExclusions(data);
    closeSheet();
    dispatch([{ t: 'settings.set', p: { exclude: ex } }], { toast: ex.allergens.length || ex.foods.length ? `${exclusionsSummary(ex)}.` : 'Aucune exclusion' });
};
