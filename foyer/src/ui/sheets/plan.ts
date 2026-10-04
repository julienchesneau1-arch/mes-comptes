// Planifier en un geste : propositions à relire (« Autre idée », « Retirer »), reprise d'une semaine, préparation en avance.
import { type LocalDate, type SlotKey, addDays, fmtDayShort, fmtSlot, slotKey, SLOTS } from '../../core/dates.ts';
import { current } from '../../core/model.ts';
import { type Proposal, proposeWeek, copyWeek, acceptDrafts, rank } from '../../core/propose.ts';
import { weekPreps } from '../../core/shopping.ts';
import { portions } from '../../core/plan.ts';
import { prepTitle, capital } from '../../core/status.ts';
import { S, clock, dispatch, thisWeek } from '../state.ts';
import { openSheet, sheetHead, closeSheet, esc, toast } from '../dom.ts';
import { CLICK, num } from '../registry.ts';
import { openRecipe } from './recipe.ts';

let props: Proposal[] = [];
let tried = new Map<SlotKey, Set<string>>();
let heading = '';
let note = '';

function dishLabel(p: Proposal): string {
  const s = S(), today = clock().date;
  const d = p.dish;
  if (!d) return 'Présences seulement (plat à choisir)';
  if (d.kind === 'outside') return d.note ? `Extérieur : ${d.note}` : 'Repas extérieur';
  if (d.kind === 'cook') { const r = s.recipes[d.recipe]; return r ? current(r).name : 'Plat'; }
  const src = props.find(x => x.slot === d.source)?.dish;
  const name = src?.kind === 'cook' ? dishLabel({ ...props.find(x => x.slot === d.source) as Proposal })
    : (() => { const sd = s.slots[d.source]?.dish; return sd?.kind === 'cook' ? prepTitle(s, s.preps[sd.prep]) : 'plat'; })();
  return `Restes de ${name} (${fmtSlot(d.source, today)})`;
}

function openProposals(title: string, list: Proposal[], extra = ''): void {
  props = list; tried = new Map(); heading = title; note = extra;
  openSheet({ id: 'proposals', render });
}

function render(): string {
  const today = clock().date;
  const cooks = props.filter(p => p.dish?.kind === 'cook').length;
  return `${sheetHead(esc(heading), 'Proposition : rien n\'est enregistré avant « Accepter ».')}
  ${note ? `<p class="banner info">${esc(note)}</p>` : ''}
  ${props.length ? `<ul class="list">${props.map((p, i) => `<li><div class="item"><span class="grow"><span class="sub">${esc(capital(fmtSlot(p.slot, today)))}</span><br>
    <span class="title">${esc(dishLabel(p))}</span><br><span class="sub">${esc(p.reason)}</span></span>
    <span class="stack">${p.dish?.kind === 'cook' ? `<button class="btn small-btn ghost" data-a="propAlt" data-n="${i}">Autre idée</button>` : ''}
    <button class="btn small-btn quiet" data-a="propDrop" data-n="${i}" aria-label="Retirer la proposition pour ${esc(fmtSlot(p.slot, today))}">Retirer</button></span></div></li>`).join('')}</ul>
  <div class="actions"><button class="btn" data-a="propOk">Accepter ${props.length} proposition${props.length > 1 ? 's' : ''}</button><button class="btn ghost" data-a="close">Annuler</button></div>
  <p class="small muted">${cooks} plat${cooks > 1 ? 's' : ''} à cuisiner. Les courses et les tâches se mettent à jour dès l'acceptation.</p>`
    : `<p class="empty"><strong>Rien à proposer</strong>${Object.keys(S().recipes).length ? 'Les repas de la semaine sont déjà prévus, ou personne ne mange à la maison.' : 'Ajoutez d\'abord quelques plats que vous faites souvent.'}</p>
    ${Object.keys(S().recipes).length ? '' : '<button class="btn block" data-a="newRecipe">Ajouter un plat</button>'}`}`;
}

CLICK['propAlt'] = d => {
  const i = num(d['n']), p = props[i];
  if (!p || p.dish?.kind !== 'cook') return;
  const t = tried.get(p.slot) ?? new Set<string>([p.dish.recipe]);
  const used = new Set(props.filter((x, j) => j !== i && x.dish?.kind === 'cook').map(x => (x.dish as { recipe: string }).recipe));
  const next = rank(S(), p.slot, clock().date, new Set([...used, ...t]))[0];
  if (!next) { tried.delete(p.slot); toast('Plus d\'autre idée parmi vos plats : on recommence au début.'); props[i] = { ...p, dish: { ...p.dish, recipe: rank(S(), p.slot, clock().date, used)[0]?.recipe ?? p.dish.recipe } }; }
  else { t.add(next.recipe); tried.set(p.slot, t); props[i] = { ...p, dish: { kind: 'cook', recipe: next.recipe, extra: p.dish.extra }, reason: next.reason }; }
  openSheet({ id: 'proposals', render });
};
CLICK['propDrop'] = d => {
  const p = props[num(d['n'])];
  if (!p) return;
  props = props.filter(x => x !== p && !(x.dish?.kind === 'from' && x.dish.source === p.slot && p.dish?.kind === 'cook'));
  openSheet({ id: 'proposals', render });
};
CLICK['propOk'] = () => {
  const drafts = acceptDrafts(S(), props);
  const n = props.length;
  closeSheet();
  dispatch(drafts, { toast: `${n} repas prévu${n > 1 ? 's' : ''} · courses à jour` });
};

CLICK['propose'] = d => {
  const c = clock();
  const week = d['week'] ?? thisWeek();
  openProposals(`Proposer la semaine du ${fmtDayShort(week)}`, proposeWeek(S(), week, c.date, c.hour));
};

CLICK['copyWeek'] = d => {
  const target = d['week'] ?? thisWeek();
  const s = S();
  const weeks: { w: LocalDate; n: number }[] = [];
  for (let i = 1; i <= 8; i++) {
    const w = addDays(target, -7 * i);
    let n = 0;
    for (let j = 0; j < 7; j++) for (const sl of SLOTS) if (s.slots[slotKey(addDays(w, j), sl)]?.dish) n++;
    if (n) weeks.push({ w, n });
  }
  openSheet({ id: 'copy', render: () => `${sheetHead(`Reprendre une semaine pour celle du ${esc(fmtDayShort(target))}`, 'Copiés : plats, présences et invités. Jamais les états préparé/mangé, les coches, les vérifications ni les dates.')}
    ${weeks.length ? `<ul class="list">${weeks.map(x => `<li><button class="item-btn" data-a="copyFrom" data-from="${x.w}" data-to="${target}"><span class="grow"><span class="title">Semaine du ${esc(fmtDayShort(x.w))}</span><br><span class="sub">${x.n} repas prévus</span></span></button></li>`).join('')}</ul>`
      : '<p class="empty"><strong>Aucune semaine précédente</strong>Les semaines planifiées apparaîtront ici.</p>'}` });
};
CLICK['copyFrom'] = d => {
  const from = d['from'] ?? '', to = d['to'] ?? '';
  const r = copyWeek(S(), from, to);
  openProposals(`Brouillon depuis la semaine du ${fmtDayShort(from)}`, r.proposals, r.skipped.length ? `Déjà prévus, non remplacés : ${r.skipped.map(k => fmtSlot(k, clock().date)).join(', ')}` : '');
};

// « Préparer en avance » : les plats de la semaine, leurs tâches renseignées et ce qui manque. Pas d'ordonnancement calculé.
CLICK['ahead'] = d => {
  const week = d['week'] ?? thisWeek();
  openSheet({ id: 'ahead', render: () => {
    const s = S(), today = clock().date;
    const preps = weekPreps(s, week).filter(p => !p.done);
    return `${sheetHead('Préparer en avance', `Semaine du ${esc(fmtDayShort(week))} · plats pas encore préparés`)}
    ${preps.length ? `<ul class="list">${preps.map(p => {
      const r = s.recipes[p.recipe]; const c = r ? current(r) : null;
      const missing = [!c?.ingredients.length ? 'ingrédients' : '', c?.ingredients.length && !c.yield ? 'rendement' : '', !c?.steps.length ? 'étapes' : ''].filter(Boolean);
      return `<li><div class="item"><span class="grow"><span class="title">${esc(prepTitle(s, p))} · ${portions(s, p).planned} portions</span><br>
        <span class="sub">${esc(capital(fmtSlot(p.slot ?? '', today)))}${c?.ahead.length ? ` · à faire avant : ${esc(c.ahead.map(a => a.label).join(', '))}` : ''}</span><br>
        ${missing.length ? `<span class="chip manque">Non renseigné : ${missing.join(', ')}</span>` : '<span class="chip s-pret">Recette complète</span>'}</span>
        <span class="stack"><button class="btn small-btn ghost" data-a="cook" data-id="${p.id}">Mode cuisine</button>${missing.length ? `<button class="btn small-btn quiet" data-a="recipe" data-id="${p.recipe}">Compléter</button>` : ''}</span></div></li>`; }).join('')}</ul>
      <p class="small muted">Foyer liste ce que vous avez renseigné. Il ne calcule pas d'ordre de cuisson ni de durée totale, et ne recommande aucune conservation.</p>`
      : '<p class="empty"><strong>Rien à préparer</strong>Aucun plat à cuisiner cette semaine, ou tout est déjà déclaré préparé.</p>'}`;
  } });
};
CLICK['completeRecipe'] = d => openRecipe(d['id'] ?? null);
