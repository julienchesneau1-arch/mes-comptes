// Persistance sur le téléphone. Le journal est écrit puis relu : un enregistrement ne compte que s'il est réellement là.
// Copies de secours dans IndexedDB (5 dernières), prises avant chaque fusion ou restauration.
import { validEvent } from '../core/model.js';
import { sortLog } from '../core/reduce.js';
const LOG = 'foyer:journal', DEVICE = 'foyer:appareil';
export function loadLog() {
    let raw = null;
    try {
        raw = localStorage.getItem(LOG);
    }
    catch { /* stockage indisponible (navigation privée) */ }
    if (!raw)
        return { log: [], dropped: 0 };
    let arr;
    try {
        arr = JSON.parse(raw);
    }
    catch {
        return { log: [], dropped: -1 };
    }
    if (!Array.isArray(arr))
        return { log: [], dropped: -1 };
    const log = [];
    let dropped = 0;
    for (const x of arr) {
        const e = validEvent(x);
        if (e)
            log.push(e);
        else
            dropped++;
    }
    return { log: sortLog(log), dropped };
}
export function saveLog(log) {
    const val = JSON.stringify(log);
    localStorage.setItem(LOG, val);
    if (localStorage.getItem(LOG) !== val)
        throw new Error('relecture différente après écriture');
}
export function loadDevice(newId) {
    let d = {};
    try {
        d = JSON.parse(localStorage.getItem(DEVICE) || '{}');
    }
    catch {
        d = {};
    }
    const dev = {
        dev: typeof d.dev === 'string' && /^[a-z0-9]{8,24}$/.test(d.dev) ? d.dev : newId(),
        me: typeof d.me === 'string' ? d.me : null,
        code: typeof d.code === 'string' ? d.code : null,
        lastSentLc: typeof d.lastSentLc === 'number' ? d.lastSentLc : 0,
        lastSentAt: typeof d.lastSentAt === 'string' ? d.lastSentAt : null,
        lastRecvAt: typeof d.lastRecvAt === 'string' ? d.lastRecvAt : null,
        theme: d.theme === 'light' || d.theme === 'dark' ? d.theme : 'auto',
        installHint: d.installHint === true,
        auto: d.auto !== false,
        push: d.push === true,
        pushHash: typeof d.pushHash === 'string' ? d.pushHash : '',
    };
    saveDevice(dev);
    return dev;
}
export function saveDevice(d) { try {
    localStorage.setItem(DEVICE, JSON.stringify(d));
}
catch { /* sans effet en navigation privée */ } }
export function wipe() { for (const k of [LOG, DEVICE, 'foyer:relais'])
    try {
        localStorage.removeItem(k);
    }
    catch { /* rien */ } }
let dbp = null;
const db = () => (dbp ??= new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('IndexedDB ne répond pas')), 5000);
    const r = indexedDB.open('foyer', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('copies', { keyPath: 'id' });
    r.onsuccess = () => { clearTimeout(t); res(r.result); };
    r.onerror = () => { clearTimeout(t); rej(r.error); };
}));
async function run(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => { const tx = d.transaction('copies', mode); const q = fn(tx.objectStore('copies')); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); });
}
export async function snapshot(log, reason) {
    if (!log.length)
        return;
    try {
        await run('readwrite', s => s.put({ id: Date.now(), reason, n: log.length, log: JSON.stringify(log) }));
        const all = (await run('readonly', s => s.getAll())).sort((a, b) => b.id - a.id);
        for (const x of all.slice(5))
            await run('readwrite', s => s.delete(x.id));
    }
    catch { /* pas de copie possible : l'app continue */ }
}
export async function snapshots() {
    try {
        return (await run('readonly', s => s.getAll())).sort((a, b) => b.id - a.id);
    }
    catch {
        return [];
    }
}
