// Synchro quasi instantanée : après chaque dépôt, un signal vide sur Supabase Realtime ; l'autre téléphone relève aussitôt.
// Ouvert seulement app visible et synchro automatique active ; coupé en arrière-plan (iOS ferme les connexions de toute façon).
// Refusé, hors ligne ou coupé : la relève toutes les 20 s (5 s en mode magasin) prend le relais, rien n'est perdu.
import { realtimeUrl, nudgeTopic, joinMsg, heartbeatMsg, nudgeMsg, hear, backoff } from '../core/nudge.ts';
import { relayKeys } from '../core/relay.ts';
import { RELAY } from './config.ts';
import { A } from './state.ts';
import { enabled, syncSoon, setAfterPush } from './autosync.ts';

export const live = { state: 'off' as 'off' | 'connecting' | 'on' | 'refused' };
let ws: WebSocket | null = null, topic = '', joinRef = '', ref = 0, tries = 0, hb = 0, retry = 0, forCode = '';
const next = (): string => String(++ref);

function close(): void {
  window.clearInterval(hb); window.clearTimeout(retry);
  if (ws) { ws.onclose = null; ws.onmessage = null; ws.onerror = null; try { ws.close(); } catch { /* déjà fermé */ } }
  ws = null; if (live.state !== 'refused') live.state = 'off';
}
async function open(): Promise<void> {
  const code = A.device.code;
  if (!RELAY || !code || !enabled() || document.hidden || typeof WebSocket !== 'function' || live.state === 'refused' || ws) return;
  forCode = code;
  topic = nudgeTopic((await relayKeys(code)).tag);
  live.state = 'connecting';
  const sock = new WebSocket(realtimeUrl(RELAY.url, RELAY.key));
  ws = sock;
  sock.onopen = () => { joinRef = next(); sock.send(joinMsg(topic, joinRef)); hb = window.setInterval(() => { if (sock.readyState === 1) sock.send(heartbeatMsg(next())); }, 25_000); };
  sock.onmessage = m => {
    const h = hear(m.data, topic, joinRef);
    if (h === 'joined') { live.state = 'on'; tries = 0; syncSoon(100); }            // rejoint : une relève tout de suite, au cas où
    else if (h === 'nudge') syncSoon(150);
    else if (h === 'refused') { live.state = 'refused'; close(); }                      // canal refusé par le serveur : la relève suffit
    else if (h === 'closed') { close(); later(); }
  };
  sock.onerror = () => { /* suivi d'un onclose */ };
  sock.onclose = () => { ws = null; window.clearInterval(hb); if (live.state !== 'refused') { live.state = 'off'; later(); } };
}
function later(): void { window.clearTimeout(retry); retry = window.setTimeout(() => { void open(); }, backoff(tries++)); }

// Après un dépôt réussi : prévenir l'autre téléphone (rien si la connexion n'est pas prête : il relèvera dans les 20 s).
function nudge(): void { if (ws && ws.readyState === 1 && live.state === 'on') ws.send(nudgeMsg(topic, next(), joinRef)); }

export function startLive(): void {
  setAfterPush(nudge);
  void open();
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); else { tries = 0; void open(); } });
  addEventListener('online', () => { tries = 0; void open(); });
  // Code du foyer changé, synchro coupée puis remise : on suit, sans rien relancer d'autre.
  window.setInterval(() => { if (ws && (!enabled() || A.device.code !== forCode)) close(); else if (!ws && enabled() && !document.hidden) void open(); }, 15_000);
}
