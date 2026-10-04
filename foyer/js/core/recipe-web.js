// Lire une recette dans une page web : données structurées schema.org « Recipe » (JSON-LD, ou microdonnées en repli),
// publiées par la plupart des sites de recettes pour les moteurs de recherche. Lecture déterministe, sans IA :
// le texte des ingrédients est rendu tel quel, puis analysé et relu par le foyer avant tout enregistrement.
// Fichier sans dépendance : copié tel quel dans la fonction serveur d'import (supabase/functions/foyer-import).
const NAMED = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â',
    ccedil: 'ç', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', oelig: 'œ', OElig: 'Œ', Eacute: 'É', Egrave: 'È', Agrave: 'À',
    deg: '°', frac12: '½', frac14: '¼', frac34: '¾', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—',
};
export function decode(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
        if (e[0] === '#') {
            const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
        }
        return NAMED[e] ?? m;
    });
}
const clean = (s) => typeof s === 'string' || typeof s === 'number'
    ? decode(String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
    : '';
const isRecipe = (o) => {
    const t = o['@type'];
    return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
};
function findRecipe(node, depth = 0) {
    if (depth > 8 || node === null || typeof node !== 'object')
        return null;
    if (Array.isArray(node)) {
        for (const x of node) {
            const r = findRecipe(x, depth + 1);
            if (r)
                return r;
        }
        return null;
    }
    const o = node;
    if (isRecipe(o))
        return o;
    for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
        const r = findRecipe(o[k], depth + 1);
        if (r)
            return r;
    }
    return null;
}
function steps(v, depth = 0) {
    if (depth > 5 || v === null || v === undefined)
        return [];
    if (typeof v === 'string')
        return clean(v).split(/\n+|(?<=[.!?])\s+(?=\d+[.)]\s)/).map(x => x.replace(/^\d{1,2}\s*[.)-]\s*/, '').trim()).filter(Boolean);
    if (Array.isArray(v))
        return v.flatMap(x => steps(x, depth + 1));
    if (typeof v === 'object') {
        const o = v;
        if (o['itemListElement'])
            return steps(o['itemListElement'], depth + 1); // HowToSection
        const t = clean(o['text'] ?? o['name'] ?? '');
        return t ? [t] : [];
    }
    return [];
}
function yieldText(v) {
    const list = Array.isArray(v) ? v : [v];
    const texts = list.map(clean).filter(Boolean);
    return texts.find(t => /\d/.test(t)) ?? texts[0] ?? '';
}
function fromJsonLd(html) {
    const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
    for (const m of html.matchAll(re)) {
        const raw = (m[1] ?? '').trim().replace(/^<!--|-->$/g, '');
        for (const attempt of [raw, raw.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' ')]) {
            try {
                const r = findRecipe(JSON.parse(attempt));
                if (r)
                    return r;
                break;
            }
            catch { /* essai suivant */ }
        }
    }
    return null;
}
// Repli : microdonnées (itemprop) quand la page n'a pas de JSON-LD.
function fromMicrodata(html) {
    if (!/itemtype\s*=\s*["'][^"']*schema\.org\/Recipe["']/i.test(html))
        return null;
    const prop = (name) => [...html.matchAll(new RegExp(`<[^>]*itemprop\\s*=\\s*["']${name}["'][^>]*>`, 'gi'))].map(m => {
        const tag = m[0];
        const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
        if (content !== undefined)
            return content;
        const start = (m.index ?? 0) + tag.length;
        const tagName = /^<\s*([a-z0-9]+)/i.exec(tag)?.[1] ?? 'span';
        const end = html.indexOf(`</${tagName}`, start);
        return end > start ? html.slice(start, end) : '';
    });
    return { name: prop('name')[0] ?? '', recipeYield: prop('recipeYield')[0] ?? '', recipeIngredient: [...prop('recipeIngredient'), ...prop('ingredients')], recipeInstructions: prop('recipeInstructions') };
}
export function extractRecipe(html, source = '') {
    const r = fromJsonLd(html) ?? fromMicrodata(html);
    if (!r)
        return null;
    const ingr = (Array.isArray(r['recipeIngredient']) ? r['recipeIngredient'] : Array.isArray(r['ingredients']) ? r['ingredients'] : [r['recipeIngredient'] ?? r['ingredients']])
        .map(clean).flatMap(x => x.split('\n')).map(x => x.trim()).filter(Boolean);
    const out = { name: clean(r['name']).slice(0, 80), yieldText: yieldText(r['recipeYield'] ?? r['yield']).slice(0, 60), ingredients: ingr.slice(0, 60).map(x => x.slice(0, 200)),
        steps: steps(r['recipeInstructions']).slice(0, 40).map(x => x.slice(0, 500)), source: source.slice(0, 300) };
    return out.name || out.ingredients.length ? out : null;
}
