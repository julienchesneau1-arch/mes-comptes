// Démarrage : préférences du téléphone, journal enregistré, navigation par onglets, lien de synchro éventuel, hors-ligne.
import { current } from '../core/model.js';
import { newId } from '../core/reduce.js';
import { esc, norm } from '../core/text.js';
import { A, S, initDevice, setLog, dispatch } from './state.js';
import { loadLog } from './store.js';
import { wire, CLICK } from './registry.js';
import { wireDrag } from './drag.js';
import { $, $$, toast, closeSheet, sheetOpen, openSheet, sheetHead } from './dom.js';
import { todayView, weekView, shopView, homeView } from './views.js';
import { onboardingView, CLASSICS } from './onboarding.js';
import { demoLog } from './demo.js';
import { applyTheme, linkFromUrl } from './sheets/settings.js';
import { startAutoSync } from './autosync.js';
import { startReminders } from './push.js';
import { startAgenda } from './agenda.js';
import './sheets/agenda.js';
import './sheets/slot.js';
import './sheets/recipe.js';
import './sheets/plan.js';
import './sheets/shop.js';
import './sheets/drive.js';
import './sheets/discover.js';
const TABS = ['aujourdhui', 'semaine', 'courses', 'maison'];
// Identifie l'élément qui a le focus pour le retrouver après un nouveau rendu (clavier, lecteur d'écran).
function focusKey() {
    const el = document.activeElement;
    if (!el || el === document.body || el.closest('dialog'))
        return null;
    const attrs = ['data-a', 'data-c', 'data-i', 'data-k', 'data-key', 'data-id', 'data-week', 'data-s', 'data-d', 'data-n', 'id'];
    const sel = attrs.map(a => (el.getAttribute(a) ? `[${a}="${CSS.escape(el.getAttribute(a))}"]` : '')).join('');
    return sel ? `${el.tagName.toLowerCase()}${sel}` : null;
}
function render() {
    const app = $('#app');
    if (!app)
        return;
    const keep = focusKey();
    const nav = $('#tabs');
    const demo = A.demo ? '<div class="demo-bar" role="note"><span>Mode découverte : foyer fictif, rien n\'est enregistré.</span><button class="btn small-btn ghost" data-a="demoExit">Quitter</button></div>' : '';
    if (!S().hid) {
        app.innerHTML = onboardingView();
        if (nav)
            nav.hidden = true;
        return;
    }
    if (nav)
        nav.hidden = false;
    const tab = A.ui.tab;
    app.innerHTML = demo + (tab === 'semaine' ? weekView() : tab === 'courses' ? shopView() : tab === 'maison' ? homeView() : todayView());
    for (const a of $$('#tabs a')) {
        if (a.getAttribute('href') === `#${tab}`)
            a.setAttribute('aria-current', 'page');
        else
            a.removeAttribute('aria-current');
    }
    if (keep)
        $(keep)?.focus({ preventScroll: true });
}
function route() {
    const h = location.hash.slice(1);
    if (h.startsWith('s=')) {
        render();
        linkFromUrl();
        return;
    } // au démarrage, ou lien ouvert alors que Foyer l'était déjà
    const tab = TABS.includes(h) ? h : 'aujourdhui';
    const changed = tab !== A.ui.tab;
    A.ui.tab = tab;
    if (sheetOpen())
        closeSheet();
    render();
    if (changed) {
        window.scrollTo(0, 0);
        $('#main')?.focus({ preventScroll: true });
    }
}
function boot() {
    initDevice();
    applyTheme();
    const { log, dropped } = loadLog();
    setLog(log);
    A.render = render;
    wire(document);
    wireDrag(document);
    route();
    startAutoSync();
    startReminders();
    startAgenda();
    if (dropped > 0)
        toast(`${dropped} élément(s) illisible(s) écarté(s) à l'ouverture. Une copie de secours existe dans Maison › Réglages.`);
    if (dropped < 0)
        toast('Données illisibles sur ce téléphone : restaurez une sauvegarde ou un lien de synchro.');
    addEventListener('hashchange', route);
    matchMedia('(min-width: 820px)').addEventListener('change', render);
    // Retour dans l'app : la date a pu changer (minuit), un autre onglet a pu écrire.
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !A.demo) {
        setLog(loadLog().log);
        render();
    } });
    addEventListener('storage', e => { if (e.key === 'foyer:journal' && !A.demo) {
        setLog(loadLog().log);
        render();
    } });
    void navigator.storage?.persist?.().catch(() => false);
    if ('serviceWorker' in navigator && location.protocol === 'https:')
        navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => undefined);
    addEventListener('online', () => toast('Connexion retrouvée'));
}
/* ---------- Mode découverte ---------- */
CLICK['demo'] = () => {
    if (sheetOpen())
        closeSheet();
    A.demo = true;
    setLog(demoLog(A.now()));
    A.ui.tab = 'aujourdhui';
    location.hash = '#aujourdhui';
    render();
};
CLICK['demoExit'] = () => { A.demo = false; setLog(loadLog().log); A.ui.tab = 'aujourdhui'; location.hash = '#aujourdhui'; render(); };
/* ---------- Ajouter des classiques (noms seuls) ---------- */
const picked = new Set();
CLICK['classics'] = () => {
    picked.clear();
    const have = new Set(Object.values(S().recipes).map(r => norm(current(r).name)));
    openSheet({ id: 'classics', render: () => `${sheetHead('Ajouter des classiques', 'Noms seuls : les ingrédients se complètent quand vous voulez.')}
    <div class="chips">${CLASSICS.filter(c => !have.has(norm(c))).map(c => `<button class="tag" data-a="classicPick" data-c="${esc(c)}" aria-pressed="${picked.has(c)}">${esc(c)}</button>`).join('')}</div>
    <button class="btn block" data-a="classicsOk">Ajouter la sélection</button>` });
};
CLICK['classicPick'] = (d, el) => { const c = d['c'] ?? ''; if (picked.has(c))
    picked.delete(c);
else
    picked.add(c); el.setAttribute('aria-pressed', String(picked.has(c))); };
CLICK['classicsOk'] = () => {
    closeSheet();
    if (!picked.size)
        return;
    dispatch([...picked].map(name => ({ t: 'recipe.save', p: { recipe: newId(), content: { name, yield: null, ingredients: [], steps: [], ahead: [], tags: [], note: '' } } })), { toast: `${picked.size} plat${picked.size > 1 ? 's' : ''} ajouté${picked.size > 1 ? 's' : ''}` });
};
boot();
