// VAPID (RFC 8292) : jeton ES256 qui prouve au service de notification (Apple, Google…) que l'envoi vient bien de Foyer.
// Fichier sans dépendance, testé dans Node (tests/push.test.ts) avec la cryptographie standard du navigateur.

export const b64u = (b: Uint8Array): string => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
const enc = new TextEncoder();

// Seules les adresses des services de notification connus sont contactées (jamais une adresse arbitraire).
export const PUSH_HOST = /^https:\/\/(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

export async function newKeys(): Promise<{ pub: string; priv: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  return { pub: b64u(raw), priv: JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)) };
}

export const signingKey = (priv: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('jwk', JSON.parse(priv) as JsonWebKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

// Jeton valable 12 h pour un service (aud = origine de l'adresse d'abonnement).
export async function vapidJwt(endpoint: string, key: CryptoKey, sub: string, now = Date.now()): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64u(sig)}`;
}

// En-têtes d'une notification vide (aucun contenu : le téléphone relit lui-même le rappel chiffré).
export const pushHeaders = (jwt: string, pub: string): Record<string, string> =>
  ({ TTL: '86400', Urgency: 'high', Authorization: `vapid t=${jwt}, k=${pub}`, 'Content-Length': '0' });
