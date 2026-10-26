// Signal « relève maintenant » entre les téléphones du foyer, par Supabase Realtime (diffusion, protocole Phoenix v1 en JSON).
// Le signal est vide : les données restent chiffrées dans le relais, que l'autre téléphone relève aussitôt. Canal tiré de
// l'étiquette du relais (déjà connue du serveur) ; un signal reçu à tort ne fait qu'une relève de plus.
export const realtimeUrl = (relayUrl: string, key: string): string =>
  `${relayUrl.replace(/^https:/, 'wss:').replace(/\/$/, '')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;
export const nudgeTopic = (tag: string): string => `realtime:foyer-${tag.slice(0, 32)}`;

export interface PhxMsg { topic: string; event: string; payload: unknown; ref: string | null; join_ref?: string | null }
export const joinMsg = (topic: string, ref: string): string => JSON.stringify({ topic, event: 'phx_join', ref, join_ref: ref,
  payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false } } });
export const heartbeatMsg = (ref: string): string => JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref });
export const nudgeMsg = (topic: string, ref: string, joinRef: string): string =>
  JSON.stringify({ topic, event: 'broadcast', payload: { type: 'broadcast', event: 'nudge', payload: {} }, ref, join_ref: joinRef });

// Ce qu'un message reçu signifie pour Foyer ; tout le reste est ignoré.
export type Heard = 'joined' | 'refused' | 'nudge' | 'closed' | null;
export function hear(raw: unknown, topic: string, joinRef: string): Heard {
  let m: Partial<PhxMsg>;
  try { m = typeof raw === 'string' ? JSON.parse(raw) as Partial<PhxMsg> : {}; } catch { return null; }
  if (m.topic !== topic) return null;
  const p = (typeof m.payload === 'object' && m.payload !== null ? m.payload : {}) as Record<string, unknown>;
  if (m.event === 'phx_reply' && m.ref === joinRef) return p['status'] === 'ok' ? 'joined' : 'refused';
  if (m.event === 'broadcast' && p['event'] === 'nudge') return 'nudge';
  if (m.event === 'phx_close' || m.event === 'phx_error' || m.event === 'system' && p['status'] === 'error') return 'closed';
  return null;
}
// Reprise après coupure : 2 s, 4 s, 8 s… plafonnée à une minute.
export const backoff = (tries: number): number => Math.min(60_000, 2000 * 2 ** Math.max(0, tries));
