// Contrôle du signal temps réel sur le vrai relais (Supabase Realtime) : deux connexions rejoignent un canal d'essai, l'une envoie
// le signal vide de Foyer, l'autre doit le recevoir. Mêmes messages que l'app (src/core/nudge.ts). Lancé par la CI (réseau ouvert).
import { realtimeUrl, joinMsg, nudgeMsg, hear } from '../src/core/nudge.ts';
import { RELAY } from '../src/ui/config.ts';

if (!RELAY) { console.log('pas de relais configuré'); process.exit(0); }
const topic = `realtime:foyer-essai-${Math.random().toString(36).slice(2, 12)}`;
const join = name => new Promise((resolve, reject) => {
  const ws = new WebSocket(realtimeUrl(RELAY.url, RELAY.key));
  const t = setTimeout(() => reject(new Error(`${name} : pas de réponse en 10 s`)), 10_000);
  ws.onopen = () => ws.send(joinMsg(topic, '1'));
  ws.onmessage = m => { const h = hear(m.data, topic, '1'); if (h === 'joined' || h === 'refused') { clearTimeout(t); h === 'joined' ? resolve(ws) : reject(new Error(`${name} : canal refusé ${m.data}`)); } };
  ws.onerror = () => { clearTimeout(t); reject(new Error(`${name} : connexion impossible`)); };
});
try {
  const a = await join('A'), b = await join('B');
  const t0 = Date.now();
  const got = new Promise(r => { b.onmessage = m => { if (hear(m.data, topic, '1') === 'nudge') r(Date.now() - t0); }; });
  a.send(nudgeMsg(topic, '2', '1'));
  const ms = await Promise.race([got, new Promise(r => setTimeout(() => r(null), 8000))]);
  a.close(); b.close();
  if (ms === null) { console.log('✗ signal non reçu en 8 s'); process.exit(1); }
  console.log(`✓ signal reçu en ${ms} ms par l'autre connexion`);
  process.exit(0);
} catch (e) { console.log(`✗ ${e.message}`); process.exit(1); }
