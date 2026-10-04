// Synchro automatique : relève au démarrage, au retour dans l'app, toutes les 20 s quand l'app est visible ; dépose après chaque changement.
// Hors ligne ou relais indisponible : rien n'est perdu, l'app continue en local et le lien chiffré reste disponible.
import { type RelayKeys, relayKeys, push, pull, RelayError, type Fetch } from '../core/relay.ts';
import { merge, SyncError } from '../core/sync.ts';
import { openConflicts } from '../core/reduce.ts';
import { RELAY } from './config.ts';
import { A, S, setLog, persist, setDevice } from './state.ts';
import { toast } from './dom.ts';

const KEY = 'foyer:relais';
interface Mem { cursor: number; known: string[] }
const load = (): Mem => { try { const m = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Mem>; return { cursor: Number(m.cursor) || 0, known: Array.isArray(m.known) ? m.known.filter(x => typeof x === 'string') : [] }; } catch { return { cursor: 0, known: [] }; } };
const save = (m: Mem): void => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* rien */ } };
export const forgetRelay = (): void => { try { localStorage.removeItem(KEY); } catch { /* rien */ } };

export type Status = 'off' | 'idle' | 'busy' | 'ok' | 'offline' | 'error';
export const sync = { status: 'off' as Status, at: null as string | null, error: '' };
let keys: { code: string; k: RelayKeys } | null = null;
let running: Promise<void> | null = null;
let again = false;
let timer = 0;
const f = ((u: string, i?: RequestInit) => fetch(u, i)) as unknown as Fetch;

export const available = (): boolean => !!RELAY;
export const enabled = (): boolean => !!RELAY && !!A.device.code && A.device.auto && !A.demo && !!S().hid;

async function keysFor(code: string): Promise<RelayKeys> {
  if (!keys || keys.code !== code) keys = { code, k: await relayKeys(code) };
  return keys.k;
}

export function syncSoon(delay = 800): void {
  if (!enabled()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { void syncNow(); }, delay);
}

export async function syncNow(): Promise<void> {
  if (!enabled() || !RELAY) { sync.status = 'off'; return; }
  if (running) { again = true; return running; }
  running = (async () => {
    sync.status = 'busy';
    const conf = RELAY as NonNullable<typeof RELAY>;
    try {
      const k = await keysFor(A.device.code as string);
      const mem = load();
      const got = await pull(conf, k, mem.cursor, f);
      const known = new Set(mem.known);
      for (const e of got.events) known.add(e.id);
      if (got.events.length) {
        const conflictsBefore = openConflicts(A.r).length;
        const m = merge(A.log, S().hid, { app: 'foyer', v: 1, hid: S().hid ?? '', from: 'relais', sent: '', events: got.events });
        if (m.added) {
          setLog(m.log); persist(); setDevice({ lastRecvAt: A.now().toISOString() }); A.render();
          const c = openConflicts(A.r).length - conflictsBefore;
          if (c > 0) toast(`${c} changement${c > 1 ? 's' : ''} de l'autre téléphone n'a pas pu s'appliquer : voir Aujourd'hui`);
        }
      }
      const fresh = A.log.filter(e => !known.has(e.id));
      if (fresh.length) { await push(conf, k, A.device.dev, fresh, f); for (const e of fresh) known.add(e.id); setDevice({ lastSentLc: A.r.maxLc, lastSentAt: A.now().toISOString() }); }
      save({ cursor: got.cursor, known: [...known] });
      sync.status = 'ok'; sync.at = A.now().toISOString(); sync.error = '';
    } catch (e) {
      sync.status = e instanceof RelayError ? 'error' : 'offline';
      sync.error = e instanceof Error ? e.message : String(e);
      if (e instanceof SyncError && e.code === 'foyer') sync.error = 'Le relais contient un autre foyer pour ce code';
    } finally {
      running = null;
      A.render();
      if (again) { again = false; syncSoon(1500); }
    }
  })();
  return running;
}

// Nouveau téléphone : le code seul suffit à retrouver le foyer sur le relais.
export async function joinWithCode(code: string): Promise<'ok' | 'introuvable' | 'hors-ligne'> {
  if (!RELAY) return 'hors-ligne';
  try {
    const k = await keysFor(code);
    const got = await pull(RELAY, k, 0, f);
    const init = got.events.find(e => e.t === 'household.init');
    if (!init || init.t !== 'household.init') return 'introuvable';
    const m = merge([], null, { app: 'foyer', v: 1, hid: init.p.hid, from: 'relais', sent: '', events: got.events });
    setLog(m.log); persist();
    setDevice({ code, auto: true, lastRecvAt: A.now().toISOString() });
    save({ cursor: got.cursor, known: got.events.map(e => e.id) });
    sync.status = 'ok'; sync.at = A.now().toISOString();
    return 'ok';
  } catch { return 'hors-ligne'; }
}

export function startAutoSync(): void {
  A.onChange = () => syncSoon();
  void syncNow();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void syncNow(); });
  addEventListener('online', () => { void syncNow(); });
  window.setInterval(() => { if (!document.hidden) void syncNow(); }, 20000);
}

export function statusLabel(): string {
  switch (sync.status) {
    case 'ok': return 'à jour';
    case 'busy': return 'en cours…';
    case 'offline': return 'hors ligne';
    case 'error': return 'relais indisponible';
    default: return '';
  }
}
