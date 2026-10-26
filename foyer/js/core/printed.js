// Date imprimée sur un emballage, lue dans un texte (saisi, ou scanné par l'appareil photo : « Scanner le texte » de l'iPhone).
// Aucune durée n'est calculée : on lit ce qui est écrit, avec sa précision. Règlement (UE) 1169/2011, annexe X : une DLC porte au
// moins le jour et le mois ; une DDM peut ne porter que le mois et l'année, ou l'année. Ce qui n'est pas lisible n'est pas deviné,
// sauf l'année absente d'une DLC (« 28/10 »), déduite et signalée comme telle.
import { addDays } from './dates.js';
const DDM_RE = /de preference|\bddm\b|\bdluo\b|best before|\bbbe\b|a consommer avant fin/g;
const DLC_RE = /jusqu.?\s?au|\bdlc\b|use by|a consommer avant le/g;
// Dates d'une autre nature imprimées à côté : emballage, fabrication, lot, ponte, pêche, abattage.
const OTHER_RE = /(emball|fabri|\bfab\b|\blot\b|conditionn|abatt|ponte|pondu|peche|\bne le\b|produit le)[^0-9]{0,12}$/;
const MONTHS = { jan: 1, janv: 1, fev: 2, fevr: 2, feb: 2, mar: 3, mars: 3, avr: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6,
    juil: 7, jul: 7, aou: 8, aout: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const valid = (y, m, d) => {
    if (m < 1 || m > 12 || d < 1 || d > 31)
        return false;
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const pad = (n) => String(n).padStart(2, '0');
const year4 = (y) => (y.length === 2 ? 2000 + Number(y) : Number(y));
// Texte normalisé ; une lettre prise entre deux chiffres (« 2O26 », « 1o/1o ») est une confusion de l'OCR (O→0, l/I/|→1).
function clean(text) {
    const t = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ');
    return t.replace(/(?<=\d[/.\-]?)[oli|](?=[/.\-]?\d)/g, c => (c === 'o' ? '0' : '1'));
}
function candidates(t, today) {
    const out = [];
    const ty = Number(today.slice(0, 4));
    const push = (at, end, y, m, d, guessed = false) => {
        if (d === null) {
            if (m >= 1 && m <= 12)
                out.push({ at, end, value: `${y}-${pad(m)}`, precision: 'mois', guessed });
            return;
        }
        if (valid(y, m, d))
            out.push({ at, end, value: `${y}-${pad(m)}-${pad(d)}`, precision: 'jour', guessed });
    };
    let m;
    const taken = (i) => out.some(c => i >= c.at && i < c.end);
    // 28/10/2026, 28.10.26, 28-10-2026, 28 / 10 / 26
    const dmy = /(?<!\d)(\d{1,2}) ?[/.\-] ?(\d{1,2}) ?[/.\-] ?(\d{4}|\d{2})(?!\d)/g;
    while ((m = dmy.exec(t)))
        push(m.index, m.index + m[0].length, year4(m[3] ?? ''), Number(m[2]), Number(m[1]));
    // 28 oct. 2026, 28 octobre 26, 28 OCT
    const dMon = /(?<!\d)(\d{1,2}) ?([a-z]{3,9})\.? ?(\d{4}|\d{2})?(?![\d])/g;
    while ((m = dMon.exec(t))) {
        const mon = MONTHS[m[2] ?? ''] ?? MONTHS[(m[2] ?? '').slice(0, 4)] ?? MONTHS[(m[2] ?? '').slice(0, 3)];
        if (!mon || taken(m.index))
            continue;
        if (m[3])
            push(m.index, m.index + m[0].length, year4(m[3]), mon, Number(m[1]));
        else
            out.push(...noYear(m.index, m.index + m[0].length, mon, Number(m[1]), today));
    }
    // 10/2027 (mois et année) ; « fin 2027 » (année)
    const my = /(?<![\d/.\-])(\d{1,2}) ?[/.\-] ?(\d{4})(?!\d)/g;
    while ((m = my.exec(t)))
        if (!taken(m.index))
            push(m.index, m.index + m[0].length, Number(m[2]), Number(m[1]), null);
    const monY = /(?<!\d )\b(janv?|fevr?|mars|avr|mai|juin|juil|aout|sept?|oct|nov|dec)[a-z]*\.? ?(\d{4})\b/g;
    while ((m = monY.exec(t)))
        if (!taken(m.index))
            push(m.index, m.index + m[0].length, Number(m[2]), MONTHS[m[1] ?? ''] ?? 0, null);
    const finY = /\bfin (?:d'?annee )?(\d{4})\b/g;
    while ((m = finY.exec(t)))
        if (!taken(m.index + 4))
            out.push({ at: m.index, end: m.index + m[0].length, value: m[1] ?? '', precision: 'annee', guessed: false });
    // 28/10 (sans année : seule une DLC peut l'omettre)
    const dm = /(?<![\d/.\-,])(\d{1,2}) ?[/.] ?(\d{1,2})(?![\d/.\-,]| ?(?:kg|g|cl|ml|l|e)\b| ?[%€°])/g; // pas « 1.5 l » ni « 3.5 % »
    while ((m = dm.exec(t)))
        if (!taken(m.index))
            out.push(...noYear(m.index, m.index + m[0].length, Number(m[2]), Number(m[1]), today));
    // Années absurdes (photo d'un autre texte) : écartées.
    return out.filter(c => { const y = Number(c.value.slice(0, 4)); return y >= ty - 2 && y <= ty + 10; }).sort((a, b) => a.at - b.at);
    function noYear(at, end, mon, day, td) {
        // L'année la plus proche qui ne place pas la date à plus de 30 jours dans le passé.
        for (const y of [ty, ty + 1])
            if (valid(y, mon, day) && `${y}-${pad(mon)}-${pad(day)}` >= addDays(td, -30))
                return [{ at, end, value: `${y}-${pad(mon)}-${pad(day)}`, precision: 'jour', guessed: true }];
        return [];
    }
}
export function readPrinted(text, today) {
    const t = clean(text);
    const cands = candidates(t, today).filter(c => !OTHER_RE.test(t.slice(Math.max(0, c.at - 30), c.at)));
    if (!cands.length)
        return null;
    const keys = [];
    for (const [re, kind] of [[DDM_RE, 'DDM'], [DLC_RE, 'DLC']]) {
        re.lastIndex = 0;
        let k;
        while ((k = re.exec(t)))
            keys.push({ at: k.index, end: k.index + k[0].length, kind });
    }
    // « à consommer de préférence avant » contient « consommer » : une mention DDM l'emporte sur une mention DLC qui la chevauche.
    const kinds = keys.filter(k => !(k.kind === 'DLC' && keys.some(o => o.kind === 'DDM' && o.at <= k.end && k.at <= o.end)));
    // La date qui suit de plus près une mention ; sinon la plus tardive (une date d'emballage précède toujours la date limite).
    let best, kind = 'inconnu';
    for (const k of kinds.sort((a, b) => a.at - b.at)) {
        const c = cands.find(x => x.at >= k.end - 1 && x.at - k.end <= 25);
        if (c) {
            best = c;
            kind = k.kind;
            break;
        }
    }
    if (!best)
        best = [...cands].sort((a, b) => (a.value < b.value ? 1 : a.value > b.value ? -1 : 0))[0];
    if (!best)
        return null;
    if (kind === 'inconnu' && best.precision !== 'jour')
        kind = 'DDM'; // sans jour : jamais une DLC
    if (kind === 'DLC' && best.precision !== 'jour')
        kind = 'inconnu'; // mention DLC sans jour lisible : à vérifier
    return { kind, value: best.value, guessedYear: best.guessed };
}
// Produit surveillé ↔ ingrédient d'une recette : les mots du plus court se retrouvent tous dans le plus long
// (« Poulet » ↔ « blanc de poulet », « Crème fraîche épaisse 30 % » ↔ « crème fraîche »). Chiffres et mots de liaison ignorés.
const STOP = new Set(['de', 'du', 'des', "d'", 'a', 'au', 'aux', 'en', 'la', 'le', 'les', 'et', 'l', 'd', 'x', 'g', 'kg', 'ml', 'cl', 'l']);
export function words(key) { return key.split(/[\s'-]+/).filter(w => w.length > 1 && !STOP.has(w) && !/\d/.test(w)); }
export function matchesProduct(ingredientKey, productKey) {
    const a = words(ingredientKey), b = words(productKey);
    if (!a.length || !b.length)
        return false;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.some(w => w.length >= 3) && short.every(w => long.includes(w));
}
