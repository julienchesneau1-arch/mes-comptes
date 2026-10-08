// Synchro automatique : relève au démarrage, au retour dans l'app, toutes les 20 s quand l'app est visible ; dépose après chaque changement.
// Hors ligne ou relais indisponible : rien n'est perdu, l'app continue en local et le lien chiffré reste disponible.
import { relayKeys, push, pull, resumeFrom, RelayError } from '../core/relay.js';
import { merge, SyncError } from '../core/sync.js';
import { SCHEMA } from '../core/model.js';
import { openConflicts } from '../core/reduce.js';
import { RELAY } from './config.js';
import { A, S, setLog, persist, setDevice } from './state.js';
import { toast } from './dom.js';
const KEY = 'foyer:relais';
const load = () => {
    try {
        const m = JSON.parse(localStorage.getItem(KEY) || '{}');
        return { cursor: Number(m.cursor) || 0, known: Array.isArray(m.known) ? m.known.filter(x => typeof x === 'string') : [], ...(typeof m.schema === 'string' ? { schema: m.schema } : {}) };
    }
    catch {
        return { cursor: 0, known: [] };
    }
};
const save = (m) => { try {
    localStorage.setItem(KEY, JSON.stringify(m));
}
catch { /* rien */ } };
export const forgetRelay = () => { try {
    localStorage.removeItem(KEY);
}
catch { /* rien */ } };
export const sync = { status: 'off', at: null, error: '' };
let keys = null;
let running = null;
let again = false;
let timer = 0;
const f = ((u, i) => fetch(u, i));
export const available = () => !!RELAY;
export const enabled = () => !!RELAY && !!A.device.code && A.device.auto && !A.demo && !!S().hid;
async function keysFor(code) {
    if (!keys || keys.code !== code)
        keys = { code, k: await relayKeys(code) };
    return keys.k;
}
export function syncSoon(delay = 800) {
    if (!enabled())
        return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { void syncNow(); }, delay);
}
export async function syncNow() {
    if (!enabled() || !RELAY) {
        sync.status = 'off';
        return;
    }
    if (running) {
        again = true;
        return running;
    }
    const shown = statusLabel(); // l'écran n'est redessiné que si ce qu'il affiche change (sinon les sections ouvertes se referment)
    running = (async () => {
        sync.status = 'busy';
        const conf = RELAY;
        try {
            const k = await keysFor(A.device.code);
            const mem = load();
            const got = await pull(conf, k, resumeFrom(mem.cursor, mem.schema, SCHEMA), f);
            const known = new Set(mem.known);
            for (const e of got.events)
                known.add(e.id);
            if (got.events.length) {
                const conflictsBefore = openConflicts(A.r).length;
                const m = merge(A.log, S().hid, { app: 'foyer', v: 1, hid: S().hid ?? '', from: 'relais', sent: '', events: got.events });
                if (m.added) {
                    setLog(m.log);
                    persist();
                    setDevice({ lastRecvAt: A.now().toISOString() });
                    A.render();
                    const c = openConflicts(A.r).length - conflictsBefore;
                    if (c > 0)
                        toast(`${c} changement${c > 1 ? 's' : ''} de l'autre téléphone n'a pas pu s'appliquer : voir Aujourd'hui`);
                }
            }
            const fresh = A.log.filter(e => !known.has(e.id));
            if (fresh.length) {
                await push(conf, k, A.device.dev, fresh, f);
                for (const e of fresh)
                    known.add(e.id);
                setDevice({ lastSentLc: A.r.maxLc, lastSentAt: A.now().toISOString() });
            }
            save({ cursor: got.cursor, known: [...known], schema: SCHEMA });
            sync.status = 'ok';
            sync.at = A.now().toISOString();
            sync.error = '';
        }
        catch (e) {
            sync.status = e instanceof RelayError ? 'error' : 'offline';
            sync.error = e instanceof Error ? e.message : String(e);
            if (e instanceof SyncError && e.code === 'foyer')
                sync.error = 'Le relais contient un autre foyer pour ce code';
        }
        finally {
            running = null;
            if (statusLabel() !== shown)
                A.render();
            if (again) {
                again = false;
                syncSoon(1500);
            }
        }
    })();
    return running;
}
// Nouveau téléphone : le code seul suffit à retrouver le foyer sur le relais.
export async function joinWithCode(code) {
    if (!RELAY)
        return 'hors-ligne';
    try {
        const k = await keysFor(code);
        const got = await pull(RELAY, k, 0, f);
        const init = got.events.find(e => e.t === 'household.init');
        if (!init || init.t !== 'household.init')
            return 'introuvable';
        const m = merge([], null, { app: 'foyer', v: 1, hid: init.p.hid, from: 'relais', sent: '', events: got.events });
        setLog(m.log);
        persist();
        setDevice({ code, auto: true, lastRecvAt: A.now().toISOString() });
        save({ cursor: got.cursor, known: got.events.map(e => e.id), schema: SCHEMA });
        sync.status = 'ok';
        sync.at = A.now().toISOString();
        return 'ok';
    }
    catch {
        return 'hors-ligne';
    }
}
export function startAutoSync() {
    A.onChange = () => syncSoon();
    void syncNow();
    document.addEventListener('visibilitychange', () => { if (!document.hidden)
        void syncNow(); });
    addEventListener('online', () => { void syncNow(); });
    // Toutes les 20 s ; toutes les 5 s en mode magasin (deux personnes cochent la même liste en même temps).
    let tick = 0;
    window.setInterval(() => { tick++; if (!document.hidden && (A.ui.store || tick % 4 === 0))
        void syncNow(); }, 5000);
}
export function statusLabel() {
    switch (sync.status) {
        case 'ok': return 'à jour';
        case 'busy': return 'en cours…';
        case 'offline': return 'hors ligne';
        case 'error': return 'relais indisponible';
        default: return '';
    }
}
