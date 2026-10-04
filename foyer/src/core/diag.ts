// Diagnostic du téléphone : ce que Foyer peut utiliser ici et ce que chaque manque change. Détection de fonctions, rien de deviné.
export interface Env {
  standalone: boolean;          // ouverte depuis l'écran d'accueil
  ios: string | null;           // « 17.5 » si le navigateur l'indique, sinon null
  crypto: boolean; compression: boolean; dialog: boolean; serviceWorker: boolean;
  wakeLock: boolean; push: boolean;
  notifications: 'granted' | 'denied' | 'default' | 'absent';
  persisted: boolean | null;    // null : le navigateur ne le dit pas
}
export interface Check { label: string; ok: boolean | null; detail: string }

// « CPU iPhone OS 17_5 like Mac OS X » → « 17.5 ». Les iPad récents se présentent comme un Mac : pas de version lisible.
export function iosVersion(ua: string): string | null {
  const m = /(?:iPhone|iPad|iPod)[^)]*? OS (\d+)_(\d+)/.exec(ua);
  return m ? `${m[1]}.${m[2]}` : null;
}
const atLeast = (v: string, min: [number, number]): boolean => {
  const [a = 0, b = 0] = v.split('.').map(Number);
  return a > min[0] || (a === min[0] && b >= min[1]);
};

export function diagnose(e: Env): Check[] {
  const notif = e.notifications === 'granted' ? 'autorisées' : e.notifications === 'denied' ? 'refusées (Réglages de l\'iPhone › Notifications › Foyer)' : e.notifications === 'default' ? 'pas encore demandées' : 'absentes';
  return [
    { label: 'Version d\'iOS', ok: e.ios ? atLeast(e.ios, [16, 4]) : null,
      detail: e.ios ? `iOS ${e.ios}${atLeast(e.ios, [16, 4]) ? '' : ' : 16.4 ou plus récent est nécessaire (liens de synchro, écran allumé, notifications)'}` : 'non lisible ici (pas un iPhone, ou iPad présenté comme un Mac)' },
    { label: 'Installée sur l\'écran d\'accueil', ok: e.standalone,
      detail: e.standalone ? 'iOS garde les données de l\'app' : 'dans Safari, iOS peut effacer les données d\'un site peu ouvert. Partager → « Sur l\'écran d\'accueil »' },
    { label: 'Chiffrement', ok: e.crypto, detail: e.crypto ? 'disponible' : 'absent : synchro impossible (page non sécurisée ?)' },
    { label: 'Compression', ok: e.compression, detail: e.compression ? 'disponible' : 'absente : liens de synchro et relais impossibles' },
    { label: 'Fenêtres de l\'app', ok: e.dialog, detail: e.dialog ? 'disponibles' : 'absentes : navigateur trop ancien' },
    { label: 'Hors ligne', ok: e.serviceWorker, detail: e.serviceWorker ? 'l\'app s\'ouvre sans réseau' : 'pas encore actif : rouvrir l\'app une fois avec du réseau' },
    { label: 'Écran allumé', ok: e.wakeLock, detail: e.wakeLock ? 'mode magasin et mode cuisine gardent l\'écran allumé' : 'non pris en charge : l\'écran peut s\'éteindre en cuisine' },
    { label: 'Notifications', ok: e.push ? e.notifications !== 'denied' : false,
      detail: e.push ? `possibles ; ${notif}` : e.ios && !e.standalone ? 'seulement une fois Foyer installée sur l\'écran d\'accueil (iOS 16.4+)' : 'non prises en charge par ce navigateur' },
    { label: 'Stockage protégé', ok: e.persisted,
      detail: e.persisted === true ? 'le navigateur s\'engage à garder les données' : e.persisted === false ? 'non garanti : gardez une sauvegarde ou la synchro active' : 'le navigateur ne l\'indique pas' },
  ];
}

export const diagText = (checks: readonly Check[]): string =>
  ['Diagnostic Foyer', ...checks.map(c => `${c.ok === true ? '✓' : c.ok === false ? '✗' : '–'} ${c.label} : ${c.detail}`)].join('\n');
