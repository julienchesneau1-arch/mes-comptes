// Persistance sur le téléphone. Le journal est écrit puis relu : un enregistrement ne compte que s'il est réellement là.
// Copies de secours dans IndexedDB (5 dernières), prises avant chaque fusion ou restauration.
import { type AnyEv, validEvent } from '../core/model.ts';
import { sortLog } from '../core/reduce.ts';

const LOG = 'foyer:journal', DEVICE = 'foyer:appareil';

export interface Device {
  dev: string;               // identifiant de ce téléphone
  me: string | null;         // membre qui utilise ce téléphone
  code: string | null;       // code du foyer (chiffrement des liens)
  lastSentLc: number;        // dernier événement local inclus dans un lien envoyé
  lastSentAt: string | null;
  lastRecvAt: string | null;
  theme: 'auto' | 'light' | 'dark';
  installHint: boolean;      // conseil d'installation iPhone déjà vu
  auto: boolean;             // synchro automatique par le relais (si disponible)
}

export function loadLog(): { log: AnyEv[]; dropped: number } {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LOG); } catch { /* stockage indisponible (navigation privée) */ }
  if (!raw) return { log: [], dropped: 0 };
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return { log: [], dropped: -1 }; }
  if (!Array.isArray(arr)) return { log: [], dropped: -1 };
  const log: AnyEv[] = [];
  let dropped = 0;
  for (const x of arr) { const e = validEvent(x); if (e) log.push(e); else dropped++; }
  return { log: sortLog(log), dropped };
}

export function saveLog(log: readonly AnyEv[]): void {
  const val = JSON.stringify(log);
  localStorage.setItem(LOG, val);
  if (localStorage.getItem(LOG) !== val) throw new Error('relecture différente après écriture');
}

export function loadDevice(newId: () => string): Device {
  let d: Partial<Device> = {};
  try { d = JSON.parse(localStorage.getItem(DEVICE) || '{}') as Partial<Device>; } catch { d = {}; }
  const dev: Device = {
    dev: typeof d.dev === 'string' && /^[a-z0-9]{8,24}$/.test(d.dev) ? d.dev : newId(),
    me: typeof d.me === 'string' ? d.me : null,
    code: typeof d.code === 'string' ? d.code : null,
    lastSentLc: typeof d.lastSentLc === 'number' ? d.lastSentLc : 0,
    lastSentAt: typeof d.lastSentAt === 'string' ? d.lastSentAt : null,
    lastRecvAt: typeof d.lastRecvAt === 'string' ? d.lastRecvAt : null,
    theme: d.theme === 'light' || d.theme === 'dark' ? d.theme : 'auto',
    installHint: d.installHint === true,
    auto: d.auto !== false,
  };
  saveDevice(dev);
  return dev;
}
export function saveDevice(d: Device): void { try { localStorage.setItem(DEVICE, JSON.stringify(d)); } catch { /* sans effet en navigation privée */ } }

export function wipe(): void { for (const k of [LOG, DEVICE, 'foyer:relais']) try { localStorage.removeItem(k); } catch { /* rien */ } }

/* ---------- Copies de secours (IndexedDB) ---------- */
interface Snap { id: number; reason: string; n: number; log: string }
let dbp: Promise<IDBDatabase> | null = null;
const db = (): Promise<IDBDatabase> => (dbp ??= new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('IndexedDB ne répond pas')), 5000);
  const r = indexedDB.open('foyer', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('copies', { keyPath: 'id' });
  r.onsuccess = () => { clearTimeout(t); res(r.result); };
  r.onerror = () => { clearTimeout(t); rej(r.error); };
}));
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const tx = d.transaction('copies', mode); const q = fn(tx.objectStore('copies')); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); });
}
export async function snapshot(log: readonly AnyEv[], reason: string): Promise<void> {
  if (!log.length) return;
  try {
    await run('readwrite', s => s.put({ id: Date.now(), reason, n: log.length, log: JSON.stringify(log) } satisfies Snap));
    const all = (await run<Snap[]>('readonly', s => s.getAll())).sort((a, b) => b.id - a.id);
    for (const x of all.slice(5)) await run('readwrite', s => s.delete(x.id));
  } catch { /* pas de copie possible : l'app continue */ }
}
export async function snapshots(): Promise<Snap[]> {
  try { return (await run<Snap[]>('readonly', s => s.getAll())).sort((a, b) => b.id - a.id); } catch { return []; }
}
