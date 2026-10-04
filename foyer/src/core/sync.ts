// Synchro entre les téléphones du foyer : le journal complet, compressé puis chiffré (AES-GCM 256, clé PBKDF2 du code du foyer),
// envoyé comme un lien par message. Fusion = union des événements par identifiant, puis rejeu : même résultat des deux côtés.
// Le code du foyer ne voyage jamais dans le lien.
import { type AnyEv, validEvent } from './model.ts';
import { sortLog } from './reduce.ts';

export const PREFIX = 'F1.';
const ITER = 210000;
const AAD = new TextEncoder().encode('foyer-sync-v1');

export interface Bundle { app: 'foyer'; v: 1; hid: string; from: string; sent: string; events: AnyEv[] }

export class SyncError extends Error {
  readonly code: 'format' | 'code' | 'foyer' | 'taille';
  constructor(code: 'format' | 'code' | 'foyer' | 'taille', message: string) { super(message); this.code = code; }
}

const b64u = {
  enc(u8: Uint8Array): string { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(s: string): Uint8Array { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
};

async function pump(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const w = stream.writable.getWriter();
  void w.write(data as Uint8Array<ArrayBuffer>); void w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
const deflate = (s: string) => pump(new TextEncoder().encode(s), new CompressionStream('deflate-raw'));
const inflate = async (u: Uint8Array) => new TextDecoder().decode(await pump(u, new DecompressionStream('deflate-raw')));

// Code du foyer : 12 signes sans 0/O ni 1/I, facile à dicter (« ABCD-EFGH-JKLM »).
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normCode = (c: string): string => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const fmtCode = (c: string): string => normCode(c).replace(/(.{4})(?=.)/g, '$1-');
export const validCode = (c: string): boolean => /^[A-HJ-NP-Z2-9]{12}$/.test(normCode(c));
export function newCode(): string { const b = crypto.getRandomValues(new Uint8Array(12)); return fmtCode([...b].map(x => CODE_ALPHA[x & 31]).join('')); }

async function key(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normCode(code)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(b: Bundle, code: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = await deflate(JSON.stringify(b));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await key(code, salt), plain as Uint8Array<ArrayBuffer>));
  const out = new Uint8Array(28 + ct.length);
  out.set(salt, 0); out.set(iv, 16); out.set(ct, 28);
  return PREFIX + b64u.enc(out);
}

// Retrouve le contenu chiffré dans un lien collé ou un message entier.
export function extractSealed(text: string): string | null {
  const m = /(?:#s=)?(F1\.[A-Za-z0-9_-]{40,})/.exec(text);
  return m ? (m[1] as string) : null;
}

export async function open(sealed: string, code: string): Promise<Bundle> {
  if (!sealed.startsWith(PREFIX)) throw new SyncError('format', 'Ce n\'est pas un lien Foyer');
  if (sealed.length > 12_000_000) throw new SyncError('taille', 'Lien trop volumineux');
  let raw: Uint8Array;
  try { raw = b64u.dec(sealed.slice(PREFIX.length)); } catch { throw new SyncError('format', 'Lien abîmé (incomplet ?)'); }
  if (raw.length < 29) throw new SyncError('format', 'Lien abîmé (incomplet ?)');
  let plain: Uint8Array;
  try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(16, 28), additionalData: AAD }, await key(code, raw.slice(0, 16)), raw.slice(28))); }
  catch { throw new SyncError('code', 'Code du foyer incorrect, ou lien abîmé'); }
  let data: unknown;
  try { data = JSON.parse(await inflate(plain)); } catch { throw new SyncError('format', 'Contenu illisible'); }
  return checkBundle(data);
}

export function checkBundle(data: unknown): Bundle {
  const d = data as Partial<Bundle> | null;
  if (!d || d.app !== 'foyer' || d.v !== 1 || typeof d.hid !== 'string' || !Array.isArray(d.events) || typeof d.from !== 'string')
    throw new SyncError('format', 'Ce n\'est pas un journal Foyer');
  if (d.events.length > 100000) throw new SyncError('taille', 'Journal trop volumineux');
  return { app: 'foyer', v: 1, hid: d.hid, from: d.from, sent: typeof d.sent === 'string' ? d.sent : '', events: d.events };
}

export interface Merge { log: AnyEv[]; added: number; invalid: number }
// Union par identifiant. Tout événement reçu est revalidé ; un autre foyer est refusé en bloc.
export function merge(local: readonly AnyEv[], localHid: string | null, incoming: Bundle): Merge {
  if (localHid && incoming.hid !== localHid) throw new SyncError('foyer', 'Ce lien vient d\'un autre foyer');
  const ids = new Set(local.map(e => e.id));
  const added: AnyEv[] = [];
  let invalid = 0;
  for (const x of incoming.events) {
    const e = validEvent(x);
    if (!e) { invalid++; continue; }
    if (ids.has(e.id)) continue;
    ids.add(e.id); added.push(e);
  }
  if (!localHid && !added.some(e => e.t === 'household.init' && e.p.hid === incoming.hid)) throw new SyncError('format', 'Journal sans création du foyer');
  return { log: sortLog([...local, ...added]), added: added.length, invalid };
}

/* ---------- Sauvegarde fichier (JSON lisible, restaurable sur un autre appareil) ---------- */

export function exportBackup(log: readonly AnyEv[], hid: string, dev: string, now: Date): string {
  return JSON.stringify({ app: 'foyer', v: 1, kind: 'sauvegarde', hid, from: dev, sent: now.toISOString(), events: [...log] } satisfies Bundle & { kind: string });
}
export function readBackup(text: string): Bundle {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new SyncError('format', 'Fichier illisible'); }
  return checkBundle(data);
}
