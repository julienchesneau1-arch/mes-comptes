// Rappels en notifications : activés à la demande, par téléphone. Les rappels partent chiffrés au relais ; à l'heure dite le
// serveur envoie une notification vide et le service worker affiche le rappel déchiffré (sw.js). Sans relais : rien ne part.
import { relayKeys, depositReminders, subscribePush, unsubscribePush, vapidPublic } from '../core/relay.js';
import { remindersFor, reminderId } from '../core/reminders.js';
import { RELAY } from './config.js';
import { A, S, setDevice } from './state.js';
const f = ((u, i) => fetch(u, i));
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification === 'function';
export const pushOn = () => !!RELAY && A.device.push && !!A.device.code && !A.demo;
// Configuration lue par le service worker (la clé reste non exportable : rangée telle quelle dans IndexedDB).
function store(mode, fn) {
    return new Promise((resolve, reject) => {
        const o = indexedDB.open('foyer-push', 1);
        o.onupgradeneeded = () => o.result.createObjectStore('kv');
        o.onerror = () => reject(o.error);
        o.onsuccess = () => { const tx = o.result.transaction('kv', mode); fn(tx.objectStore('kv')); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); };
    });
}
// Renvoie null si c'est fait, sinon la raison (affichée telle quelle).
export async function enablePush() {
    if (!RELAY || !A.device.code)
        return 'Il faut d\'abord la synchro automatique (code du foyer).';
    if (!pushSupported())
        return 'Ce navigateur ne reçoit pas de notifications. Sur iPhone : installer Foyer sur l\'écran d\'accueil (iOS 16.4 ou plus).';
    if (await Notification.requestPermission() !== 'granted')
        return 'Notifications refusées. Pour changer d\'avis : Réglages de l\'iPhone › Notifications › Foyer.';
    try {
        const k = await relayKeys(A.device.code);
        const pub = await vapidPublic(RELAY, f);
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(pub) }));
        await subscribePush(RELAY, k, A.device.dev, sub.endpoint, f);
        await store('readwrite', s => s.put({ url: RELAY?.url, apikey: RELAY?.key, tag: k.tag, key: k.key }, 'conf'));
        setDevice({ push: true, pushHash: '' });
        await syncReminders(true);
        return null;
    }
    catch (e) {
        return `Activation impossible : ${e instanceof Error ? e.message : String(e)}`;
    }
}
export async function disablePush() {
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub && RELAY && A.device.code)
            await unsubscribePush(RELAY, await relayKeys(A.device.code), sub.endpoint, f).catch(() => undefined);
        await sub?.unsubscribe();
    }
    catch { /* hors ligne : l'abonnement périmé sera retiré par le serveur */ }
    await store('readwrite', s => s.delete('conf')).catch(() => undefined);
    setDevice({ push: false, pushHash: '' });
}
// Effacement du téléphone : plus rien ne doit s'afficher ni rester rangé.
export async function forgetPush() {
    if (A.device.push)
        await disablePush();
    try {
        indexedDB.deleteDatabase('foyer-push');
    }
    catch { /* rien */ }
}
// Dépose les rappels des 8 prochains jours s'ils ont changé (ou toujours si force). Silencieux en cas d'échec : on réessaiera.
let extra = [];
export async function syncReminders(force = false) {
    if (!pushOn() || !RELAY)
        return false;
    const now = A.now();
    extra = extra.filter(r => Date.parse(r.at) > now.getTime() - 60e3);
    const list = [...remindersFor(S(), now), ...extra];
    // + l'heure en cours : redépôt au moins une fois par heure (un téléphone pas encore synchronisé a pu retirer nos rappels).
    const hash = `${list.map(r => r.rid).join(',')}@${Math.floor(now.getTime() / 3600e3)}`;
    if (!force && hash === A.device.pushHash)
        return true;
    try {
        await depositReminders(RELAY, await relayKeys(A.device.code), list, now, f);
        setDevice({ pushHash: hash });
        return true;
    }
    catch {
        return false;
    }
}
// Rappel d'essai dans les minutes qui suivent (le serveur passe toutes les 5 minutes).
export async function testReminder() {
    const at = new Date(A.now().getTime() + 60e3).toISOString();
    const title = '🔔 Essai Foyer', body = 'Les rappels arrivent bien sur ce téléphone.';
    extra.push({ rid: reminderId(`essai-${at}`, at, title, body), at, title, body });
    return syncReminders(true);
}
let timer = 0;
export function startReminders() {
    const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { void syncReminders(); }, 3000); };
    const prev = A.onChange;
    A.onChange = () => { prev(); soon(); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden)
        soon(); });
    window.setInterval(() => { if (!document.hidden)
        soon(); }, 10 * 60e3); // changements reçus de l'autre téléphone
    soon();
}
