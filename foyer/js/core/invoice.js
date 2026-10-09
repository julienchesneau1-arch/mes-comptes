// Lecteur de factures du drive, sans IA et sur le téléphone : le texte du PDF (extrait par pdf.js, voir ui/invoice.ts) est remis
// en lignes, puis chaque ligne « produit … quantité … prix … montant » est lue par des règles fixes, vérifiées par le calcul
// (quantité × prix = montant, au centime près). Rien n'est deviné : une ligne non vérifiable est signalée comme telle.
// Données personnelles : seules les lignes portant un montant en euros sont lues, et seuls le nom du produit, sa contenance
// et son prix sont retenus. Nom, adresse, carte de fidélité, numéro de commande ne sortent jamais de cette fonction.
// Règles génériques (factures françaises) : elles seront calées sur une facture Auchan réelle, copie anonymisée en test.
import { isDate } from './dates.js';
import { parseSize } from './drive.js';
import { deriveShopping } from './shopping.js';
import { ingredientKey } from './ingredients.js';
import { GROUP_DEFS } from './products.js';
import { REF_DEFS } from './refprice.js';
import { qStr } from './rational.js';
import { nameKey, norm } from './text.js';
// Lignes de texte : morceaux d'une même page à la même hauteur (à 2 points près), lus de gauche à droite. Tri : O(n log n).
export function toLines(items, tol = 2) {
    const sorted = items.filter(i => i.str.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
    const rows = [];
    for (const it of sorted) {
        const r = rows[rows.length - 1];
        if (r && r.page === it.page && Math.abs(r.y - it.y) <= tol)
            r.parts.push(it);
        else
            rows.push({ page: it.page, y: it.y, parts: [it] });
    }
    return rows.map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.str.trim()).join(' ').replace(/\s+/g, ' ').trim());
}
const MONEY_RE = /^-?\d{1,5}[,.]\d{2}$/, WEIGHT_RE = /^\d{1,3}[,.]\d{3}$/;
const SKIP_RE = /^(?:€|eur|x|\*|%|kg|l|le|\/kg|\/l|€\/kg|€\/l|-?\d{1,3}(?:[,.]\d{1,2})?%)$/;
const cents = (s) => Math.round(Number(s.replace(',', '.')) * 100);
// Lignes qui ne sont pas des produits : totaux, taxes, frais de service, remises, paiement. Expressions précises :
// « Œufs frais » ou « Préparation pour gâteau » restent des produits.
const NOT_ITEM = /\b(total|sous-total|tva|t\.v\.a|ht|ttc|remises?|reductions?|avantages?|cagnotte|fidelite|bons? d'achat|coupons?|economies?|frais (?:de |d')?(?:livraison|preparation|service|port|retrait|gestion)|livraison|paiement|payer|paye|rendu|acompte|arrondi|montant|avoir|consigne|carte (?:bancaire|cb|de fidelite)|cb|visa|mastercard)\b/;
const TOTAL_STRONG = /\b(net a payer|total a payer|total ttc|montant total|total paye|montant paye|total de la commande|total commande)\b/;
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
// Fin de ligne chiffrée, lue de droite à gauche : montants (2 décimales), poids (3 décimales), quantités (1 à 99),
// et ce qui les entoure (€, %, « x », « kg », « /kg »), plus un code TVA d'une lettre tout au bout.
function tail(words) {
    const toks = [];
    for (let i = words.length - 1; i >= 0; i--) {
        const w = (words[i] ?? '').toLowerCase();
        if (SKIP_RE.test(w) || (/^[a-z]$/.test(w) && toks.every(x => x.t.k === 'skip')))
            toks.unshift({ i, t: { k: 'skip', v: 0 } });
        else if (MONEY_RE.test(w))
            toks.unshift({ i, t: { k: 'money', v: cents(w) } });
        else if (WEIGHT_RE.test(w))
            toks.unshift({ i, t: { k: 'weight', v: Number(w.replace(',', '.')) } });
        else if (/^\d{1,2}$/.test(w) && Number(w) >= 1)
            toks.unshift({ i, t: { k: 'int', v: Number(w) } });
        else
            break;
    }
    return toks;
}
// Contenance lue dans le nom du produit : lot (« 4x125g », « 6 x 1 L »), masse ou volume (« 500 g », « 1,5kg », « 75cl »), nombre (« x12 »).
export function labelSize(label) {
    const s = norm(label);
    const lot = /(\d{1,2}) ?[x×*] ?(\d{1,4}(?:[.,]\d{1,3})?) ?(kg|g|l|cl|ml)\b/.exec(s);
    const one = /(\d{1,4}(?:[.,]\d{1,3})?) ?(kg|g|l|cl|ml)\b/.exec(s);
    const count = /(?:\b|^)[x×] ?(\d{1,3})\b|\b(\d{1,3}) ?(?:pieces?|pcs?|unites?|oeufs?)\b/.exec(s);
    const raw = lot ? `${lot[1]} x ${lot[2]} ${lot[3]}` : one ? `${one[1]} ${one[2]}` : count ? `${count[1] ?? count[2]}` : null;
    const r = raw ? parseSize(raw) : null;
    return r ? { size: qStr(r.size), unit: r.unit.id } : null;
}
// Nom imprimé, sans code article ni code-barres (suites de 5 chiffres ou plus) en tête ou en fin.
const cleanLabel = (s) => s.replace(/^(?:\d{5,}\s+)+/, '').replace(/(?:\s+\d{5,})+$/, '').replace(/\s+/g, ' ').trim().slice(0, 120);
function readLine(line) {
    const words = line.replace(/€/g, ' € ').replace(/×/g, ' x ').replace(/[\u00a0\u202f]/g, ' ').split(/\s+/).filter(Boolean);
    const toks = tail(words), of = (k) => toks.filter(x => x.t.k === k);
    const last = of('money').at(-1);
    if (!last || last.t.v <= 0)
        return null;
    const total = last.t.v, before = (k) => of(k).filter(x => x.i < last.i);
    const pk = before('money'), w = before('weight')[0];
    // « x 12 » ou « 1 l » : contenance du paquet (nom du produit), pas une quantité achetée. « 2 Oignons … » : quantité en tête.
    const lead = /^\d{1,2}$/.test(words[0] ?? '') && Number(words[0]) >= 1 && last.i > 1 ? { i: 0, t: { k: 'int', v: Number(words[0]) } } : null;
    const ints = [...(lead ? [lead] : []), ...before('int').filter(x => (words[x.i - 1] ?? '').toLowerCase() !== 'x' && !/^(?:kg|g|l|cl|ml)$/i.test(words[x.i + 1] ?? ''))];
    let n = 1, unit = total, loose = false, weight = null, sure = false, used = last.i, from = 0;
    const perKg = w ? pk.find(p => Math.abs(Math.round(w.t.v * p.t.v) - total) <= 1) : undefined;
    const counted = ints.flatMap(a => pk.map(b => [a, b])).reverse().find(([a, b]) => a.t.v * b.t.v === total);
    if (w && perKg) {
        loose = true;
        weight = w.t.v;
        unit = perKg.t.v;
        sure = true;
        used = Math.min(w.i, perKg.i);
    } // poids × prix au kg
    else if (counted) { // quantité × prix
        n = counted[0].t.v;
        unit = counted[1].t.v;
        sure = true;
        if (counted[0] === lead) {
            from = 1;
            used = counted[1].i;
        }
        else
            used = Math.min(counted[0].i, counted[1].i);
    }
    else if (pk.some(p => p.t.v === total)) {
        sure = true;
        used = pk.find(p => p.t.v === total).i;
    } // « 1,25 1,25 »
    else if (pk.length)
        return null; // deux montants sans rapport : ligne non comprise, rien n'est deviné
    else { // quantité sans prix unitaire : vérifiable seulement pour un article
        const prev = toks.filter(x => x.i < last.i && x.t.k !== 'skip').at(-1), qn = prev?.t.k === 'int' && ints.includes(prev) ? prev : lead;
        if (qn) {
            n = qn.t.v;
            unit = Math.round(total / n);
            sure = n === 1;
            if (qn === lead)
                from = 1;
            else
                used = qn.i;
        }
    }
    const label = cleanLabel(words.slice(from, used).join(' ').replace(/(?:\s+(?:€|eur|x|\*))+$/i, ''));
    if ((label.match(/[a-zà-ÿ]/gi) ?? []).length < 3)
        return null;
    const sz = loose ? null : labelSize(label);
    return { label, n, unitCents: unit, cents: total, loose, weight, size: loose ? '1' : sz?.size ?? null, unit: loose ? 'kg' : sz?.unit ?? null, sure };
}
function readDate(lines) {
    let first = null;
    for (const line of lines) {
        const s = norm(line);
        const m = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/.exec(s), t = new RegExp(`\\b(\\d{1,2}) (${MONTHS.join('|')}) (\\d{4})\\b`).exec(s);
        const y = m ? (m[3]?.length === 2 ? `20${m[3]}` : m[3]) : t?.[3], mo = m ? m[2] : t ? String(MONTHS.indexOf(t[2] ?? '') + 1) : null, d = m ? m[1] : t?.[1];
        if (!y || !mo || !d)
            continue;
        const day = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
        if (!isDate(day) || y < '2000' || y > '2099')
            continue;
        if (/(facture|commande|livraison|retrait|date)/.test(s))
            return day;
        first ??= day;
    }
    return first;
}
export function parseInvoice(lines) {
    const out = [];
    let strong = null, weak = null, ignored = 0;
    for (const raw of lines) {
        const s = norm(raw);
        const r = readLine(raw);
        if (NOT_ITEM.test(s)) {
            const amount = r?.cents ?? null;
            if (amount !== null && TOTAL_STRONG.test(s))
                strong = amount;
            else if (amount !== null && /\btotal\b/.test(s) && !/sous-total|tva|\bht\b/.test(s))
                weak = amount;
            else if (amount !== null)
                ignored++;
            continue;
        }
        if (r)
            out.push(r);
    }
    return { day: readDate(lines), total: strong ?? weak, lines: out, sum: out.reduce((n, l) => n + l.cents, 0), ignored };
}
const STOP = new Set(['auchan', 'bio', 'x', 'g', 'kg', 'l', 'cl', 'ml', 'le', 'la', 'les', 'de', 'du', 'des', 'd', 'a', 'au', 'aux', 'en', 'et',
    'avec', 'sans', 'piece', 'pc', 'pcs', 'mon', 'ma', 'mes', 'notre', 'pour', 'sur', 'un', 'une']);
const words = (s) => nameKey(s).split(/[ '-]+/).filter(w => w && !STOP.has(w) && !/^\d/.test(w));
// Le candidat dont tous les mots figurent dans le nom imprimé ; le plus précis gagne (« sauce tomate » avant « tomate »),
// puis celui dont le premier mot vient en tête du nom. Égalité indécidable : aucun choix (la personne choisit).
export function matchKey(label, cands) {
    const lw = words(label), plain = norm(label);
    let best = null, tie = false;
    for (const c of cands) {
        const cw = words(c.name);
        if (!cw.length || !cw.every(w => lw.includes(w)) || c.not?.test(plain))
            continue;
        const score = cw.length, pos = lw.indexOf(cw[0]);
        if (!best || score > best.score || (score === best.score && pos < best.pos)) {
            best = { c, score, pos };
            tie = false;
        }
        else if (score === best.score && pos === best.pos && c.key !== best.c.key)
            tie = true;
    }
    return best && !tie ? best.c : null;
}
// Ingrédients auxquels rattacher un produit : ceux des courses des semaines données (avec leur forme : surgelé, en conserve…),
// les produits de base, ceux déjà retenus ou déjà payés, et les noms génériques des prix de référence et de l'étude qualité-prix.
// Le garde-fou d'un groupe (« crème » mais pas « crème dessert ») suit le nom.
export function candidates(s, weeks) {
    const guard = new Map();
    for (const d of GROUP_DEFS)
        if (d.not)
            for (const k of d.keys)
                guard.set(nameKey(k), d.not);
    const out = new Map();
    const add = (key, name) => {
        const g = guard.get(nameKey(name));
        if (key && name && !out.has(key))
            out.set(key, g ? { key, name, not: g } : { key, name });
    };
    for (const w of weeks)
        for (const l of deriveShopping(s, w).lines) {
            add(ingredientKey(l.name, l.form), l.form ? `${l.name} ${l.form}` : l.name);
            add(nameKey(l.name), l.name);
        }
    for (const [key, st] of Object.entries(s.staples))
        add(key, st.name);
    for (const key of [...Object.keys(s.products), ...Object.keys(s.paid)])
        add(key, key.replace('|', ' '));
    for (const d of [...GROUP_DEFS, ...REF_DEFS])
        for (const k of d.keys)
            add(nameKey(k), k);
    return [...out.values()];
}
export const MAX_PAGES = 20;
// Morceaux de texte et leur position, page par page (20 pages au plus). Le document est refermé dans tous les cas.
export async function pdfItems(lib, data) {
    const task = lib.getDocument({ data, verbosity: 0, disableFontFace: true, useSystemFonts: false });
    try {
        const doc = await task.promise, out = [];
        for (let page = 1; page <= Math.min(doc.numPages, MAX_PAGES); page++) {
            for (const it of (await (await doc.getPage(page)).getTextContent()).items) {
                const t = it.transform;
                if (typeof it.str === 'string' && Array.isArray(t))
                    out.push({ str: it.str, x: Number(t[4]) || 0, y: Number(t[5]) || 0, page });
            }
        }
        return out;
    }
    finally {
        await task.destroy();
    }
}
