// Coller une recette (notes, message, site) : découpage déterministe en nom, rendement, ingrédients et étapes.
// Les lignes incertaines restent marquées « à vérifier » dans l'aperçu : rien n'est enregistré sans relecture.
import { parseIngredient } from './ingredients.js';
import { UNIT } from './units.js';
import { qFrom, formatQ } from './rational.js';
const YIELD = /(?:pour|for|portions?\s*:|parts?\s*:|personnes?\s*:)\s*(\d{1,2})\s*(?:personnes?|pers\.?|portions?|parts?|couverts?|people|servings)?|(\d{1,2})\s*(?:personnes|portions|parts|couverts|pers\.)/i;
const ING_HEAD = /^#*\s*ingr[ée]dients?\b\s*:?\s*$/i;
const STEP_HEAD = /^#*\s*(?:pr[ée]paration|[ée]tapes?|instructions?|m[ée]thode|d[ée]roul[ée]|recette)\b\s*:?\s*$/i;
const NUMBERED = /^\s*(?:[ée]tape\s*)?\d{1,2}\s*[.)\-:]\s*/i;
export function parseRecipeText(text) {
    const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let name = '', yieldN = null;
    const ingredients = [], steps = [];
    let mode = 'auto';
    const hasHeads = lines.some(l => ING_HEAD.test(l) || STEP_HEAD.test(l));
    for (const raw of lines) {
        const y = YIELD.exec(raw);
        if (y && yieldN === null) {
            yieldN = Number(y[1] ?? y[2]);
            if (raw.replace(YIELD, '').replace(/[\s:()–-]/g, '').length < 3)
                continue;
        }
        if (ING_HEAD.test(raw)) {
            mode = 'ing';
            continue;
        }
        if (STEP_HEAD.test(raw)) {
            mode = 'steps';
            continue;
        }
        if (!name && mode === 'auto') {
            name = raw.replace(/^#+\s*/, '').replace(YIELD, '').replace(/\(\s*\)/g, '').replace(/[\s(:–-]+$/, '').trim().slice(0, 80);
            continue;
        }
        if (mode === 'steps') {
            steps.push(raw.replace(NUMBERED, '').slice(0, 500));
            continue;
        }
        if (mode === 'ing') {
            ingredients.push(parseIngredient(raw));
            continue;
        }
        // Sans titres de sections : quantité ou ligne courte → ingrédient ; phrase → étape.
        const p = parseIngredient(raw);
        const short = raw.split(' ').length <= 4 && !/[.!?]$/.test(raw);
        if (!hasHeads && (p.line.qty || short) && !NUMBERED.test(raw))
            ingredients.push(p);
        else
            steps.push(raw.replace(NUMBERED, '').slice(0, 500));
    }
    return { name: name || 'Nouveau plat', yield: yieldN && yieldN > 0 && yieldN <= 50 ? yieldN : null, ingredients, steps };
}
// Texte éditable d'une ligne, relu à l'identique par parseIngredient : « 600 g Poulet », « 1,5 kg Pommes de terre ».
export function lineText(l) {
    const q = l.qty ? qFrom(l.qty) : null;
    const f = q ? formatQ(q, 3) : null;
    const qty = q && f ? (f.exact ? f.text : l.qty ?? '') : '';
    const unit = l.unit && l.unit !== 'piece' ? UNIT[l.unit]?.one ?? '' : '';
    return [qty, unit, l.name, l.form ?? '', l.note ? `(${l.note})` : ''].filter(Boolean).join(' ');
}
