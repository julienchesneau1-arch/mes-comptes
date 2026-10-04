// Un créneau : qui mange, quel plat, combien de portions, et les actions (préparé, mangé, déplacer, extérieur, retirer).
import { parseSlot, fmtDay, fmtSlot, addDays, slotKey, SLOTS, slotOrder, daysBetween, weekday } from '../../core/dates.js';
import { current } from '../../core/model.js';
import { portions, servings, eaters, dependents } from '../../core/plan.js';
import { slotView, STATUS_LABEL, problems, prepTitle, capital } from '../../core/status.js';
import { portionsDetail } from '../../core/today.js';
import { lineLabel } from '../../core/ingredients.js';
import { rank, leftovers } from '../../core/propose.js';
import { setDish, setLeftovers, setOutside, removeDish, move, eat, declarePrepared } from '../../core/commands.js';
import { newId } from '../../core/reduce.js';
import { activeWatch } from '../../core/watch.js';
import { norm } from '../../core/text.js';
import { A, S, clock, dispatch, undo } from '../state.js';
import { openSheet, sheetHead, closeSheet, esc } from '../dom.js';
import { CLICK, CHANGE, INPUT, SUBMIT, num } from '../registry.js';
import { openPreview } from './preview.js';
const title = (k) => { const p = parseSlot(k); return p ? `${capital(fmtDay(p.date))} · ${p.slot}` : k; };
/* ---------- Feuille du créneau ---------- */
export function openSlot(k) { openSheet({ id: `slot:${k}`, render: () => slotHtml(k) }); }
function slotHtml(k) {
    const s = S(), c = clock();
    const v = slotView(s, k, c.date, c.hour);
    const slot = s.slots[k];
    const people = eaters(s, k);
    const presence = people.map(e => {
        const mk = s.agenda.marks[`${k}|${e.id}`];
        return `<div class="person"><span class="title">${esc(e.name)}${mk && !mk.overridden ? `<br><span class="sub">d'après l'agenda : « ${esc(mk.title)} »</span>` : ''}</span>
    <div class="seg" role="radiogroup" aria-label="${esc(e.name)}, ${esc(fmtSlot(k, c.date))}">${['maison', 'boite', 'dehors'].map(p => `
      <label><input type="radio" name="pr-${e.id}" value="${p}" data-c="presence" data-k="${k}" data-m="${e.id}" ${e.presence === p ? 'checked' : ''}>${p === 'maison' ? 'Maison' : p === 'boite' ? 'Boîte' : 'Dehors'}</label>`).join('')}</div></div>`;
    }).join('');
    const guests = slot?.guests ?? 0;
    const probs = problems(A.r, c.date, c.hour).filter(p => p.slot === k || (v.prep && p.prep === v.prep.id));
    const watch = activeWatch(s.watch, c.date).filter(w => w.item.slot === k);
    return `${sheetHead(esc(title(k)), `<span class="chip s-${v.status}">${STATUS_LABEL[v.status]}</span> · ${v.servings} portion${v.servings > 1 ? 's' : ''} à servir`)}
  ${probs.length ? `<ul class="impacts">${probs.map(p => `<li class="${p.level === 'manque' ? 'attention' : p.level}">${esc(p.text)}</li>`).join('')}</ul>` : ''}
  <section class="card stack" aria-labelledby="who-h"><h3 id="who-h" class="section-title">Qui mange ?</h3>${presence}
    <div class="person"><span class="title">Invités</span><div class="stepper">
      <button class="icon-btn" data-a="guests" data-k="${k}" data-d="-1" aria-label="Un invité de moins" ${guests ? '' : 'disabled'}>−</button>
      <output aria-live="polite">${guests}</output>
      <button class="icon-btn" data-a="guests" data-k="${k}" data-d="1" aria-label="Un invité de plus">+</button></div></div>
    ${slot?.dish && slot.dish.kind !== 'outside' ? `<div class="person"><span class="title">Qui cuisine ?</span><div class="seg" role="radiogroup" aria-label="Qui cuisine ${esc(fmtSlot(k, c.date))}">
      <label><input type="radio" name="chef" value="" data-c="chef" data-k="${k}" ${slot.chef ? '' : 'checked'}>Pas décidé</label>
      ${s.members.map(m => `<label><input type="radio" name="chef" value="${m.id}" data-c="chef" data-k="${k}" ${slot.chef === m.id ? 'checked' : ''}>${esc(m.name)}</label>`).join('')}</div></div>` : ''}
    <p class="small muted">Boîte = mange un plat de la maison, emporté. Le rythme habituel se règle dans Maison › Réglages.</p></section>
  <section class="card stack" aria-labelledby="dish-h"><h3 id="dish-h" class="section-title">Au menu</h3>${dishHtml(k)}</section>
  ${watch.length ? `<section class="card stack"><h3 class="section-title">Produits surveillés liés</h3>${watch.map(w => `<p>${esc(w.item.name)} · ${esc(w.headline)}</p>`).join('')}</section>` : ''}`;
}
function dishHtml(k) {
    const s = S(), c = clock();
    const slot = s.slots[k];
    const d = slot?.dish;
    const n = servings(s, k);
    if (!d) {
        return `${n ? '' : '<p class="muted">Personne ne mange ici d\'après les présences. Vous pouvez tout de même prévoir un plat.</p>'}
    <div class="actions"><button class="btn" data-a="pick" data-k="${k}" data-back="slot">Choisir un plat</button>
    <button class="btn ghost" data-a="outside" data-k="${k}">Repas extérieur</button></div>`;
    }
    const eatenBy = slot?.eaten ? `<p class="chip s-mange">Mangé · ${slot.eaten.n} portion${slot.eaten.n > 1 ? 's' : ''}, déclaré par ${esc(s.members.find(m => m.id === slot.eaten?.by)?.name ?? 'quelqu\'un')}</p>
    <button class="btn ghost" data-a="uneat" data-k="${k}">Annuler « mangé »</button>` : '';
    const common = slot?.eaten ? '' : `<div class="actions"><button class="btn ghost" data-a="pick" data-k="${k}" data-back="slot">Changer</button>
    <button class="btn ghost" data-a="move" data-k="${k}">Déplacer</button>
    <button class="btn ghost" data-a="outside" data-k="${k}">Extérieur</button>
    <button class="btn ghost" data-a="remove" data-k="${k}">Retirer</button></div>`;
    if (d.kind === 'outside')
        return `<p class="title">${esc(d.note || 'Repas extérieur')}</p>
    <form data-f="outsideNote" data-k="${k}" class="row"><label class="field grow">Note<input type="text" name="note" maxlength="80" value="${esc(d.note)}" placeholder="Restaurant, chez des amis…"></label><button class="btn ghost">Enregistrer</button></form>
    <div class="actions"><button class="btn" data-a="pick" data-k="${k}" data-back="slot">Prévoir un plat à la place</button><button class="btn ghost" data-a="remove" data-k="${k}">Retirer</button></div>`;
    const prep = s.preps[d.prep];
    if (!prep)
        return `<p>Le plat dont venaient ces restes a été retiré.</p><div class="actions"><button class="btn" data-a="pick" data-k="${k}" data-back="slot">Choisir un plat</button><button class="btn ghost" data-a="remove" data-k="${k}">Vider</button></div>`;
    const r = s.recipes[prep.recipe];
    const rc = r ? current(r) : null;
    const pt = portions(s, prep);
    const name = esc(prepTitle(s, prep));
    const ingr = rc?.ingredients.length
        ? `<details><summary>${rc.ingredients.length} ingrédient${rc.ingredients.length > 1 ? 's' : ''} (pour ${rc.yield ?? '?'} portions de référence)</summary><ul class="parsed">${rc.ingredients.map(l => `<li>${esc(lineLabel(l))}</li>`).join('')}</ul></details>`
        : `<p class="chip manque">Ingrédients non renseignés : liste de courses partielle</p>`;
    const ahead = rc?.ahead.length ? `<p class="small">À faire avant : ${rc.ahead.map(a => `${esc(a.label)} (${a.when === 'veille' ? 'la veille' : 'le matin'})`).join(' · ')}</p>` : '';
    if (d.kind === 'from') {
        return `<p class="title">Restes : ${name}</p><p class="small muted">${esc(portionsDetail(s, prep, k, c.date))}</p>
    ${prep.slot ? `<p class="small">Cuisiné ${esc(fmtSlot(prep.slot, c.date))}${prep.done ? ', déclaré préparé' : ', pas encore déclaré préparé'}.</p>` : ''}
    ${eatenBy || `<div class="actions"><button class="btn" data-a="eat" data-k="${k}">On a mangé</button></div>`}${common}`;
    }
    const steps = rc?.steps.length ? `<button class="btn quiet" data-a="cook" data-id="${prep.id}">Voir les étapes (${rc.steps.length})</button>` : '';
    const extra = prep.done ? '' : `<div class="person"><span><span class="title">Portions en plus</span><br><span class="sub">sans destination, en plus des ${pt.serve + pt.linked} prévues</span></span>
    <div class="stepper"><button class="icon-btn" data-a="extra" data-id="${prep.id}" data-d="-1" aria-label="Une portion en plus de moins" ${prep.extra ? '' : 'disabled'}>−</button>
    <output aria-live="polite">${prep.extra}</output><button class="icon-btn" data-a="extra" data-id="${prep.id}" data-d="1" aria-label="Une portion en plus">+</button></div></div>`;
    const status = slot?.eaten ? eatenBy : `<div class="actions">
    ${prep.status === 'planned' ? `<button class="btn ghost" data-a="start" data-id="${prep.id}">Commencer</button>` : ''}
    ${prep.done ? `<button class="btn ghost" data-a="portions" data-id="${prep.id}">Portions…</button>` : `<button class="btn soft" data-a="prepared" data-id="${prep.id}" data-k="${k}">C'est préparé</button>`}
    <button class="btn" data-a="eat" data-k="${k}">On a mangé</button></div>`;
    return `<div class="row"><p class="title grow">${name}</p><button class="btn quiet" data-a="recipe" data-id="${prep.recipe}">Recette</button></div>
    <p class="small">${esc(portionsDetail(s, prep, k, c.date))}</p>${extra}${ingr}${ahead}${steps}${status}${common}`;
}
/* ---------- Choisir un plat ---------- */
let pickQ = '';
let pickBack;
export function openPick(k, back) { pickQ = ''; pickBack = back; openSheet({ id: `pick:${k}`, render: () => pickHtml(k) }); }
function pickHtml(k) {
    const s = S(), c = clock();
    const n = servings(s, k);
    const q = norm(pickQ);
    const ranked = rank(s, k, c.date).filter(x => !q || norm(x.name).includes(q));
    const left = leftovers(s, c.date).filter(x => x.free >= Math.max(1, n) && (!q || norm(x.name).includes(q)));
    // Plats prévus juste avant, pas encore préparés : on peut en cuisiner plus pour en garder.
    const before = Object.values(s.preps).filter(p => !p.done && p.slot && slotOrder(p.slot) < slotOrder(k) && daysBetween(parseSlot(p.slot)?.date ?? '', parseSlot(k)?.date ?? '') <= 3
        && !dependents(s, p.id).includes(k) && (!q || norm(prepTitle(s, p)).includes(q)));
    const exact = Object.values(s.recipes).some(r => norm(current(r).name) === q);
    return `${sheetHead(`Au menu ${esc(fmtSlot(k, c.date))}`, `${n} portion${n > 1 ? 's' : ''} à servir`)}
  <label class="field">Chercher ou créer un plat<input type="search" data-i="pickQ" data-k="${k}" value="${esc(pickQ)}" placeholder="Ex. : curry, lasagnes…" autocomplete="off" data-focus="pickq"></label>
  ${q && !exact ? `<button class="btn soft block" data-a="pickNew" data-k="${k}">Créer « ${esc(pickQ.trim())} » et le prévoir</button>` : ''}
  ${left.length || before.length ? `<section><h3 class="section-title">Restes (rien à cuisiner de plus)</h3><ul class="list">
    ${left.map(x => `<li><button class="item-btn" data-a="pickLeft" data-k="${k}" data-id="${x.prep}"><span class="grow"><span class="title">${esc(x.name)}</span><br><span class="sub">${x.free} portion${x.free > 1 ? 's' : ''} libre${x.free > 1 ? 's' : ''} · préparé ${x.age === 0 ? 'aujourd\'hui' : x.age === 1 ? 'hier' : `il y a ${x.age} jours`}</span></span></button></li>`).join('')}
    ${before.map(p => `<li><button class="item-btn" data-a="pickLeft" data-k="${k}" data-id="${p.id}"><span class="grow"><span class="title">${esc(prepTitle(s, p))} (en cuisiner plus)</span><br><span class="sub">prévu ${esc(fmtSlot(p.slot, c.date))} : +${n} portion${n > 1 ? 's' : ''} à préparer</span></span></button></li>`).join('')}
  </ul></section>` : ''}
  <section><h3 class="section-title">Vos plats</h3>${ranked.length ? `<ul class="list">${ranked.map(x => `<li><button class="item-btn" data-a="pickRecipe" data-k="${k}" data-id="${x.recipe}">
    <span class="grow"><span class="title">${esc(x.name)}</span><br><span class="sub">${esc(x.reason)}</span></span></button></li>`).join('')}</ul>`
        : `<p class="muted">${Object.keys(s.recipes).length ? 'Aucun plat ne correspond.' : 'Aucun plat enregistré : tapez un nom ci-dessus pour le créer.'}</p>`}</section>`;
}
INPUT['pickQ'] = (d, el) => { pickQ = el.value; openSheet({ id: `pick:${d['k']}`, render: () => pickHtml(d['k'] ?? '') }); };
function afterPick(k) { if (pickBack === 'slot')
    openSlot(k);
else
    closeSheet(); }
CLICK['pick'] = d => openPick(d['k'] ?? '', d['back']);
CLICK['pickRecipe'] = d => {
    const k = d['k'] ?? '', id = d['id'] ?? '';
    const name = S().recipes[id] ? current(S().recipes[id]).name : '';
    afterPick(k);
    dispatch(setDish(S(), k, id), { toast: `${name} prévu ${fmtSlot(k, clock().date)}` });
};
CLICK['pickLeft'] = d => {
    const k = d['k'] ?? '';
    afterPick(k);
    dispatch(setLeftovers(S(), k, d['id'] ?? ''), { toast: `Restes prévus ${fmtSlot(k, clock().date)}` });
};
CLICK['pickNew'] = d => {
    const k = d['k'] ?? '', name = pickQ.trim().slice(0, 80);
    if (!name)
        return;
    const id = newId();
    afterPick(k);
    dispatch([{ t: 'recipe.save', p: { recipe: id, content: { name: name.charAt(0).toUpperCase() + name.slice(1), yield: null, ingredients: [], steps: [], ahead: [], tags: [], note: '' } } },
        ...setDish(S(), k, id)], { toast: `${name} créé et prévu. Ajoutez ses ingrédients quand vous voulez (Maison › Nos plats).` });
};
/* ---------- Présences, invités, portions ---------- */
CHANGE['presence'] = (d, el) => {
    const k = d['k'] ?? '', m = d['m'] ?? '', p = el.value;
    const s = S();
    const pd = parseSlot(k);
    const def = pd ? s.settings.rhythm[weekday(pd.date)]?.[pd.slot][m] ?? 'maison' : 'maison';
    const before = servings(s, k);
    dispatch([{ t: 'slot.presence', p: { slot: k, member: m, presence: p === def ? null : p } }], { toast: impactText(k, before) });
};
CLICK['guests'] = d => {
    const k = d['k'] ?? '', s = S();
    const before = servings(s, k);
    const g = Math.max(0, Math.min(20, (s.slots[k]?.guests ?? 0) + num(d['d'])));
    dispatch([{ t: 'slot.guests', p: { slot: k, guests: g } }], { toast: impactText(k, before) });
};
function impactText(k, before) {
    const s = S(), n = servings(s, k);
    const d = s.slots[k]?.dish;
    const prep = d && d.kind !== 'outside' ? s.preps[d.prep] : undefined;
    const base = `${capital(fmtSlot(k, clock().date))} : ${before} → ${n} portion${n > 1 ? 's' : ''}`;
    return prep && !prep.done ? `${base} · ${prepTitle(s, prep)} : ${portions(s, prep).planned} à préparer · courses recalculées` : base;
}
CLICK['extra'] = d => {
    const prep = S().preps[d['id'] ?? ''];
    if (!prep)
        return;
    const extra = Math.max(0, Math.min(30, prep.extra + num(d['d'])));
    dispatch([{ t: 'prep.extra', p: { prep: prep.id, extra } }], { toast: `${prepTitle(S(), prep)} : ${portions(S(), { ...prep, extra }).planned} portions à préparer · courses recalculées` });
};
CHANGE['chef'] = (d, el) => {
    const v = el.value || null;
    dispatch([{ t: 'slot.chef', p: { slot: d['k'] ?? '', member: v } }], { toast: v ? `${S().members.find(m => m.id === v)?.name ?? ''} cuisine ${fmtSlot(d['k'] ?? '', clock().date)}` : 'Cuisinier retiré' });
};
CLICK['start'] = d => dispatch([{ t: 'prep.start', p: { prep: d['id'] ?? '' } }], { toast: 'Préparation commencée' });
/* ---------- Préparé / mangé ---------- */
let yieldN = 0;
function openYield(prepId, then) {
    const s = S(), prep = s.preps[prepId];
    if (!prep)
        return;
    yieldN = portions(s, prep).planned;
    openSheet({ id: `yield:${prepId}`, render: () => {
            const p2 = S().preps[prepId];
            if (!p2)
                return '';
            const pt = portions(S(), p2);
            return `${sheetHead(`${esc(prepTitle(S(), p2))} : combien de portions en tout ?`)}
    <p>Prévu : <strong>${pt.planned} portion${pt.planned > 1 ? 's' : ''}</strong> (${esc(portionsDetail(S(), p2, p2.slot ?? then.k, clock().date))}).</p>
    <div class="row"><span class="title grow">Réellement préparé</span><div class="stepper">
      <button class="icon-btn" data-a="yieldD" data-d="-1" aria-label="Une portion de moins">−</button><output aria-live="polite" id="yieldOut">${yieldN}</output>
      <button class="icon-btn" data-a="yieldD" data-d="1" aria-label="Une portion de plus">+</button></div></div>
    <p class="small muted">Sert à savoir ce qui reste. S'il en manque pour un repas prévu, Foyer vous demandera lequel modifier : personne n'est privé en silence.</p>
    <button class="btn block" data-a="yieldOk" data-id="${prepId}" data-k="${then.k}" data-eat="${then.eat ? '1' : ''}">Confirmer ${yieldN} portion${yieldN > 1 ? 's' : ''}${then.eat ? ' et « mangé »' : ''}</button>`;
        } });
}
CLICK['yieldD'] = d => { yieldN = Math.max(0, Math.min(99, yieldN + num(d['d']))); const o = document.getElementById('yieldOut'); if (o)
    o.textContent = String(yieldN); const b = document.querySelector('[data-a="yieldOk"]'); if (b)
    b.textContent = b.textContent?.replace(/\d+ portions?/, `${yieldN} portion${yieldN > 1 ? 's' : ''}`) ?? ''; };
CLICK['yieldOk'] = d => {
    const prepId = d['id'] ?? '', k = d['k'] ?? '';
    closeSheet();
    const s = S();
    if (d['eat']) {
        const r = eat(s, k, yieldN);
        if (Array.isArray(r))
            dispatch(r, { toast: `Noté : préparé (${yieldN}) et mangé` });
    }
    else
        dispatch(declarePrepared(s, prepId, yieldN), { toast: `${prepTitle(s, s.preps[prepId])} : ${yieldN} portion${yieldN > 1 ? 's' : ''} déclarée${yieldN > 1 ? 's' : ''}` });
};
CLICK['prepared'] = d => openYield(d['id'] ?? '', { k: d['k'] ?? '', eat: false });
CLICK['eat'] = d => {
    const k = d['k'] ?? '';
    const s = S();
    const dish = s.slots[k]?.dish;
    const prep = dish && dish.kind !== 'outside' ? s.preps[dish.prep] : undefined;
    if (prep && !prep.done && dish?.kind === 'from') {
        // Restes d'un plat jamais déclaré préparé : on demande, on ne suppose pas.
        openSheet({ id: 'ask', render: () => `${sheetHead(`${esc(prepTitle(s, prep))} a-t-il bien été préparé ?`)}
      <p>Ces restes viennent de ${esc(prepTitle(s, prep))} (${esc(prep.slot ? fmtSlot(prep.slot, clock().date) : '')}), qui n'est pas déclaré préparé.</p>
      <div class="actions"><button class="btn" data-a="askYes" data-id="${prep.id}" data-k="${k}">Oui, il a été préparé</button><button class="btn ghost" data-a="close">Non</button></div>` });
        return;
    }
    const r = eat(s, k, null);
    if (Array.isArray(r))
        dispatch(r, { toast: `${capital(fmtSlot(k, clock().date))} : mangé ✓` });
    else
        openYield(r.prep, { k, eat: true });
};
CLICK['askYes'] = d => openYield(d['id'] ?? '', { k: d['k'] ?? '', eat: true });
CLICK['uneat'] = d => {
    const k = d['k'] ?? '';
    const ev = [...A.log].reverse().find(e => e.t === 'slot.eaten' && e.p.slot === k && !A.r.undone.has(e.id) && !A.r.rejected.has(e.id));
    if (ev)
        undo([ev.id]);
};
/* ---------- Déplacer, extérieur, retirer ---------- */
CLICK['move'] = d => openMove(d['k'] ?? '');
function openMove(k) {
    const s = S(), c = clock();
    const start = parseSlot(k)?.date ?? c.date;
    const first = start < c.date ? c.date : addDays(start, -3) < c.date ? c.date : addDays(start, -3);
    const targets = [];
    for (let i = 0; i < 14; i++)
        for (const sl of SLOTS) {
            const t = slotKey(addDays(first, i), sl);
            if (t !== k && !s.slots[t]?.eaten)
                targets.push(t);
        }
    openSheet({ id: `move:${k}`, render: () => `${sheetHead(`Déplacer ${esc(slotView(S(), k, c.date, c.hour).title)}`, `depuis ${esc(fmtSlot(k, c.date))}`)}
    <p class="small muted">Choisissez le nouveau créneau. Rien n'est enregistré avant l'aperçu.</p>
    <ul class="list">${targets.map(t => {
            const v = slotView(S(), t, c.date, c.hour);
            const busy = !!S().slots[t]?.dish;
            return `<li><button class="item-btn" data-a="moveTo" data-k="${k}" data-to="${t}"><span class="grow"><span class="title">${esc(capital(fmtSlot(t, c.date)))}</span><br>
      <span class="sub">${busy ? `${esc(v.title)} : les deux repas seront échangés` : v.servings ? `libre · ${v.servings} portion${v.servings > 1 ? 's' : ''} à servir` : 'libre · personne à la maison'}</span></span></button></li>`;
        }).join('')}</ul>` });
}
CLICK['moveTo'] = d => {
    const k = d['k'] ?? '', to = d['to'] ?? '';
    const s = S(), c = clock();
    const swap = !!s.slots[to]?.dish;
    const dish = s.slots[k]?.dish;
    const prep = dish?.kind === 'cook' ? s.preps[dish.prep] : undefined;
    const late = prep && !prep.done ? dependents(s, prep.id).filter(x => x !== to && slotOrder(x) <= slotOrder(to)) : [];
    const names = late.map(x => fmtSlot(x, c.date)).join(', ');
    const modes = late.length
        ? [{ id: 'follow', label: `Décaler aussi ${names} d'autant`, hint: 'si le créneau d\'arrivée est libre ; sinon le repas lié est vidé' },
            { id: 'detach', label: `Détacher ${names}`, hint: 'le repas lié redevient à prévoir' },
            { id: 'keep', label: 'Garder tel quel', hint: 'intention enregistrée avec un problème à résoudre' }]
        : [{ id: 'keep', label: '' }];
    openPreview({ title: swap ? `Échanger avec ${fmtSlot(to, c.date)}` : `Déplacer vers ${fmtSlot(to, c.date)}`, sub: slotView(s, k, c.date, c.hour).title,
        modes, build: m => move(S(), k, to, swap, m), confirm: swap ? 'Échanger' : 'Déplacer', done: swap ? 'Repas échangés' : 'Repas déplacé' });
};
CLICK['outside'] = d => {
    const k = d['k'] ?? '', s = S(), c = clock();
    const dish = s.slots[k]?.dish;
    const prep = dish?.kind === 'cook' ? s.preps[dish.prep] : undefined;
    if (!dish) {
        dispatch(setOutside(s, k, ''), { toast: `${capital(fmtSlot(k, c.date))} : repas extérieur` });
        return;
    }
    openSheet({ id: `outside:${k}`, render: () => `${sheetHead(`Repas extérieur ${esc(fmtSlot(k, c.date))}`, `à la place de ${esc(slotView(S(), k, c.date, c.hour).title)}`)}
    <div class="stack">${prep && !prep.done ? `<button class="btn block" data-a="move" data-k="${k}">Reporter ${esc(prepTitle(s, prep))} à un autre jour</button>` : ''}
    <button class="btn ghost block" data-a="outsideOnly" data-k="${k}">Retirer seulement ce créneau</button></div>
    <p class="small muted">Les portions déjà préparées ne sont jamais effacées, et un produit acheté ne disparaît pas des courses cochées.</p>` });
};
CLICK['outsideOnly'] = d => {
    const k = d['k'] ?? '', c = clock();
    const s = S();
    const dish = s.slots[k]?.dish;
    const prep = dish?.kind === 'cook' ? s.preps[dish.prep] : undefined;
    const deps = prep && !prep.done ? dependents(s, prep.id) : [];
    openPreview({ title: `Repas extérieur ${fmtSlot(k, c.date)}`, modes: deps.length
            ? [{ id: 'detach', label: `Détacher ${deps.map(x => fmtSlot(x, c.date)).join(', ')}`, hint: 'ces repas redeviennent à prévoir' }, { id: 'keep', label: 'Les garder', hint: 'problème à résoudre : leur plat d\'origine disparaît' }]
            : undefined, build: m => setOutside(S(), k, '', (m || 'keep')), confirm: 'Enregistrer', done: 'Repas extérieur noté' });
};
SUBMIT['outsideNote'] = (data, form) => dispatch([{ t: 'slot.outside', p: { slot: form.dataset['k'] ?? '', note: String(data.get('note') ?? '').slice(0, 80) } }], { toast: 'Note enregistrée' });
CLICK['remove'] = d => {
    const k = d['k'] ?? '', s = S(), c = clock();
    const dish = s.slots[k]?.dish;
    const prep = dish?.kind === 'cook' ? s.preps[dish.prep] : undefined;
    const deps = prep && !prep.done ? dependents(s, prep.id) : [];
    openPreview({ title: `Retirer ${slotView(s, k, c.date, c.hour).title}`, sub: fmtSlot(k, c.date), modes: deps.length
            ? [{ id: 'detach', label: `Détacher aussi ${deps.map(x => fmtSlot(x, c.date)).join(', ')}`, hint: 'ces repas redeviennent à prévoir' }, { id: 'keep', label: 'Les garder', hint: 'problème à résoudre' }]
            : undefined, build: m => removeDish(S(), k, (m || 'keep')), confirm: 'Retirer', done: 'Repas retiré' });
};
CLICK['slot'] = d => openSlot(d['k'] ?? '');
CLICK['close'] = () => closeSheet();
