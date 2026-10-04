// Agenda et repas : brancher un agenda (Google, iCloud, Outlook), décider une fois ce qu'un événement change, voir ce qui
// a été fait seul et l'annuler. L'adresse de l'agenda donne accès en lecture à tout l'agenda : expliqué avant de la coller.
import { parseSlot, fmtDayShort } from '../../core/dates.js';
import { AGENDA_URL_RE } from '../../core/model.js';
import { capitalize } from '../../core/text.js';
import { changeText, ruleKey, onceKey } from '../../core/agenda.js';
import { newId } from '../../core/reduce.js';
import { A, S, dispatch, memberName } from '../state.js';
import { openSheet, sheetHead, esc, toast, refreshSheet, closeSheet } from '../dom.js';
import { CLICK, CHANGE, SUBMIT } from '../registry.js';
import { RELAY } from '../config.js';
import { plan, readCal, refreshAgenda, calStatus, toDecide, HORIZON } from '../agenda.js';
const short = (t) => (t.length > 40 ? `${t.slice(0, 38)}…` : t);
const ago = (ms) => { const m = Math.round((A.now().getTime() - ms) / 60e3); return m < 1 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`; };
// Section de Réglages.
export function agendaSection() {
    const s = S(), cals = Object.values(s.agenda.cals);
    return `<section class="card stack" aria-labelledby="ag-h"><h2 id="ag-h">Agendas</h2>
    <p>Foyer lit vos agendas sur un mois et ajuste les repas : absent·e le soir du foot, midi à la maison en télétravail, plat décalé si plus personne ne le mange.</p>
    ${cals.length ? `<ul class="list">${cals.map(c => {
        const st = calStatus(c.id);
        const line = !st ? 'pas encore lu' : st.error ? `⚠️ ${st.error}${st.ok ? ` (dernière lecture réussie ${ago(st.at)})` : ''}` : `lu ${ago(st.at)} · ${st.occurrences.length} événement${st.occurrences.length > 1 ? 's' : ''} sur ${HORIZON} jours${st.skipped.length ? ` · ${st.skipped.length} non compris` : ''}`;
        return `<li><div class="item"><span class="grow"><span class="title">${esc(c.label)}</span><br><span class="sub">${esc(c.member ? memberName(c.member) : 'Tout le foyer')} · ${esc(line)}</span></span>
        <button class="btn small-btn ghost" data-a="agendaRemove" data-cal="${esc(c.id)}">Retirer</button></div></li>`;
    }).join('')}</ul>` : ''}
    <div class="item"><label class="check"><input type="checkbox" data-c="holidays" ${s.settings.holidays !== false ? 'checked' : ''} aria-label="Jours fériés : proposer le midi à la maison"><span></span></label>
      <span class="grow">Jours fériés (France) : proposer le midi à la maison</span></div>
    <div class="actions">${RELAY ? '<button class="btn" data-a="agendaAdd">Brancher un agenda</button>' : ''}<button class="btn ghost" data-a="agendaOpen">Ce que l'agenda change</button></div></section>`;
}
/* ---------- Brancher un agenda ---------- */
CLICK['agendaAdd'] = () => openSheet({ id: 'agendaAdd', render: () => {
        const s = S();
        return `${sheetHead('Brancher un agenda', 'Une seule fois par agenda. Foyer le relit ensuite tout seul.')}
  <form data-f="agendaAdd" class="stack">
    <label class="field">De qui est cet agenda ?<select name="member">${s.members.map(m => `<option value="${esc(m.id)}" ${m.id === A.device.me ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}<option value="">Tout le foyer (agenda commun)</option></select></label>
    <label class="field">Adresse de l'agenda (lien iCal)<input name="url" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" required></label>
    <button class="btn block">Lire et brancher</button></form>
  <details class="card"><summary>Où trouver l'adresse : Google Agenda</summary><ol class="steps">
    <li>Sur un ordinateur, ouvrir calendar.google.com.</li><li>En haut à droite : Paramètres (roue dentée) › Paramètres.</li>
    <li>À gauche, sous « Paramètres de mes agendas », cliquer sur l'agenda.</li><li>« Intégrer l'agenda » › copier l'« Adresse secrète au format iCal ».</li>
    <li>L'envoyer sur votre iPhone (Notes, message à soi-même), la coller ici.</li></ol></details>
  <details class="card"><summary>Où trouver l'adresse : iPhone (iCloud)</summary><ol class="steps">
    <li>App Calendrier › bouton Calendriers (en bas).</li><li>Toucher ⓘ à côté du calendrier iCloud.</li>
    <li>Activer « Calendrier public », puis « Envoyer le lien » › Copier.</li><li>Coller ici.</li></ol>
    <p class="small muted">« Calendrier public » : toute personne qui a ce lien peut lire ce calendrier. Ne l'envoyez qu'à Foyer.</p></details>
  <p class="small muted">Cette adresse permet de lire tout l'agenda. Foyer la garde dans votre journal chiffré (synchro de bout en bout) ; pour lire l'agenda, le serveur de Foyer le télécharge, garde seulement les ${HORIZON} prochains jours et ne conserve rien. Pour couper l'accès : Google › « Réinitialiser » l'adresse secrète ; iPhone › désactiver « Calendrier public ». Les sauvegardes exportées contiennent l'adresse.</p>`;
    } });
SUBMIT['agendaAdd'] = async (fd, form) => {
    const raw = String(fd.get('url') ?? '').trim().replace(/^webcals?:\/\//i, 'https://');
    const member = String(fd.get('member') ?? '') || null;
    if (!AGENDA_URL_RE.test(raw)) {
        toast('Adresse incomplète : collez le lien entier, qui commence par https:// ou webcal://');
        return;
    }
    const btn = form.querySelector('button');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Lecture de l\'agenda…';
    }
    const id = newId(10);
    const st = await readCal(id, raw);
    if (!st.ok) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Lire et brancher';
        }
        toast(`Agenda non branché : ${st.error}`);
        return;
    }
    const label = member ? `Agenda de ${memberName(member)}` : 'Agenda du foyer';
    dispatch([{ t: 'agenda.set', p: { cal: id, member, label, url: raw } }]);
    const n = plan().changes.filter(c => c.cal === id).length;
    if (!n)
        closeSheet();
    toast(`${label} branché : ${st.occurrences.length} événement${st.occurrences.length > 1 ? 's' : ''} sur ${HORIZON} jours${n ? `, ${n} qui touche${n > 1 ? 'nt' : ''} des repas` : ''}`);
    if (n)
        CLICK['agendaOpen']?.({}, document.body);
};
CLICK['agendaRemove'] = d => {
    const c = S().agenda.cals[d['cal'] ?? ''];
    if (c)
        dispatch([{ t: 'agenda.set', p: { cal: c.id, member: c.member, label: c.label, url: null } }], { toast: `${c.label} débranché (les repas déjà ajustés restent)` });
};
CHANGE['holidays'] = (_d, el) => { dispatch([{ t: 'settings.set', p: { holidays: el.checked } }]); };
/* ---------- Ce que l'agenda change ---------- */
function changeCard(c) {
    const s = S();
    const head = `<p class="small muted">${esc(c.label || 'Agenda')} · ${esc(c.when)}</p><h3>« ${esc(c.title)} »</h3><p>${esc(changeText(s, c))}</p>
    ${c.sure ? '' : '<p class="small muted">Le titre ne parle pas de repas : l\'événement occupe seulement l\'heure du repas. À vous de dire.</p>'}
    ${c.manual ? '<p class="small muted">Ce repas avait été réglé à la main : rien ne change sans vous.</p>' : ''}`;
    if (c.kind === 'invites') {
        const k = c.slots[0] ?? '';
        return `<article class="card stack">${head}<div class="actions">${[1, 2, 4].map(n => `<button class="btn ghost" data-a="agendaGuests" data-k="${k}" data-n="${n}">+${n} invité${n > 1 ? 's' : ''}</button>`).join('')}
      <button class="btn quiet" data-a="agendaSkip" data-occ="${c.occ}">Pas d'invités</button></div></article>`;
    }
    return `<article class="card stack">${head}
    <div class="item"><label class="check"><input type="checkbox" data-always="${c.occ}" checked aria-label="${esc(`Pareil les prochaines fois pour « ${c.title} »`)}"><span></span></label><span class="grow">Pareil les prochaines fois pour « ${esc(short(c.title))} »</span></div>
    <div class="actions"><button class="btn" data-a="agendaApply" data-occ="${c.occ}">Appliquer</button><button class="btn ghost" data-a="agendaSkip" data-occ="${c.occ}">Pas cette fois</button>
      <button class="btn quiet" data-a="agendaNever" data-occ="${c.occ}">Jamais pour « ${esc(short(c.title))} »</button></div></article>`;
}
function agendaHtml() {
    const s = S(), p = plan(), now = A.now().getTime();
    const ask = p.changes.filter(c => !c.auto);
    const marks = Object.entries(s.agenda.marks).filter(([, m]) => !m.overridden)
        .map(([key, m]) => ({ k: key.slice(0, key.lastIndexOf('|')), member: key.slice(key.lastIndexOf('|') + 1), m }))
        .filter(x => { const sl = parseSlot(x.k); return !!sl && !s.slots[x.k]?.eaten && Date.parse(`${sl.date}T23:59:59Z`) > now; })
        .sort((a, b) => (a.k < b.k ? -1 : 1));
    const rules = Object.entries(s.agenda.rules).filter(([k]) => k.startsWith('t:'));
    const cals = Object.values(s.agenda.cals);
    return `${sheetHead('Ce que l\'agenda change', `Les ${HORIZON} prochains jours. Une décision par événement, ensuite Foyer fait pareil tout seul.`)}
  ${!cals.length ? `<div class="banner info"><p class="grow">Aucun agenda branché${s.settings.holidays !== false ? ' (seuls les jours fériés sont pris en compte)' : ''}.</p>${RELAY ? '<button class="btn small-btn" data-a="agendaAdd">Brancher un agenda</button>' : ''}</div>` : ''}
  <section class="stack" aria-labelledby="agd-h"><h3 id="agd-h" class="section-title">À décider${ask.length ? ` (${ask.length})` : ''}</h3>
    ${ask.length ? ask.map(changeCard).join('') : '<p class="small muted">Rien à décider : les repas suivent déjà l\'agenda.</p>'}</section>
  <section class="card stack" aria-labelledby="agf-h"><h3 id="agf-h" class="section-title">Fait d'après l'agenda</h3>
    ${marks.length ? `<ul class="list">${marks.map(x => {
        const sl = parseSlot(x.k);
        return `<li><div class="item"><span class="grow"><span class="title">${esc(memberName(x.member))} ${x.m.presence === 'dehors' ? 'absent·e' : x.m.presence === 'maison' ? 'à la maison' : 'en boîte'} ${sl ? esc(`${fmtDayShort(sl.date)} ${sl.slot}`) : ''}</span><br><span class="sub">« ${esc(x.m.title)} »</span></span>
      <button class="btn small-btn ghost" data-a="agendaUndo" data-k="${x.k}" data-m="${esc(x.member)}">Annuler</button></div></li>`;
    }).join('')}</ul>` : '<p class="small muted">Rien pour l\'instant.</p>'}</section>
  ${rules.length ? `<section class="card stack" aria-labelledby="agr-h"><h3 id="agr-h" class="section-title">Décisions retenues</h3><ul class="list">${rules.map(([k, v]) => `<li><div class="item"><span class="grow">« ${esc(capitalize(k.slice(2)))} » : ${v === 'auto' ? 'appliqué tout seul' : 'ignoré'}</span>
      <button class="btn small-btn ghost" data-a="agendaForget" data-key="${esc(k)}">Oublier</button></div></li>`).join('')}</ul></section>` : ''}
  ${cals.length ? '<button class="btn ghost block" data-a="agendaRefresh">Relire les agendas maintenant</button>' : ''}`;
}
CLICK['agendaOpen'] = () => openSheet({ id: 'agendaRepas', render: agendaHtml });
CLICK['agendaRefresh'] = async () => { toast('Lecture des agendas…'); await refreshAgenda(true); refreshSheet(); toast(toDecide() ? `${toDecide()} changement${toDecide() > 1 ? 's' : ''} à décider` : 'Agendas relus : rien à décider'); };
const find = (occ) => plan().changes.find(c => c.occ === occ);
CLICK['agendaApply'] = d => {
    const c = find(d['occ'] ?? '');
    if (!c) {
        refreshSheet();
        return;
    }
    const always = document.querySelector(`input[data-always="${CSS.escape(c.occ)}"]`)?.checked ?? false;
    const drafts = [...c.drafts, ...(always && c.rule ? [{ t: 'agenda.rule', p: { key: c.rule, effect: 'auto' } }] : [])];
    dispatch(drafts, { toast: `${changeText(S(), c)}${always ? ' · les prochaines fois aussi' : ''}` });
};
CLICK['agendaSkip'] = d => { dispatch([{ t: 'agenda.rule', p: { key: onceKey(d['occ'] ?? ''), effect: 'jamais' } }], { toast: 'Ignoré pour cette fois' }); };
CLICK['agendaNever'] = d => {
    const c = find(d['occ'] ?? '');
    if (c)
        dispatch([{ t: 'agenda.rule', p: { key: ruleKey(c.title), effect: 'jamais' } }], { toast: `« ${short(c.title)} » ne changera plus les repas` });
};
CLICK['agendaGuests'] = d => { dispatch([{ t: 'slot.guests', p: { slot: d['k'] ?? '', guests: Number(d['n'] ?? 0) } }], { toast: 'Invités notés : portions et courses recalculées' }); };
CLICK['agendaUndo'] = d => { dispatch([{ t: 'slot.presence', p: { slot: d['k'] ?? '', member: d['m'] ?? '', presence: null } }], { toast: 'Annulé : retour à l\'habitude (l\'agenda ne reviendra pas dessus)' }); };
CLICK['agendaForget'] = d => { dispatch([{ t: 'agenda.rule', p: { key: d['key'] ?? '', effect: null } }], { toast: 'Décision oubliée : Foyer redemandera' }); };
