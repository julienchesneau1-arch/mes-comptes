// État de l'application côté interface : journal, rejeu courant, préférences de ce téléphone, et l'envoi des actions.
import { type LocalDate, paris, weekOf } from '../core/dates.ts';
import type { AnyEv, State } from '../core/model.ts';
import { type Draft, type Replay, replay, stamp, newId } from '../core/reduce.ts';
import { describe } from '../core/describe.ts';
import { type Device, loadDevice, saveDevice, saveLog } from './store.ts';
import { toast, refreshSheet } from './dom.ts';

export type Tab = 'aujourdhui' | 'semaine' | 'courses' | 'maison';
export interface UI {
  tab: Tab;
  week: LocalDate | null;      // semaine affichée (null = semaine en cours)
  day: number;                 // jour sélectionné dans la semaine (téléphone)
  weekList: boolean;           // « toute la semaine » en liste
  shopWeek: LocalDate | null;
  home: 'plats' | 'portions' | 'surveiller' | 'reglages';
  q: string;
  showDone: boolean;
  store: boolean;              // mode magasin : écran allumé, seulement ce qui reste
}

export const A = {
  log: [] as AnyEv[],
  r: replay([]) as Replay,
  device: null as unknown as Device,
  demo: false,
  saveError: null as string | null,
  ui: { tab: 'aujourdhui', week: null, day: -1, weekList: false, shopWeek: null, home: 'plats', q: '', showDone: false, store: false } as UI,
  render: (): void => undefined,
  onChange: (): void => undefined,   // après chaque changement local (synchro automatique)
  now: (): Date => new Date(),
};

export const S = (): State => A.r.state;
export const clock = (): { date: LocalDate; hour: number; minute: number } => paris(A.now());
export const thisWeek = (): LocalDate => weekOf(clock().date, S().settings.weekStart);
export const me = (): string | null => A.device.me;
export const memberName = (id: string | null): string => S().members.find(m => m.id === id)?.name ?? 'Quelqu\'un';
export const otherNames = (): string => S().members.filter(m => m.id !== A.device.me).map(m => m.name).join(', ') || 'l\'autre téléphone';

export function initDevice(): void { A.device = loadDevice(() => newId(16)); }
export function setDevice(patch: Partial<Device>): void { Object.assign(A.device, patch); if (!A.demo) saveDevice(A.device); }

export function setLog(log: AnyEv[]): void {
  A.log = log;
  A.r = replay(log);
}

// Enregistre (sauf en découverte) avec relecture ; une erreur est montrée en permanence jusqu'au prochain succès.
export function persist(): void {
  if (A.demo) return;
  try { saveLog(A.log); A.saveError = null; }
  catch (e) { A.saveError = `Vos dernières modifications ne sont pas enregistrées sur ce téléphone (${e instanceof Error ? e.message : String(e)}). Envoyez un lien de synchro ou exportez une sauvegarde.`; }
}

// Simulation d'annulation : refusée si elle rendrait impossibles des actions faites depuis (par vous ou l'autre téléphone).
export function undoProblem(ids: readonly string[]): string | null {
  const after = replay(A.log, new Set(ids));
  for (const [id, rj] of after.rejected) {
    if (ids.includes(id) || A.r.rejected.has(id) || rj.severity !== 'conflict') continue;
    return `${memberName(rj.by)} a depuis voulu ${describe(A.r, id)} (${rj.reason})`;
  }
  return null;
}

export interface DispatchOpts { toast?: string; undo?: boolean }
// Une commande : événements horodatés, ajoutés au journal, rejoués, enregistrés. Renvoie les événements créés.
export function dispatch(drafts: readonly Draft[], opts: DispatchOpts = {}): AnyEv[] {
  if (!drafts.length) return [];
  const events = stamp({ dev: A.device.dev, by: A.device.me, lc: A.r.maxLc, now: A.now() }, drafts);
  setLog([...A.log, ...events]);
  persist();
  A.render();
  refreshSheet();
  A.onChange();
  const rejected = events.map(e => A.r.rejected.get(e.id)).find(x => x?.severity === 'conflict');
  if (rejected) toast(`Non enregistré : ${rejected.reason}`);
  else if (opts.toast) toast(opts.toast, opts.undo === false ? undefined : () => undo(events.map(e => e.id)));
  return events;
}

export function undo(ids: readonly string[]): void {
  const why = undoProblem(ids);
  if (why) { toast(`Impossible d'annuler : ${why}.`); return; }
  dispatch(ids.map(id => ({ t: 'undo', p: { event: id } }) as Draft), { toast: 'Annulé', undo: false });
}

// Changements faits sur ce téléphone et pas encore envoyés à l'autre.
export const unsent = (): number => A.log.filter(e => e.dev === A.device.dev && e.lc > A.device.lastSentLc && e.t !== 'conflict.ack').length;
