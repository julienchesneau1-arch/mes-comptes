// Synchro automatique par relais : chaque téléphone dépose ses événements chiffrés et relève ceux de l'autre.
// Le relais (table Supabase) ne voit qu'une étiquette de foyer et des blocs chiffrés ; le code du foyer reste sur les téléphones.
// Étiquette et clé sont tirées du code par PBKDF2 avec deux sels distincts : connaître l'étiquette ne donne pas la clé.
import { type AnyEv, validEvent } from './model.ts';
import type { Occurrence } from './ical.ts';
import { type LocalDate, isDate } from './dates.ts';

export interface RelayConf { url: string; key: string }
export type Fetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const ITER = 210000;
const enc = new TextEncoder();
const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const norm = (c: string): string => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
const b64u = {
  enc(u8: Uint8Array): string { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(s: string): Uint8Array { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
};

async function pbkdf2(code: string, salt: string): Promise<ArrayBuffer> {
  const base = await crypto.subtle.importKey('raw', enc.encode(norm(code)), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITER }, base, 256);
}
export interface RelayKeys { tag: string; key: CryptoKey }
export async function relayKeys(code: string): Promise<RelayKeys> {
  const [t, k] = await Promise.all([pbkdf2(code, 'foyer-relais-etiquette-v1'), pbkdf2(code, 'foyer-relais-cle-v1')]);
  return { tag: hex(t), key: await crypto.subtle.importKey('raw', k, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']) };
}

const AAD = enc.encode('foyer-relais-v1');
async function pump(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const w = stream.writable.getWriter(); void w.write(data as Uint8Array<ArrayBuffer>); void w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
export async function sealEvents(k: RelayKeys, events: readonly AnyEv[]): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = await pump(enc.encode(JSON.stringify({ v: 1, events })), new CompressionStream('deflate-raw'));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, k.key, plain as Uint8Array<ArrayBuffer>));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64u.enc(out);
}
export async function openEvents(k: RelayKeys, blob: string): Promise<AnyEv[] | null> {
  try {
    const raw = b64u.dec(blob);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: AAD }, k.key, raw.slice(12)));
    const data = JSON.parse(new TextDecoder().decode(await pump(plain, new DecompressionStream('deflate-raw')))) as { events?: unknown };
    return Array.isArray(data.events) ? data.events.map(validEvent).filter((e): e is AnyEv => e !== null) : null;
  } catch { return null; } // bloc illisible (autre code, altéré) : ignoré
}

// Clé publique Supabase : la nouvelle clé « sb_publishable_ » va seule dans « apikey » ; une ancienne clé (jeton) va aussi dans Authorization.
export const relayHeaders = (c: RelayConf): Record<string, string> => ({ apikey: c.key, ...(c.key.split('.').length === 3 ? { Authorization: `Bearer ${c.key}` } : {}), 'Content-Type': 'application/json' });
const headers = (c: RelayConf, tag: string): Record<string, string> => ({ ...relayHeaders(c), 'x-foyer': tag });
export class RelayError extends Error { readonly status: number; constructor(status: number, m: string) { super(m); this.status = status; } }

/* ---------- Rappels (notifications) ---------- */
// Chaque rappel est chiffré avec la clé du foyer ; le service worker du téléphone le déchiffre (même format, sw.js).
const NOTE_AAD = enc.encode('foyer-rappel-v1');
export async function sealNote(key: CryptoKey, msg: { title: string; body: string }): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: NOTE_AAD }, key, enc.encode(JSON.stringify(msg))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64u.enc(out);
}
export async function openNote(key: CryptoKey, blob: string): Promise<{ title: string; body: string } | null> {
  try {
    const raw = b64u.dec(blob);
    const m = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: NOTE_AAD }, key, raw.slice(12)))) as { title?: unknown; body?: unknown };
    return typeof m.title === 'string' && typeof m.body === 'string' ? { title: m.title, body: m.body } : null;
  } catch { return null; }
}
// La liste complète remplace les rappels pas encore envoyés, sauf ceux des 10 prochaines minutes (jamais retirés au dernier moment).
export async function depositReminders(c: RelayConf, k: RelayKeys, list: readonly { rid: string; at: string; title: string; body: string }[], now: Date, f: Fetch): Promise<void> {
  const soon = new Date(now.getTime() + 10 * 60e3).toISOString();
  const keep = list.map(r => r.rid).join(',');
  const del = await f(`${c.url}/rest/v1/foyer_rappel?sent_at=is.null&at=gt.${encodeURIComponent(soon)}${keep ? `&rid=not.in.(${keep})` : ''}`,
    { method: 'DELETE', headers: { ...headers(c, k.tag), Prefer: 'return=minimal' } });
  if (!del.ok) throw new RelayError(del.status, `rappels : mise à jour refusée (${del.status})`);
  if (!list.length) return;
  const rows = await Promise.all(list.map(async r => ({ household: k.tag, rid: r.rid, at: r.at, blob: await sealNote(k.key, { title: r.title, body: r.body }) })));
  const ins = await f(`${c.url}/rest/v1/foyer_rappel?on_conflict=household,rid`, { method: 'POST', headers: { ...headers(c, k.tag), Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) });
  if (!ins.ok) throw new RelayError(ins.status, `rappels : dépôt refusé (${ins.status})`);
}
export async function subscribePush(c: RelayConf, k: RelayKeys, device: string, endpoint: string, f: Fetch): Promise<void> {
  const r = await f(`${c.url}/rest/v1/foyer_push?on_conflict=endpoint`, { method: 'POST', headers: { ...headers(c, k.tag), Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify([{ endpoint, household: k.tag, device }]) });
  if (!r.ok) throw new RelayError(r.status, `notifications : abonnement refusé (${r.status})`);
}
export async function unsubscribePush(c: RelayConf, k: RelayKeys, endpoint: string, f: Fetch): Promise<void> {
  const r = await f(`${c.url}/rest/v1/foyer_push?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', headers: { ...headers(c, k.tag), Prefer: 'return=minimal' } });
  if (!r.ok) throw new RelayError(r.status, `notifications : désabonnement refusé (${r.status})`);
}
// Clé publique VAPID du relais (créée au premier appel de la fonction foyer-push).
export async function vapidPublic(c: RelayConf, f: Fetch): Promise<string> {
  const r = await f(`${c.url}/functions/v1/foyer-push`, { method: 'POST', headers: relayHeaders(c), body: '{}' });
  const body = (await r.json()) as { pub?: unknown };
  if (!r.ok || typeof body.pub !== 'string' || !/^[A-Za-z0-9_-]{80,100}$/.test(body.pub)) throw new RelayError(r.status, 'notifications : clé du serveur indisponible');
  return body.pub;
}

// Agenda : la fonction foyer-agenda lit l'adresse iCal et ne renvoie que les événements de la période, revérifiés ici un à un.
export interface AgendaRead { occurrences: Occurrence[]; events: number; skipped: { title: string; why: string }[] }
const validOcc = (o: unknown): o is Occurrence => {
  if (typeof o !== 'object' || o === null) return false;
  const x = o as Record<string, unknown>;
  const days = x['days'];
  return typeof x['id'] === 'string' && /^[0-9a-f]{16}$/.test(x['id']) && typeof x['title'] === 'string' && x['title'].length <= 120
    && typeof x['allDay'] === 'boolean' && Number.isFinite(x['start']) && Number.isFinite(x['end']) && (x['end'] as number) >= (x['start'] as number)
    && (days === null || (Array.isArray(days) && days.length === 2 && isDate(days[0]) && isDate(days[1])))
    && typeof x['busy'] === 'boolean' && typeof x['recurring'] === 'boolean' && typeof x['tzGuess'] === 'boolean';
};
export async function readAgenda(c: RelayConf, url: string, from: LocalDate, to: LocalDate, cal: string, f: Fetch): Promise<AgendaRead> {
  const r = await f(`${c.url}/functions/v1/foyer-agenda`, { method: 'POST', headers: relayHeaders(c), body: JSON.stringify({ url, from, to, cal }) });
  const body = (await r.json().catch(() => ({}))) as { occurrences?: unknown; events?: unknown; skipped?: unknown; error?: unknown };
  if (!r.ok) throw new RelayError(r.status, typeof body.error === 'string' ? body.error.slice(0, 200) : `agenda illisible (${r.status})`);
  const occ = Array.isArray(body.occurrences) ? body.occurrences.slice(0, 3000) : [];
  const skipped = Array.isArray(body.skipped) ? body.skipped.filter((s): s is { title: string; why: string } =>
    typeof s === 'object' && s !== null && typeof (s as { title?: unknown }).title === 'string' && typeof (s as { why?: unknown }).why === 'string').slice(0, 20) : [];
  return { occurrences: occ.filter(validOcc), events: Number.isInteger(body.events) ? body.events as number : 0, skipped };
}

// Dépose les événements par paquets (un bloc chiffré par paquet). Idempotent côté téléphones : un événement reçu deux fois ne compte qu'une fois.
export async function push(c: RelayConf, k: RelayKeys, device: string, events: readonly AnyEv[], f: Fetch): Promise<number> {
  const rows: { household: string; device: string; blob: string }[] = [];
  for (let i = 0; i < events.length; i += 400) rows.push({ household: k.tag, device, blob: await sealEvents(k, events.slice(i, i + 400)) });
  if (!rows.length) return 0;
  const r = await f(`${c.url}/rest/v1/foyer_relais`, { method: 'POST', headers: { ...headers(c, k.tag), Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
  if (!r.ok) throw new RelayError(r.status, `relais : dépôt refusé (${r.status})`);
  return rows.length;
}

// Relève les blocs déposés depuis le dernier passage (curseur = dernier numéro lu).
// Une version plus ancienne a pu écarter des événements qu'elle ne savait pas lire, tout en avançant son curseur :
// après une mise à jour (autre liste de types), on relit tout. La fusion par identifiant rend cette relecture sans effet de bord.
export const resumeFrom = (cursor: number, readWith: string | undefined, schema: string): number => (readWith === schema ? cursor : 0);

export async function pull(c: RelayConf, k: RelayKeys, cursor: number, f: Fetch): Promise<{ events: AnyEv[]; cursor: number; unreadable: number }> {
  const events: AnyEv[] = [];
  let unreadable = 0;
  for (let page = 0; page < 50; page++) {
    const r = await f(`${c.url}/rest/v1/foyer_relais?select=seq,blob&seq=gt.${cursor}&order=seq.asc&limit=200`, { headers: headers(c, k.tag) });
    if (!r.ok) throw new RelayError(r.status, `relais : lecture refusée (${r.status})`);
    const rows = (await r.json()) as { seq: number; blob: string }[];
    if (!Array.isArray(rows)) throw new RelayError(500, 'relais : réponse inattendue');
    for (const row of rows) {
      const evs = typeof row.blob === 'string' ? await openEvents(k, row.blob) : null;
      if (evs) events.push(...evs); else unreadable++;
      if (Number.isInteger(row.seq) && row.seq > cursor) cursor = row.seq;
    }
    if (rows.length < 200) break;
  }
  return { events, cursor, unreadable };
}
