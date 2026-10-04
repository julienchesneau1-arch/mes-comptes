import { isDate, isSlotKey } from './dates.js';
import { AISLE } from './ingredients.js';
import { UNIT } from './units.js';
import { qFrom } from './rational.js';
export const EVENT_TYPES = new Set(['household.init', 'members.set', 'settings.set', 'recipe.save', 'recipe.archive', 'slot.presence',
    'slot.guests', 'slot.cook', 'slot.from', 'slot.outside', 'slot.clear', 'slot.move', 'slot.eaten', 'prep.recipe', 'prep.extra', 'prep.start',
    'prep.done', 'prep.correct', 'prep.discard', 'task.set', 'shop.check', 'shop.pantry', 'shop.item', 'staple.set', 'aisle.set', 'watch.save',
    'watch.close', 'conflict.ack', 'undo']);
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v, max, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const bool = (v) => typeof v === 'boolean';
const ID_RE = /^[a-z0-9]{2,24}$/;
export const isId = (v) => typeof v === 'string' && ID_RE.test(v);
const KEY_RE = /^[^\u0000-\u001f]{1,120}$/;
const isKey = (v) => typeof v === 'string' && KEY_RE.test(v);
const PRESENCES = new Set(['maison', 'boite', 'dehors']);
const isPresence = (v) => typeof v === 'string' && PRESENCES.has(v);
const STATES = new Set(['ferme', 'ouvert', 'congele', 'decongele', 'prepare', 'inconnu']);
const NEED_RE = /^(na|-?\d{1,12}(\/\d{1,12})?)(\+\d{1,3})?$/;
const isNeed = (v) => typeof v === 'string' && NEED_RE.test(v);
const isQty = (v) => typeof v === 'string' && qFrom(v) !== null && (qFrom(v)?.n ?? 0) > 0;
function validMembers(v) {
    if (!Array.isArray(v) || v.length < 1 || v.length > 8)
        return false;
    const ids = new Set();
    for (const m of v) {
        if (!isObj(m) || !isId(m['id']) || !str(m['name'], 40, 1) || ids.has(m['id']))
            return false;
        ids.add(m['id']);
    }
    return true;
}
function validPresenceMap(v) {
    return isObj(v) && Object.keys(v).length <= 8 && Object.entries(v).every(([k, p]) => isId(k) && isPresence(p));
}
export function validRhythm(v) {
    return Array.isArray(v) && v.length === 7 && v.every(d => isObj(d) && validPresenceMap(d['midi']) && validPresenceMap(d['soir']));
}
function validSettings(v) {
    return isObj(v) && int(v['weekStart'], 0, 6) && validRhythm(v['rhythm']) && bool(v['boxesFromDinner']);
}
export function validIngredient(v) {
    if (!isObj(v) || !str(v['name'], 80, 1) || !str(v['note'], 120))
        return false;
    const qty = v['qty'], unit = v['unit'], form = v['form'];
    if (qty === null) {
        if (unit !== null)
            return false;
    }
    else if (!isQty(qty) || typeof unit !== 'string' || !UNIT[unit])
        return false;
    return form === null || str(form, 20, 1);
}
export function validContent(v) {
    return isObj(v) && str(v['name'], 80, 1) && (v['yield'] === null || int(v['yield'], 1, 50))
        && Array.isArray(v['ingredients']) && v['ingredients'].length <= 60 && v['ingredients'].every(validIngredient)
        && Array.isArray(v['steps']) && v['steps'].length <= 40 && v['steps'].every(s => str(s, 500, 1))
        && Array.isArray(v['ahead']) && v['ahead'].length <= 10
        && v['ahead'].every(a => isObj(a) && str(a['label'], 120, 1) && (a['when'] === 'veille' || a['when'] === 'matin'))
        && Array.isArray(v['tags']) && v['tags'].length <= 10 && v['tags'].every(t => str(t, 24, 1))
        && str(v['note'], 1000);
}
function validDateDecl(v) {
    if (!isObj(v))
        return false;
    const k = v['kind'], val = v['value'];
    if (k !== 'DLC' && k !== 'DDM' && k !== 'inconnu')
        return false;
    if (typeof val !== 'string')
        return false;
    if (isDate(val))
        return true;
    if (k === 'DLC')
        return false; // une DLC porte toujours un jour : jamais de jour inventé
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(val) || /^\d{4}$/.test(val);
}
const P = {
    'household.init': p => isId(p['hid']) && validMembers(p['members']) && validSettings(p['settings']),
    'members.set': p => validMembers(p['members']),
    'settings.set': p => (p['weekStart'] === undefined || int(p['weekStart'], 0, 6)) && (p['rhythm'] === undefined || validRhythm(p['rhythm']))
        && (p['boxesFromDinner'] === undefined || bool(p['boxesFromDinner'])),
    'recipe.save': p => isId(p['recipe']) && validContent(p['content']),
    'recipe.archive': p => isId(p['recipe']) && bool(p['archived']),
    'slot.presence': p => isSlotKey(p['slot']) && isId(p['member']) && (p['presence'] === null || isPresence(p['presence'])),
    'slot.guests': p => isSlotKey(p['slot']) && int(p['guests'], 0, 20),
    'slot.cook': p => isSlotKey(p['slot']) && isId(p['prep']) && isId(p['recipe']) && int(p['extra'], 0, 30),
    'slot.from': p => isSlotKey(p['slot']) && isId(p['prep']),
    'slot.outside': p => isSlotKey(p['slot']) && str(p['note'], 80),
    'slot.clear': p => isSlotKey(p['slot']),
    'slot.move': p => isSlotKey(p['from']) && isSlotKey(p['to']) && p['from'] !== p['to'] && bool(p['swap']),
    'slot.eaten': p => isSlotKey(p['slot']) && int(p['n'], 0, 50),
    'prep.recipe': p => isId(p['prep']) && isId(p['recipe']),
    'prep.extra': p => isId(p['prep']) && int(p['extra'], 0, 30),
    'prep.start': p => isId(p['prep']),
    'prep.done': p => isId(p['prep']) && int(p['yield'], 0, 99) && int(p['planned'], 0, 99) && int(p['version'], 1, 10000),
    'prep.correct': p => isId(p['prep']) && int(p['yield'], 0, 99) && str(p['reason'], 120),
    'prep.discard': p => isId(p['prep']) && int(p['n'], 1, 99) && str(p['reason'], 120),
    'task.set': p => isKey(p['key']) && bool(p['done']),
    'shop.check': p => isDate(p['week']) && isKey(p['key']) && (p['needAt'] === null || isNeed(p['needAt'])),
    'shop.pantry': p => isDate(p['week']) && isKey(p['key']) && (p['qty'] === null || p['qty'] === 'all' || isQty(p['qty'])) && isNeed(p['needAt']),
    'shop.item': p => isDate(p['week']) && isId(p['id']) && str(p['name'], 80, 1) && str(p['qty'], 40) && typeof p['aisle'] === 'string'
        && !!AISLE[p['aisle']] && bool(p['checked']) && bool(p['removed']),
    'staple.set': p => isKey(p['key']) && str(p['name'], 80, 1) && str(p['qty'], 40) && typeof p['aisle'] === 'string' && !!AISLE[p['aisle']] && bool(p['removed']),
    'aisle.set': p => isKey(p['key']) && typeof p['aisle'] === 'string' && !!AISLE[p['aisle']],
    'watch.save': p => isId(p['id']) && str(p['name'], 80, 1) && str(p['qty'], 40) && (p['date'] === null || validDateDecl(p['date']))
        && typeof p['state'] === 'string' && STATES.has(p['state']) && (p['slot'] === null || isSlotKey(p['slot'])),
    'watch.close': p => isId(p['id']) && (p['outcome'] === 'utilise' || p['outcome'] === 'jete'),
    'conflict.ack': p => isId(p['event']),
    'undo': p => isId(p['event']),
};
// Renvoie l'événement s'il est conforme, sinon null. Taille bornée : un lien reçu ne peut pas saturer le téléphone.
export function validEvent(x) {
    if (!isObj(x) || !isId(x['id']) || !int(x['lc'], 1, 1e12) || !isId(x['dev']) || !(x['by'] === null || isId(x['by']))
        || !str(x['at'], 40, 10) || Number.isNaN(Date.parse(x['at'])) || typeof x['t'] !== 'string' || !EVENT_TYPES.has(x['t']) || !isObj(x['p']))
        return null;
    if (JSON.stringify(x).length > 20000)
        return null;
    const check = P[x['t']];
    return check(x['p']) ? x : null;
}
export const defaultRhythm = (ids, midi, soir, weekendMidi = 'maison') => Array.from({ length: 7 }, (_, wd) => ({
    midi: Object.fromEntries(ids.map(id => [id, wd >= 5 ? weekendMidi : midi])),
    soir: Object.fromEntries(ids.map(id => [id, soir])),
}));
export const emptyState = () => ({
    hid: null, members: [], settings: { weekStart: 0, rhythm: defaultRhythm([], 'maison', 'maison'), boxesFromDinner: true },
    recipes: {}, slots: {}, preps: {}, shop: {}, staples: {}, aisles: {}, watch: {}, tasks: {}, acked: new Set(),
});
export const current = (r) => r.versions[r.versions.length - 1];
