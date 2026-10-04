// Synchro automatique par relais : chaque téléphone dépose ses événements chiffrés et relève ceux de l'autre.
// Le relais (table Supabase) ne voit qu'une étiquette de foyer et des blocs chiffrés ; le code du foyer reste sur les téléphones.
// Étiquette et clé sont tirées du code par PBKDF2 avec deux sels distincts : connaître l'étiquette ne donne pas la clé.
import { validEvent } from './model.js';
const ITER = 210000;
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const norm = (c) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
const b64u = {
    enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000)
        s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(s) { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++)
        u[i] = b.charCodeAt(i); return u; },
};
async function pbkdf2(code, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(norm(code)), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITER }, base, 256);
}
export async function relayKeys(code) {
    const [t, k] = await Promise.all([pbkdf2(code, 'foyer-relais-etiquette-v1'), pbkdf2(code, 'foyer-relais-cle-v1')]);
    return { tag: hex(t), key: await crypto.subtle.importKey('raw', k, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']) };
}
const AAD = enc.encode('foyer-relais-v1');
async function pump(data, stream) {
    const w = stream.writable.getWriter();
    void w.write(data);
    void w.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
export async function sealEvents(k, events) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = await pump(enc.encode(JSON.stringify({ v: 1, events })), new CompressionStream('deflate-raw'));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, k.key, plain));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return b64u.enc(out);
}
export async function openEvents(k, blob) {
    try {
        const raw = b64u.dec(blob);
        const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: AAD }, k.key, raw.slice(12)));
        const data = JSON.parse(new TextDecoder().decode(await pump(plain, new DecompressionStream('deflate-raw'))));
        return Array.isArray(data.events) ? data.events.map(validEvent).filter((e) => e !== null) : null;
    }
    catch {
        return null;
    } // bloc illisible (autre code, altéré) : ignoré
}
const headers = (c, tag) => ({ apikey: c.key, Authorization: `Bearer ${c.key}`, 'x-foyer': tag, 'Content-Type': 'application/json' });
export class RelayError extends Error {
    status;
    constructor(status, m) { super(m); this.status = status; }
}
// Dépose les événements par paquets (un bloc chiffré par paquet). Idempotent côté téléphones : un événement reçu deux fois ne compte qu'une fois.
export async function push(c, k, device, events, f) {
    const rows = [];
    for (let i = 0; i < events.length; i += 400)
        rows.push({ household: k.tag, device, blob: await sealEvents(k, events.slice(i, i + 400)) });
    if (!rows.length)
        return 0;
    const r = await f(`${c.url}/rest/v1/foyer_relais`, { method: 'POST', headers: { ...headers(c, k.tag), Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
    if (!r.ok)
        throw new RelayError(r.status, `relais : dépôt refusé (${r.status})`);
    return rows.length;
}
// Relève les blocs déposés depuis le dernier passage (curseur = dernier numéro lu).
export async function pull(c, k, cursor, f) {
    const events = [];
    let unreadable = 0;
    for (let page = 0; page < 50; page++) {
        const r = await f(`${c.url}/rest/v1/foyer_relais?select=seq,blob&seq=gt.${cursor}&order=seq.asc&limit=200`, { headers: headers(c, k.tag) });
        if (!r.ok)
            throw new RelayError(r.status, `relais : lecture refusée (${r.status})`);
        const rows = (await r.json());
        if (!Array.isArray(rows))
            throw new RelayError(500, 'relais : réponse inattendue');
        for (const row of rows) {
            const evs = typeof row.blob === 'string' ? await openEvents(k, row.blob) : null;
            if (evs)
                events.push(...evs);
            else
                unreadable++;
            if (Number.isInteger(row.seq) && row.seq > cursor)
                cursor = row.seq;
        }
        if (rows.length < 200)
            break;
    }
    return { events, cursor, unreadable };
}
