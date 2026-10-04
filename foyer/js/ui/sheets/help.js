// Prise en main : « Premiers pas » sur Aujourd'hui (six gestes, cochés d'après ce qui est réellement fait) et
// « Comment ça marche » (les mots de Foyer expliqués simplement). Rien n'est coché sur parole : tout se lit dans l'état.
import { addDays, weekOf, paris, weekDays, SLOTS, slotKey } from '../../core/dates.js';
import { A, S, otherNames, setDevice } from '../state.js';
import { openSheet, sheetHead, esc } from '../dom.js';
import { CLICK } from '../registry.js';
import { RELAY } from '../config.js';
import { isIOS, standalone } from './settings.js';
export function firstSteps() {
    const s = S(), today = paris(A.now()).date, week = weekOf(today, s.settings.weekStart);
    const planned = [week, addDays(week, 7)].some(w => weekDays(w).some(d => SLOTS.some(sl => !!s.slots[slotKey(d, sl)]?.dish)));
    const dishes = Object.values(s.recipes).filter(r => !r.archived).length;
    const steps = [
        { done: dishes >= 5, text: 'Noter 5 plats que vous faites souvent', why: 'Un nom suffit. Foyer propose ensuite les repas à partir d\'eux.', action: '<button class="btn small-btn ghost" data-a="classics">Choisir</button>' },
        { done: planned, text: 'Prévoir la semaine', why: 'Foyer remplit les repas vides ; vous validez ligne par ligne.', action: '<button class="btn small-btn ghost" data-a="propose">Proposer</button>' },
    ];
    if (s.members.length > 1)
        steps.push({ done: A.log.some(e => e.dev !== A.device.dev), text: `Installer Foyer sur le téléphone de ${otherNames()}`, why: 'Avec le code du foyer : ensuite, tout se synchronise seul.', action: '<button class="btn small-btn ghost" data-a="sync">Comment</button>' });
    if (RELAY) {
        steps.push({ done: Object.keys(s.agenda.cals).length > 0, text: 'Brancher vos agendas', why: 'Le foot, un resto, le télétravail : les repas s\'ajustent seuls.', action: '<button class="btn small-btn ghost" data-a="agendaAdd">Brancher</button>' });
        steps.push({ done: A.device.push, text: 'Recevoir les rappels sur ce téléphone', why: '« Sortir le poulet » la veille à 19 h, la boîte à préparer.', action: '<button class="btn small-btn ghost" data-a="pushOn">Activer</button>' });
    }
    if (isIOS())
        steps.push({ done: standalone(), text: 'Mettre Foyer sur l\'écran d\'accueil', why: 'Safari › Partager › « Sur l\'écran d\'accueil » : l\'app garde vos données et reçoit les rappels.', action: '' });
    return steps;
}
export function guideCard() {
    if (A.demo || !A.device.guide)
        return '';
    const steps = firstSteps(), done = steps.filter(x => x.done).length;
    if (done === steps.length)
        return '';
    return `<section class="card stack" aria-labelledby="guide-h"><h2 id="guide-h">Premiers pas · ${done} sur ${steps.length}</h2>
    <ul class="list">${steps.map(x => `<li${x.done ? ' class="done-line"' : ''}><div class="item"><span aria-hidden="true">${x.done ? '✓' : '○'}</span>
      <span class="grow"><span class="title">${esc(x.text)}</span>${x.done ? '<span class="sr-only"> : fait</span>' : `<br><span class="sub">${esc(x.why)}</span>`}</span>${x.done ? '' : x.action}</div></li>`).join('')}</ul>
    <div class="actions"><button class="btn ghost" data-a="help">Comment ça marche</button><button class="btn quiet" data-a="guideHide">Masquer</button></div></section>`;
}
CLICK['guideHide'] = () => { setDevice({ guide: false }); A.render(); };
const HELP = [
    ['Les quatre écrans', '<strong>Aujourd\'hui</strong> : ce soir et demain midi, ce qu\'il reste à faire. <strong>Semaine</strong> : qui mange quoi, jour par jour. <strong>Courses</strong> : la liste, calculée toute seule. <strong>Maison</strong> : vos plats, les portions qui restent, les réglages.'],
    ['Qui mange : Maison, Boîte, Dehors', 'Pour chaque repas, chacun est <strong>à la maison</strong>, emporte une <strong>boîte</strong> (un plat de la maison mangé ailleurs, souvent le midi au travail) ou mange <strong>dehors</strong>. Foyer en déduit combien de portions préparer. L\'habitude se règle une fois (Maison › Réglages › Rythme) ; un repas différent se change en le touchant.'],
    ['Préparer plus pour demain', 'Un plat du soir peut aussi remplir les boîtes du lendemain midi : Foyer l\'indique (« Préparer 4 portions : 2 ce soir, 2 pour demain midi »).'],
    ['« C\'est préparé » et « On a mangé »', 'Quand le plat est cuit, touchez <strong>C\'est préparé</strong> et dites combien de portions il a vraiment donné. Après le repas, <strong>On a mangé</strong>. Ce qui reste apparaît dans Maison › Portions. Foyer ne coche jamais rien parce que l\'heure est passée.'],
    ['Les courses', 'La liste additionne les ingrédients des plats prévus pour les personnes présentes. <strong>Cocher</strong> = acheté. <strong>« On en a déjà »</strong> retire un article pour cette liste seulement. Une quantité inconnue est signalée, jamais inventée.'],
    ['L\'agenda', 'Branché une fois (Maison › Réglages › Agendas), il est relu tout seul. Un événement à l\'heure d\'un repas propose « absent ce soir-là » ; vous décidez une fois, ensuite Foyer fait pareil. Un événement supprimé : le repas revient comme d\'habitude.'],
    ['À deux', 'Chaque téléphone envoie ses changements chiffrés ; seuls vos téléphones, qui ont le code du foyer, peuvent les lire. Sans réseau, tout continue sur le téléphone.'],
    ['Une erreur ?', 'Presque chaque action propose <strong>Annuler</strong> juste après. Les copies de secours sont dans Maison › Réglages.'],
];
CLICK['help'] = () => openSheet({ id: 'help', render: () => `${sheetHead('Comment ça marche', 'Les mots de Foyer, simplement.')}
  ${HELP.map(([h, p]) => `<section class="card stack"><h3 class="section-title">${h}</h3><p>${p}</p></section>`).join('')}` });
