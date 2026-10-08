// Repères de la semaine (Santé publique France, mangerbouger.fr, vérifiés le 8 octobre 2026) : poisson 2 fois par semaine dont
// un gras (sardines, maquereau, hareng, saumon) ; légumes secs au moins 2 fois ; viande hors volaille 500 g maximum par semaine ;
// charcuterie 150 g maximum. Comptés d'après les plats prévus et leurs ingrédients, par mots du nom (règles fixes, sans IA).
import { addDays, slotKey, SLOTS } from './dates.js';
import { current } from './model.js';
import { presence } from './plan.js';
import { qFrom } from './rational.js';
import { UNIT, toBase } from './units.js';
import { norm } from './text.js';
export const SOURCES = {
    poisson: 'https://www.mangerbouger.fr/l-essentiel/les-recommandations-sur-l-alimentation-l-activite-physique-et-la-sedentarite/aller-vers/aller-vers-les-poissons-gras-et-maigres-en-alternance',
    viande: 'https://www.mangerbouger.fr/l-essentiel/les-recommandations-sur-l-alimentation-l-activite-physique-et-la-sedentarite/reduire/reduire-la-viande-porc-baeuf-veau-mouton-agneau-abats',
    essentiel: 'https://www.mangerbouger.fr/content/show/1597/file/L%E2%80%99essentiel%20des%20recommandations%20alimentaires.pdf',
};
export const TARGET = { fish: 2, oily: 1, legumes: 2, meatG: 500, charcG: 150 };
const FISH = /\b(poissons?|saumon|cabillaud|thon|colin|merlus?|lieu|truites?|sardines?|maquereaux?|harengs?|dorades?|bar|soles?|merlans?|lotte|eglefin|haddock|limandes?|tilapia|panga|anchois|rougets?|bulots?)\b/;
const OILY = /\b(sardines?|maquereaux?|harengs?|saumon)\b/;
const LEGUMES = /\b(lentilles?|pois chiches?|haricots? (rouges?|blancs?|secs?|noirs?|coco|tarbais|lingots?)|flageolets?|feves?|pois casses|mogettes?|dahl?)\b/;
const MEAT = /\b(boeuf|veau|agneau|mouton|porc|steaks?|entrecotes?|bavettes?|rumsteck|onglet|paleron|macreuse|jarret|gigot|echine|filet mignon|abats|rognons?|viande hachee|hache)\b/;
const CHARC = /\b(jambon|lardons?|saucisses?|saucisson|chorizo|bacon|pancetta|coppa|merguez|rillettes|pate de campagne|andouillettes?|boudin|knacks?|chipolatas?|chair a saucisse)\b/;
const NOT_MEAT = /\b(bouillon|fond|cube|volaille|poulet|dinde|canard|bouillon de)\b/;
export const isFish = (t) => FISH.test(norm(t));
export const isOily = (t) => OILY.test(norm(t));
export const isLegume = (t) => LEGUMES.test(norm(t));
export const isCharc = (t) => CHARC.test(norm(t));
export const isMeat = (t) => { const n = norm(t); return MEAT.test(n) && !NOT_MEAT.test(n) && !CHARC.test(n); };
// Grammes par portion d'une famille d'ingrédients (null si une quantité manque : jamais deviné).
function gramsPerPortion(lines, yieldN, test) {
    let g = 0, unknown = false;
    for (const l of lines) {
        if (!test(l.name))
            continue;
        const u = l.unit ? UNIT[l.unit] : undefined, qty = l.qty ? qFrom(l.qty) : null;
        if (!u || !qty || u.dim !== 'masse' || !yieldN) {
            unknown = true;
            continue;
        }
        const b = toBase(qty, u);
        g += b.n / b.d / yieldN; // affichage arrondi au gramme : un flottant suffit ici
    }
    return { g, unknown };
}
export function weekBalance(s, week) {
    const out = { week, meals: 0, fish: 0, oily: 0, legumes: 0, meat: { g: 0, unknown: false, meals: 0 }, charc: { g: 0, unknown: false, meals: 0 } };
    const meatBy = new Map(), charcBy = new Map();
    const per = new Map(s.members.map(m => [m.id, { fish: 0, oily: 0, legumes: 0 }]));
    for (let i = 0; i < 7; i++)
        for (const sl of SLOTS) {
            const k = slotKey(addDays(week, i), sl), d = s.slots[k]?.dish;
            if (!d || d.kind === 'outside')
                continue;
            const prep = s.preps[d.prep], r = prep ? s.recipes[prep.recipe] : undefined;
            if (!prep || !r)
                continue;
            const c = r.versions[(prep.done?.version ?? r.versions.length) - 1] ?? current(r);
            const eaters = s.members.filter(m => presence(s, k, m.id) !== 'dehors');
            if (!eaters.length && !(s.slots[k]?.guests))
                continue;
            out.meals++;
            const names = c.ingredients.map(l => l.name);
            const fish = names.some(isFish), oily = names.some(isOily), leg = names.some(isLegume);
            for (const m of eaters) {
                const x = per.get(m.id);
                if (x) {
                    x.fish += +fish;
                    x.oily += +oily;
                    x.legumes += +leg;
                }
            }
            const meat = gramsPerPortion(c.ingredients, c.yield, isMeat), charc = gramsPerPortion(c.ingredients, c.yield, isCharc);
            if (names.some(isMeat)) {
                out.meat.meals++;
                out.meat.unknown ||= meat.unknown;
                for (const m of eaters)
                    meatBy.set(m.id, (meatBy.get(m.id) ?? 0) + meat.g);
            }
            if (names.some(isCharc)) {
                out.charc.meals++;
                out.charc.unknown ||= charc.unknown;
                for (const m of eaters)
                    charcBy.set(m.id, (charcBy.get(m.id) ?? 0) + charc.g);
            }
        }
    const xs = [...per.values()];
    out.fish = xs.length ? Math.min(...xs.map(x => x.fish)) : 0;
    out.oily = xs.length ? Math.min(...xs.map(x => x.oily)) : 0;
    out.legumes = xs.length ? Math.min(...xs.map(x => x.legumes)) : 0;
    out.meat.g = Math.round(Math.max(0, ...meatBy.values()));
    out.charc.g = Math.round(Math.max(0, ...charcBy.values()));
    return out;
}
export const running = (b) => ({ fish: b.fish, oily: b.oily, legumes: b.legumes, meatMeals: b.meat.meals });
export function balanceBonus(r, names) {
    if (names.some(isOily) && r.oily < TARGET.oily)
        return { score: 12, why: 'poisson gras de la semaine' };
    if (names.some(isFish) && r.fish < TARGET.fish)
        return { score: 10, why: 'poisson de la semaine' };
    if (names.some(isLegume) && r.legumes < TARGET.legumes)
        return { score: 10, why: 'légumes secs de la semaine' };
    if (names.some(isMeat) && r.meatMeals >= 4)
        return { score: -12, why: '' }; // « 500 g ≈ 3 ou 4 steaks » (mangerbouger.fr)
    return null;
}
export function addToRunning(r, names) {
    if (names.some(isFish))
        r.fish++;
    if (names.some(isOily))
        r.oily++;
    if (names.some(isLegume))
        r.legumes++;
    if (names.some(isMeat))
        r.meatMeals++;
}
