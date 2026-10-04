// Réglages : membres, rythme, semaine, synchro par lien chiffré, sauvegarde/restauration, copies de secours, thème.
import { type Presence, type Member, type RhythmDay, defaultRhythm } from '../../core/model.ts';
import { seal, open, merge, extractSealed, exportBackup, readBackup, SyncError, fmtCode, validCode, normCode, newCode } from '../../core/sync.ts';
import { newId, openConflicts } from '../../core/reduce.ts';
import { fmtDayShort, paris } from '../../core/dates.ts';
import { A, S, dispatch, setDevice, setLog, persist, unsent, memberName, otherNames } from '../state.ts';
import { snapshot, snapshots, wipe } from '../store.ts';
import { openSheet, sheetHead, closeSheet, esc, toast, saveFile } from '../dom.ts';
import { orderedAisles } from '../../core/shopping.ts';
import { available as relayAvailable, enabled as autoOn, syncNow, sync as autoSync, statusLabel, joinWithCode, forgetRelay } from '../autosync.ts';
import { CLICK, CHANGE, SUBMIT, num } from '../registry.ts';
import { type Env, diagnose, diagText, iosVersion } from '../../core/diag.ts';
import { enablePush, disablePush, forgetPush, testReminder } from '../push.ts';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const PRES: Record<Presence, string> = { maison: 'Maison', boite: 'Boîte', dehors: 'Dehors' };
const ago = (iso: string | null): string => { if (!iso) return 'jamais'; const p = paris(new Date(iso)); return `${fmtDayShort(p.date)} à ${String(p.hour).padStart(2, '0')} h ${String(p.minute).padStart(2, '0')}`; };

/* ---------- Membres et rythme ---------- */
CLICK['members'] = () => openSheet({ id: 'members', render: () => {
  const s = S();
  return `${sheetHead('Membres du foyer', 'Un membre ne peut pas être retiré (l\'historique y fait référence) ; il peut être renommé.')}
  <form data-f="membersSave" class="stack">${s.members.map((m, i) => `<label class="field">Prénom ${i + 1}<input type="text" name="m-${m.id}" maxlength="40" required value="${esc(m.name)}"></label>`).join('')}
  ${s.members.length < 6 ? '<label class="field">Ajouter un membre (facultatif)<input type="text" name="new" maxlength="40" placeholder="Prénom"></label>' : ''}
  <fieldset><legend>Qui utilise ce téléphone ?</legend><div class="seg" role="radiogroup" aria-label="Qui utilise ce téléphone">${s.members.map(m => `<label><input type="radio" name="me" value="${m.id}" ${A.device.me === m.id ? 'checked' : ''}>${esc(m.name)}</label>`).join('')}</div></fieldset>
  <button class="btn">Enregistrer</button></form>`;
} });
SUBMIT['membersSave'] = data => {
  const s = S();
  const members: Member[] = s.members.map(m => ({ id: m.id, name: String(data.get(`m-${m.id}`) ?? m.name).trim().slice(0, 40) || m.name }));
  const add = String(data.get('new') ?? '').trim().slice(0, 40);
  const drafts = [];
  if (add) {
    const id = newId(8);
    members.push({ id, name: add });
    const rhythm = s.settings.rhythm.map(d => ({ midi: { ...d.midi, [id]: 'maison' as Presence }, soir: { ...d.soir, [id]: 'maison' as Presence } }));
    drafts.push({ t: 'settings.set' as const, p: { rhythm } });
  }
  const me = String(data.get('me') ?? '');
  if (me) setDevice({ me });
  closeSheet();
  dispatch([{ t: 'members.set', p: { members } }, ...drafts], { toast: 'Membres enregistrés' });
};

let rhythm: RhythmDay[] = [];
CLICK['rhythm'] = () => { rhythm = structuredClone(S().settings.rhythm); openSheet({ id: 'rhythm', render: rhythmHtml }); };
function rhythmHtml(): string {
  const s = S();
  return `${sheetHead('Notre rythme habituel', 'Un choix explicite, pas une déduction : il sert de base à chaque semaine. Les exceptions se changent sur le créneau.')}
  <div class="chips"><button class="tag" data-a="rhPreset" data-p="tout">Tous à la maison midi et soir</button>
    <button class="tag" data-a="rhPreset" data-p="dehors">Midi dehors en semaine</button>
    <button class="tag" data-a="rhPreset" data-p="boite">Midi en boîte en semaine</button></div>
  ${rhythm.map((d, i) => `<details ${i === 0 ? 'open' : ''}><summary>${DAYS[i]} · midi : ${esc(summary(d.midi))} · soir : ${esc(summary(d.soir))}</summary><div class="stack">
    ${(['midi', 'soir'] as const).map(sl => s.members.map(m => `<div class="person"><span>${sl === 'midi' ? 'Midi' : 'Soir'} · ${esc(m.name)}</span><div class="seg" role="radiogroup" aria-label="${DAYS[i]} ${sl}, ${esc(m.name)}">
      ${(['maison', 'boite', 'dehors'] as Presence[]).map(p => `<label><input type="radio" name="rh-${i}-${sl}-${m.id}" value="${p}" data-c="rhSet" data-day="${i}" data-sl="${sl}" data-m="${m.id}" ${(d[sl][m.id] ?? 'maison') === p ? 'checked' : ''}>${PRES[p]}</label>`).join('')}</div></div>`).join('')).join('')}
  </div></details>`).join('')}
  <label class="item"><input type="checkbox" data-c="boxes" ${s.settings.boxesFromDinner ? 'checked' : ''}><span>Les boîtes du midi viennent du dîner de la veille (proposition automatique, toujours à valider)</span></label>
  <label class="field">La semaine commence le<select data-c="weekStart">${DAYS.map((d, i) => `<option value="${i}" ${s.settings.weekStart === i ? 'selected' : ''}>${d.toLowerCase()}</option>`).join('')}</select></label>
  <button class="btn" data-a="rhSave">Enregistrer le rythme</button>`;
}
const summary = (m: Record<string, Presence>): string => S().members.map(x => `${x.name.slice(0, 1)} ${PRES[m[x.id] ?? 'maison'].toLowerCase()}`).join(', ');
CHANGE['rhSet'] = (d, el) => { const day = rhythm[num(d['day'])]; if (day) { day[d['sl'] === 'soir' ? 'soir' : 'midi'][d['m'] ?? ''] = (el as HTMLInputElement).value as Presence; openSheet({ id: 'rhythm', render: rhythmHtml }); } };
CLICK['rhPreset'] = d => {
  const ids = S().members.map(m => m.id);
  rhythm = d['p'] === 'dehors' ? defaultRhythm(ids, 'dehors', 'maison') : d['p'] === 'boite' ? defaultRhythm(ids, 'boite', 'maison') : defaultRhythm(ids, 'maison', 'maison');
  openSheet({ id: 'rhythm', render: rhythmHtml });
};
CLICK['rhSave'] = () => { closeSheet(); dispatch([{ t: 'settings.set', p: { rhythm } }], { toast: 'Rythme enregistré : portions et courses recalculées' }); };
CHANGE['boxes'] = (_d, el) => dispatch([{ t: 'settings.set', p: { boxesFromDinner: (el as HTMLInputElement).checked } }]);
CHANGE['weekStart'] = (_d, el) => dispatch([{ t: 'settings.set', p: { weekStart: Number((el as HTMLSelectElement).value) } }], { toast: 'Début de semaine changé' });

/* ---------- Synchro par lien ---------- */
const isIOS = (): boolean => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = (): boolean => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function openSync(): void {
  openSheet({ id: 'sync', render: () => {
    const n = unsent();
    const auto = relayAvailable() ? `<section class="card stack"><h3 class="section-title">Synchro automatique</h3>
      <label class="item"><input type="checkbox" data-c="autoSync" ${A.device.auto ? 'checked' : ''}><span>Synchroniser seul avec ${esc(otherNames())} (chiffré de bout en bout ; le relais ne voit que des blocs illisibles)</span></label>
      ${autoOn() ? `<p>État : <strong>${esc(statusLabel() || 'en attente')}</strong>${autoSync.at ? ` · dernier échange ${esc(ago(autoSync.at))}` : ''}${autoSync.error && autoSync.status !== 'ok' ? `<br><span class="small muted">${esc(autoSync.error)}</span>` : ''}</p>
      <button class="btn ghost" data-a="syncNow">Synchroniser maintenant</button>` : ''}</section>` : '';
    return `${sheetHead(`Synchro avec ${esc(otherNames())}`, relayAvailable() ? 'Automatique par défaut ; le lien chiffré reste disponible en secours.' : 'Un lien chiffré par message. Le code du foyer ne voyage jamais dans le lien.')}
    ${auto}
    <button class="btn ${autoOn() ? 'ghost ' : ''}block" data-a="sendSync">Envoyer un lien${n && !autoOn() ? ` (${n} changements)` : ''}</button>
    <button class="btn ghost block" data-a="pasteSync">Coller le lien reçu</button>
    <details><summary>Le lien ne se colle pas ?</summary><form data-f="syncText" class="stack"><label class="field">Collez ici le message ou le lien<textarea name="text" rows="3"></textarea></label><button class="btn ghost">Importer</button></form></details>
    <ul class="parsed"><li>Dernier envoi : ${esc(ago(A.device.lastSentAt))}</li><li>Dernière réception : ${esc(ago(A.device.lastRecvAt))}</li></ul>
    <section class="card stack"><h3 class="section-title">Code du foyer</h3>
      ${A.device.code ? `<p class="kbd">${esc(fmtCode(A.device.code))}</p><p class="small muted">À donner une fois de vive voix à l'autre téléphone. Ne l'envoyez pas avec le lien.</p>` : '<p>Aucun code sur ce téléphone.</p>'}</section>
    ${isIOS() ? `<p class="small muted">Sur iPhone, un lien reçu s'ouvre dans Safari, pas dans l'app : appui long sur le lien → Copier, puis ici « Coller le lien reçu ».</p>` : ''}`;
  } });
}
CLICK['sync'] = () => openSync();
CHANGE['autoSync'] = (_d, el) => { setDevice({ auto: (el as HTMLInputElement).checked }); if (A.device.auto) void syncNow(); A.render(); openSync(); };
CLICK['syncNow'] = async () => { await syncNow(); openSync(); toast(autoSync.status === 'ok' ? 'Synchronisé' : `Synchro impossible : ${autoSync.error || statusLabel()}`); };

// Rejoindre un foyer avec le seul code (relais disponible).
SUBMIT['joinCode'] = async data => {
  const code = String(data.get('code') ?? '');
  if (!validCode(code)) { toast('Le code fait 12 signes (lettres et chiffres, sans 0, O, 1 ni I)'); return; }
  toast('Recherche du foyer…');
  const r = await joinWithCode(normCode(code));
  if (r === 'introuvable') { toast('Aucun foyer avec ce code. Vérifiez-le, ou utilisez un lien.'); return; }
  if (r === 'hors-ligne') { toast('Relais injoignable : réessayez, ou utilisez un lien.'); return; }
  A.render();
  toast('Foyer retrouvé et synchronisé');
  CLICK['members']?.({}, document.body);
};

CLICK['sendSync'] = async () => {
  if (A.demo) { toast('Mode découverte : rien n\'est envoyé'); return; }
  const s = S();
  if (!s.hid) return;
  if (!A.device.code) setDevice({ code: newCode() });
  let link: string;
  try {
    const sealed = await seal({ app: 'foyer', v: 1, hid: s.hid, from: A.device.dev, sent: A.now().toISOString(), events: A.log }, A.device.code as string);
    link = `${location.origin}${location.pathname}#s=${sealed}`;
  } catch (e) { toast(`Lien impossible : ${e instanceof Error ? e.message : String(e)}`); return; }
  const text = `🍽️ Foyer : mes derniers changements (chiffrés).\nSur iPhone : appui long sur le lien → Copier, puis dans Foyer : Synchro → Coller le lien reçu.\n${link}`;
  const done = () => { setDevice({ lastSentLc: A.r.maxLc, lastSentAt: A.now().toISOString() }); A.render(); };
  try {
    if (navigator.share) { await navigator.share({ text }); done(); toast('Lien envoyé'); return; }
  } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); done(); toast('Lien copié : collez-le dans un message'); }
  catch { toast('Copie impossible sur cet appareil'); }
};

CLICK['pasteSync'] = async () => {
  try { const t = await navigator.clipboard.readText(); await receive(t); }
  catch { toast('Lecture du presse-papiers refusée : utilisez « Le lien ne se colle pas ? »'); }
};
SUBMIT['syncText'] = data => { void receive(String(data.get('text') ?? '')); };

let pending: string | null = null;
function askCode(text: string, wrong: boolean): void {
  pending = text;
  openSheet({ id: 'code', render: () => `${sheetHead('Code du foyer', 'Demandé une seule fois sur ce téléphone. Il est affiché dans Maison › Réglages › Synchro sur l\'autre téléphone.')}
    ${wrong ? '<p class="banner conflit">Code incorrect, ou lien incomplet. Vérifiez sur l\'autre téléphone.</p>' : ''}
    <form data-f="codeSubmit" class="stack"><label class="field">Code (12 signes)<input type="text" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM" required autofocus></label>
    <button class="btn">Ouvrir le lien</button></form>` });
}
SUBMIT['codeSubmit'] = data => {
  const code = String(data.get('code') ?? '');
  if (!validCode(code)) { toast('Le code fait 12 signes (lettres et chiffres, sans 0, O, 1 ni I)'); return; }
  if (pending) void receive(pending, normCode(code));
};

export async function receive(text: string, code?: string): Promise<void> {
  const sealed = extractSealed(text);
  if (!sealed) { toast('Ce n\'est pas un lien Foyer'); return; }
  const useCode = code ?? A.device.code;
  if (!useCode) { askCode(text, false); return; }
  try {
    const bundle = await open(sealed, useCode);
    const before = A.log.length, hadHid = !!S().hid;
    if (A.demo) { toast('Mode découverte : quittez-le pour synchroniser'); return; }
    const m = merge(A.log, S().hid, bundle);
    await snapshot(A.log, 'Avant la synchro');
    setLog(m.log);
    persist();
    setDevice({ code: normCode(useCode), lastRecvAt: A.now().toISOString() });
    pending = null;
    closeSheet();
    A.render();
    const from = memberName(m.log.find(e => e.dev === bundle.from && e.by)?.by ?? null);
    const conflicts = openConflicts(A.r).length;
    toast(`Synchronisé${from !== 'Quelqu\'un' ? ` avec ${from}` : ''} · ${m.log.length - before ? `${m.log.length - before} changement${m.log.length - before > 1 ? 's' : ''} reçu${m.log.length - before > 1 ? 's' : ''}` : 'déjà à jour'}${m.invalid ? ` · ${m.invalid} élément(s) illisible(s) écarté(s)` : ''}${conflicts ? ` · ${conflicts} conflit(s) à voir dans Aujourd'hui` : ''}`);
    if (!hadHid && !A.device.me) CLICK['members']?.({}, document.body);
  } catch (e) {
    if (e instanceof SyncError && e.code === 'code') { askCode(text, true); return; }
    toast(e instanceof SyncError ? e.message : `Lien illisible (${e instanceof Error ? e.message : String(e)})`);
  }
}

// Lien ouvert depuis un message : on l'importe ici, ou (iPhone, Safari) on le copie pour l'app de l'écran d'accueil.
export function linkFromUrl(): void {
  const h = location.hash;
  if (!h.startsWith('#s=')) return;
  const text = location.href;
  history.replaceState(null, '', location.pathname);
  if (isIOS() && !standalone()) {
    openSheet({ id: 'iosLink', render: () => `${sheetHead('Lien de synchro reçu')}
      <p>Sur iPhone, les liens s'ouvrent dans Safari, pas dans l'app Foyer de l'écran d'accueil (qui a sa propre mémoire).</p>
      <ol><li>Touchez « Copier le lien ».</li><li>Ouvrez Foyer depuis l'écran d'accueil.</li><li>Synchro → <strong>Coller le lien reçu</strong>.</li></ol>
      <button class="btn block" data-a="copyLink">Copier le lien</button>
      <button class="btn ghost block" data-a="importHere">Utiliser Foyer dans Safari plutôt</button>` });
    pending = text;
    return;
  }
  void receive(text);
}
CLICK['copyLink'] = async () => { if (!pending) return; try { await navigator.clipboard.writeText(pending); toast('Copié : ouvrez maintenant Foyer depuis l\'écran d\'accueil'); } catch { toast('Copie impossible'); } };
CLICK['importHere'] = () => { if (pending) void receive(pending); };

/* ---------- Sauvegarde ---------- */
CLICK['exportBackup'] = async () => {
  const s = S();
  if (!s.hid) return;
  const r = await saveFile(`foyer-sauvegarde-${paris(A.now()).date}.json`, 'application/json', exportBackup(A.log, s.hid, A.device.dev, A.now()));
  if (r !== 'annule') toast(r === 'partage' ? 'Sauvegarde partagée' : 'Sauvegarde téléchargée');
};
CHANGE['importBackup'] = async (_d, el) => {
  const f = (el as HTMLInputElement).files?.[0];
  (el as HTMLInputElement).value = '';
  if (!f) return;
  if (f.size > 20_000_000) { toast('Fichier trop volumineux'); return; }
  try {
    const bundle = readBackup(await f.text());
    const m = merge(A.log, S().hid, bundle);
    await snapshot(A.log, 'Avant import d\'une sauvegarde');
    setLog(m.log); persist(); A.render();
    toast(`Sauvegarde importée · ${m.added} élément(s) ajouté(s)${m.invalid ? ` · ${m.invalid} écarté(s)` : ''}`);
  } catch (e) { toast(e instanceof SyncError ? e.message : 'Fichier illisible'); }
};
CLICK['snapshots'] = async () => {
  const list = await snapshots();
  openSheet({ id: 'snaps', render: () => `${sheetHead('Copies de secours', 'Les 5 dernières versions, prises avant chaque synchro ou import.')}
    ${list.length ? `<ul class="list">${list.map(x => `<li><div class="item"><span class="grow"><span class="title">${esc(ago(new Date(x.id).toISOString()))}</span><br><span class="sub">${esc(x.reason)} · ${x.n} éléments</span></span>
      <button class="btn small-btn ghost" data-a="restoreSnap" data-id="${x.id}">Revenir à cette version</button></div></li>`).join('')}</ul>` : '<p class="muted">Aucune copie pour l\'instant.</p>'}` });
};
CLICK['restoreSnap'] = async d => {
  const x = (await snapshots()).find(s => s.id === num(d['id']));
  if (!x) return;
  try {
    const bundle = readBackup(JSON.stringify({ app: 'foyer', v: 1, hid: S().hid ?? '', from: A.device.dev, events: JSON.parse(x.log) }));
    await snapshot(A.log, 'Avant retour à une copie');
    setLog(merge([], null, bundle).log); persist(); closeSheet(); A.render();
    toast('Version restaurée. Les changements reçus plus tard reviendront à la prochaine synchro.');
  } catch { toast('Copie illisible'); }
};

/* ---------- Ordre des rayons (celui de votre magasin) ---------- */
let aisles: string[] = [];
CLICK['aisleOrder'] = () => { aisles = orderedAisles(S()).map(a => a.id); openSheet({ id: 'aisles', render: aislesHtml }); };
function aislesHtml(): string {
  const all = orderedAisles(S());
  const label = (id: string) => all.find(a => a.id === id);
  return `${sheetHead('Ordre des rayons', 'Celui de votre magasin : la liste de courses suit votre parcours.')}
  <ol class="list">${aisles.map((id, i) => `<li><div class="item"><span class="grow"><span aria-hidden="true">${label(id)?.icon ?? ''}</span> ${esc(label(id)?.label ?? id)}</span>
    <button class="icon-btn" data-a="aisleUp" data-n="${i}" aria-label="Monter ${esc(label(id)?.label ?? id)}" ${i === 0 ? 'disabled' : ''}>↑</button>
    <button class="icon-btn" data-a="aisleDown" data-n="${i}" aria-label="Descendre ${esc(label(id)?.label ?? id)}" ${i === aisles.length - 1 ? 'disabled' : ''}>↓</button></div></li>`).join('')}</ol>
  <button class="btn block" data-a="aisleSave">Enregistrer cet ordre</button>`;
}
const swap = (i: number, j: number) => { if (i < 0 || j < 0 || i >= aisles.length || j >= aisles.length) return; [aisles[i], aisles[j]] = [aisles[j] as string, aisles[i] as string]; openSheet({ id: 'aisles', render: aislesHtml }); };
CLICK['aisleUp'] = d => swap(num(d['n']), num(d['n']) - 1);
CLICK['aisleDown'] = d => swap(num(d['n']), num(d['n']) + 1);
CLICK['aisleSave'] = () => { closeSheet(); dispatch([{ t: 'settings.set', p: { aisleOrder: aisles } }], { toast: 'Ordre des rayons enregistré' }); };

/* ---------- Installer sur l'écran d'accueil (iPhone) ---------- */
export const needsInstall = (): boolean => isIOS() && !standalone() && !A.device.installHint;
CLICK['installDone'] = () => { setDevice({ installHint: true }); A.render(); };

/* ---------- Rappels en notifications ---------- */
CLICK['pushOn'] = async () => { toast('Activation…'); const why = await enablePush(); A.render(); toast(why ?? 'Rappels activés sur ce téléphone'); };
CLICK['pushOff'] = async () => { await disablePush(); A.render(); toast('Rappels désactivés sur ce téléphone'); };
CLICK['pushTest'] = async () => { toast(await testReminder() ? 'Rappel d\'essai prévu : il arrive dans les 5 minutes' : 'Envoi impossible pour l\'instant (réseau ?)'); };

/* ---------- Diagnostic du téléphone ---------- */
async function env(): Promise<Env> {
  const n = navigator as Navigator & { wakeLock?: unknown };
  let persisted: boolean | null = null;
  try { persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { persisted = null; }
  return {
    standalone: standalone(), ios: iosVersion(navigator.userAgent),
    crypto: !!globalThis.crypto?.subtle, compression: typeof CompressionStream === 'function', dialog: typeof HTMLDialogElement === 'function',
    serviceWorker: !!navigator.serviceWorker?.controller, wakeLock: !!n.wakeLock, push: 'PushManager' in window && 'serviceWorker' in navigator,
    notifications: typeof Notification === 'function' ? Notification.permission : 'absent', persisted,
  };
}
let lastDiag = '';
CLICK['diag'] = async () => {
  const e = await env();
  const checks = diagnose(e);
  lastDiag = diagText(checks);
  openSheet({ id: 'diag', render: () => `${sheetHead('Diagnostic de ce téléphone', 'Ce que Foyer peut utiliser ici, et ce que chaque manque change.')}
    <ul class="list">${checks.map(c => `<li><div class="item"><span class="chip ${c.ok === true ? 's-pret' : c.ok === false ? 'attention' : 'info'}" aria-hidden="true">${c.ok === true ? '✓' : c.ok === false ? '✗' : '–'}</span>
      <span class="grow"><span class="title">${esc(c.label)}</span><br><span class="sub">${esc(`${c.ok === true ? 'Oui' : c.ok === false ? 'Non' : 'Inconnu'} · ${c.detail}`)}</span></span></div></li>`).join('')}</ul>
    ${e.persisted === false ? '<button class="btn soft block" data-a="persistAsk">Demander au navigateur de garder les données</button>' : ''}
    <button class="btn ghost block" data-a="diagCopy">Copier le diagnostic</button>
    <p class="small muted">À coller dans un message si quelque chose ne marche pas. Il ne contient aucune donnée du foyer.</p>` });
};
CLICK['diagCopy'] = async () => { try { await navigator.clipboard.writeText(lastDiag); toast('Diagnostic copié'); } catch { toast('Copie impossible'); } };
CLICK['persistAsk'] = async () => {
  let ok = false;
  try { ok = !!(await navigator.storage?.persist?.()); } catch { ok = false; }
  toast(ok ? 'Le navigateur gardera les données de Foyer' : 'Refusé par le navigateur : installez Foyer et gardez la synchro active');
  void CLICK['diag']?.({}, document.body);
};

/* ---------- Divers ---------- */
CHANGE['theme'] = (_d, el) => { const t = (el as HTMLSelectElement).value as 'auto' | 'light' | 'dark'; setDevice({ theme: t }); applyTheme(); };
export function applyTheme(): void { const t = A.device.theme; if (t === 'auto') delete document.documentElement.dataset['theme']; else document.documentElement.dataset['theme'] = t; }
CLICK['wipe'] = () => openSheet({ id: 'wipe', render: () => `${sheetHead('Effacer Foyer sur ce téléphone ?', 'L\'autre téléphone garde tout. Une sauvegarde ou un lien de synchro permet de tout récupérer.')}
  <div class="actions"><button class="btn ghost" data-a="exportBackup">Exporter d'abord une sauvegarde</button><button class="btn danger" data-a="wipeOk">Effacer ce téléphone</button></div>` });
CLICK['wipeOk'] = async () => { await snapshot(A.log, 'Avant effacement'); await forgetPush(); wipe(); forgetRelay(); location.reload(); };
