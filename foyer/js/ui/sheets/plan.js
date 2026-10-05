// Planifier en un geste : propositions à relire (« Autre idée », « Retirer »), reprise d'une semaine, préparation en avance.
import { addDays, fmtDayShort, fmtSlot, slotKey, SLOTS } from '../../core/dates.js';
import { current } from '../../core/model.js';
import { copyWeek, acceptDrafts, rank, nextDiscovery } from '../../core/propose.js';
import { loadCatalog } from '../catalog.js';
import { weekPreps } from '../../core/shopping.js';
import { portions } from '../../core/plan.js';
import { prepTitle, capital } from '../../core/status.js';
import { A, S, clock, dispatch, thisWeek } from '../state.js';
import { weekIcs, weekItems } from '../../core/ics.js';
import { openSheet, sheetHead, closeSheet, esc, toast, saveFile } from '../dom.js';
import { CLICK, num } from '../registry.js';
import { openRecipe } from './recipe.js';
import { openWeekDeck } from './deck.js';
let props = [];
let tried = new Map();
let heading = '';
let note = '';
let curWeek = '';
function dishLabel(p) {
    const s = S(), today = clock().date;
    const d = p.dish;
    if (!d)
        return 'Présences seulement (plat à choisir)';
    if (d.kind === 'outside')
        return d.note ? `Extérieur : ${d.note}` : 'Repas extérieur';
    if (d.kind === 'cook') {
        const r = s.recipes[d.recipe];
        return r ? current(r).name : 'Plat';
    }
    if (d.kind === 'new')
        return `Nouveau : ${d.catalog.title}`;
    const src = props.find(x => x.slot === d.source)?.dish;
    const name = src?.kind === 'cook' || src?.kind === 'new' ? dishLabel({ ...props.find(x => x.slot === d.source) })
        : (() => { const sd = s.slots[d.source]?.dish; return sd?.kind === 'cook' ? prepTitle(s, s.preps[sd.prep]) : 'plat'; })();
    return `Restes de ${name} (${fmtSlot(d.source, today)})`;
}
function openProposals(title, list, extra = '') {
    props = list;
    tried = new Map();
    heading = title;
    note = extra;
    openSheet({ id: 'proposals', render });
}
function render() {
    const today = clock().date;
    const cooks = props.filter(p => p.dish?.kind === 'cook' || p.dish?.kind === 'new').length;
    return `${sheetHead(esc(heading), 'Proposition : rien n\'est enregistré avant « Accepter ».')}
  ${note ? `<p class="banner info">${esc(note)}</p>` : ''}
  ${props.length ? `<ul class="list">${props.map((p, i) => `<li><div class="item"><span class="grow"><span class="sub">${esc(capital(fmtSlot(p.slot, today)))}</span><br>
    <span class="title">${esc(dishLabel(p))}</span><br><span class="sub">${esc(p.reason)}</span>${p.dish?.kind === 'new' ? `<br><a class="small" href="${esc(p.dish.catalog.url)}" target="_blank" rel="noopener noreferrer">Voir la recette sur Wikilivres</a><span class="small muted"> · ajoutée à « Nos plats » si vous acceptez</span>` : ''}</span>
    <span class="stack">${p.dish?.kind === 'cook' || p.dish?.kind === 'new' ? `<button class="btn small-btn ghost" data-a="propAlt" data-n="${i}">Autre idée</button>` : ''}
    <button class="btn small-btn quiet" data-a="propDrop" data-n="${i}" aria-label="Retirer la proposition pour ${esc(fmtSlot(p.slot, today))}">Retirer</button></span></div></li>`).join('')}</ul>
  <div class="actions"><button class="btn" data-a="propOk">Accepter ${props.length} proposition${props.length > 1 ? 's' : ''}</button><button class="btn ghost" data-a="close">Annuler</button></div>
  <p class="small muted">${cooks} plat${cooks > 1 ? 's' : ''} à cuisiner. Les courses et les tâches se mettent à jour dès l'acceptation.</p>`
        : `<p class="empty"><strong>Rien à proposer</strong>${Object.keys(S().recipes).length ? 'Les repas de la semaine sont déjà prévus, ou personne ne mange à la maison.' : 'Ajoutez d\'abord quelques plats que vous faites souvent.'}</p>
    ${Object.keys(S().recipes).length ? '' : '<button class="btn block" data-a="newRecipe">Ajouter un plat</button>'}`}`;
}
CLICK['propAlt'] = async (d) => {
    const i = num(d['n']), p = props[i];
    if (p?.dish?.kind === 'new') {
        const cat = await loadCatalog();
        const t = tried.get(p.slot) ?? new Set([p.dish.catalog.id]);
        const others = props.flatMap(x => (x.dish?.kind === 'new' ? [x.dish.catalog.id] : []));
        const next = cat ? nextDiscovery(S(), cat, p.slot, curWeek, new Set([...others, ...t])) : undefined;
        if (!next) {
            toast('Plus d\'autre découverte pour ce repas');
            return;
        }
        t.add(next.recipe.id);
        tried.set(p.slot, t);
        props[i] = { ...p, dish: { kind: 'new', catalog: next.recipe, extra: 0 }, reason: next.reason };
        openSheet({ id: 'proposals', render });
        return;
    }
    if (!p || p.dish?.kind !== 'cook')
        return;
    const t = tried.get(p.slot) ?? new Set([p.dish.recipe]);
    const used = new Set(props.filter((x, j) => j !== i && x.dish?.kind === 'cook').map(x => x.dish.recipe));
    const next = rank(S(), p.slot, clock().date, new Set([...used, ...t]))[0];
    if (!next) {
        tried.delete(p.slot);
        toast('Plus d\'autre idée parmi vos plats : on recommence au début.');
        props[i] = { ...p, dish: { ...p.dish, recipe: rank(S(), p.slot, clock().date, used)[0]?.recipe ?? p.dish.recipe } };
    }
    else {
        t.add(next.recipe);
        tried.set(p.slot, t);
        props[i] = { ...p, dish: { kind: 'cook', recipe: next.recipe, extra: p.dish.extra }, reason: next.reason };
    }
    openSheet({ id: 'proposals', render });
};
CLICK['propDrop'] = d => {
    const p = props[num(d['n'])];
    if (!p)
        return;
    props = props.filter(x => x !== p && !(x.dish?.kind === 'from' && x.dish.source === p.slot && p.dish?.kind === 'cook'));
    openSheet({ id: 'proposals', render });
};
CLICK['propOk'] = () => {
    const drafts = acceptDrafts(S(), props);
    const n = props.length;
    closeSheet();
    dispatch(drafts, { toast: `${n} repas prévu${n > 1 ? 's' : ''} · courses à jour` });
};
// « Proposer » : le menu en cartes à balayer (sheets/deck.ts).
CLICK['propose'] = async (d) => { const week = d['week'] ?? thisWeek(); curWeek = week; await openWeekDeck(week); };
CLICK['copyWeek'] = d => {
    const target = d['week'] ?? thisWeek();
    const s = S();
    const weeks = [];
    for (let i = 1; i <= 8; i++) {
        const w = addDays(target, -7 * i);
        let n = 0;
        for (let j = 0; j < 7; j++)
            for (const sl of SLOTS)
                if (s.slots[slotKey(addDays(w, j), sl)]?.dish)
                    n++;
        if (n)
            weeks.push({ w, n });
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
                const r = s.recipes[p.recipe];
                const c = r ? current(r) : null;
                const missing = [!c?.ingredients.length ? 'ingrédients' : '', c?.ingredients.length && !c.yield ? 'rendement' : '', !c?.steps.length ? 'étapes' : ''].filter(Boolean);
                return `<li><div class="item"><span class="grow"><span class="title">${esc(prepTitle(s, p))} · ${portions(s, p).planned} portions</span><br>
        <span class="sub">${esc(capital(fmtSlot(p.slot ?? '', today)))}${c?.ahead.length ? ` · à faire avant : ${esc(c.ahead.map(a => a.label).join(', '))}` : ''}</span><br>
        ${missing.length ? `<span class="chip manque">Non renseigné : ${missing.join(', ')}</span>` : '<span class="chip s-pret">Recette complète</span>'}</span>
        <span class="stack"><button class="btn small-btn ghost" data-a="cook" data-id="${p.id}">Mode cuisine</button>${missing.length ? `<button class="btn small-btn quiet" data-a="recipe" data-id="${p.recipe}">Compléter</button>` : ''}</span></div></li>`;
            }).join('')}</ul>
      <p class="small muted">Foyer liste ce que vous avez renseigné. Il ne calcule pas d'ordre de cuisson ni de durée totale, et ne recommande aucune conservation.</p>`
                : '<p class="empty"><strong>Rien à préparer</strong>Aucun plat à cuisiner cette semaine, ou tout est déjà déclaré préparé.</p>'}`;
        } });
};
// Rappels dans l'agenda du téléphone (fichier .ics), sans serveur ni notification.
CLICK['agenda'] = d => {
    const week = d['week'] ?? thisWeek();
    const from = clock().date;
    const n = weekItems(S(), week, false, from).length, m = weekItems(S(), week, true, from).length;
    openSheet({ id: 'agenda', render: () => `${sheetHead('Ajouter la semaine à l\'agenda', `Semaine du ${esc(fmtDayShort(week))} · fichier à ouvrir avec Calendrier`)}
    <button class="btn block" data-a="agendaGo" data-week="${week}" data-meals="" ${n ? '' : 'disabled'}>Rappels seulement (${n})</button>
    <button class="btn ghost block" data-a="agendaGo" data-week="${week}" data-meals="1" ${m ? '' : 'disabled'}>Repas et rappels (${m})</button>
    <p class="small muted">Rappels : « à faire la veille » à 19 h, « le matin » à 8 h, boîtes à préparer la veille à 21 h. Si le planning change, refaites l'export : les mêmes événements sont mis à jour plutôt que dupliqués (selon l'application d'agenda).</p>` });
};
CLICK['agendaGo'] = async (d) => {
    const week = d['week'] ?? thisWeek();
    const r = await saveFile(`foyer-semaine-${week}.ics`, 'text/calendar', weekIcs(S(), week, !!d['meals'], A.now(), `${location.origin}${location.pathname}`, clock().date));
    closeSheet();
    if (r !== 'annule')
        toast(r === 'partage' ? 'Choisissez « Calendrier » pour ajouter les rappels' : 'Fichier agenda téléchargé : ouvrez-le pour ajouter les rappels');
};
CLICK['completeRecipe'] = d => openRecipe(d['id'] ?? null);
