// Démarrage : préférences du téléphone, journal enregistré, navigation par onglets, lien de synchro éventuel, hors-ligne.
import { current } from '../core/model.ts';
import { newId } from '../core/reduce.ts';
import { esc, norm } from '../core/text.ts';
import { A, S, initDevice, setLog, dispatch, type Tab } from './state.ts';
import { loadLog } from './store.ts';
import { wire, CLICK } from './registry.ts';
import { wireDrag } from './drag.ts';
import { $, $$, toast, closeSheet, sheetOpen, openSheet, sheetHead } from './dom.ts';
import { todayView, weekView, shopView, homeView } from './views.ts';
import { onboardingView, CLASSICS } from './onboarding.ts';
import { demoLog } from './demo.ts';
import { applyTheme, linkFromUrl } from './sheets/settings.ts';
import { startAutoSync } from './autosync.ts';
import './sheets/slot.ts';
import './sheets/recipe.ts';
import './sheets/plan.ts';
import './sheets/shop.ts';

const TABS: Tab[] = ['aujourdhui', 'semaine', 'courses', 'maison'];

// Identifie l'élément qui a le focus pour le retrouver après un nouveau rendu (clavier, lecteur d'écran).
function focusKey(): string | null {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body || el.closest('dialog')) return null;
  const attrs = ['data-a', 'data-c', 'data-i', 'data-k', 'data-key', 'data-id', 'data-week', 'data-s', 'data-d', 'data-n', 'id'];
  const sel = attrs.map(a => (el.getAttribute(a) ? `[${a}="${CSS.escape(el.getAttribute(a) as string)}"]` : '')).join('');
  return sel ? `${el.tagName.toLowerCase()}${sel}` : null;
}

function render(): void {
  const app = $('#app');
  if (!app) return;
  const keep = focusKey();
  const nav = $('#tabs');
  const demo = A.demo ? '<div class="demo-bar" role="note"><span>Mode découverte : foyer fictif, rien n\'est enregistré.</span><button class="btn small-btn ghost" data-a="demoExit">Quitter</button></div>' : '';
  if (!S().hid) {
    app.innerHTML = onboardingView();
    if (nav) nav.hidden = true;
    return;
  }
  if (nav) nav.hidden = false;
  const tab = A.ui.tab;
  app.innerHTML = demo + (tab === 'semaine' ? weekView() : tab === 'courses' ? shopView() : tab === 'maison' ? homeView() : todayView());
  for (const a of $$<HTMLAnchorElement>('#tabs a')) {
    if (a.getAttribute('href') === `#${tab}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (keep) $<HTMLElement>(keep)?.focus({ preventScroll: true });
}

function route(): void {
  const h = location.hash.slice(1);
  if (h.startsWith('s=')) { render(); linkFromUrl(); return; } // au démarrage, ou lien ouvert alors que Foyer l'était déjà
  const tab = (TABS as string[]).includes(h) ? (h as Tab) : 'aujourdhui';
  const changed = tab !== A.ui.tab;
  A.ui.tab = tab;
  if (sheetOpen()) closeSheet();
  render();
  if (changed) { window.scrollTo(0, 0); $('#main')?.focus({ preventScroll: true }); }
}

function boot(): void {
  initDevice();
  applyTheme();
  const { log, dropped } = loadLog();
  setLog(log);
  A.render = render;
  wire(document);
  wireDrag(document);
  route();
  startAutoSync();
  if (dropped > 0) toast(`${dropped} élément(s) illisible(s) écarté(s) à l'ouverture. Une copie de secours existe dans Maison › Réglages.`);
  if (dropped < 0) toast('Données illisibles sur ce téléphone : restaurez une sauvegarde ou un lien de synchro.');
  addEventListener('hashchange', route);
  matchMedia('(min-width: 820px)').addEventListener('change', render);
  // Retour dans l'app : la date a pu changer (minuit), un autre onglet a pu écrire.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !A.demo) { setLog(loadLog().log); render(); } });
  addEventListener('storage', e => { if (e.key === 'foyer:journal' && !A.demo) { setLog(loadLog().log); render(); } });
  void navigator.storage?.persist?.().catch(() => false);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => undefined);
  addEventListener('online', () => toast('Connexion retrouvée'));
}

/* ---------- Mode découverte ---------- */
CLICK['demo'] = () => {
  if (sheetOpen()) closeSheet();
  A.demo = true;
  setLog(demoLog(A.now()));
  A.ui.tab = 'aujourdhui';
  location.hash = '#aujourdhui';
  render();
};
CLICK['demoExit'] = () => { A.demo = false; setLog(loadLog().log); A.ui.tab = 'aujourdhui'; location.hash = '#aujourdhui'; render(); };

/* ---------- Ajouter des classiques (noms seuls) ---------- */
const picked = new Set<string>();
CLICK['classics'] = () => {
  picked.clear();
  const have = new Set(Object.values(S().recipes).map(r => norm(current(r).name)));
  openSheet({ id: 'classics', render: () => `${sheetHead('Ajouter des classiques', 'Noms seuls : les ingrédients se complètent quand vous voulez.')}
    <div class="chips">${CLASSICS.filter(c => !have.has(norm(c))).map(c => `<button class="tag" data-a="classicPick" data-c="${esc(c)}" aria-pressed="${picked.has(c)}">${esc(c)}</button>`).join('')}</div>
    <button class="btn block" data-a="classicsOk">Ajouter la sélection</button>` });
};
CLICK['classicPick'] = (d, el) => { const c = d['c'] ?? ''; if (picked.has(c)) picked.delete(c); else picked.add(c); el.setAttribute('aria-pressed', String(picked.has(c))); };
CLICK['classicsOk'] = () => {
  closeSheet();
  if (!picked.size) return;
  dispatch([...picked].map(name => ({ t: 'recipe.save' as const, p: { recipe: newId(), content: { name, yield: null, ingredients: [], steps: [], ahead: [], tags: [], note: '' } } })),
    { toast: `${picked.size} plat${picked.size > 1 ? 's' : ''} ajouté${picked.size > 1 ? 's' : ''}` });
};

boot();
