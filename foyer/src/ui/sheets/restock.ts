// Produits de la maison (core/restock.ts) : choisir ceux que Foyer suit, voir quand chacun devrait manquer, corriger d'un geste
// (« il en faut », « il en reste »), fixer un rythme, ajouter un produit à soi. Les achats se notent dans la liste ou par la facture.
import { type LocalDate, addDays, daysBetween, fmtDayShort, fmtRelDay } from '../../core/dates.ts';
import { RESTOCK, RESTOCK_DEF, GROUP_LABEL, type RestockGroup, estimate, lastBought, later, nameOf, nextDue, packOf, rhythm, rhythmText, trips } from '../../core/restock.ts';
import type { Draft } from '../../core/reduce.ts';
import { newId } from '../../core/reduce.ts';
import { capitalize, plural } from '../../core/text.ts';
import { S, clock, dispatch } from '../state.ts';
import { openSheet, sheetHead, esc, toast } from '../dom.ts';
import { CLICK, CHANGE, SUBMIT } from '../registry.ts';

const EVERY = [7, 14, 21, 30, 45, 60, 90, 120, 180] as const;
const people = (): number => Math.max(1, S().members.length);
const today = (): LocalDate => clock().date;

// « dans 12 jours », « en retard de 3 jours », « aujourd'hui ».
function dueText(due: LocalDate): string {
  const d = daysBetween(today(), due);
  if (d < 0) return `en retard : devait manquer ${fmtRelDay(due, today())}`;
  return d === 0 ? 'à racheter aujourd\'hui' : `vers le ${fmtDayShort(due)} (dans ${plural(d, 'jour')})`;
}

export function openRestock(): void { openSheet({ id: 'restock', render: listHtml }); }
export function openRestockItem(id: string): void { openSheet({ id: `restock:${id}`, render: () => itemHtml(id) }); }

function listHtml(): string {
  const s = S(), n = people();
  const head = sheetHead('🧴 Produits de la maison', 'Remis aux courses quand ils devraient manquer : pas chaque semaine, seulement quand il le faut.');
  if (!Object.keys(s.restock).length) {
    // Premier choix : les produits courants sont cochés, ceux qui dépendent de l'équipement (lave-vaisselle…) ne le sont pas.
    const group = (g: RestockGroup) => `<fieldset><legend>${esc(GROUP_LABEL[g])}</legend>${RESTOCK.filter(d => d.group === g).map(d => `<label class="item"><input type="checkbox" name="on" value="${d.id}" ${d.on ? 'checked' : ''}>
      <span class="grow">${esc(d.name)}<br><span class="small muted">${esc(`≈ tous les ${estimate(d, n)} jours pour ${plural(n, 'personne')} · ${d.why}`)}</span></span></label>`).join('')}</fieldset>`;
    return `${head}<form data-f="restockStart" class="stack">
      <p class="small">Cochez ce que vous achetez régulièrement. Foyer part d'une estimation (écrite sous chaque produit), puis apprend votre vrai rythme à chaque achat noté : coche dans la liste de courses ou facture du drive lue.</p>
      ${group('hygiene')}${group('entretien')}
      <button class="btn big block">Commencer le suivi</button></form>`;
  }
  const row = (id: string): string => {
    const it = s.restock[id], d = RESTOCK_DEF[id], r = rhythm(s, id), due = it?.on ? nextDue(s, id) : null;
    const sub = it?.on && r && due ? `${dueText(due)} · ${rhythmText(r)}` : d ? `≈ tous les ${estimate(d, n)} jours · ${d.why}` : 'non suivi';
    return `<li><div class="item"><label class="check"><input type="checkbox" data-c="restockOn" data-id="${esc(id)}" ${it?.on ? 'checked' : ''} aria-label="Suivre ${esc(nameOf(id, it))}"><span></span></label>
      <button class="item-btn grow" data-a="restockItem" data-id="${esc(id)}"><span class="grow"><span class="title">${esc(nameOf(id, it))}</span><br><span class="sub">${esc(sub)}</span></span></button></div></li>`;
  };
  const mine = Object.keys(s.restock).filter(id => !RESTOCK_DEF[id]).sort((a, b) => nameOf(a, s.restock[a]).localeCompare(nameOf(b, s.restock[b]), 'fr'));
  const section = (title: string, ids: readonly string[]) => ids.length ? `<section class="card stack"><h3 class="section-title">${esc(title)}</h3><ul class="list">${ids.map(row).join('')}</ul></section>` : '';
  return `${head}
    ${section(GROUP_LABEL.hygiene, RESTOCK.filter(d => d.group === 'hygiene').map(d => d.id))}
    ${section(GROUP_LABEL.entretien, RESTOCK.filter(d => d.group === 'entretien').map(d => d.id))}
    ${section('Ajoutés par vous', mine)}
    <form data-f="restockAdd" class="card stack"><h3 class="section-title">Ajouter un produit</h3>
      <label class="field">Nom<input type="text" name="name" maxlength="60" required autocomplete="off" placeholder="ex. croquettes du chat, couches, piles"></label>
      <label class="field">Environ tous les<select name="days">${EVERY.map(x => `<option value="${x}" ${x === 30 ? 'selected' : ''}>${x} jours</option>`).join('')}</select></label>
      <button class="btn ghost">Ajouter</button></form>
    <p class="small muted">Cocher = suivi. Le rythme part d'une estimation pour ${esc(plural(n, 'personne'))}, puis suit l'écart réel entre vos achats notés (coche dans la liste, facture lue). Deux achats à moins de 5 jours comptent pour un.</p>`;
}

function itemHtml(id: string): string {
  const s = S(), it = s.restock[id], d = RESTOCK_DEF[id], n = people();
  if (!it && !d) return `${sheetHead('Produit retiré')}<p>Ce produit n'est plus suivi.</p>`;
  const name = nameOf(id, it), r = it ? rhythm(s, id) : null, due = it?.on ? nextDue(s, id) : null, last = it ? lastBought(it) : null;
  const forced = !!(it?.due && (!last || last < it.due.set));
  const est = estimate(d, n), history = it ? trips(it.bought).slice(-5).reverse() : [];
  const freq = `<label class="field">Rythme<select data-c="restockDays" data-id="${esc(id)}">${d ? `<option value="" ${it?.days == null ? 'selected' : ''}>Automatique${r && r.basis !== 'choisi' ? ` (≈ ${r.days} jours)` : est ? ` (≈ ${est} jours)` : ''}</option>` : ''}
    ${EVERY.map(x => `<option value="${x}" ${it?.days === x ? 'selected' : ''}>Tous les ${x} jours</option>`).join('')}</select></label>`;
  return `${sheetHead(`🧴 ${esc(name)}`, esc(packOf(id, n) || 'Ajouté par vous'))}
    ${it?.on && due ? `<section class="card stack">
      <p><strong>Prochain achat : ${esc(dueText(due))}</strong>${forced ? ' · date choisie par vous' : ''}</p>
      ${r ? `<p class="small">${esc(capitalize(rhythmText(r)))}.</p>` : ''}
      <div class="actions"><button class="btn soft" data-a="restockNow" data-id="${esc(id)}">Il en faut maintenant</button>
        <button class="btn ghost" data-a="restockLater" data-id="${esc(id)}">Il en reste encore</button>
        <button class="btn ghost" data-a="restockBought" data-id="${esc(id)}">Acheté aujourd'hui</button>
        ${forced ? `<button class="btn quiet" data-a="restockAuto" data-id="${esc(id)}">Revenir au rythme calculé</button>` : ''}</div>
    </section>` : `<p class="banner info">Pas suivi : il n'apparaît pas dans les courses.</p>`}
    ${it?.on ? freq : ''}
    ${d ? `<section class="card stack"><h3 class="section-title">Estimation de départ</h3><p class="small">≈ tous les ${est} jours pour ${esc(plural(n, 'personne'))}${d.share === 'partage' ? ` (${d.days} jours pour une personne)` : d.share === 'chacun' ? ' (un par personne)' : ' (quel que soit le nombre de personnes)'} : ${esc(d.why)}.</p>
      <p class="small muted">Une hypothèse, pas une mesure : dès deux achats notés, c'est votre rythme réel qui compte.</p></section>` : ''}
    <section class="card stack"><h3 class="section-title">Achats notés</h3>${history.length ? `<ul class="list">${history.map(x => `<li class="small">${esc(fmtDayShort(x))} ${x.slice(0, 4)}</li>`).join('')}</ul>` : '<p class="small muted">Aucun pour l\'instant : cochez-le dans la liste quand il est acheté, ou lisez la facture du drive.</p>'}</section>
    <button class="btn ${it?.on ? 'quiet' : 'soft'}" data-a="restockToggle" data-id="${esc(id)}">${it?.on ? 'Ne plus suivre' : 'Suivre ce produit'}</button>`;
}

const setOn = (id: string, on: boolean): Draft => ({ t: 'restock.set', p: { id, on, day: today() } });

SUBMIT['restockStart'] = data => {
  const ids = data.getAll('on').map(String).filter(id => RESTOCK_DEF[id]);
  if (!ids.length) { toast('Cochez au moins un produit'); return; }
  dispatch(ids.map(id => setOn(id, true)), { toast: `${plural(ids.length, 'produit suivi', 'produits suivis')} : ils reviendront dans les courses au bon moment` });
};
SUBMIT['restockAdd'] = (data, form) => {
  const name = capitalize(String(data.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)), days = Number(data.get('days'));
  if (!name || !EVERY.includes(days as typeof EVERY[number])) return;
  dispatch([{ t: 'restock.set', p: { id: `p${newId(10)}`, on: true, day: today(), name, days } }], { toast: `${name} : suivi, tous les ${days} jours` });
  form.reset();
};
CHANGE['restockOn'] = (d, el) => { const id = d['id'] ?? ''; dispatch([setOn(id, (el as HTMLInputElement).checked)]); };
CLICK['restockToggle'] = d => { const id = d['id'] ?? '', it = S().restock[id]; dispatch([setOn(id, !it?.on)], { toast: `${nameOf(id, it)} : ${it?.on ? 'plus suivi' : 'suivi'}` }); };
CHANGE['restockDays'] = (d, el) => {
  const id = d['id'] ?? '', it = S().restock[id], v = (el as HTMLSelectElement).value;
  if (!it) return;
  dispatch([{ t: 'restock.set', p: { id, on: it.on, day: today(), days: v ? Number(v) : null } }], { toast: v ? `${nameOf(id, it)} : tous les ${v} jours` : `${nameOf(id, it)} : rythme automatique` });
};
CLICK['restockNow'] = d => { const id = d['id'] ?? ''; dispatch([{ t: 'restock.due', p: { id, due: today(), day: today() } }], { toast: `${nameOf(id, S().restock[id])} : dans les courses de cette semaine` }); };
CLICK['restockLater'] = d => {
  const id = d['id'] ?? '', r = rhythm(S(), id), was = nextDue(S(), id);
  if (!r) return;
  // Reporté depuis la date prévue (ou aujourd'hui si elle est passée) : « il en reste » ne l'avance jamais.
  const due = addDays(was && was > today() ? was : today(), later(r.days));
  dispatch([{ t: 'restock.due', p: { id, due, day: today() } }], { toast: `${nameOf(id, S().restock[id])} : reporté au ${fmtDayShort(due)}` });
};
CLICK['restockAuto'] = d => { const id = d['id'] ?? ''; dispatch([{ t: 'restock.due', p: { id, due: null, day: today() } }], { toast: 'Rythme calculé' }); };
CLICK['restockBought'] = d => { restockCheck(d['id'] ?? '', true); };
CLICK['restockList'] = () => openRestock();
CLICK['restockItem'] = d => openRestockItem(d['id'] ?? '');

// Coche dans la liste : achat noté aujourd'hui ; décochée : le dernier passage noté est retiré (toutes ses dates).
export function restockCheck(id: string, on: boolean): void {
  const it = S().restock[id];
  if (!it) return;
  const name = nameOf(id, it);
  if (on) {
    dispatch([{ t: 'restock.bought', p: { id, day: today(), bought: true } }]);
    const next = nextDue(S(), id);
    toast(next ? `${name} : acheté. Prochain rappel ${fmtDayShort(next)}` : `${name} : acheté`);
    return;
  }
  const last = lastBought(it);
  if (last) dispatch(it.bought.filter(x => x >= last).map(day => ({ t: 'restock.bought' as const, p: { id, day, bought: false } })), { toast: `${name} : achat retiré` });
}
CHANGE['restockCheck'] = (d, el) => restockCheck(d['id'] ?? '', (el as HTMLInputElement).checked);
