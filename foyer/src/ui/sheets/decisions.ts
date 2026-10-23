// « À régler » (Aujourd'hui) et « Décisions automatiques » (Réglages) : la file ne montre que ce qu'aucune règle n'a tranché ;
// un toucher règle une carte ; « … » la remet à plus tard (24 h) ou mène à la règle à décider une fois pour toutes.
import { type LeftoverRule, LEFTOVER_RULES } from '../../core/model.ts';
import { type Exception, exceptions } from '../../core/exceptions.ts';
import type { Today } from '../../core/today.ts';
import { deriveToday } from '../../core/today.ts';
import { SNOOZE_MAX_MS } from '../../core/reduce.ts';
import { A, S, dispatch, me } from '../state.ts';
import { esc, openSheet, sheetHead, toast } from '../dom.ts';
import { CLICK, CHANGE } from '../registry.ts';

const CHIP: Record<Exception['code'], [string, string]> = {
  conflit: ['conflit', 'À résoudre'], personne: ['attention', 'Repas'], cuisson: ['attention', 'En cuisine'],
  surveille: ['attention', 'Bientôt'], restes: ['info', 'Restes'], semaine: ['manque', 'À décider'],
};
const OPEN: Record<'slot' | 'watch' | 'ack' | 'propose', (arg: string) => string> = {
  slot: a => `data-a="slot" data-k="${esc(a)}"`, watch: a => `data-a="watch" data-id="${esc(a)}"`,
  ack: a => `data-a="ack" data-id="${esc(a)}"`, propose: a => `data-a="propose"${a ? ` data-week="${esc(a)}"` : ''}`,
};

function card(x: Exception): string {
  const [cls, tag] = CHIP[x.code];
  const acts = x.actions.map((a, i) => `<button class="btn small-btn${i ? ' ghost' : ''}" ${'drafts' in a ? `data-a="excDo" data-key="${esc(x.key)}" data-i="${i}"` : OPEN[a.open](a.arg)}>${esc(a.label)}</button>`).join('');
  return `<li class="exc"><p class="exc-title"><span class="chip ${cls}">${tag}</span> ${esc(x.title)}</p>${x.sub ? `<p class="small muted">${esc(x.sub)}</p>` : ''}
    ${acts ? `<div class="actions">${acts}</div>` : ''}<details class="exc-more"><summary aria-label="Plus tard ou règle : ${esc(x.title)}">Plus tard…</summary>
      <div class="actions"><button class="btn small-btn ghost" data-a="excSnooze" data-key="${esc(x.key)}">Plus tard (demain)</button>${x.rule ? '<button class="btn small-btn ghost" data-a="decisions">Décider une règle pour toujours</button>' : ''}</div></details></li>`;
}

// Section « À régler » : 5 cartes au plus, triées (échéance proche, blocage, repas) ; le reste replié.
export function reglerSection(t: Today): string {
  const { shown, hidden } = exceptions(A.r, t, me(), A.now());
  if (!shown.length) return '';
  return `<section class="card stack" aria-labelledby="exc-h"><h2 id="exc-h">À régler</h2><ul class="exc-list">${shown.map(card).join('')}</ul>
    ${hidden.length ? `<details><summary>+ ${hidden.length} autre${hidden.length > 1 ? 's' : ''}</summary><ul class="exc-list">${hidden.map(card).join('')}</ul></details>` : ''}</section>`;
}

const live = (): Exception[] => { const t = deriveToday(A.r, A.now()), x = exceptions(A.r, t, me(), A.now()); return [...x.shown, ...x.hidden]; };
CLICK['excDo'] = d => {
  const x = live().find(e => e.key === d['key']), a = x?.actions[Number(d['i'])];
  if (!x || !a || !('drafts' in a)) { toast('Déjà réglé'); A.render(); return; }
  dispatch(a.drafts, { toast: `${x.title.split(' : ')[0]} : ${a.label.toLowerCase()}` });
};
CLICK['excSnooze'] = d => {
  const key = d['key'] ?? '';
  dispatch([{ t: 'exc.snooze', p: { key, until: new Date(A.now().getTime() + SNOOZE_MAX_MS).toISOString() } }], { toast: 'Remis à demain' });
};

/* ---------- Décisions automatiques ---------- */

export const LEFTOVER_TEXT: Record<LeftoverRule, { label: string; example: string }> = {
  auto: { label: 'Proposés d\'office', example: '« 2 portions de lasagnes → demain midi » : un toucher pour confirmer ; posés tout seuls dans une semaine générée.' },
  suggest: { label: 'Me proposer des créneaux', example: '« 2 portions de lasagnes en attente : demain midi, vendredi soir… » : vous choisissez.' },
  manual: { label: 'Je m\'en occupe', example: 'Rien n\'est signalé ; les restes restent dans les idées du repas.' },
};
export function decisionsSummary(): string {
  const s = S(), rule = s.settings.leftovers ?? 'auto';
  return `Restes : ${LEFTOVER_TEXT[rule].label.toLowerCase()} · boîtes du midi : ${s.settings.boxesFromDinner ? 'dîner de la veille' : 'à choisir'}`;
}
export function openDecisions(): void {
  openSheet({ id: 'decisions', render: () => {
    const s = S(), rule = s.settings.leftovers ?? 'auto', agendaRules = Object.keys(s.agenda.rules).length;
    return `${sheetHead('Décisions automatiques', 'Décidées une fois, appliquées ensuite sans vous demander. Aujourd\'hui ne montre que ce qu\'aucune règle ne tranche.')}
    <section class="card stack"><h3 class="section-title">Restes</h3>
      <div class="seg" role="radiogroup" aria-label="Règle des restes">${LEFTOVER_RULES.map(r => `<label><input type="radio" name="leftovers" value="${r}" data-c="leftoverRule" ${rule === r ? 'checked' : ''}>${LEFTOVER_TEXT[r].label}</label>`).join('')}</div>
      <p class="small muted">Exemple : ${esc(LEFTOVER_TEXT[rule].example)}</p></section>
    <section class="card stack"><h3 class="section-title">Boîtes du midi</h3>
      <label class="item"><input type="checkbox" data-c="boxes" ${s.settings.boxesFromDinner ? 'checked' : ''}><span>Les boîtes du midi viennent du dîner de la veille (proposition automatique, toujours à valider)</span></label></section>
    <section class="card stack"><h3 class="section-title">Agenda</h3>
      <p>${agendaRules ? `${agendaRules} décision${agendaRules > 1 ? 's' : ''} mémorisée${agendaRules > 1 ? 's' : ''} (« toujours appliquer » ou « ignorer » un événement).` : 'Aucune décision mémorisée.'}</p>
      <p class="small muted">Elles se revoient dans Réglages › Agendas.</p></section>
    <p class="small muted">« Plus tard » sur une carte la masque 24 h pour vous seul. Remise trois fois, Foyer propose d'en faire une règle.</p>`;
  } });
}
CLICK['decisions'] = () => openDecisions();
CHANGE['leftoverRule'] = (_d, el) => {
  const v = (el as HTMLInputElement).value as LeftoverRule;
  dispatch([{ t: 'settings.set', p: { leftovers: v } }], { toast: `Restes : ${LEFTOVER_TEXT[v].label.toLowerCase()}` });
};
