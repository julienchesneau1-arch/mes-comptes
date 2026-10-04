// Agendas : relus à l'ouverture, au retour dans l'app et toutes les 30 min quand l'app est ouverte (un mois devant soi).
// Les décisions « pareil les prochaines fois » s'appliquent seules ; un événement disparu fait revenir à l'habitude.
// Les événements lus restent sur ce téléphone (cache), jamais dans le journal ni au relais : seule l'adresse de l'agenda est synchronisée.
import { addDays, paris } from '../core/dates.js';
import { readAgenda, RelayError } from '../core/relay.js';
import { planAgenda, changeText } from '../core/agenda.js';
import { holidayOccurrences } from '../core/feries.js';
import { RELAY } from './config.js';
import { A, S, dispatch } from './state.js';
export const HORIZON = 31;
const KEY = 'foyer:agenda', EVERY = 30 * 60e3;
let cache = (() => { try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
}
catch {
    return {};
} })();
const save = () => { try {
    localStorage.setItem(KEY, JSON.stringify(cache));
}
catch { /* cache seulement */ } };
export const forgetAgenda = () => { cache = {}; try {
    localStorage.removeItem(KEY);
}
catch { /* rien */ } };
export const calStatus = (id) => cache[id] ?? null;
const f = ((u, i) => fetch(u, i));
// Flux utilisables : agendas branchés relus avec succès (même adresse qu'aujourd'hui) + jours fériés si activés.
export function feeds() {
    const s = S(), today = paris(A.now()).date;
    const out = Object.values(s.agenda.cals).filter(c => cache[c.id]?.ok && cache[c.id]?.url === c.url)
        .map(c => ({ cal: c.id, member: c.member, label: c.label, occurrences: cache[c.id]?.occurrences ?? [] }));
    if (s.settings.holidays !== false)
        out.push({ cal: 'feries', member: null, label: 'Jours fériés', occurrences: holidayOccurrences(today, addDays(today, HORIZON)) });
    return out;
}
export const plan = () => (A.demo || !S().hid ? { changes: [], reverts: [] } : planAgenda(S(), feeds(), A.now(), HORIZON));
export const toDecide = () => plan().changes.filter(c => !c.auto).length;
// Relit un agenda (ou tous). Renvoie le message d'erreur éventuel.
export async function readCal(id, url) {
    const today = paris(A.now()).date;
    const prev = cache[id];
    try {
        if (!RELAY)
            throw new Error('lecture d\'agenda indisponible (pas de relais)');
        const r = await readAgenda(RELAY, url, today, addDays(today, HORIZON), id, f);
        cache[id] = { at: A.now().getTime(), ok: true, error: '', url, ...r };
    }
    catch (e) {
        const error = e instanceof RelayError || e instanceof Error ? e.message : 'agenda injoignable';
        // Échec : on garde la dernière lecture réussie (jamais de retour arrière sur une lecture ratée), avec l'erreur affichée.
        cache[id] = prev && prev.url === url ? { ...prev, error } : { at: A.now().getTime(), ok: false, error, occurrences: [], events: 0, skipped: [], url };
    }
    save();
    return cache[id];
}
let running = false;
export async function refreshAgenda(force = false) {
    if (running || A.demo || !S().hid)
        return;
    running = true;
    try {
        const now = A.now().getTime();
        for (const c of Object.values(S().agenda.cals)) {
            const got = cache[c.id];
            if (force || !got || got.url !== c.url || now - got.at > EVERY)
                await readCal(c.id, c.url);
        }
        for (const id of Object.keys(cache))
            if (!S().agenda.cals[id])
                delete cache[id]; // agenda débranché : ses événements sont oubliés
        save();
        applyAuto();
    }
    finally {
        running = false;
        A.render();
    }
}
// Décisions déjà prises : appliquées sans demander (avec « Annuler » dans le message).
export function applyAuto() {
    if (A.demo || !S().hid)
        return;
    const p = plan();
    const auto = p.changes.filter(c => c.auto);
    const drafts = [...auto.flatMap(c => c.drafts), ...p.reverts.flatMap(r => r.drafts)];
    if (!drafts.length)
        return;
    const texts = [...auto.map(c => `${c.title} : ${changeText(S(), c)}`), ...p.reverts.map(r => r.text)];
    dispatch(drafts, { toast: `Agenda : ${texts.length > 1 ? `${texts.length} changements (Maison › Réglages › Agendas)` : texts[0]}` });
}
let timer = 0;
export function startAgenda() {
    const soon = (force = false) => { window.clearTimeout(timer); timer = window.setTimeout(() => { void refreshAgenda(force); }, 1500); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden)
        soon(); });
    window.setInterval(() => { if (!document.hidden)
        soon(); }, EVERY);
    soon();
}
