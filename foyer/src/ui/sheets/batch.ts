// Rituel batch : réglage (jours et heures), feuille du batch (plats, boîtes J+n, mise en place commune, « c'est prêt »),
// cartes d'Aujourd'hui (jour des courses, jour du batch) et budget de la semaine.
import { type LocalDate, addDays, fmtDay, fmtDayShort, fmtSlot, fmtRelDay, parseSlot, daysBetween } from '../../core/dates.ts';
import { type Ritual, current } from '../../core/model.ts';
import { type BatchDish, type RitualNow, DEFAULT_RITUAL, ANSES_FROID, batchView, batchDrafts, batchDayFor, defaultIn, miseEnPlace, sharedIngredients, batchStreak } from '../../core/batch.ts';
import { declarePrepared } from '../../core/commands.ts';
import { deriveShopping } from '../../core/shopping.ts';
import { cartEstimate } from '../../core/budget.ts';
import { eur, parseEuros } from '../../core/money.ts';
import { dishLook } from '../../core/visual.ts';
import { capital } from '../../core/status.ts';
import { A, S, clock, dispatch, setDevice } from '../state.ts';
import { openSheet, sheetHead, closeSheet, esc, toast, confetti } from '../dom.ts';
import { CLICK, CHANGE, SUBMIT } from '../registry.ts';

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const HOURS = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}00`); // 6 h … 22 h
export const hourText = (hhmm: string): string => `${Number(hhmm.slice(0, 2))} h${hhmm.slice(2) === '00' ? '' : ` ${hhmm.slice(2)}`}`;
export const ritualText = (r: Ritual): string => `courses le ${DAYS[r.shop]} à ${hourText(r.shopAt)} · batch le ${DAYS[r.cook]} à ${hourText(r.cookAt)}`;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n > 1 ? many : one}`;
// « aujourd'hui », « demain », « hier », sinon « samedi » précédé de « le » (« courses le samedi à 17 h »).
const relDay = (d: LocalDate, today: LocalDate): string => { const t = fmtRelDay(d, today); return ['aujourd\'hui', 'demain', 'hier'].includes(t) ? t : `le ${t}`; };

// Aller à la liste de courses d'une semaine.
function goShop(week: LocalDate): void { closeSheet(); A.ui.shopWeek = week; if (location.hash === '#courses') A.render(); else location.hash = '#courses'; }
CLICK['goShop'] = d => goShop(d['week'] ?? '');

/* ---------- Réglage du rituel et du budget ---------- */
export function openRitual(): void { openSheet({ id: 'ritual', render: ritualHtml }); }
CLICK['ritual'] = () => openRitual();

function ritualHtml(): string {
  const s = S(), r = s.settings.ritual;
  const sel = (name: string, value: number) => `<select data-c="ritualSet" data-k="${name}" aria-label="Jour">${DAYS.map((d, i) => `<option value="${i}" ${i === value ? 'selected' : ''}>${d}</option>`).join('')}</select>`;
  const hour = (name: string, value: string) => `<select data-c="ritualSet" data-k="${name}" aria-label="Heure">${[...new Set([...HOURS, value])].sort().map(h => `<option value="${h}" ${h === value ? 'selected' : ''}>${hourText(h)}</option>`).join('')}</select>`;
  const steps = (x: Ritual) => `<ol class="ritual-steps">
    <li><span class="look t-sun" aria-hidden="true">🗓️</span><span><strong>Jusqu'au ${DAYS[x.shop]}</strong> : le menu de la semaine, en cartes à balayer.</span></li>
    <li><span class="look t-ocean" aria-hidden="true">🛒</span><span><strong>${capital(DAYS[x.shop] ?? '')} ${hourText(x.shopAt)}</strong> : la liste finale, commandée au drive en quelques gestes.</span></li>
    <li><span class="look t-basil" aria-hidden="true">🚗</span><span><strong>Retrait du drive</strong>, au créneau choisi chez Auchan.</span></li>
    <li><span class="look t-tomato" aria-hidden="true">👩‍🍳</span><span><strong>${capital(DAYS[x.cook] ?? '')} ${hourText(x.cookAt)}</strong> : batch cooking. Foyer liste les plats, la mise en place commune et les boîtes à remplir.</span></li></ol>`;
  const budget = s.settings.budget;
  return `${sheetHead('Notre rituel de la semaine', 'Courses finales, drive, batch cooking : chaque étape arrive au bon moment, sur les deux téléphones.')}
  ${steps(r ?? DEFAULT_RITUAL)}
  ${r ? `<section class="card stack"><h3 class="section-title">Quand ?</h3>
      <div class="row wrap"><span class="grow">Courses finales</span>${sel('shop', r.shop)}${hour('shopAt', r.shopAt)}</div>
      <div class="row wrap"><span class="grow">Batch cooking</span>${sel('cook', r.cook)}${hour('cookAt', r.cookAt)}</div>
      <p class="small muted">Rappels sur les téléphones où ils sont activés : la liste à commander à l'heure des courses, la séance de batch à son heure.</p>
      <button class="btn quiet" data-a="ritualOff">Arrêter le rituel</button></section>`
    : '<button class="btn big block" data-a="ritualOn">Activer : courses le samedi, batch le dimanche</button><p class="small muted">Jours et heures se changent ensuite ici.</p>'}
  <section class="card stack"><h3 class="section-title">Budget courses (facultatif)</h3>
    <form data-f="budgetSet" class="row"><label class="field grow">Par semaine, en euros<input type="text" name="eur" inputmode="decimal" placeholder="ex. 90" value="${budget ? esc(eur(budget).replace(/\s?€$/, '').replace(/ /g, '')) : ''}"></label><button class="btn ghost">Enregistrer</button></form>
    ${budget ? '<button class="btn quiet" data-a="budgetOff">Retirer le budget</button>' : ''}
    <p class="small muted">Comparé au panier estimé (prix que vous notez sur les produits du drive) et au montant réellement payé. Foyer ne lit aucun prix sur un site.</p></section>`;
}
CLICK['ritualOn'] = () => dispatch([{ t: 'settings.set', p: { ritual: DEFAULT_RITUAL } }], { toast: 'Rituel activé : courses le samedi, batch le dimanche' });
CLICK['ritualOff'] = () => dispatch([{ t: 'settings.set', p: { ritual: null } }], { toast: 'Rituel arrêté' });
CHANGE['ritualSet'] = (d, el) => {
  const r = S().settings.ritual;
  if (!r) return;
  const k = d['k'] ?? '', v = (el as HTMLSelectElement).value;
  const next: Ritual = { ...r, ...(k === 'shop' || k === 'cook' ? { [k]: Number(v) } : k === 'shopAt' || k === 'cookAt' ? { [k]: v } : {}) };
  dispatch([{ t: 'settings.set', p: { ritual: next } }], { toast: `Rituel : ${ritualText(next)}` });
};
SUBMIT['budgetSet'] = data => {
  const c = parseEuros(String(data.get('eur') ?? ''));
  if (!c) { toast('Montant non compris : par exemple 90 ou 92,50'); return; }
  dispatch([{ t: 'settings.set', p: { budget: c } }], { toast: `Budget : ${eur(c)} par semaine` });
};
CLICK['budgetOff'] = () => dispatch([{ t: 'settings.set', p: { budget: null } }], { toast: 'Budget retiré' });

/* ---------- Feuille du batch ---------- */
let celebrated = '';
const widths = (root: HTMLElement): void => { for (const el of root.querySelectorAll<HTMLElement>('[data-pct]')) el.style.width = `${el.dataset['pct'] ?? 0}%`; }; // CSP : pas de style dans le HTML
export function openBatch(day: LocalDate): void { openSheet({ id: `batch:${day}`, render: () => batchHtml(day), mount: widths }); }
CLICK['batchOpen'] = d => openBatch(d['day'] ?? '');

const serveText = (x: BatchDish['serves'][number], today: LocalDate): string =>
  `${capital(fmtSlot(x.slot, today))} · ${x.n} portion${x.n > 1 ? 's' : ''}${x.boxes.length ? ` (boîte ${x.boxes.join(', ')})` : ''} · J+${x.offset}`;

function dishRow(d: BatchDish, day: LocalDate, mode: 'session' | 'plan' | 'candidate'): string {
  const s = S(), today = clock().date, r = s.recipes[d.prep.recipe], c = r ? current(r) : null;
  const look = dishLook(d.name, c?.ingredients.map(l => l.name) ?? []);
  const serves = d.serves.filter(x => !x.eaten).map(x => `<li>${esc(serveText(x, today))}</li>`).join('') + (d.extra ? `<li>${plural(d.extra, 'portion')} en plus</li>` : '');
  const missing = !c?.ingredients.length ? 'ingrédients à compléter' : !c.yield ? 'rendement à compléter' : '';
  const actions = mode === 'candidate'
    ? `<button class="btn small-btn soft" data-a="batchIn" data-id="${d.prep.id}" data-day="${day}">Ajouter au batch</button>`
    : mode === 'plan'
      ? `${d.done ? '' : `<button class="btn small-btn quiet" data-a="batchOut" data-id="${d.prep.id}" data-day="${day}">Retirer</button>`}`
      : d.done ? '<span class="chip s-pret">Prêt</span>'
        : `<button class="btn small-btn" data-a="batchDone" data-id="${d.prep.id}" data-day="${day}">C'est prêt · ${d.portions}</button>${c?.steps.length ? `<button class="btn small-btn ghost" data-a="cook" data-id="${d.prep.id}">Recette</button>` : ''}<button class="btn small-btn quiet" data-a="prepared" data-id="${d.prep.id}" data-k="${d.prep.slot ?? ''}">Autre nombre</button>`;
  return `<li class="${d.done ? 'done-line' : ''}"><div class="item top-align"><span class="look t-${look.theme}" aria-hidden="true">${look.emoji}</span>
    <span class="grow"><span class="title">${esc(d.name)} · ${plural(d.portions, 'portion')}</span>
    <ul class="serves">${serves}</ul>${missing ? `<span class="chip manque">${missing}</span>` : ''}
    <span class="actions">${actions}</span></span></div></li>`;
}

function batchHtml(day: LocalDate): string {
  const s = S(), today = clock().date, v = batchView(s, day), r = s.settings.ritual;
  const session = day <= today;
  const title = `👩‍🍳 Batch ${day === today ? 'd\'aujourd\'hui' : `du ${fmtDay(day)}`}`;
  const sub = v.shopDay && r ? `Courses ${relDay(v.shopDay, today)} à ${hourText(r.shopAt)} · cuisine ${relDay(day, today)} à ${hourText(r.cookAt)}` : '';
  if (!v.dishes.length && !v.candidates.length) {
    return `${sheetHead(esc(title), esc(sub))}<div class="celebrate"><span class="big-emoji" aria-hidden="true">🗓️</span><h3>Pas encore de menu</h3>
      <p class="muted">Aucun plat à cuisiner entre le ${esc(fmtDayShort(day))} et le ${esc(fmtDayShort(addDays(day, 6)))}.</p>
      <button class="btn big" data-a="propose" data-week="${v.week}">✨ Proposer le menu</button></div>`;
  }
  const all = v.dishes.length && v.done === v.dishes.length;
  if (all && session && celebrated !== day) { celebrated = day; window.setTimeout(() => confetti(), 50); }
  const mep = miseEnPlace(s, v.dishes), shared = sharedIngredients(s, v.dishes);
  const list = deriveShopping(s, v.week), cart = cartEstimate(s, list);
  const defaults = v.candidates.filter(d => defaultIn(day, parseSlot(d.prep.slot ?? '')?.date ?? ''));
  return `${sheetHead(esc(title), esc(sub))}
  ${all && session ? `<div class="celebrate"><span class="big-emoji" aria-hidden="true">🎉</span><h3>Batch terminé !</h3><p class="muted">${plural(v.portions, 'portion prête', 'portions prêtes')} pour la semaine. Au frigo ou au congélateur selon les jours (J+n ci-dessous).</p></div>` : ''}
  <div class="stats" role="list">
    <span role="listitem"><strong>${v.dishes.length}</strong>${v.dishes.length > 1 ? 'plats' : 'plat'}</span>
    <span role="listitem"><strong>${v.portions}</strong>portions</span>
    <span role="listitem"><strong>${v.containers}</strong>boîtes à remplir</span>
    ${session && v.dishes.length ? `<span role="listitem"><strong>${v.done}/${v.dishes.length}</strong>prêts</span>` : ''}
  </div>
  ${session && v.dishes.length && !all ? `<div class="deck-progress" role="progressbar" aria-label="Plats prêts" aria-valuemin="0" aria-valuemax="${v.dishes.length}" aria-valuenow="${v.done}"><span data-pct="${Math.round(100 * v.done / v.dishes.length)}"></span></div>` : ''}
  ${v.dishes.length ? `<section class="card"><h3 class="section-title">${session ? 'En cuisine' : 'Au programme'}</h3><ul class="list">${v.dishes.map(d => dishRow(d, day, session ? 'session' : 'plan')).join('')}</ul></section>`
    : '<p class="banner info">Aucun plat dans ce batch pour l\'instant : choisissez ceux à cuisiner à l\'avance.</p>'}
  ${v.candidates.length && !all ? `<section class="card"><div class="row"><h3 class="section-title grow">${v.dishes.length ? 'À ajouter ?' : 'Plats de la semaine'}</h3>
      ${defaults.length > 1 ? `<button class="btn small-btn" data-a="batchAll" data-day="${day}">Ajouter les ${defaults.length} de la semaine</button>` : ''}</div>
      <ul class="list">${v.candidates.map(d => dishRow(d, day, 'candidate')).join('')}</ul></section>` : ''}
  ${mep.length ? `<section class="card"><h3 class="section-title">Mise en place commune</h3><p class="small muted">Laver, éplucher, couper en une fois pour tous les plats.</p>
      <ul class="list">${mep.map(l => `<li><div class="item"><span class="grow"><span class="title">${esc(l.name)}</span><br><span class="sub">${esc(l.dishes.join(', '))}</span></span><span class="qty">${esc(l.qty || '?')}</span></div></li>`).join('')}</ul></section>` : ''}
  ${shared.length ? `<p class="banner ok"><span><strong>Malin :</strong> ${esc(shared.slice(0, 4).join(', '))} ${shared.length > 1 ? 'servent' : 'sert'} dans plusieurs plats : moins de restes, moins d'achats.</span></p>` : ''}
  ${!session || !v.dishes.length ? `<section class="card stack"><h3 class="section-title">Courses du batch</h3>
      <p>${list.remaining ? `${plural(list.remaining, 'article')} à prendre` : 'Liste traitée'}${cart.priced ? ` · panier estimé ${cart.partial ? '≥\u00a0' : ''}${esc(eur(cart.cents))}${cart.unpriced ? ` (${cart.unpriced} sans prix)` : ''}` : ''}</p>
      <div class="actions"><button class="btn soft" data-a="drive" data-week="${v.week}">Commander au drive</button><button class="btn ghost" data-a="goShop" data-week="${v.week}">Voir la liste</button></div></section>` : ''}
  <p class="small muted">J+n = jours entre le batch et le repas. Foyer n'évalue pas la conservation : frigo ou congélateur, c'est vous qui décidez. Repères officiels : <a href="${ANSES_FROID}" target="_blank" rel="noopener noreferrer">ANSES, conserver ses aliments</a>.</p>`;
}

CLICK['batchIn'] = d => { const day = d['day'] ?? ''; dispatch(batchDrafts(S(), day, [d['id'] ?? ''], true), { toast: `Ajouté au batch du ${fmtDayShort(day)}` }); };
CLICK['batchOut'] = d => { const day = d['day'] ?? ''; dispatch(batchDrafts(S(), day, [d['id'] ?? ''], false), { toast: 'Retiré du batch : cuisiné le jour du repas' }); };
CLICK['batchAll'] = d => {
  const day = d['day'] ?? '', v = batchView(S(), day);
  const ids = v.candidates.filter(x => defaultIn(day, parseSlot(x.prep.slot ?? '')?.date ?? '')).map(x => x.prep.id);
  dispatch(batchDrafts(S(), day, ids, true), { toast: `${plural(ids.length, 'plat')} au batch du ${fmtDayShort(day)}` });
};
CLICK['batchDone'] = d => {
  const s = S(), id = d['id'] ?? '', day = d['day'] ?? '', prep = s.preps[id];
  if (!prep) return;
  const n = batchView(s, day).dishes.find(x => x.prep.id === id)?.portions ?? 0;
  dispatch(declarePrepared(s, id, n), { toast: `${batchView(s, day).dishes.find(x => x.prep.id === id)?.name ?? 'Plat'} : ${plural(n, 'portion prête', 'portions prêtes')}` });
};

/* ---------- Aujourd'hui : ce que demande le rituel ---------- */
export function ritualCard(rn: RitualNow | null): string {
  const s = S(), r = s.settings.ritual, today = clock().date;
  if (!rn || !r) return '';
  const v = rn.view, when = fmtRelDay(v.day, today);
  const card = (theme: string, emoji: string, kicker: string, title: string, text: string, actions: string) =>
    `<article class="card hero ritual" aria-labelledby="ritual-h"><div class="hero-art t-${theme}"><span class="art-emoji" aria-hidden="true">${emoji}</span><span class="chip info">${esc(kicker)}</span></div>
      <div class="hero-body"><h3 id="ritual-h">${title}</h3><p class="detail">${text}</p><div class="actions">${actions}</div></div></article>`;
  if (rn.kind === 'batch') {
    const left = v.dishes.length - v.done;
    return card('tomato', '👩‍🍳', 'Rituel · batch', left ? 'C\'est l\'heure du batch !' : 'Batch terminé 🎉',
      esc(`${plural(v.dishes.length, 'plat')} · ${plural(v.portions, 'portion')} · ${v.done}/${v.dishes.length} prêts`),
      `<button class="btn" data-a="batchOpen" data-day="${v.day}">${left ? 'Lancer la session' : 'Voir le batch'}</button>`);
  }
  if (rn.kind === 'courses') {
    if (rn.menuEmpty) return card('sun', '🗓️', `Rituel · courses ${hourText(r.shopAt)}`, 'D\'abord, le menu', esc(`Le batch est ${when} : choisissez les repas, la liste de courses suit.`),
      `<button class="btn" data-a="propose" data-week="${v.week}">✨ Proposer le menu</button>`);
    const list = deriveShopping(s, v.week), cart = cartEstimate(s, list);
    return card('ocean', '🛒', `Rituel · courses ${hourText(r.shopAt)}`, 'Jour des courses',
      esc(`${list.remaining ? plural(list.remaining, 'article') + ' à commander' : 'Liste traitée'}${cart.priced ? ` · panier estimé ${cart.partial ? '≥\u00a0' : ''}${eur(cart.cents)}` : ''} · batch ${when}${v.dishes.length ? ` (${plural(v.dishes.length, 'plat')})` : ''}`),
      `<button class="btn" data-a="drive" data-week="${v.week}">Commander au drive</button><button class="btn ghost" data-a="goShop" data-week="${v.week}">Voir la liste</button>${v.dishes.length ? '' : `<button class="btn ghost" data-a="batchOpen" data-day="${v.day}">Plats du batch</button>`}`);
  }
  if (rn.kind === 'choose') return card('basil', '🥘', 'Rituel · batch', `Batch ${when} : quels plats ?`,
    esc(`${plural(v.candidates.length, 'plat prévu', 'plats prévus')} cette semaine. Choisissez ceux à cuisiner à l'avance.`),
    `<button class="btn" data-a="batchOpen" data-day="${v.day}">Choisir les plats</button>`);
  return card('sun', '🗓️', 'Rituel · menu', `Batch ${when} : le menu d'abord`, 'Choisissez les repas de la semaine : la liste de courses et le batch suivent.',
    `<button class="btn" data-a="propose" data-week="${v.week}">✨ Proposer le menu</button>`);
}

// Le rituel jamais réglé : on le présente une fois, discrètement.
export function ritualPromo(): string {
  const s = S();
  if (A.demo || s.settings.ritual !== undefined || !A.device.ritualHint) return '';
  return `<section class="card promo stack" aria-labelledby="promo-h"><div class="row"><span class="look t-tomato" aria-hidden="true">👩‍🍳</span><h2 id="promo-h" class="grow">Batch cooking le dimanche ?</h2></div>
    <p>Menu choisi en cartes, liste finale le samedi, drive le dimanche matin, cuisine l'après-midi : Foyer orchestre et rappelle chaque étape.</p>
    <div class="actions"><button class="btn" data-a="ritual">Découvrir le rituel</button><button class="btn quiet" data-a="ritualLater">Plus tard</button></div></section>`;
}
CLICK['ritualLater'] = () => { setDevice({ ritualHint: false }); A.render(); };

// Semaine : bouton du batch qui la prépare (s'il est encore à venir), avec la série en cours.
export function weekBatchButton(week: LocalDate): string {
  const s = S(), r = s.settings.ritual, today = clock().date;
  if (!r) return '';
  const day = batchDayFor(r, week);
  if (daysBetween(today, day) < -6) return '';
  const v = batchView(s, day), streak = batchStreak(s, today);
  return `<button class="btn soft" data-a="batchOpen" data-day="${day}">👩‍🍳 Batch du ${esc(fmtDayShort(day))}${v.dishes.length ? ` · ${plural(v.dishes.length, 'plat')}` : ''}${streak > 1 ? ` · 🔥 ${streak}` : ''}</button>`;
}

// Réglages : résumé du rituel et du budget.
export function ritualSection(): string {
  const s = S(), r = s.settings.ritual, b = s.settings.budget;
  return `<section class="card stack"><h2>Rituel batch et budget</h2>
    <p>${r ? esc(capital(ritualText(r))) : 'Pas de rituel : courses et cuisine au fil de la semaine.'}${b ? ` · budget ${esc(eur(b))} par semaine` : ''}</p>
    <div class="actions"><button class="btn ${r ? 'ghost' : ''}" data-a="ritual">${r ? 'Régler' : 'Découvrir le rituel batch'}</button></div></section>`;
}

