// Mesure de l'usage sur ce téléphone (core/usage.ts) : chaque toucher d'action, chaque onglet, chaque fiche recette ouverte.
// Rangé à part du journal : jamais synchronisé, jamais envoyé, jamais dans une sauvegarde ; coupé en mode découverte.
// Sert les raccourcis d'Aujourd'hui (zone fixe, recalculée une fois par jour) et la page « Votre usage » des Réglages.
import { type Usage, readUsage, record, shortcuts, unused, top, measured, featureOf, emptyUsage, MAX_PINS, MEASURE_DAYS, WINDOW } from '../core/usage.ts';
import { current } from '../core/model.ts';
import { A, S, clock, setDevice, thisWeek } from './state.ts';
import { esc, openSheet, sheetHead, refreshSheet, toast } from './dom.ts';
import { CLICK, CHANGE, onAction } from './registry.ts';
import { shopWeekFor } from './sheets/drive.ts';

const KEY = 'foyer:usage';
let usage: Usage | null = null;
function load(): Usage {
  if (usage) return usage;
  let raw: unknown = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  usage = readUsage(raw, clock().date);
  return usage;
}
const save = (): void => { try { if (usage) localStorage.setItem(KEY, JSON.stringify(usage)); } catch { /* navigation privée : rien n'est compté */ } };
export const measuring = (): boolean => !A.demo && A.device.usage;
export function track(key: string): void { if (measuring()) { record(load(), key, clock().date); save(); } }
onAction((name: string) => track(`a:${name}`));

// Libellés lisibles des actions les plus courantes (les autres ne sont pas montrées : la page doit se lire d'un coup d'œil).
const LABELS: Record<string, string> = {
  'a:recipe': 'Ouvrir une fiche recette', 'a:slot': 'Ouvrir un repas', 'a:pick': 'Choisir un plat', 'a:eat': '« On a mangé »',
  'a:prepared': '« C\'est préparé »', 'a:cook': 'Mode cuisine', 'a:line': 'Détail d\'une ligne de courses', 'a:excDo': 'Régler une carte « À régler »',
  'a:deckOk': 'Tout approuver (menu)', 'a:listOther': 'Autre idée (menu)', 'a:idea': 'Trouver une idée', 'a:storeMode': 'Mode magasin',
  'a:batchOpen': 'Séance de batch', 'a:help': 'Comment ça marche', 'a:sync': 'Synchro',
  't:aujourdhui': 'Onglet Aujourd\'hui', 't:semaine': 'Onglet Semaine', 't:courses': 'Onglet Courses', 't:maison': 'Onglet Maison',
};
function labelOf(key: string): string | null {
  if (key.startsWith('r:')) { const r = S().recipes[key.slice(2)]; return r ? `📖 ${current(r).name}` : null; }
  const f = featureOf(key);
  return f ? `${f.icon} ${f.label}` : LABELS[key] ?? null;
}
const recipeOk = (id: string): boolean => !!S().recipes[id] && !S().recipes[id]?.archived;

// Raccourcis d'Aujourd'hui : rien tant que rien n'est épinglé ni servi au moins 3 fois (aucune suggestion inventée).
export function shortcutsHtml(): string {
  if (A.demo) return '';
  // « Scanner une date » a son bouton fixe en haut d'Aujourd'hui : pas de raccourci en double.
  const list = shortcuts(load(), clock().date, A.device.pins, recipeOk).filter(x => x.key !== 'a:watchNew');
  if (!list.length) return '';
  const btn = (key: string): string => {
    if (key.startsWith('r:')) return `<button class="shortcut" data-a="recipe" data-id="${esc(key.slice(2))}">${esc(labelOf(key) ?? '')}</button>`;
    const f = featureOf(key), act = key.slice(2);
    const extra = act === 'drive' ? ` data-week="${shopWeekFor(S(), clock().date, thisWeek())}"` : '';
    return f ? `<button class="shortcut" data-a="${act}"${extra}>${esc(`${f.icon} ${f.label}`)}</button>` : '';
  };
  return `<nav class="shortcuts" aria-label="Raccourcis">${list.map(x => btn(x.key)).join('')}</nav>`;
}

export function usageSummary(): string {
  if (!A.device.usage) return 'Mesure coupée sur ce téléphone.';
  const t = top(load(), clock().date, 3).map(([k]) => labelOf(k)).filter(Boolean);
  return t.length ? `Le plus servi ces 30 jours : ${t.join(', ')}.` : 'Rien de compté pour l\'instant.';
}

export function openUsage(): void {
  openSheet({ id: 'usage', render: () => {
    const u = load(), today = clock().date, days = measured(u, today);
    const rows = top(u, today, 12).map(([k, n]) => ({ k, n, label: labelOf(k) })).filter(x => x.label);
    const pinnable = (k: string): boolean => k.startsWith('r:') || !!featureOf(k);
    const pin = (k: string): string => pinnable(k) ? `<button class="btn quiet small-btn" data-a="pinToggle" data-key="${esc(k)}" aria-pressed="${A.device.pins.includes(k)}">${A.device.pins.includes(k) ? 'Épinglé' : 'Épingler'}</button>` : '';
    const none = unused(u, today);
    return `${sheetHead('Votre usage', 'Compté sur ce téléphone seulement : jamais synchronisé, jamais envoyé, absent des sauvegardes.')}
    <section class="card stack"><h3 class="section-title">Ce qui revient le plus (${WINDOW} jours)</h3>
      ${rows.length ? `<ul class="list">${rows.map(x => `<li><div class="item"><span class="grow"><span class="title">${esc(x.label ?? '')}</span><br><span class="sub">${x.n} fois</span></span>${pin(x.k)}</div></li>`).join('')}</ul>`
        : '<p class="muted">Rien de compté pour l\'instant.</p>'}
      <p class="small muted">Les recettes et outils servis au moins 3 fois, ou épinglés (${MAX_PINS} au plus), apparaissent en raccourci en haut d'Aujourd'hui. Ils se recalculent une fois par jour : rien ne bouge pendant que vous vous en servez, et les onglets restent toujours à la même place.</p></section>
    <section class="card stack"><h3 class="section-title">Pas servi depuis ${WINDOW} jours</h3>
      ${none === null ? `<p class="muted">Encore ${MEASURE_DAYS - days} jour${MEASURE_DAYS - days > 1 ? 's' : ''} de mesure avant de le dire.</p>`
        : none.length ? `<ul class="list">${none.map(f => `<li class="small">${esc(`${f.icon} ${f.label}`)} · ${esc(f.where)}</li>`).join('')}</ul><p class="small muted">Rien n'est masqué : ces outils restent à leur place, hors des raccourcis.</p>`
        : '<p class="muted">Vous vous servez de tout.</p>'}</section>
    <section class="card stack"><label class="item"><input type="checkbox" data-c="usageOn" ${A.device.usage ? 'checked' : ''}><span>Compter mon usage sur ce téléphone</span></label>
      <button class="btn quiet" data-a="usageClear">Effacer les compteurs</button>
      <p class="small muted">Mesuré depuis ${days} jour${days > 1 ? 's' : ''}. Seuls des noms d'actions et d'écrans sont comptés, jamais ce que vous saisissez.</p></section>`;
  } });
}
CLICK['usage'] = () => openUsage();
CLICK['pinToggle'] = d => {
  const k = d['key'] ?? '', pins = A.device.pins;
  if (pins.includes(k)) setDevice({ pins: pins.filter(x => x !== k) });
  else if (pins.length >= MAX_PINS) { toast(`${MAX_PINS} raccourcis épinglés au plus : retirez-en un d'abord.`); return; }
  else setDevice({ pins: [...pins, k] });
  refreshSheet(); A.render();
};
CHANGE['usageOn'] = (_d, el) => { setDevice({ usage: (el as HTMLInputElement).checked }); refreshSheet(); A.render(); };
CLICK['usageClear'] = () => { usage = emptyUsage(clock().date); save(); toast('Compteurs effacés'); refreshSheet(); A.render(); };
