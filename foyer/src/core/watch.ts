// Produits à surveiller : contrôles volontairement limités sur des dates déclarées par le foyer.
// Source consultée le 4 octobre 2026 : DGCCRF, fiche « Date limite de consommation et date de durabilité minimale »
// (écrite le 17/12/2025). Aucune durée de conservation n'est calculée ; on affiche des faits et les seuls contrôles effectués.
import { type LocalDate, type SlotKey, daysBetween, fmtDayShort, monthName, parseSlot, fmtSlot } from './dates.ts';
import type { DateDecl, WatchItem, ItemState } from './model.ts';

export const DGCCRF_URL = 'https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/date-limite-de-consommation-et-date-de-durabilite-minimale-ce-que-vous-devez-savoir';

export const STATE_LABEL: Record<ItemState, string> = {
  ferme: 'fermé', ouvert: 'ouvert', congele: 'congelé', decongele: 'décongelé', prepare: 'préparé / cuisiné', inconnu: 'état inconnu',
};
export const KIND_LABEL: Record<DateDecl['kind'], string> = {
  DLC: 'À consommer jusqu\'au (DLC)', DDM: 'À consommer de préférence avant (DDM)', inconnu: 'type de date inconnu',
};

export function fmtDecl(d: DateDecl): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.value)) return `${fmtDayShort(d.value)} ${d.value.slice(0, 4)}`;
  if (/^\d{4}-\d{2}$/.test(d.value)) return `${monthName(Number(d.value.slice(5, 7)))} ${d.value.slice(0, 4)}`;
  return d.value;
}

// Comparaison d'une date imprimée à un jour, en respectant sa précision (une DDM « octobre 2026 » n'a pas de jour).
export function declVsDay(d: DateDecl, day: LocalDate): 'avant' | 'meme' | 'apres' {
  const n = d.value.length === 10 ? 10 : d.value.length === 7 ? 7 : 4;
  const a = d.value.slice(0, n), b = day.slice(0, n);
  return a < b ? 'avant' : a === b ? 'meme' : 'apres';
}

export interface Check { level: 'conflit' | 'attention' | 'manque' | 'info'; text: string }
export interface WatchView { item: WatchItem; checks: Check[]; urgency: number; headline: string }

export function watchView(w: WatchItem, today: LocalDate): WatchView {
  const checks: Check[] = [];
  let urgency = 1000, headline = '';
  const d = w.date;
  const opened = w.state === 'ouvert' || w.state === 'decongele' || w.state === 'prepare';
  if (!d) { checks.push({ level: 'manque', text: 'Date à renseigner' }); headline = 'Date à renseigner'; urgency = 500; }
  else if (d.kind === 'inconnu') { checks.push({ level: 'manque', text: 'Type de date à préciser : DLC ou DDM' }); headline = `Date ${fmtDecl(d)} · type à préciser`; urgency = 400; }
  else if (d.kind === 'DLC') {
    const delta = daysBetween(today, d.value);
    urgency = delta;
    headline = `DLC ${fmtDecl(d)}`;
    if (delta < 0) checks.push({ level: 'conflit', text: `DLC dépassée depuis ${-delta} jour${delta < -1 ? 's' : ''} (date imprimée, déclarée par vous)` });
    else if (delta === 0) checks.push({ level: 'attention', text: 'DLC aujourd\'hui' });
    else if (delta === 1) checks.push({ level: 'attention', text: 'DLC demain' });
  } else {
    headline = `DDM ${fmtDecl(d)}`;
    urgency = 300;
    if (declVsDay(d, today) === 'avant') checks.push({ level: 'info', text: 'DDM dépassée. DGCCRF : une DDM n\'a pas le caractère impératif d\'une DLC ; le produit peut être consommé si l\'emballage n\'est pas altéré.' });
  }
  if (opened) checks.push({ level: 'manque', text: `${STATE_LABEL[w.state]} : la date imprimée ne s'applique plus (DGCCRF). Conservation non déterminée : suivez l'étiquette.` });
  if (w.state === 'inconnu') checks.push({ level: 'manque', text: 'État à préciser (fermé, ouvert…)' });
  if (w.state === 'congele' && d?.kind === 'DLC') checks.push({ level: 'info', text: 'DGCCRF : ne jamais congeler un produit dont la DLC est proche, atteinte ou dépassée. La congélation ne repousse aucune date ici.' });
  if (w.slot) checks.push(...linkChecks(w, w.slot, today));
  return { item: w, checks, urgency, headline };
}

// EX-03 : seul contrôle effectué = DLC déclarée et confirmée face à la date du repas lié. Rien d'autre n'est garanti.
export function linkChecks(w: WatchItem, slot: SlotKey, today: LocalDate): Check[] {
  const p = parseSlot(slot);
  if (!p) return [];
  const when = fmtSlot(slot, today);
  const d = w.date;
  if (!d || d.kind === 'inconnu') return [{ level: 'manque', text: `Prévu ${when} : date manquante, compatibilité non évaluée` }];
  if (w.state !== 'ferme') return [{ level: 'manque', text: `Prévu ${when} : produit ${STATE_LABEL[w.state]}, compatibilité non évaluée` }];
  if (d.kind === 'DLC' && declVsDay(d, p.date) === 'avant') return [{ level: 'conflit', text: `Prévu ${when}, après sa DLC (${fmtDecl(d)})` }];
  if (d.kind === 'DLC') return [{ level: 'info', text: `Prévu ${when} : DLC déclarée non dépassée à cette date. Seul contrôle effectué, pas une garantie.` }];
  return [{ level: 'info', text: `Prévu ${when} : DDM, aucune limite impérative contrôlée` }];
}

export const activeWatch = (items: Record<string, WatchItem>, today: LocalDate): WatchView[] =>
  Object.values(items).filter(w => !w.closed).map(w => watchView(w, today))
    .sort((a, b) => a.urgency - b.urgency || a.item.name.localeCompare(b.item.name, 'fr'));
