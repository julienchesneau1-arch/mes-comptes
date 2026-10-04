// Les quatre écrans : Aujourd'hui, Semaine, Courses, Maison. HTML calculé depuis l'état ; tout texte est échappé.
import { type LocalDate, type SlotKey, addDays, fmtDay, fmtDayShort, dayShort, dayNumber, slotKey, SLOTS, weekOf, weekday, parseSlot, fmtSlot, paris } from '../core/dates.ts';
import { current } from '../core/model.ts';
import { deriveToday } from '../core/today.ts';
import { slotView, STATUS_LABEL, prepTitle, capital, type SlotView } from '../core/status.ts';
import { deriveShopping, lineQty, shoppingText, orderedAisles, type ShopLine } from '../core/shopping.ts';
import { activeWatch, DGCCRF_URL } from '../core/watch.ts';
import { portions } from '../core/plan.ts';
import { showQty } from '../core/units.ts';
import { norm } from '../core/text.ts';
import { A, S, clock, thisWeek, unsent, otherNames, dispatch } from './state.ts';
import { esc, toast, keepAwake } from './dom.ts';
import { needsInstall } from './sheets/settings.ts';
import { enabled as autoOn, statusLabel, sync as autoSync } from './autosync.ts';
import { fmtCode } from '../core/sync.ts';
import { CLICK, INPUT } from './registry.ts';
import { pushOn } from './push.ts';
import { RELAY } from './config.ts';
import { openLine } from './sheets/shop.ts';
import { packsFor } from '../core/drive.ts';
import { ingredientKey } from '../core/ingredients.ts';

const VERSION = '1.0.0';
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n > 1 ? many : one}`;

/* ---------- Aujourd'hui ---------- */
function cardActions(v: SlotView): string {
  const k = v.key;
  const p = v.prep;
  const more = `<button class="btn ghost" data-a="slot" data-k="${k}">Voir</button>`;
  switch (v.status) {
    case 'vide': return `<button class="btn" data-a="pick" data-k="${k}">Choisir un plat</button><button class="btn ghost" data-a="outside" data-k="${k}">Repas extérieur</button>`;
    case 'personne': return `<button class="btn ghost" data-a="slot" data-k="${k}">Changer les présences</button>`;
    case 'a-cuisiner': case 'commence':
    {
      const rc = p ? S().recipes[p.recipe] : undefined;
      const steps = rc ? current(rc).steps.length : 0;
      return `<button class="btn" data-a="eat" data-k="${k}">On a mangé</button>${p ? `<button class="btn soft" data-a="prepared" data-id="${p.id}" data-k="${k}">C'est préparé</button>` : ''}${p && steps ? `<button class="btn ghost" data-a="cook" data-id="${p.id}">Étapes</button>` : ''}${more}`;
    }
    case 'pret': case 'attend': case 'passe': return `<button class="btn" data-a="eat" data-k="${k}">On a mangé</button>${more}`;
    case 'probleme': return `<button class="btn" data-a="slot" data-k="${k}">Résoudre</button>`;
    default: return more;
  }
}

export function todayView(): string {
  const t = deriveToday(A.r, A.now());
  const s = S();
  const n = unsent();
  const cards = t.cards.map(c => {
    const v = c.view;
    const title = v.title || (v.status === 'personne' ? 'Personne à la maison' : 'Aucun repas prévu');
    return `<article class="card meal" aria-labelledby="m-${v.key.replace('|', '-')}">
      <div class="row"><span class="when grow">${esc(c.label)}</span><span class="chip s-${v.status}">${STATUS_LABEL[v.status]}</span></div>
      <h3 id="m-${v.key.replace('|', '-')}">${esc(title)}</h3>
      ${v.sub ? `<p class="muted small detail">${esc(v.sub)}</p>` : ''}
      ${c.detail ? `<p class="detail">${esc(c.detail)}</p>` : ''}
      ${v.link && v.status !== 'vide' && !c.detail?.startsWith('Préparer') ? `<p class="small muted detail">${esc(v.link)}</p>` : ''}
      ${v.incomplete ? '<p class="chip manque">Ingrédients non renseignés</p>' : ''}
      <div class="actions">${cardActions(v)}</div></article>`;
  }).join('');
  const ideas = t.ideas && (t.ideas.leftovers.length || t.ideas.recipes.length) && t.cards[0] ? `<section class="card" aria-labelledby="ideas-h"><h2 id="ideas-h">Idées pour ${esc(t.cards[0].label.toLowerCase())}</h2><ul class="list">
      ${t.ideas.leftovers.map(x => `<li><button class="item-btn" data-a="pickLeft" data-k="${t.cards[0]?.view.key}" data-id="${x.prep}"><span class="grow"><span class="title">Restes : ${esc(x.name)}</span><br><span class="sub">${plural(x.free, 'portion libre', 'portions libres')} · préparé ${x.age === 0 ? 'aujourd\'hui' : x.age === 1 ? 'hier' : `il y a ${x.age} jours`} · rien à cuisiner</span></span></button></li>`).join('')}
      ${t.ideas.recipes.map(x => `<li><button class="item-btn" data-a="pickRecipe" data-k="${t.cards[0]?.view.key}" data-id="${x.recipe}"><span class="grow"><span class="title">${esc(x.name)}</span><br><span class="sub">${esc(x.reason)}</span></span></button></li>`).join('')}
    </ul></section>` : '';
  const tasks = t.tasks.length ? `<section class="card" aria-labelledby="todo-h"><h2 id="todo-h">À faire</h2><ul class="list">${t.tasks.map(x => `<li class="${x.done ? 'done-line' : ''}"><div class="item">
      <label class="check"><input type="checkbox" data-c="task" data-key="${esc(x.key)}" ${x.done ? 'checked' : ''} aria-label="${esc(x.text)} : fait"><span></span></label>
      <span class="grow"><span class="title">${esc(x.text)}</span><br><span class="sub">${esc(x.hint)}</span></span></div></li>`).join('')}</ul>
      ${t.tasks.every(x => x.done) ? '<p class="small muted">Aucune autre tâche enregistrée aujourd\'hui.</p>' : ''}</section>` : '';
  const toBuy = t.toBuy.length ? `<section class="card" aria-labelledby="buy-h"><h2 id="buy-h">Pas encore pris</h2>${t.toBuy.map(x => `<p><strong>${esc(capital(fmtSlot(x.slot, t.date)))} :</strong> ${esc(x.names.join(', '))}</p>`).join('')}
      <a class="btn ghost" href="#courses">Voir les courses</a></section>` : '';
  const checks = t.checks.length ? `<section class="card" aria-labelledby="chk-h"><h2 id="chk-h">À vérifier</h2><ul class="list">${t.checks.map(p => `<li><div class="item">
      <span class="chip ${p.level}">${p.level === 'conflit' ? 'À résoudre' : p.level === 'attention' ? 'Attention' : 'À compléter'}</span><span class="grow">${esc(p.text)}</span>
      ${p.event ? `<button class="btn small-btn ghost" data-a="ack" data-id="${p.event}">Vu</button>` : p.slot ? `<button class="btn small-btn ghost" data-a="slot" data-k="${p.slot}">Ouvrir</button>` : p.watch ? `<button class="btn small-btn ghost" data-a="watch" data-id="${p.watch}">Ouvrir</button>` : ''}</div></li>`).join('')}</ul></section>` : '';
  const plan = t.empty || t.nextWeekEmpty ? `<section class="card stack" aria-labelledby="plan-h"><h2 id="plan-h">À décider</h2>
      ${t.empty ? `<p>${plural(t.empty, 'repas', 'repas')} pas encore prévu${t.empty > 1 ? 's' : ''} cette semaine.</p><button class="btn soft" data-a="propose">Proposer à partir de nos plats</button>` : ''}
      ${t.nextWeekEmpty ? `<p>La semaine prochaine est vide.</p><div class="actions"><button class="btn soft" data-a="propose" data-week="${addDays(weekOf(t.date, s.settings.weekStart), 7)}">Proposer la semaine prochaine</button><button class="btn ghost" data-a="copyWeek" data-week="${addDays(weekOf(t.date, s.settings.weekStart), 7)}">Reprendre une semaine</button></div>` : ''}</section>` : '';
  const partnerJoined = A.log.some(e => e.dev !== A.device.dev);
  const sync = A.demo || s.members.length < 2 ? '' : autoOn()
    ? (partnerJoined || !A.device.code ? '' : `<div class="banner info"><p class="grow"><strong>${esc(otherNames())} n'a pas encore Foyer.</strong> Sur son téléphone : ouvrir Foyer → « L'autre téléphone a déjà Foyer » → taper le code <span class="kbd">${esc(fmtCode(A.device.code))}</span>. Ensuite, tout se synchronise seul.</p></div>`)
    : !n ? '' : !A.device.lastSentAt && !A.device.lastRecvAt
    ? `<div class="banner info"><p class="grow">${esc(otherNames())} n'a pas encore Foyer : envoyez-lui le lien, puis donnez-lui une fois le code du foyer (Maison › Réglages › Synchro).</p><button class="btn small-btn ghost" data-a="sendSync">Envoyer le lien</button></div>`
    : `<div class="banner info"><p class="grow">${plural(n, 'changement', 'changements')} pas encore envoyé${n > 1 ? 's' : ''} à ${esc(otherNames())}.</p><button class="btn small-btn ghost" data-a="sendSync">Envoyer</button></div>`;
  const install = needsInstall() ? `<div class="banner info"><p class="grow"><strong>Installez Foyer</strong> : Partager <span aria-hidden="true">⎋</span> → « Sur l'écran d'accueil ». Sur iPhone, Safari peut effacer les données d'un site peu ouvert ; l'app installée les garde.</p><button class="btn small-btn ghost" data-a="installDone">C'est fait</button></div>` : '';
  const syncBtn = autoOn() ? `Synchro · ${statusLabel() || 'auto'}` : `Synchro${n ? ` · ${n}` : ''}`;
  return `<div class="top"><h1>${esc(capital(fmtDay(t.date)))}</h1><button class="btn small-btn ghost${autoSync.status === 'offline' || autoSync.status === 'error' ? ' warn' : ''}" data-a="sync">${esc(syncBtn)}</button></div>
  <main id="main" tabindex="-1">${A.saveError ? `<p class="warn-save" role="alert">${esc(A.saveError)}</p>` : ''}${install}${sync}
    <div class="cols"><div class="stack">${cards}${ideas}</div><div class="stack">${checks}${tasks}${toBuy}${plan}</div></div></main>`;
}

/* ---------- Semaine ---------- */
function slotButton(k: SlotKey, label: string): string {
  const c = clock();
  const v = slotView(S(), k, c.date, c.hour);
  const title = v.title || (v.status === 'personne' ? 'Personne' : '+ Ajouter');
  const aria = `${capital(fmtSlot(k, c.date))} : ${title}${v.servings ? `, ${v.servings} portions` : ''}, ${STATUS_LABEL[v.status]}`;
  return `<button class="slot s-${v.status}" data-a="slot" data-k="${k}" aria-label="${esc(aria)}">
    <span class="lbl">${label}</span><span class="t">${esc(title)}</span>
    ${v.status !== 'personne' && v.status !== 'vide' ? `<span class="p">${v.servings} portion${v.servings > 1 ? 's' : ''}${v.sub ? ` · ${esc(v.sub)}` : ''}</span>` : v.status === 'vide' ? `<span class="p">${esc(v.sub)}</span>` : ''}
    ${v.link ? `<span class="p">${esc(v.link)}</span>` : ''}
    ${v.status !== 'vide' && v.status !== 'personne' ? `<span class="chip s-${v.status}">${STATUS_LABEL[v.status]}</span>` : ''}</button>`;
}

export function weekView(): string {
  const s = S(), c = clock();
  const week = A.ui.week ?? defaultWeek();
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  if (A.ui.day < 0 || A.ui.day > 6) A.ui.day = Math.max(0, days.indexOf(c.date));
  const wide = matchMedia('(min-width: 820px)').matches;
  const count = (d: LocalDate) => SLOTS.filter(sl => s.slots[slotKey(d, sl)]?.dish).length;
  const head = `<div class="weeknav"><button class="icon-btn" data-a="wk" data-d="-7" aria-label="Semaine précédente">‹</button>
    <h2>Semaine du ${esc(fmtDayShort(week))}</h2><button class="icon-btn" data-a="wk" data-d="7" aria-label="Semaine suivante">›</button>
    </div>${week !== thisWeek() ? `<button class="btn small-btn quiet" data-a="wk" data-d="0">${week > thisWeek() && week === addDays(thisWeek(), 7) ? 'Revenir à la semaine en cours' : 'Cette semaine'}</button>` : ''}
    <div class="actions"><button class="btn soft small-btn" data-a="propose" data-week="${week}">Proposer les repas vides</button><button class="btn ghost small-btn" data-a="copyWeek" data-week="${week}">Reprendre une semaine</button><button class="btn ghost small-btn" data-a="ahead" data-week="${week}">Préparer en avance</button><button class="btn ghost small-btn" data-a="agenda" data-week="${week}">Agenda</button></div>`;
  let body: string;
  if (wide) {
    body = `<div class="grid7">${days.map(d => `<section aria-labelledby="d-${d}"><h3 id="d-${d}" class="${d === c.date ? 'today' : ''}">${esc(dayShort(d))} ${dayNumber(d)}</h3>
      ${slotButton(slotKey(d, 'midi'), 'Midi')}${slotButton(slotKey(d, 'soir'), 'Soir')}</section>`).join('')}</div>`;
  } else if (A.ui.weekList) {
    body = `<div class="day-list">${days.map(d => `<section class="day-block"><h3>${esc(capital(fmtDay(d)))}${d === c.date ? ' · aujourd\'hui' : ''}</h3>
      <div class="day-slots">${slotButton(slotKey(d, 'midi'), 'Midi')}${slotButton(slotKey(d, 'soir'), 'Soir')}</div></section>`).join('')}</div>`;
  } else {
    const sel = days[A.ui.day] ?? days[0] as LocalDate;
    body = `<div class="ribbon" role="group" aria-label="Jours de la semaine">${days.map((d, i) => `<button data-a="day" data-n="${i}" aria-pressed="${i === A.ui.day}" aria-label="${esc(fmtDay(d))}, ${count(d)} repas prévus">
      <span class="d ${d === c.date ? 'today' : ''}">${esc(dayShort(d))}</span><span class="n">${dayNumber(d)}</span><span class="dots" aria-hidden="true">${'●'.repeat(count(d))}${'○'.repeat(2 - count(d))}</span></button>`).join('')}</div>
      <h3 class="section-title">${esc(capital(fmtDay(sel)))}</h3>
      <div class="stack">${slotButton(slotKey(sel, 'midi'), 'Midi')}${slotButton(slotKey(sel, 'soir'), 'Soir')}</div>`;
  }
  return `<div class="top"><h1>Semaine</h1>${wide ? '' : `<button class="btn small-btn ghost" data-a="weekList" aria-pressed="${A.ui.weekList}">${A.ui.weekList ? 'Vue jour' : 'Toute la semaine'}</button>`}</div>
  <main id="main" tabindex="-1">${head}${body}</main>`;
}
// Le dernier jour de la semaine, on regarde surtout la suivante : c'est elle qu'on prépare.
export function defaultWeek(): LocalDate {
  const c = clock(), w = thisWeek();
  return c.date === addDays(w, 6) ? addDays(w, 7) : w;
}
CLICK['wk'] = d => { const delta = Number(d['d']); A.ui.week = delta === 0 ? thisWeek() : addDays(A.ui.week ?? defaultWeek(), delta); A.ui.day = delta === 0 ? -1 : 0; A.render(); };
CLICK['day'] = d => { A.ui.day = Number(d['n']); A.render(); };
CLICK['weekList'] = () => { A.ui.weekList = !A.ui.weekList; A.render(); };

/* ---------- Courses ---------- */
function lineRow(l: ShopLine, week: LocalDate): string {
  const qty = lineQty(l);
  const sub: string[] = [];
  const known = [...new Set(l.sources.filter(x => x.part).map(x => x.recipeName))];
  if (known.length) sub.push(known.join(', '));
  if (l.pantry?.active && l.pantry.qty !== 'all') sub.push(`déjà là : ${showQty(l.have, l.dim ?? 'piece')} (besoin ${lineQty(l, 'need')})`);
  if (l.pantry?.active && l.pantry.qty === 'all') sub.push('vous avez tout pour cette ligne');
  if (l.pantry && !l.pantry.active) sub.push('« on en a » à revérifier');
  if (l.check?.delta) sub.push(`+${showQty(l.check.delta, l.dim ?? 'piece')} depuis la coche`);
  if (l.check?.newUnknown) sub.push('nouveau plat sans quantité');
  if (l.unknown.length) sub.push(`quantité non renseignée (${[...new Set(l.unknown.map(x => x.recipeName))].join(', ')})`);
  const prod = l.done ? undefined : S().products[ingredientKey(l.name, l.form)];
  const packs = prod ? packsFor(l, prod) : null;
  if (packs?.n) sub.push(`Auchan : ${packs.text}`);
  const label = `${l.name}${l.form ? ` (${l.form})` : ''}`;
  return `<li class="${l.done ? 'done-line' : ''}"><div class="item"><label class="check"><input type="checkbox" data-c="shopCheck" data-week="${week}" data-key="${esc(l.key)}" ${l.done ? 'checked' : ''} aria-label="${esc(label)} : pris"><span></span></label>
    <button class="item-btn grow" data-a="line" data-week="${week}" data-key="${esc(l.key)}"><span class="grow"><span class="title">${esc(label)}</span><br><span class="sub">${esc(sub.filter(Boolean).join(' · '))}</span></span>
    <span class="qty">${esc(l.done && !l.check?.delta ? '' : qty || (l.unknown.length ? '?' : ''))}</span></button></div></li>`;
}

export function shopView(): string {
  const s = S(), c = clock();
  const week = A.ui.shopWeek ?? (weekday(c.date) >= 5 && Object.values(s.preps).some(p => p.slot && (parseSlot(p.slot)?.date ?? '') >= addDays(thisWeek(), 7) && (parseSlot(p.slot)?.date ?? '') < addDays(thisWeek(), 14)) ? addDays(thisWeek(), 7) : thisWeek());
  const list = deriveShopping(s, week);
  const banner = !list.meals ? '' : list.incomplete.length
    ? `<div class="banner partial"><p class="grow"><strong>Liste partielle</strong> : ${esc(list.incomplete.map(x => `${x.name} (${x.why})`).join(', '))}.</p><button class="btn small-btn ghost" data-a="recipe" data-id="${list.incomplete[0]?.recipe}">Compléter</button></div>`
    : '<p class="banner ok">Complète pour les repas renseignés de la semaine.</p>';
  const todo = list.lines.filter(l => !l.done), done = list.lines.filter(l => l.done);
  const mTodo = list.manual.filter(m => !m.checked), mDone = list.manual.filter(m => m.checked);
  const manualRow = (m: typeof list.manual[number]) => `<li class="${m.checked ? 'done-line' : ''}"><div class="item"><label class="check"><input type="checkbox" data-c="itemCheck" data-week="${week}" data-id="${m.id}" ${m.checked ? 'checked' : ''} aria-label="${esc(m.name)} : pris"><span></span></label>
    <button class="item-btn grow" data-a="item" data-week="${week}" data-id="${m.id}"><span class="grow"><span class="title">${esc(m.name)}</span><br><span class="sub">ajouté à la main</span></span><span class="qty">${esc(m.qty)}</span></button></div></li>`;
  const sections = orderedAisles(s).map(a => {
    const ls = todo.filter(l => l.aisle === a.id), ms = mTodo.filter(m => m.aisle === a.id);
    if (!ls.length && !ms.length) return '';
    return `<section class="card" aria-labelledby="a-${a.id}"><h2 id="a-${a.id}"><span aria-hidden="true">${a.icon}</span> ${esc(a.label)}</h2><ul class="list">${ls.map(l => lineRow(l, week)).join('')}${ms.map(manualRow).join('')}</ul></section>`;
  }).join('');
  const staples = Object.entries(s.staples).filter(([, st]) => !list.manual.some(m => norm(m.name) === norm(st.name)));
  const doneCount = done.length + mDone.length;
  const known = [...new Set([...Object.values(s.staples).map(x => x.name), ...Object.values(s.shop).flatMap(w => Object.values(w.items).map(x => x.name)),
    ...Object.values(s.recipes).flatMap(r => current(r).ingredients.map(l => l.name))])].sort((x, y) => x.localeCompare(y, 'fr')).slice(0, 300);
  return `<div class="top"><h1>Courses</h1><button class="btn small-btn ${A.ui.store ? '' : 'ghost'}" data-a="storeMode" aria-pressed="${A.ui.store}">Mode magasin</button><button class="btn small-btn ghost" data-a="shareList" data-week="${week}">Partager</button></div>
  <main id="main" tabindex="-1">
    <div class="weeknav"><button class="icon-btn" data-a="shopWk" data-d="-7" data-w="${week}" aria-label="Semaine précédente">‹</button><h2>Pour la semaine du ${esc(fmtDayShort(week))}</h2><button class="icon-btn" data-a="shopWk" data-d="7" data-w="${week}" aria-label="Semaine suivante">›</button></div>
    ${A.ui.store ? '<p class="banner info">Mode magasin : écran allumé, seulement ce qui reste à prendre.</p>' : banner}
    <form data-f="addItem" data-week="${week}" class="addbar" role="search"><label class="sr-only" for="add-item">Ajouter un article</label><input id="add-item" type="text" name="text" placeholder="Ajouter : café, 2 paquets de pâtes…" autocomplete="off" maxlength="80" list="known-items"><button class="btn">Ajouter</button></form>
    <datalist id="known-items">${known.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
    ${staples.length ? `<div class="chips" aria-label="Habituels">${staples.map(([k, st]) => `<button class="tag" data-a="addStaple" data-key="${esc(k)}" data-week="${week}">+ ${esc(st.name)}</button>`).join('')}</div>` : ''}
    <p class="muted">${todo.length + mTodo.length ? `${plural(todo.length + mTodo.length, 'article', 'articles')} à acheter ou vérifier` : list.meals ? 'Tout est traité pour ces courses.' : 'Aucun plat prévu cette semaine : la liste se remplit dès qu\'un plat avec ingrédients est posé dans la semaine.'}</p>
    ${todo.length + mTodo.length && !A.ui.store ? `<div class="actions"><button class="btn soft" data-a="drive" data-week="${week}">Commander chez Auchan</button></div>` : ''}
    ${sections}
    ${doneCount && !A.ui.store ? `<details class="card" ${A.ui.showDone ? 'open' : ''}><summary data-a="toggleDone">Déjà traités (${doneCount})</summary><ul class="list">${done.map(l => lineRow(l, week)).join('')}${mDone.map(manualRow).join('')}</ul></details>` : ''}
    <div class="actions"><button class="btn ghost" data-a="watchNew">Surveiller la date d'un produit</button></div>
    <p class="small muted">Cocher = traité pour ces courses. Cela ne crée ni stock, ni date, ni prix.</p></main>`;
}
CLICK['shopWk'] = d => { A.ui.shopWeek = addDays(d['w'] ?? thisWeek(), Number(d['d'])); A.render(); };
CLICK['toggleDone'] = () => { A.ui.showDone = !A.ui.showDone; A.render(); };
CLICK['storeMode'] = async () => {
  A.ui.store = !A.ui.store;
  const awake = await keepAwake(A.ui.store);
  A.render();
  toast(A.ui.store ? (awake ? 'Mode magasin : l\'écran reste allumé' : 'Mode magasin (écran allumé non pris en charge ici)') : 'Mode magasin terminé');
};

/* ---------- Maison ---------- */
export function homeView(): string {
  const sec = A.ui.home;
  const tabs = ([['plats', 'Nos plats'], ['portions', 'Portions'], ['surveiller', 'À surveiller'], ['reglages', 'Réglages']] as const)
    .map(([id, label]) => `<button class="tag" data-a="homeSec" data-s="${id}" aria-pressed="${sec === id}">${label}</button>`).join('');
  const body = sec === 'plats' ? platsView() : sec === 'portions' ? portionsView() : sec === 'surveiller' ? watchListView() : settingsView();
  return `<div class="top"><h1>Maison</h1></div><main id="main" tabindex="-1"><div class="chips" role="group" aria-label="Sections">${tabs}</div>${body}</main>`;
}
CLICK['homeSec'] = d => { A.ui.home = (d['s'] ?? 'plats') as typeof A.ui.home; A.render(); };
INPUT['homeQ'] = (_d, el) => { A.ui.q = (el as HTMLInputElement).value; const list = document.getElementById('plats-list'); if (list) list.innerHTML = platsList(); };

function platsList(): string {
  const s = S(), q = norm(A.ui.q);
  const all = Object.values(s.recipes).map(r => ({ r, c: current(r) })).filter(x => !q || norm(x.c.name).includes(q)).sort((a, b) => a.c.name.localeCompare(b.c.name, 'fr'));
  const row = (x: typeof all[number]) => {
    const info = [x.c.yield ? `pour ${x.c.yield}` : '', x.c.ingredients.length ? plural(x.c.ingredients.length, 'ingrédient') : '', x.c.tags.join(', ')].filter(Boolean).join(' · ');
    const missing = !x.c.ingredients.length ? 'ingrédients à compléter' : x.c.ingredients.some(l => l.qty) && !x.c.yield ? 'rendement à compléter' : '';
    return `<li><button class="item-btn" data-a="recipe" data-id="${x.r.id}"><span class="grow"><span class="title">${esc(x.c.name)}</span><br><span class="sub">${esc(info || 'nom seul')}</span></span>${missing ? `<span class="chip manque">${missing}</span>` : ''}</button></li>`;
  };
  const active = all.filter(x => !x.r.archived), archived = all.filter(x => x.r.archived);
  return `${active.length ? `<ul class="list">${active.map(row).join('')}</ul>` : `<p class="empty"><strong>${q ? 'Aucun plat trouvé' : 'Aucun plat pour l\'instant'}</strong>${q ? '' : 'Commencez par vos classiques : un nom suffit, les ingrédients peuvent venir plus tard.'}</p>`}
    ${archived.length ? `<details><summary>Plats rangés (${archived.length})</summary><ul class="list">${archived.map(row).join('')}</ul></details>` : ''}`;
}
function platsView(): string {
  return `<section class="card stack"><div class="actions"><button class="btn" data-a="newRecipe">Nouveau plat</button><button class="btn ghost" data-a="pasteRecipe">Coller une recette</button><button class="btn ghost" data-a="classics">Ajouter des classiques</button><button class="btn ghost" data-a="discover">Découvrir des recettes</button></div>
    <label class="field">Chercher<input type="search" data-i="homeQ" value="${esc(A.ui.q)}" placeholder="Nom du plat" autocomplete="off"></label>
    <div id="plats-list">${platsList()}</div></section>`;
}

function portionsView(): string {
  const s = S(), c = clock();
  const list = Object.values(s.preps).filter(p => p.done).map(p => ({ p, pt: portions(s, p) })).filter(x => (x.pt.remaining ?? 0) > 0)
    .sort((a, b) => (a.p.done?.at ?? '') < (b.p.done?.at ?? '') ? 1 : -1);
  return `<section class="card"><h2>Portions déclarées</h2>
    ${list.length ? `<ul class="list">${list.map(({ p, pt }) => `<li><button class="item-btn" data-a="portions" data-id="${p.id}"><span class="grow"><span class="title">${esc(prepTitle(s, p))} · ${plural(pt.remaining ?? 0, 'portion')}</span><br>
      <span class="sub">préparé ${esc(fmtDayShort(p.done ? paris(new Date(p.done.at)).date : c.date))}${pt.reservations.length ? ` · réservées : ${esc(pt.reservations.map(r => `${r.n} ${fmtSlot(r.slot, c.date)}`).join(', '))}` : ''} · ${(pt.free ?? 0) >= 0 ? `${pt.free} libre${(pt.free ?? 0) > 1 ? 's' : ''}` : `il en manque ${-(pt.free ?? 0)}`}</span></span></button></li>`).join('')}</ul>`
      : '<p class="empty"><strong>Aucune portion enregistrée</strong>Quand vous déclarez un plat préparé avec des portions en plus, elles apparaissent ici.</p>'}
    <p class="small muted">Ce compteur reflète les portions que vous déclarez, pas tout le congélateur. Foyer n'évalue pas la conservation.</p></section>`;
}

function watchListView(): string {
  const c = clock();
  const list = activeWatch(S().watch, c.date);
  return `<section class="card stack"><div class="row"><h2 class="grow">Produits à surveiller</h2><button class="btn small-btn" data-a="watchNew">Ajouter</button></div>
    ${list.length ? `<ul class="list">${list.map(v => `<li><button class="item-btn" data-a="watch" data-id="${v.item.id}"><span class="grow"><span class="title">${esc(v.item.name)}${v.item.qty ? ` · ${esc(v.item.qty)}` : ''}</span><br>
      <span class="sub">${esc(v.headline)}${v.item.slot ? ` · prévu ${esc(fmtSlot(v.item.slot, c.date))}` : ''}</span></span>${v.checks[0] ? `<span class="chip ${v.checks[0].level}">${v.checks[0].level === 'conflit' ? 'À résoudre' : v.checks[0].level === 'attention' ? 'Bientôt' : v.checks[0].level === 'manque' ? 'À compléter' : 'Info'}</span>` : ''}</button></li>`).join('')}</ul>`
      : '<p class="empty"><strong>Aucun produit suivi</strong>Ajoutez seulement ceux qui comptent (viande, poisson, crème…). Pas d\'inventaire du frigo.</p>'}
    <p class="small muted">Seuls contrôles : DLC dépassée, date manquante, produit ouvert. <a href="${DGCCRF_URL}" target="_blank" rel="noopener">Source DGCCRF</a>.</p></section>`;
}

function settingsView(): string {
  const s = S();
  return `<section class="card stack"><h2>Foyer</h2>
      <p>${esc(s.members.map(m => m.name).join(' · '))}${A.device.me ? ` — ce téléphone : <strong>${esc(s.members.find(m => m.id === A.device.me)?.name ?? '')}</strong>` : ''}</p>
      <div class="actions"><button class="btn ghost" data-a="members">Membres</button><button class="btn ghost" data-a="rhythm">Rythme et semaine</button><button class="btn ghost" data-a="aisleOrder">Ordre des rayons</button></div></section>
    <section class="card stack"><h2>Synchro et sauvegarde</h2>
      <div class="actions"><button class="btn" data-a="sync">Synchro avec ${esc(otherNames())}</button><button class="btn ghost" data-a="exportBackup">Exporter une sauvegarde</button>
      <label class="btn ghost">Importer une sauvegarde<input type="file" accept="application/json,.json" data-c="importBackup" class="sr-only"></label><button class="btn ghost" data-a="snapshots">Copies de secours</button></div></section>
    ${RELAY ? `<section class="card stack"><h2>Rappels sur ce téléphone</h2>
      <p>${pushOn() ? '<strong>Activés.</strong> ' : ''}La veille à 19 h « sortir le poulet », la boîte à préparer, et le dimanche à 18 h si la semaine suivante est vide.</p>
      <p class="small muted">Le serveur ne voit que l'heure et un bloc chiffré ; le texte est déchiffré sur le téléphone. Sur iPhone : Foyer installé sur l'écran d'accueil, iOS 16.4 ou plus.</p>
      <div class="actions">${pushOn() ? '<button class="btn ghost" data-a="pushTest">Envoyer un rappel d\'essai</button><button class="btn quiet" data-a="pushOff">Désactiver</button>' : '<button class="btn" data-a="pushOn">Activer les rappels</button>'}</div></section>` : ''}
    <section class="card stack"><h2>Affichage</h2><label class="field">Thème<select data-c="theme"><option value="auto" ${A.device.theme === 'auto' ? 'selected' : ''}>Comme le téléphone</option><option value="light" ${A.device.theme === 'light' ? 'selected' : ''}>Clair</option><option value="dark" ${A.device.theme === 'dark' ? 'selected' : ''}>Sombre</option></select></label>
      <button class="btn ghost" data-a="demo">Mode découverte (exemple, rien n'est enregistré)</button></section>
    <section class="card stack"><h2>Ce que fait Foyer, et ce qu'il ne fait pas</h2>
      <ul class="parsed"><li>Calcule les courses à partir de vos plats et du nombre de portions : quantités exactes, sources visibles.</li>
      <li>Ne tient pas d'inventaire : « on en a déjà » vaut pour une liste, pas pour toujours.</li>
      <li>N'utilise aucune IA, ne devine ni prix, ni durée, ni conservation.</li>
      <li>Ne confirme jamais un repas parce que l'heure est passée.</li>
      <li>Données sur vos téléphones uniquement ; la synchro est chiffrée de bout en bout.</li></ul>
      <p class="small muted">Version ${VERSION} · <a href="${DGCCRF_URL}" target="_blank" rel="noopener">DLC et DDM (DGCCRF)</a></p>
      <button class="btn ghost" data-a="diag">Diagnostic de ce téléphone</button>
      <button class="btn danger" data-a="wipe">Effacer Foyer sur ce téléphone</button></section>`;
}

CLICK['ack'] = d => { dispatch([{ t: 'conflict.ack', p: { event: d['id'] ?? '' } }]); };
CLICK['line'] = d => openLine(d['week'] ?? '', d['key'] ?? '');
CLICK['shareList'] = async d => {
  const week = d['week'] ?? thisWeek();
  const text = shoppingText(deriveShopping(S(), week), `🛒 Courses · semaine du ${fmtDayShort(week)}`, S());
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Liste copiée'); } catch { toast('Copie impossible'); }
};
