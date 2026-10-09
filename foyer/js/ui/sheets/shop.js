// Détail d'une ligne de courses, articles ajoutés à la main, produits à surveiller, lots de portions.
import { addDays, slotKey, SLOTS, fmtSlot, fmtDayShort, isDate } from '../../core/dates.js';
import { deriveShopping, explain, lineQty, checkSig } from '../../core/shopping.js';
import { AISLES, aisleOf, parseIngredient, lineLabel, ingredientKey } from '../../core/ingredients.js';
import { UNITS, UNIT, toBase, showQty } from '../../core/units.js';
import { parseQ, qStr, cmp } from '../../core/rational.js';
import { nameKey, capitalize } from '../../core/text.js';
import { newId } from '../../core/reduce.js';
import { portions } from '../../core/plan.js';
import { prepTitle, slotView, capital } from '../../core/status.js';
import { STATE_LABEL, KIND_LABEL, watchView, DGCCRF_URL } from '../../core/watch.js';
import { paris } from '../../core/dates.js';
import { S, clock, dispatch, memberName } from '../state.js';
import { openSheet, sheetHead, closeSheet, esc, toast } from '../dom.js';
import { CLICK, CHANGE, SUBMIT, INPUT, num } from '../registry.js';
import { setLeftovers } from '../../core/commands.js';
import { productSection, adviceHtml } from './drive.js';
const when = (iso) => { const p = paris(new Date(iso)); return `${fmtDayShort(p.date)} ${String(p.hour).padStart(2, '0')} h ${String(p.minute).padStart(2, '0')}`; };
/* ---------- Ligne calculée ---------- */
export function openLine(week, key) { openSheet({ id: `line:${key}`, render: () => lineHtml(week, key) }); }
function lineHtml(week, key) {
    const l = deriveShopping(S(), week).lines.find(x => x.key === key);
    if (!l)
        return `${sheetHead('Ligne retirée')}<p>Cette ligne n'est plus nécessaire pour les repas de la semaine.</p>`;
    const units = l.dim ? UNITS.filter(u => u.dim === l.dim) : [];
    const pantry = l.pantry
        ? `<p>${l.pantry.qty === 'all' ? 'Vous avez confirmé avoir tout ce qu\'il faut pour cette ligne' : `Vous avez confirmé ${esc(showQty(l.pantry.qty, l.dim ?? 'piece'))} pour ces repas`} (${esc(memberName(l.pantry.by))}, ${esc(when(l.pantry.at))}).</p>
       ${l.pantry.active ? '<p class="chip s-pret">Vérification valable pour cette liste</p>' : '<p class="chip attention">À revérifier : le besoin a changé depuis, elle n\'est plus déduite</p>'}`
        : '';
    return `${sheetHead(esc(l.name + (l.form ? ` (${l.form})` : '')), esc(AISLES.find(a => a.id === l.aisle)?.label ?? ''))}
  <section class="card stack"><h3 class="section-title">Calcul</h3>
    <p>Besoin : <strong>${esc(lineQty(l, 'need') || 'quantité non renseignée')}</strong>${l.unknown.length && l.need ? ' + une part non chiffrée' : ''}${l.pantry?.active && l.pantry.qty !== 'all' ? ` · déjà là : ${esc(showQty(l.have, l.dim ?? 'piece'))} · à acheter : <strong>${esc(lineQty(l))}</strong>` : ''}</p>
    <ul class="parsed">${explain(l).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${l.unknown.length ? `<div class="actions">${[...new Set(l.unknown.map(u => u.recipe))].map(id => `<button class="btn small-btn ghost" data-a="recipe" data-id="${id}">Compléter ${esc(l.unknown.find(u => u.recipe === id)?.recipeName ?? '')}</button>`).join('')}</div>` : ''}
  </section>
  ${adviceHtml(l.name) ? `<section class="card stack">${adviceHtml(l.name)}</section>` : ''}
  <section class="card stack"><h3 class="section-title">On en a déjà ?</h3>
    <p class="small muted">Vérification ponctuelle pour ces repas, pas un stock : elle ne dit pas ce qui restera demain, et ne vaut pas pour une autre semaine.</p>
    ${pantry}
    ${l.dim ? `<form data-f="pantryQty" data-week="${week}" data-key="${esc(key)}" class="row">
      <label class="field grow">Quantité vérifiée<input type="text" name="qty" inputmode="decimal" placeholder="ex. 200" required></label>
      ${units.length > 1 ? `<label class="field">Unité<select name="unit">${units.map(u => `<option value="${u.id}">${esc(u.one)}</option>`).join('')}</select></label>` : `<input type="hidden" name="unit" value="${units[0]?.id ?? ''}">`}
      <button class="btn ghost">Noter</button></form>` : ''}
    <div class="actions"><button class="btn soft" data-a="pantryAll" data-week="${week}" data-key="${esc(key)}">On a tout pour cette ligne</button>
    ${l.pantry ? `<button class="btn quiet" data-a="pantryClear" data-week="${week}" data-key="${esc(key)}">Effacer la vérification</button>` : ''}</div>
  </section>
  ${l.check ? `<p class="small">Coché « pris » par ${esc(memberName(l.check.by))} (${esc(when(l.check.at))})${l.check.delta ? ` · il faut ${esc(showQty(l.check.delta, l.dim ?? 'piece'))} de plus depuis` : ''}${l.check.newUnknown ? ' · un plat sans quantité s\'est ajouté depuis' : ''}.</p>` : ''}
  ${productSection(ingredientKey(l.name, l.form), l.name, S().products[ingredientKey(l.name, l.form)] ?? null)}
  <label class="field">Rayon<select data-c="aisleSet" data-name="${esc(l.name)}">${AISLES.map(a => `<option value="${a.id}" ${a.id === l.aisle ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></label>
  <button class="btn ghost" data-a="watchNew" data-name="${esc(l.name)}">Surveiller une date pour ce produit</button>`;
}
SUBMIT['pantryQty'] = (data, form) => {
    const week = form.dataset['week'] ?? '', key = form.dataset['key'] ?? '';
    const l = deriveShopping(S(), week).lines.find(x => x.key === key);
    const unit = UNIT[String(data.get('unit') ?? '')];
    const qty = parseQ(String(data.get('qty') ?? ''));
    if (!l || !unit || !qty || qty.n <= 0) {
        toast('Quantité non comprise : un nombre comme « 200 » ou « 1,5 »');
        return;
    }
    const base = toBase(qty, unit);
    const all = l.need && cmp(base, l.need) >= 0;
    dispatch([{ t: 'shop.pantry', p: { week, key, qty: all ? 'all' : qStr(base), needAt: l.needAt } }], { toast: all ? `${l.name} : vous avez tout ce qu'il faut` : `${l.name} : ${showQty(base, l.dim ?? 'piece')} déjà là pour ces repas` });
};
CLICK['pantryAll'] = d => {
    const week = d['week'] ?? '', key = d['key'] ?? '';
    const l = deriveShopping(S(), week).lines.find(x => x.key === key);
    if (l)
        dispatch([{ t: 'shop.pantry', p: { week, key, qty: 'all', needAt: l.needAt } }], { toast: `${l.name} : rien à acheter pour ces repas` });
};
CLICK['pantryClear'] = d => {
    const week = d['week'] ?? '', key = d['key'] ?? '';
    const l = deriveShopping(S(), week).lines.find(x => x.key === key);
    if (l)
        dispatch([{ t: 'shop.pantry', p: { week, key, qty: null, needAt: l.needAt } }], { toast: 'Vérification effacée' });
};
CHANGE['aisleSet'] = (d, el) => dispatch([{ t: 'aisle.set', p: { key: nameKey(d['name'] ?? ''), aisle: el.value } }], { toast: 'Rayon mémorisé pour ce produit' });
// Coche d'une ligne calculée : « pris » mémorise ce qui restait à acheter à cet instant.
CHANGE['shopCheck'] = (d, el) => {
    const week = d['week'] ?? '', key = d['key'] ?? '';
    const l = deriveShopping(S(), week).lines.find(x => x.key === key);
    if (!l)
        return;
    const on = el.checked;
    if (on)
        dispatch([{ t: 'shop.check', p: { week, key, needAt: checkSig(l), name: l.name } }]);
    else if (l.check)
        dispatch([{ t: 'shop.check', p: { week, key, needAt: null } }]);
    else if (l.pantry?.active)
        dispatch([{ t: 'shop.pantry', p: { week, key, qty: null, needAt: l.needAt } }]);
};
/* ---------- Articles ajoutés à la main et habituels ---------- */
export function addItemDrafts(week, text) {
    const t = text.trim();
    if (!t)
        return null;
    const p = parseIngredient(t).line;
    const label = lineLabel(p);
    const qty = label.includes(' · ') ? label.split(' · ')[0] ?? '' : '';
    return itemDraft(week, newId(), capitalize(p.name || t).slice(0, 80), qty.slice(0, 40), aisleOf(p.name || t, p.form, S().aisles));
}
const itemDraft = (week, id, name, qty, aisle) => ({ t: 'shop.item', p: { week, id, name, qty, aisle, checked: false, removed: false } });
SUBMIT['addItem'] = (data, form) => {
    const week = form.dataset['week'] ?? '';
    const d = addItemDrafts(week, String(data.get('text') ?? ''));
    if (!d)
        return;
    dispatch([d], { toast: `${d.p.name} ajouté` });
    const input = form.querySelector('input');
    if (input) {
        input.value = '';
        input.focus();
    }
};
CLICK['addStaple'] = d => {
    const st = S().staples[d['key'] ?? ''];
    if (!st)
        return;
    dispatch([itemDraft(d['week'] ?? '', newId(), st.name, st.qty, st.aisle)], { toast: `${st.name} ajouté` });
};
CHANGE['itemCheck'] = (d, el) => {
    const week = d['week'] ?? '', id = d['id'] ?? '';
    const it = S().shop[week]?.items[id];
    if (it)
        dispatch([{ t: 'shop.item', p: { week, id, name: it.name, qty: it.qty, aisle: it.aisle, checked: el.checked, removed: false } }]);
};
CLICK['item'] = d => {
    const week = d['week'] ?? '', id = d['id'] ?? '';
    openSheet({ id: `item:${id}`, render: () => {
            const it = S().shop[week]?.items[id];
            if (!it)
                return sheetHead('Article retiré');
            const key = nameKey(it.name);
            const staple = !!S().staples[key];
            return `${sheetHead(esc(it.name), 'Ajouté à la main · quantité telle que saisie')}
    <form data-f="itemSave" data-week="${week}" data-id="${id}" class="stack">
      <label class="field">Nom<input type="text" name="name" maxlength="80" required value="${esc(it.name)}"></label>
      <label class="field">Quantité<input type="text" name="qty" maxlength="40" value="${esc(it.qty)}" placeholder="2 paquets, 1 kg…"></label>
      <label class="field">Rayon<select name="aisle">${AISLES.map(a => `<option value="${a.id}" ${a.id === it.aisle ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></label>
      <label class="item"><input type="checkbox" name="staple" ${staple ? 'checked' : ''}> <span>Habituel : le proposer en un geste les prochaines semaines</span></label>
      <div class="actions"><button class="btn">Enregistrer</button><button class="btn danger" type="button" data-a="itemRemove" data-week="${week}" data-id="${id}">Retirer de la liste</button></div></form>`;
        } });
};
SUBMIT['itemSave'] = (data, form) => {
    const week = form.dataset['week'] ?? '', id = form.dataset['id'] ?? '';
    const it = S().shop[week]?.items[id];
    if (!it)
        return;
    const name = String(data.get('name') ?? '').trim().slice(0, 80) || it.name, qty = String(data.get('qty') ?? '').slice(0, 40), aisle = String(data.get('aisle') ?? it.aisle);
    const key = nameKey(name), staple = data.get('staple') === 'on', was = !!S().staples[key];
    closeSheet();
    dispatch([{ t: 'shop.item', p: { week, id, name, qty, aisle, checked: it.checked, removed: false } },
        ...(staple || was ? [{ t: 'staple.set', p: { key, name, qty, aisle, removed: !staple } }] : [])], { toast: 'Article enregistré' });
};
CLICK['itemRemove'] = d => {
    const week = d['week'] ?? '', id = d['id'] ?? '';
    const it = S().shop[week]?.items[id];
    if (!it)
        return;
    closeSheet();
    dispatch([{ t: 'shop.item', p: { week, id, name: it.name, qty: it.qty, aisle: it.aisle, checked: it.checked, removed: true } }], { toast: `${it.name} retiré` });
};
let wd = null;
export function openWatch(id, name = '') {
    const w = id ? S().watch[id] : undefined;
    const v = w?.date?.value ?? '';
    wd = { id, name: w?.name ?? name, qty: w?.qty ?? '', kind: w?.date?.kind ?? 'none', date: v.length === 10 ? v : '', month: v.length === 7 ? v : '', year: v.length === 4 ? v : '',
        precision: v.length === 7 ? 'mois' : v.length === 4 ? 'annee' : 'jour', state: w?.state ?? 'ferme', slot: w?.slot ?? '' };
    openSheet({ id: 'watch', render: watchHtml, onClose: () => { wd = null; } });
}
function watchHtml() {
    const d = wd;
    if (!d)
        return '';
    const c = clock();
    const slots = [];
    for (let i = 0; i < 14; i++)
        for (const sl of SLOTS) {
            const k = slotKey(addDays(c.date, i), sl);
            const dish = S().slots[k]?.dish;
            if (dish && dish.kind !== 'outside')
                slots.push(k);
        }
    const chips = [['aujourd\'hui', 0], ['demain', 1], ['+2 j', 2], ['+3 j', 3], ['+5 j', 5], ['+7 j', 7]];
    const w = d.id ? S().watch[d.id] : undefined;
    const view = w ? watchView(w, c.date) : null;
    return `${sheetHead(d.id ? `Surveiller ${esc(d.name)}` : 'Surveiller un produit', 'Vous choisissez les produits suivis ; dates saisies par vous, traçables et corrigeables.')}
  ${view?.checks.length ? `<ul class="impacts">${view.checks.map(x => `<li class="${x.level === 'manque' ? 'attention' : x.level}">${esc(x.text)}</li>`).join('')}</ul>` : ''}
  <form data-f="watchSave" class="stack">
    <label class="field">Produit<input type="text" name="name" required maxlength="80" value="${esc(d.name)}" data-i="wName" placeholder="Poulet, crème fraîche…"></label>
    <label class="field">Quantité (facultatif)<input type="text" name="qty" maxlength="40" value="${esc(d.qty)}" data-i="wQty"></label>
    <fieldset><legend>Date imprimée</legend><div class="seg" role="radiogroup" aria-label="Type de date">
      ${['DLC', 'DDM', 'inconnu', 'none'].map(k => `<label><input type="radio" name="kind" value="${k}" data-c="wKind" ${d.kind === k ? 'checked' : ''}>${k === 'DLC' ? 'DLC' : k === 'DDM' ? 'DDM' : k === 'inconnu' ? 'Je ne sais pas' : 'Pas de date'}</label>`).join('')}</div>
      <p class="small muted">${d.kind === 'DLC' ? esc(KIND_LABEL.DLC) + ' : limite impérative.' : d.kind === 'DDM' ? esc(KIND_LABEL.DDM) + ' : date de qualité, jour, mois ou année seulement selon l\'emballage.' : d.kind === 'inconnu' ? 'La date sera gardée, avec son type « à préciser ».' : 'Le produit s\'affichera « Date à renseigner ».'}</p>
      ${d.kind === 'DDM' ? `<div class="seg" role="radiogroup" aria-label="Précision de la date">${['jour', 'mois', 'annee'].map(p => `<label><input type="radio" name="precision" value="${p}" data-c="wPrec" ${d.precision === p ? 'checked' : ''}>${p === 'annee' ? 'année' : p}</label>`).join('')}</div>` : ''}
      ${d.kind !== 'none' ? (d.kind === 'DDM' && d.precision === 'mois' ? `<label class="field">Mois<input type="month" name="month" value="${esc(d.month)}" data-i="wMonth"></label>`
        : d.kind === 'DDM' && d.precision === 'annee' ? `<label class="field">Année<input type="number" name="year" min="2000" max="2100" value="${esc(d.year)}" data-i="wYear"></label>`
            : `<label class="field">Date<input type="date" name="date" value="${esc(d.date)}" data-i="wDate"></label><div class="chips">${chips.map(([l, n]) => `<button type="button" class="tag" data-a="wQuick" data-n="${n}">${l}</button>`).join('')}</div>`) : ''}
    </fieldset>
    <label class="field">État<select name="state" data-c="wState">${Object.keys(STATE_LABEL).map(k => `<option value="${k}" ${d.state === k ? 'selected' : ''}>${esc(STATE_LABEL[k])}</option>`).join('')}</select></label>
    <label class="field">Prévu pour un repas (facultatif)<select name="slot" data-c="wSlot"><option value="">Aucun</option>${slots.map(k => `<option value="${k}" ${d.slot === k ? 'selected' : ''}>${esc(capital(fmtSlot(k, c.date)))} · ${esc(slotView(S(), k, c.date, c.hour).title)}</option>`).join('')}</select></label>
    <div class="actions"><button class="btn">Enregistrer</button>${d.id ? `<button class="btn ghost" type="button" data-a="watchClose" data-o="utilise">Utilisé</button><button class="btn ghost" type="button" data-a="watchClose" data-o="jete">Jeté</button>` : ''}</div>
    <p class="small muted">Contrôles limités : DLC dépassée, date manquante, produit ouvert. Aucune durée de conservation n'est calculée. Source : <a href="${DGCCRF_URL}" target="_blank" rel="noopener">fiche DGCCRF DLC/DDM</a>.</p>
  </form>`;
}
const wField = (k) => (_, el) => { if (wd)
    wd[k] = el.value; };
INPUT['wName'] = wField('name');
INPUT['wQty'] = wField('qty');
INPUT['wDate'] = wField('date');
INPUT['wMonth'] = wField('month');
INPUT['wYear'] = wField('year');
const rerender = () => openSheet({ id: 'watch', render: watchHtml, onClose: () => { wd = null; } });
CHANGE['wKind'] = (_d, el) => { if (wd) {
    wd.kind = el.value;
    rerender();
} };
CHANGE['wPrec'] = (_d, el) => { if (wd) {
    wd.precision = el.value;
    rerender();
} };
CHANGE['wState'] = wField('state');
CHANGE['wSlot'] = wField('slot');
CLICK['wQuick'] = d => { if (wd) {
    wd.date = addDays(clock().date, num(d['n']));
    rerender();
} };
CLICK['watchNew'] = d => openWatch(null, d['name'] ?? '');
CLICK['watch'] = d => openWatch(d['id'] ?? null);
SUBMIT['watchSave'] = () => {
    const d = wd;
    if (!d)
        return;
    const name = d.name.trim();
    if (!name) {
        toast('Nom du produit manquant');
        return;
    }
    let date = null;
    if (d.kind !== 'none') {
        const value = d.kind === 'DDM' && d.precision === 'mois' ? d.month : d.kind === 'DDM' && d.precision === 'annee' ? d.year : d.date;
        const ok = d.kind === 'DDM' && d.precision === 'mois' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(value) : d.kind === 'DDM' && d.precision === 'annee' ? /^\d{4}$/.test(value) : isDate(value);
        if (!ok) {
            toast('Date incomplète : saisissez-la, ou choisissez « Pas de date »');
            return;
        }
        date = { kind: d.kind, value };
    }
    closeSheet();
    dispatch([{ t: 'watch.save', p: { id: d.id ?? newId(), name: capitalize(name).slice(0, 80), qty: d.qty.slice(0, 40), date, state: d.state, slot: d.slot || null } }], { toast: `${name} surveillé` });
};
CLICK['watchClose'] = d => {
    const id = wd?.id ?? d['id'];
    if (!id)
        return;
    closeSheet();
    dispatch([{ t: 'watch.close', p: { id, outcome: d['o'] === 'jete' ? 'jete' : 'utilise' } }], { toast: d['o'] === 'jete' ? 'Noté comme jeté' : 'Noté comme utilisé' });
};
/* ---------- Lot de portions ---------- */
let adj = 1, adjReason = 'mangé hors planning';
CLICK['portions'] = d => {
    const id = d['id'] ?? '';
    adj = 1;
    openSheet({ id: `portions:${id}`, render: () => {
            const s = S(), c = clock(), prep = s.preps[id];
            if (!prep?.done)
                return sheetHead('Pas encore préparé');
            const pt = portions(s, prep);
            const made = paris(new Date(prep.done.at));
            const targets = [];
            for (let i = 0; i < 10; i++)
                for (const sl of SLOTS) {
                    const k = slotKey(addDays(c.date, i), sl);
                    if (!s.slots[k]?.dish && slotView(s, k, c.date, c.hour).status === 'vide' && k > (prep.slot ?? ''))
                        targets.push(k);
                }
            return `${sheetHead(esc(prepTitle(s, prep)), `déclaré préparé ${esc(fmtDayShort(made.date))} par ${esc(memberName(prep.done.by))}`)}
    <ul class="parsed"><li>${pt.declared} portion${(pt.declared ?? 0) > 1 ? 's' : ''} déclarée${(pt.declared ?? 0) > 1 ? 's' : ''}${prep.done.planned !== pt.declared ? ` (prévu : ${prep.done.planned})` : ''}</li>
      <li>${pt.eaten} mangée${pt.eaten > 1 ? 's' : ''} · ${pt.discarded} retirée${pt.discarded > 1 ? 's' : ''}</li>
      <li>Réservées : ${pt.reservations.length ? pt.reservations.map(r => `${r.n} ${esc(fmtSlot(r.slot, c.date))}`).join(', ') : 'aucune'}</li>
      <li><strong>${(pt.free ?? 0) >= 0 ? `${pt.free} libre${(pt.free ?? 0) > 1 ? 's' : ''}` : `il en manque ${-(pt.free ?? 0)}`}</strong></li></ul>
    <p class="small muted">Compteur des portions que vous déclarez, pas de tout le congélateur. Conservation non évaluée par Foyer.</p>
    ${(pt.free ?? 0) > 0 && targets.length ? `<label class="field">Prévoir les restes pour<select data-c="leftTo" data-id="${id}"><option value="">Choisir un repas…</option>${targets.map(k => `<option value="${k}">${esc(capital(fmtSlot(k, c.date)))} (${slotView(s, k, c.date, c.hour).servings} portion${slotView(s, k, c.date, c.hour).servings > 1 ? 's' : ''})</option>`).join('')}</select></label>` : ''}
    ${(pt.remaining ?? 0) > 0 ? `<fieldset><legend>Retirer des portions</legend><div class="row"><div class="stepper"><button class="icon-btn" data-a="adjD" data-d="-1" aria-label="Une de moins">−</button><output id="adjOut">${adj}</output><button class="icon-btn" data-a="adjD" data-d="1" aria-label="Une de plus">+</button></div>
      <select data-c="adjReason" aria-label="Motif"><option ${adjReason === 'mangé hors planning' ? 'selected' : ''}>mangé hors planning</option><option ${adjReason === 'jeté' ? 'selected' : ''}>jeté</option><option ${adjReason === 'erreur de saisie' ? 'selected' : ''}>erreur de saisie</option></select>
      <button class="btn ghost" data-a="discard" data-id="${id}">Retirer</button></div></fieldset>` : ''}
    <button class="btn quiet" data-a="cook" data-id="${id}">Voir la recette utilisée</button>`;
        } });
};
CLICK['adjD'] = d => { adj = Math.max(1, Math.min(99, adj + num(d['d']))); const o = document.getElementById('adjOut'); if (o)
    o.textContent = String(adj); };
CHANGE['adjReason'] = (_d, el) => { adjReason = el.value; };
CLICK['discard'] = d => dispatch([{ t: 'prep.discard', p: { prep: d['id'] ?? '', n: adj, reason: adjReason } }], { toast: `${adj} portion${adj > 1 ? 's' : ''} retirée${adj > 1 ? 's' : ''} (${adjReason})` });
CHANGE['leftTo'] = (d, el) => {
    const k = el.value;
    if (!k)
        return;
    closeSheet();
    dispatch(setLeftovers(S(), k, d['id'] ?? ''), { toast: `Restes prévus ${fmtSlot(k, clock().date)}` });
};
