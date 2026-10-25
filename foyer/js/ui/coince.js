// « Ça coince ? » : en haut de chaque écran, noter une gêne au moment où elle arrive (un mot facultatif, puis son genre).
// Rangé à part du journal comme l'usage : jamais synchronisé, jamais envoyé, absent des sauvegardes ; la liste se copie
// depuis Réglages pour être envoyée, puis s'efface. Coupé en mode découverte.
import { KINDS, KIND_LABEL, readFrictions, addFriction, report } from '../core/coince.js';
import { A, setDevice } from './state.js';
import { $, esc, openSheet, sheetHead, closeSheet, refreshSheet, toast } from './dom.js';
import { CLICK, CHANGE, onAction } from './registry.js';
import { VERSION } from './config.js';
const KEY = 'foyer:coince';
const SCREEN = { aujourdhui: 'Aujourd\'hui', semaine: 'Semaine', courses: 'Courses', maison: 'Maison' };
let steps = [];
export const coinceStep = (name) => { if (name !== 'coince' && name !== 'coinceKind')
    steps = [...steps, name].slice(-8); };
onAction(coinceStep);
function load() {
    try {
        return readFrictions(JSON.parse(localStorage.getItem(KEY) || '[]'));
    }
    catch {
        return [];
    }
}
const save = (list) => { try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
}
catch {
    return false;
} };
const stamp = (d) => d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const coinceButton = () => (A.demo || !A.device.coince ? '' : '<button class="btn small-btn ghost coince-btn" data-a="coince">Ça coince ?</button>');
export function coinceSummary() {
    const n = load().length;
    return n ? `${n} gêne${n > 1 ? 's' : ''} notée${n > 1 ? 's' : ''} sur ce téléphone.` : 'Rien de noté pour l\'instant : « Ça coince ? » en haut de chaque écran.';
}
CLICK['coince'] = () => {
    const screen = SCREEN[A.ui.tab] ?? A.ui.tab;
    openSheet({ id: 'coince', render: () => `${sheetHead('Qu\'est-ce qui coince ?', `Noté sur ce téléphone seulement, avec l'écran (${esc(screen)}) et vos derniers gestes. Vous m'enverrez la liste depuis Réglages.`)}
    <label class="field">Un mot (facultatif)<textarea name="coinceNote" rows="3" maxlength="280" placeholder="ex. : je ne trouve pas où changer les portions"></textarea></label>
    <p>Puis touchez ce qui décrit le mieux la gêne :</p>
    <div class="chips" role="group" aria-label="Genre de gêne">${KINDS.map(k => `<button class="tag" data-a="coinceKind" data-v="${k}">${esc(KIND_LABEL[k])}</button>`).join('')}</div>` });
};
CLICK['coinceKind'] = d => {
    const kind = KINDS.includes(d['v'] ?? '') ? d['v'] : 'autre';
    const note = $('dialog[open] textarea[name="coinceNote"]')?.value ?? '';
    const ok = save(addFriction(load(), { at: stamp(A.now()), screen: SCREEN[A.ui.tab] ?? A.ui.tab, kind, note, steps }));
    closeSheet();
    toast(ok ? 'Noté, merci : Réglages › Ça coince pour envoyer la liste' : 'Impossible de noter (stockage du téléphone indisponible)');
    A.render();
};
export function openCoinceList() {
    openSheet({ id: 'coinceList', render: () => {
            const list = load();
            return `${sheetHead('Ça coince', 'Les gênes notées sur ce téléphone, la plus récente d\'abord. Rien n\'est envoyé tout seul.')}
    ${list.length ? `<ul class="list">${[...list].reverse().map(f => `<li><div class="item"><span class="grow"><span class="title">${esc(KIND_LABEL[f.kind])} · ${esc(f.screen)}</span><br><span class="sub">${esc(f.at)}${f.note ? ` · « ${esc(f.note)} »` : ''}</span></span></div></li>`).join('')}</ul>
      <div class="actions"><button class="btn" data-a="coinceCopy">Copier la liste pour l'envoyer</button><button class="btn quiet" data-a="coinceClear">Tout effacer</button></div>`
                : '<p class="muted">Rien de noté pour l\'instant.</p>'}`;
        } });
}
CLICK['coinceList'] = () => openCoinceList();
CHANGE['coinceShow'] = (_d, el) => { setDevice({ coince: el.checked }); A.render(); };
CLICK['coinceCopy'] = async () => { try {
    await navigator.clipboard.writeText(report(load(), VERSION));
    toast('Liste copiée : collez-la dans un message');
}
catch {
    toast('Copie impossible');
} };
CLICK['coinceClear'] = () => { try {
    localStorage.removeItem(KEY);
}
catch { /* rien */ } toast('Liste effacée'); refreshSheet(); A.render(); };
