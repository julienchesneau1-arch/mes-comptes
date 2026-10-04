// Catalogue de recettes tiré du « Livre de cuisine » de Wikilivres (CC BY-SA 4.0) : lecture déterministe du wikitexte, sans IA.
// Une recette n'entre au catalogue que si elle est exploitable telle quelle : nombre de personnes, au moins 3 ingrédients
// dont la moitié chiffrés, des étapes, et un plat de repas (ni dessert, ni boisson, ni cuisine historique).
import { parseIngredient } from './ingredients.js';
import { matchUnit } from './units.js';
import { decode } from './recipe-web.js';
const WORDS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20 };
const n = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS[s.toLowerCase()] ?? null);
// Modèles en ligne gardés (leur texte affiché) ; tous les autres modèles sont retirés.
function template(inner) {
    const parts = inner.split('|').map(x => x.trim());
    const name = (parts[0] ?? '').toLowerCase();
    const pos = parts.slice(1).filter(x => !/^[^=]*=/.test(x));
    if (name === 'i' || name === 'w' || name === 'lien' || name === 'ustensile' || name === 'nobr' || name === 'formatnum')
        return pos[pos.length - 1] ?? '';
    if (name === 'fraction' && pos.length >= 2)
        return `${pos[0]}/${pos[1]}`;
    return '';
}
// Wikitexte → texte : liens, modèles, gras, balises. Les images et catégories disparaissent.
export function plain(wiki) {
    let s = wiki.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<br\s*\/?>/gi, '\n');
    for (let i = 0; i < 6 && /\{\{[^{}]*\}\}/.test(s); i++)
        s = s.replace(/\{\{([^{}]*)\}\}/g, (_, x) => template(x));
    s = s.replace(/\[\[(?:File|Fichier|Image|Catégorie|Category):[^\]]*\]\]/gi, '')
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
        .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/[^\]]+\]/g, '')
        .replace(/'{2,}/g, '').replace(/<[^>]+>/g, '');
    return decode(s);
}
// Ligne d'ingrédient lisible par le lecteur commun : nombre en chiffres, nom court, précisions en remarque.
// « Deux tomates fraîches, écrasées » → « 2 tomates fraîches (écrasées) » ; « 2 gros oignons » → « 2 oignons (gros) ».
export function normalizeLine(line) {
    let s = line.replace(/\s+/g, ' ').trim().replace(/[;,.]+$/, '').trim();
    s = s.replace(/^une?\s+demie?[\s-]+/i, '1/2 ');
    s = s.replace(/^([a-zéû]+)\b/i, w => { const v = n(w); return v !== null && !/^\d/.test(w) ? String(v) : w; });
    const notes = [];
    for (let i = 0; i < 4 && /\([^()]*\)/.test(s); i++)
        s = s.replace(/\s*\(([^()]*)\)/g, (_, x) => { if (x.trim())
            notes.push(x.trim()); return ''; });
    s = s.replace(/[()]/g, '').trim();
    // « Bœuf haché (600 g) » : la quantité notée en remarque passe en tête, si c'est bien une quantité (nombre + unité connue).
    const isQty = (x) => { const m = /^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(.*)$/.exec(x); if (!m)
        return false; const w = (m[2] ?? '').split(' ').filter(Boolean); return !w.length || matchUnit(w)?.used === w.length; };
    const qi = /^\d/.test(s) ? -1 : notes.findIndex(isQty);
    if (qi >= 0) {
        s = `${notes[qi]} ${s}`;
        notes.splice(qi, 1);
    }
    const numbered = /^(\d+(?:[.,]\d+)?|\d+\/\d+)\s/.test(s);
    const colon = /^(.+?)\s*:\s+(.+)$/.exec(s);
    if (numbered && colon) {
        s = colon[1] ?? s;
        notes.unshift(colon[2] ?? '');
    }
    const comma = numbered ? /^([^,]+?),\s*(.+)$/.exec(s) : null;
    if (comma) {
        s = comma[1] ?? s;
        notes.push(comma[2] ?? '');
    }
    s = s.replace(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s+(gros|grosses?|petite?s?|beaux?|belles?|moyens?|moyennes?)\s+(.+)$/i, (_, q, adj, rest) => { notes.unshift(adj); return `${q} ${rest}`; });
    const note = notes.filter(Boolean).join(' ; ');
    const short = note.length > 58 ? `${note.slice(0, 57).replace(/\s+\S*$/, '')}…` : note; // coupé sur un mot : le lecteur garde 60 signes de remarque
    return short ? `${s} (${short})` : s;
}
const UTENSIL = /^(?:\d+\s+|une?\s+)?(?:grande?s?\s+|petite?s?\s+)?(?:sauteuse|cocotte|casserole|po[eê]le|plat|moule|saladier|autocuiseur|marmite|wok|four|mixeur|robot|fouet|couteau|planche|bol|passoire|cuit-vapeur|ficelle|papier)\b/i;
const MAIN_CATS = new Set(['Plat principal', 'Recettes de tous les jours', 'Pâtes alimentaires', 'Recettes de pizzas', 'Soupes', 'Salades', 'Viande', 'Recettes de ragoût', 'Fondues', 'Galettes', 'Recettes de tartes']);
const EXCLUDE = /dessert|gâteau|sucrerie|confiserie|boisson|cocktail|confiture|historique|médiév|viennoiserie|biscuit|glace|sorbet|petits?-déjeuner/i;
const SIDE = /entrée|amuse|pâtés|accompagnement|sauce|condiment|marinade|apéritif|tapas|pains|bases/i; // ni plat ni repas à eux seuls
const FAMILY = [
    ['poisson', /poisson|saumon|cabillaud|thon|colin|merlu|sardine|maquereau|truite|crevette|moule|fruits de mer|calmar|lieu|dorade|bar\b|morue/i],
    ['volaille', /poulet|dinde|canard|lapin|pintade|volaille|caille/i],
    ['viande', /b(?:œ|oe)uf|veau|porc|agneau|mouton|lardon|jambon|saucisse|chorizo|viande|bacon|merguez|steak/i],
    ['œufs', /(?:^|[^a-z])(?:œuf|oeuf)s?$/i],
];
// Famille d'un ingrédient (« blanc de poulet » → volaille) : sert à varier les repas d'un jour à l'autre.
export const familyOf = (name) => FAMILY.find(([, re]) => re.test(name))?.[0] ?? null;
const TYPE_TAGS = [['Soupes', 'soupe'], ['Salades', 'salade'], ['Pâtes alimentaires', 'pâtes'], ['Recettes de pizzas', 'pizza'], ['Recettes de tartes', 'tarte']];
function sections(text) {
    const out = [{ head: '', body: '' }];
    for (const line of text.split('\n')) {
        const h = /^(={2,4})\s*(.+?)\s*\1\s*$/.exec(line);
        if (h)
            out.push({ head: (h[2] ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), body: '' });
        else
            out[out.length - 1].body += `${line}\n`;
    }
    return out;
}
function minutesOf(text) {
    const t = text.normalize('NFC');
    const d = /dur[ée]e\s*(?:totale)?\s*:?\s*(?:(\d{1,2})\s*h(?:eures?)?\s*)?(?:(\d{1,3})\s*(?:min|mn)?)?/i.exec(t);
    if (d && (d[1] || d[2]))
        return Number(d[1] ?? 0) * 60 + Number(d[2] ?? 0);
    const part = (re) => { const m = re.exec(t); return m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) : null; };
    const prep = part(/(?:temps de )?pr[ée]paration\s*:\s*(?:(\d{1,2})\s*h\s*)?(\d{1,3})?\s*(?:min|mn)/i);
    const cook = part(/(?:temps de )?cuisson\s*:\s*(?:(\d{1,2})\s*h\s*)?(\d{1,3})?\s*(?:min|mn)/i);
    return prep !== null || cook !== null ? (prep ?? 0) + (cook ?? 0) : null;
}
export function parseWikiRecipe(p) {
    const cats = p.categories.map(c => c.replace(/^(?:Catégorie|Category):/, ''));
    const kinds = cats.filter(c => !/^Recettes de cuisine à base/i.test(c)); // les catégories d'ingrédient (« à base de sucre glace ») ne disent pas le type de plat
    if (kinds.some(c => EXCLUDE.test(c)))
        return { ok: false, why: 'dessert, boisson ou cuisine historique' };
    const base = cats.map(c => /^Recettes de cuisine à base d(?:e |e l'|'|u |es )(.+)$/i.exec(c)?.[1] ?? '').filter(Boolean);
    const main = FAMILY.find(([, re]) => base.some(b => re.test(b)))?.[0] ?? null;
    const veg = cats.includes('Recettes végétariennes') || cats.includes('Recettes végétaliennes');
    const isMain = cats.some(c => MAIN_CATS.has(c)), side = kinds.some(c => SIDE.test(c));
    if (!isMain && (side || ((!main || main === 'œufs') && !veg)))
        return { ok: false, why: 'pas un plat de repas' };
    const text = plain(p.content);
    const secs = sections(text);
    const ingIdx = secs.findIndex(x => x.head.startsWith('ingredient'));
    const ing = secs[ingIdx];
    if (!ing)
        return { ok: false, why: 'pas de section ingrédients' };
    // Étapes : la première section de préparation APRÈS les ingrédients (« Recette du hachis » au-dessus n'en est pas une).
    const prepIdx = secs.findIndex((x, i) => i > ingIdx && /^(preparation|recette|etapes?|instructions|realisation|methode|deroulement)/.test(x.head));
    const before = secs.slice(0, prepIdx < 0 ? secs.length : prepIdx).map(x => x.body).join('\n');
    const yieldN = [...before.matchAll(/pour\s*:?\s*(\d{1,2}|[a-z]+)\s*(?:(?:à|a|-)\s*\d{1,2}\s*)?(?:personnes?|pers\.?|portions?|parts?|couverts?)/gi)]
        .map(m => n(m[1] ?? '')).find((x) => x !== null) ?? null;
    if (yieldN !== null && (yieldN < 1 || yieldN > 20))
        return { ok: false, why: 'nombre de personnes invraisemblable' };
    const ingredients = ing.body.split('\n').filter(l => /^[*#]/.test(l) && !/^[*#]{2,}/.test(l)).map(l => normalizeLine(l.replace(/^[*#]+\s*/, '')))
        .filter(l => l.length >= 2 && !UTENSIL.test(l) && !/^pour\s*:?\s*\d/i.test(l)).slice(0, 40).map(l => l.slice(0, 160));
    if (ingredients.length < 3)
        return { ok: false, why: 'moins de 3 ingrédients' };
    const counted = ingredients.filter(l => parseIngredient(l).line.qty !== null).length;
    if (counted * 2 < ingredients.length)
        return { ok: false, why: 'moins de la moitié des ingrédients chiffrés' };
    const steps = [];
    for (const l of (prepIdx < 0 ? '' : secs[prepIdx].body).split('\n')) {
        const t = l.replace(/\s+/g, ' ').trim();
        if (!t || /^bon app[ée]tit/i.test(t))
            continue;
        if (/^:/.test(t) && steps.length) {
            steps[steps.length - 1] += ` ${t.replace(/^:+\s*/, '')}`;
            continue;
        }
        const body = t.replace(/^[*#:]+\s*/, '');
        if (body.length >= 3)
            steps.push(body.slice(0, 400));
    }
    if (steps.length < 2)
        return { ok: false, why: 'moins de 2 étapes' };
    const minutes = minutesOf(before);
    const tags = [...(minutes !== null && minutes <= 30 ? ['rapide'] : []), ...(veg ? ['végétarien'] : []),
        ...TYPE_TAGS.filter(([c]) => cats.includes(c)).map(([, t]) => t)];
    const title = (p.title.split('/').pop() ?? p.title).trim().slice(0, 80);
    return { ok: true, recipe: { id: `wb${p.pageid}`, title, yield: yieldN && yieldN >= 1 ? yieldN : null, minutes, ingredients, steps: steps.slice(0, 20), tags, main: veg ? null : main,
            url: `https://fr.wikibooks.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_')).replace(/%2F/g, '/')}`, rev: p.revid } };
}
