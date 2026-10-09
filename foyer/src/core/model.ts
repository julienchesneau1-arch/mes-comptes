// Modèle : un journal d'événements (qui a fait quoi, quand), rejoué de façon déterministe pour obtenir l'état.
// Deux téléphones qui ont les mêmes événements calculent exactement le même état, quel que soit l'ordre de réception.
import type { LocalDate, SlotKey } from './dates.ts';
import { isDate, isSlotKey } from './dates.ts';
import type { IngredientLine } from './ingredients.ts';
import { AISLE } from './ingredients.ts';
import { UNIT } from './units.ts';
import { qFrom } from './rational.ts';

export type MemberId = string;
export type Presence = 'maison' | 'boite' | 'dehors'; // boîte = mange un plat de la maison, emporté
export interface Member { id: MemberId; name: string }
export interface RhythmDay { midi: Record<MemberId, Presence>; soir: Record<MemberId, Presence> }
// Rituel de la semaine : jour et heure des courses finales (drive), jour et heure du batch cooking. 0 = lundi … 6 = dimanche ; heure « HHMM ».
export interface Ritual { shop: number; shopAt: string; cook: number; cookAt: string }
export interface Settings {
  weekStart: number; rhythm: RhythmDay[]; boxesFromDinner: boolean; aisleOrder?: string[];
  holidays?: boolean;            // fériés (absent = oui)
  ritual?: Ritual | null;        // absent ou null = pas de rituel
  budget?: number | null;        // budget courses par semaine, en centimes, choisi par le foyer
  variety?: Variety;             // part de recettes nouvelles dans les propositions (absent = « max »)
}
// « max » : des recettes nouvelles partout où c'est possible ; « equilibre » : 1 à 3 par semaine ; « mes-plats » : vos plats d'abord.
export type Variety = 'max' | 'equilibre' | 'mes-plats';
export const VARIETIES: readonly Variety[] = ['max', 'equilibre', 'mes-plats'];
const isVariety = (v: unknown): v is Variety => typeof v === 'string' && (VARIETIES as readonly string[]).includes(v);

export interface AheadTask { label: string; when: 'veille' | 'matin' }
export interface RecipeContent {
  name: string;
  yield: number | null;         // rendement de référence (portions) ; null = non renseigné
  ingredients: IngredientLine[];
  steps: string[];
  ahead: AheadTask[];           // « sortir le poulet du congélateur » : déclaré par le foyer, jamais déduit
  tags: string[];               // « rapide », « week-end », « favori »…
  note: string;
  prepMin?: number | null;      // durées déclarées (minutes) : préparation et cuisson ; servent à ordonner la séance de batch
  cookMin?: number | null;
}
export interface Recipe { id: string; versions: RecipeContent[]; archived: boolean }

export type Dish = { kind: 'cook'; prep: string } | { kind: 'from'; prep: string } | { kind: 'outside'; note: string };
export interface Eaten { n: number; by: MemberId | null; at: string }
export interface Slot { presence: Record<MemberId, Presence>; guests: number; dish: Dish | null; eaten: Eaten | null; chef: MemberId | null }

export interface PrepDone { yield: number; planned: number; version: number; by: MemberId | null; at: string }
export interface Prep {
  id: string; recipe: string;
  slot: SlotKey | null;        // créneau où le plat est cuisiné ; null = plat retiré du planning après préparation (portions conservées)
  extra: number;               // portions « sans destination » prévues en plus
  status: 'planned' | 'started' | 'done';
  done: PrepDone | null;
  discarded: number;
  batch: LocalDate | null;     // jour du batch cooking où le plat est cuisiné à l'avance ; null = cuisiné le jour du repas
}

export type DateKind = 'DLC' | 'DDM' | 'inconnu';
export interface DateDecl { kind: DateKind; value: string } // AAAA-MM-JJ, AAAA-MM ou AAAA : la précision imprimée est conservée
export type ItemState = 'ferme' | 'ouvert' | 'congele' | 'decongele' | 'prepare' | 'inconnu';
export interface WatchItem {
  id: string; name: string; qty: string; date: DateDecl | null; state: ItemState; slot: SlotKey | null;
  closed: 'utilise' | 'jete' | null; by: MemberId | null; at: string;
}

export interface Mark { by: MemberId | null; at: string }
export interface WeekShop {
  checked: Record<string, Mark & { needAt: string; name?: string }>;               // « pris » pour le besoin affiché à ce moment
  pantry: Record<string, Mark & { qty: string; needAt: string }>;   // « on en a » : qty = fraction ou « all »
  items: Record<string, Mark & { name: string; qty: string; aisle: string; checked: boolean }>;
  spent?: Mark & { cents: number };                                 // montant réellement payé, saisi par le foyer
}
export interface Staple { name: string; qty: string; aisle: string }
// Produit retenu au drive pour un ingrédient : lien et contenance saisis par le foyer (rien n'est lu sur le site du magasin).
export interface Product { url: string; label: string; size: string | null; unit: string | null; price: number | null; by: MemberId | null; at: string } // price : un paquet, en centimes, vu par le foyer
// Dernier prix payé pour un ingrédient, lu sur une facture du drive (sur le téléphone, sans IA) : nom imprimé, contenance, prix.
// loose : vendu au poids, cents est alors le prix d'un kg (ou d'un litre) ; sinon le prix d'un article de cette contenance.
export interface Paid { label: string; cents: number; size: string | null; unit: string | null; loose: boolean; day: LocalDate; by: MemberId | null; at: string }
export const PRODUCT_URL_RE = /^https:\/\/www\.auchan\.fr\/[a-z0-9-]{1,200}\/pr-[A-Za-z0-9]{1,20}$/;
// Agendas branchés : adresse de lecture (secrète) d'un agenda, rattachée à une personne ou au foyer entier.
export interface AgendaCal { id: string; member: MemberId | null; label: string; url: string }
// Présence posée d'après l'agenda : l'occurrence d'origine est gardée pour la retirer si l'événement disparaît ;
// « overridden » = modifiée ensuite à la main, l'agenda ne s'en mêle plus.
export interface AgendaMark { src: string; cal: string; title: string; presence: Presence; overridden: boolean }
export interface AgendaState { cals: Record<string, AgendaCal>; rules: Record<string, 'auto' | 'jamais'>; marks: Record<string, AgendaMark> }
export const AGENDA_URL_RE = /^https:\/\/[a-z0-9.-]{3,100}\/[^\s"<>\\]{1,1900}$/;

/* ---------- Événements ---------- */

export interface Payloads {
  'household.init': { hid: string; members: Member[]; settings: Settings };
  'members.set': { members: Member[] };
  'settings.set': { weekStart?: number; rhythm?: RhythmDay[]; boxesFromDinner?: boolean; aisleOrder?: string[]; holidays?: boolean; ritual?: Ritual | null; budget?: number | null; variety?: Variety };
  'recipe.save': { recipe: string; content: RecipeContent };
  'recipe.archive': { recipe: string; archived: boolean };
  'slot.presence': { slot: SlotKey; member: MemberId; presence: Presence | null };
  'slot.guests': { slot: SlotKey; guests: number };
  'slot.chef': { slot: SlotKey; member: MemberId | null };
  'slot.cook': { slot: SlotKey; prep: string; recipe: string; extra: number };
  'slot.from': { slot: SlotKey; prep: string };
  'slot.outside': { slot: SlotKey; note: string };
  'slot.clear': { slot: SlotKey };
  'slot.move': { from: SlotKey; to: SlotKey; swap: boolean };
  'slot.eaten': { slot: SlotKey; n: number };
  'prep.recipe': { prep: string; recipe: string };
  'prep.extra': { prep: string; extra: number };
  'prep.start': { prep: string };
  'prep.done': { prep: string; yield: number; planned: number; version: number };
  'prep.correct': { prep: string; yield: number; reason: string };
  'prep.discard': { prep: string; n: number; reason: string };
  'prep.batch': { prep: string; day: LocalDate | null };
  'task.set': { key: string; done: boolean };
  'shop.check': { week: LocalDate; key: string; needAt: string | null; name?: string }; // name : pour nommer un article qui n'est plus au menu
  'shop.pantry': { week: LocalDate; key: string; qty: string | null; needAt: string };
  'shop.item': { week: LocalDate; id: string; name: string; qty: string; aisle: string; checked: boolean; removed: boolean };
  'shop.spent': { week: LocalDate; cents: number | null };
  'staple.set': { key: string; name: string; qty: string; aisle: string; removed: boolean };
  'aisle.set': { key: string; aisle: string };
  'product.set': { key: string; url: string | null; label: string; size: string | null; unit: string | null; price?: number | null };
  'price.paid': { key: string; label: string; cents: number | null; size: string | null; unit: string | null; loose: boolean; day: LocalDate }; // cents null : oublier
  'agenda.set': { cal: string; member: MemberId | null; label: string; url: string | null };
  'agenda.rule': { key: string; effect: 'auto' | 'jamais' | null };
  'agenda.mark': { slot: SlotKey; member: MemberId; presence: Presence | null; src: string; cal: string; title: string };
  'watch.save': { id: string; name: string; qty: string; date: DateDecl | null; state: ItemState; slot: SlotKey | null };
  'watch.close': { id: string; outcome: 'utilise' | 'jete' };
  'conflict.ack': { event: string };
  'undo': { event: string };
}
export type EventType = keyof Payloads;
export interface Ev<T extends EventType = EventType> {
  id: string;            // unique : rejouer deux fois le même événement ne fait rien de plus (idempotence)
  lc: number;            // horloge logique (Lamport) : ordre commun aux deux téléphones
  dev: string;           // appareil émetteur
  by: MemberId | null;   // qui
  at: string;            // instant ISO, pour l'affichage seulement
  t: T;
  p: Payloads[T];
}
export type AnyEv = { [K in EventType]: Ev<K> }[EventType];
export const EVENT_TYPES = new Set<string>(['household.init', 'members.set', 'settings.set', 'recipe.save', 'recipe.archive', 'slot.presence',
  'slot.guests', 'slot.chef', 'slot.cook', 'slot.from', 'slot.outside', 'slot.clear', 'slot.move', 'slot.eaten', 'prep.recipe', 'prep.extra', 'prep.start',
  'prep.done', 'prep.correct', 'prep.discard', 'prep.batch', 'task.set', 'shop.check', 'shop.pantry', 'shop.item', 'shop.spent', 'staple.set', 'aisle.set', 'product.set', 'price.paid', 'agenda.set', 'agenda.rule', 'agenda.mark', 'watch.save',
  'watch.close', 'conflict.ack', 'undo'] satisfies EventType[]);
// Types d'événements que cette version sait lire : s'ils changent (mise à jour de l'app), le relais est relu depuis le début.
export const SCHEMA = [...EVENT_TYPES].sort().join(' ');

/* ---------- Validation stricte de tout ce qui vient d'ailleurs (lien de synchro, sauvegarde) ---------- */

type R = Record<string, unknown>;
const isObj = (v: unknown): v is R => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const bool = (v: unknown): v is boolean => typeof v === 'boolean';
const ID_RE = /^[a-z0-9]{2,24}$/;
export const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);
const KEY_RE = /^[^\u0000-\u001f]{1,120}$/;
const isKey = (v: unknown): v is string => typeof v === 'string' && KEY_RE.test(v);
const PRESENCES = new Set(['maison', 'boite', 'dehors']);
const isPresence = (v: unknown): v is Presence => typeof v === 'string' && PRESENCES.has(v);
const STATES = new Set(['ferme', 'ouvert', 'congele', 'decongele', 'prepare', 'inconnu']);
const NEED_RE = /^(na|-?\d{1,12}(\/\d{1,12})?)(\+\d{1,3})?$/;
const isNeed = (v: unknown): v is string => typeof v === 'string' && NEED_RE.test(v);
const isQty = (v: unknown): v is string => typeof v === 'string' && qFrom(v) !== null && (qFrom(v)?.n ?? 0) > 0;
const optMin = (v: unknown): boolean => v === undefined || v === null || int(v, 0, 1440);
const isHHMM = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3])[0-5]\d$/.test(v);
export const validRitual = (v: unknown): v is Ritual => isObj(v) && int(v['shop'], 0, 6) && int(v['cook'], 0, 6) && isHHMM(v['shopAt']) && isHHMM(v['cookAt']);
const optRitual = (v: unknown): boolean => v === undefined || v === null || validRitual(v);
const optCents = (v: unknown, hi: number): boolean => v === undefined || v === null || int(v, 1, hi);
export const MAX_CENTS = 1_000_000; // 10 000 € : borne de saisie

function validMembers(v: unknown): v is Member[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 8) return false;
  const ids = new Set<string>();
  for (const m of v) { if (!isObj(m) || !isId(m['id']) || !str(m['name'], 40, 1) || ids.has(m['id'])) return false; ids.add(m['id']); }
  return true;
}
function validPresenceMap(v: unknown): v is Record<MemberId, Presence> {
  return isObj(v) && Object.keys(v).length <= 8 && Object.entries(v).every(([k, p]) => isId(k) && isPresence(p));
}
export function validRhythm(v: unknown): v is RhythmDay[] {
  return Array.isArray(v) && v.length === 7 && v.every(d => isObj(d) && validPresenceMap(d['midi']) && validPresenceMap(d['soir']));
}
const validAisleOrder = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 20 && new Set(v).size === v.length && v.every(a => typeof a === 'string' && !!AISLE[a]);
function validSettings(v: unknown): v is Settings {
  return isObj(v) && int(v['weekStart'], 0, 6) && validRhythm(v['rhythm']) && bool(v['boxesFromDinner']) && (v['aisleOrder'] === undefined || validAisleOrder(v['aisleOrder'])) && (v['holidays'] === undefined || bool(v['holidays']))
    && optRitual(v['ritual']) && optCents(v['budget'], MAX_CENTS) && (v['variety'] === undefined || isVariety(v['variety']));
}
export function validIngredient(v: unknown): v is IngredientLine {
  if (!isObj(v) || !str(v['name'], 80, 1) || !str(v['note'], 120)) return false;
  const qty = v['qty'], unit = v['unit'], form = v['form'];
  if (qty === null) { if (unit !== null) return false; }
  else if (!isQty(qty) || typeof unit !== 'string' || !UNIT[unit]) return false;
  return form === null || str(form, 20, 1);
}
export function validContent(v: unknown): v is RecipeContent {
  return isObj(v) && str(v['name'], 80, 1) && (v['yield'] === null || int(v['yield'], 1, 50))
    && Array.isArray(v['ingredients']) && v['ingredients'].length <= 60 && v['ingredients'].every(validIngredient)
    && Array.isArray(v['steps']) && v['steps'].length <= 40 && v['steps'].every(s => str(s, 500, 1))
    && Array.isArray(v['ahead']) && v['ahead'].length <= 10
    && v['ahead'].every(a => isObj(a) && str(a['label'], 120, 1) && (a['when'] === 'veille' || a['when'] === 'matin'))
    && Array.isArray(v['tags']) && v['tags'].length <= 10 && v['tags'].every(t => str(t, 24, 1))
    && str(v['note'], 1000) && optMin(v['prepMin']) && optMin(v['cookMin']);
}
function validDateDecl(v: unknown): v is DateDecl {
  if (!isObj(v)) return false;
  const k = v['kind'], val = v['value'];
  if (k !== 'DLC' && k !== 'DDM' && k !== 'inconnu') return false;
  if (typeof val !== 'string') return false;
  if (isDate(val)) return true;
  if (k === 'DLC') return false; // une DLC porte toujours un jour : jamais de jour inventé
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(val) || /^\d{4}$/.test(val);
}

const P: { [K in EventType]: (p: R) => boolean } = {
  'household.init': p => isId(p['hid']) && validMembers(p['members']) && validSettings(p['settings']),
  'members.set': p => validMembers(p['members']),
  'settings.set': p => (p['weekStart'] === undefined || int(p['weekStart'], 0, 6)) && (p['rhythm'] === undefined || validRhythm(p['rhythm']))
    && (p['boxesFromDinner'] === undefined || bool(p['boxesFromDinner'])) && (p['aisleOrder'] === undefined || validAisleOrder(p['aisleOrder']))
    && (p['holidays'] === undefined || bool(p['holidays'])) && optRitual(p['ritual']) && optCents(p['budget'], MAX_CENTS)
    && (p['variety'] === undefined || isVariety(p['variety'])),
  'recipe.save': p => isId(p['recipe']) && validContent(p['content']),
  'recipe.archive': p => isId(p['recipe']) && bool(p['archived']),
  'slot.presence': p => isSlotKey(p['slot']) && isId(p['member']) && (p['presence'] === null || isPresence(p['presence'])),
  'slot.guests': p => isSlotKey(p['slot']) && int(p['guests'], 0, 20),
  'slot.chef': p => isSlotKey(p['slot']) && (p['member'] === null || isId(p['member'])),
  'slot.cook': p => isSlotKey(p['slot']) && isId(p['prep']) && isId(p['recipe']) && int(p['extra'], 0, 30),
  'slot.from': p => isSlotKey(p['slot']) && isId(p['prep']),
  'slot.outside': p => isSlotKey(p['slot']) && str(p['note'], 80),
  'slot.clear': p => isSlotKey(p['slot']),
  'slot.move': p => isSlotKey(p['from']) && isSlotKey(p['to']) && p['from'] !== p['to'] && bool(p['swap']),
  'slot.eaten': p => isSlotKey(p['slot']) && int(p['n'], 0, 50),
  'prep.recipe': p => isId(p['prep']) && isId(p['recipe']),
  'prep.extra': p => isId(p['prep']) && int(p['extra'], 0, 30),
  'prep.start': p => isId(p['prep']),
  'prep.done': p => isId(p['prep']) && int(p['yield'], 0, 99) && int(p['planned'], 0, 99) && int(p['version'], 1, 10000),
  'prep.correct': p => isId(p['prep']) && int(p['yield'], 0, 99) && str(p['reason'], 120),
  'prep.discard': p => isId(p['prep']) && int(p['n'], 1, 99) && str(p['reason'], 120),
  'prep.batch': p => isId(p['prep']) && (p['day'] === null || isDate(p['day'])),
  'task.set': p => isKey(p['key']) && bool(p['done']),
  'shop.check': p => isDate(p['week']) && isKey(p['key']) && (p['needAt'] === null || isNeed(p['needAt'])) && (p['name'] === undefined || str(p['name'], 80, 1)),
  'shop.pantry': p => isDate(p['week']) && isKey(p['key']) && (p['qty'] === null || p['qty'] === 'all' || isQty(p['qty'])) && isNeed(p['needAt']),
  'shop.item': p => isDate(p['week']) && isId(p['id']) && str(p['name'], 80, 1) && str(p['qty'], 40) && typeof p['aisle'] === 'string'
    && !!AISLE[p['aisle']] && bool(p['checked']) && bool(p['removed']),
  'shop.spent': p => isDate(p['week']) && (p['cents'] === null || int(p['cents'], 1, MAX_CENTS)),
  'staple.set': p => isKey(p['key']) && str(p['name'], 80, 1) && str(p['qty'], 40) && typeof p['aisle'] === 'string' && !!AISLE[p['aisle']] && bool(p['removed']),
  'aisle.set': p => isKey(p['key']) && typeof p['aisle'] === 'string' && !!AISLE[p['aisle']],
  'product.set': p => isKey(p['key']) && (p['url'] === null || (typeof p['url'] === 'string' && PRODUCT_URL_RE.test(p['url']))) && str(p['label'], 120)
    && ((p['size'] === null && p['unit'] === null) || (isQty(p['size']) && typeof p['unit'] === 'string' && !!UNIT[p['unit']])) && optCents(p['price'], 100_000),
  'price.paid': p => isKey(p['key']) && str(p['label'], 120) && (p['cents'] === null || int(p['cents'], 1, 100_000)) && bool(p['loose']) && isDate(p['day'])
    && ((p['size'] === null && p['unit'] === null) || (isQty(p['size']) && typeof p['unit'] === 'string' && !!UNIT[p['unit']]))
    && (!p['loose'] || (p['size'] === '1' && (p['unit'] === 'kg' || p['unit'] === 'l'))),
  'agenda.set': p => isId(p['cal']) && (p['member'] === null || isId(p['member'])) && str(p['label'], 40)
    && (p['url'] === null || (typeof p['url'] === 'string' && AGENDA_URL_RE.test(p['url']))),
  'agenda.rule': p => isKey(p['key']) && (p['effect'] === null || p['effect'] === 'auto' || p['effect'] === 'jamais'),
  'agenda.mark': p => isSlotKey(p['slot']) && isId(p['member']) && (p['presence'] === null || isPresence(p['presence']))
    && typeof p['src'] === 'string' && /^[0-9a-f]{16}$/.test(p['src']) && isId(p['cal']) && str(p['title'], 120),
  'watch.save': p => isId(p['id']) && str(p['name'], 80, 1) && str(p['qty'], 40) && (p['date'] === null || validDateDecl(p['date']))
    && typeof p['state'] === 'string' && STATES.has(p['state']) && (p['slot'] === null || isSlotKey(p['slot'])),
  'watch.close': p => isId(p['id']) && (p['outcome'] === 'utilise' || p['outcome'] === 'jete'),
  'conflict.ack': p => isId(p['event']),
  'undo': p => isId(p['event']),
};

// Renvoie l'événement s'il est conforme, sinon null. Taille bornée : un lien reçu ne peut pas saturer le téléphone.
export function validEvent(x: unknown): AnyEv | null {
  if (!isObj(x) || !isId(x['id']) || !int(x['lc'], 1, 1e12) || !isId(x['dev']) || !(x['by'] === null || isId(x['by']))
    || !str(x['at'], 40, 10) || Number.isNaN(Date.parse(x['at'] as string)) || typeof x['t'] !== 'string' || !EVENT_TYPES.has(x['t']) || !isObj(x['p'])) return null;
  if (JSON.stringify(x).length > 20000) return null;
  const check = P[x['t'] as EventType];
  return check(x['p']) ? (x as unknown as AnyEv) : null;
}

/* ---------- État ---------- */

export interface Rejection { id: string; t: EventType; by: MemberId | null; at: string; reason: string; severity: 'noop' | 'conflict' }
export interface State {
  hid: string | null;
  members: Member[];
  settings: Settings;
  recipes: Record<string, Recipe>;
  slots: Record<SlotKey, Slot>;
  preps: Record<string, Prep>;
  shop: Record<LocalDate, WeekShop>;
  staples: Record<string, Staple>;
  aisles: Record<string, string>;
  products: Record<string, Product>;
  paid: Record<string, Paid>;      // dernier prix payé par ingrédient (factures du drive)
  agenda: AgendaState;
  watch: Record<string, WatchItem>;
  tasks: Record<string, Mark & { done: boolean }>;
  acked: Set<string>;
}

export const defaultRhythm = (ids: readonly MemberId[], midi: Presence, soir: Presence, weekendMidi: Presence = 'maison'): RhythmDay[] =>
  Array.from({ length: 7 }, (_, wd) => ({
    midi: Object.fromEntries(ids.map(id => [id, wd >= 5 ? weekendMidi : midi])),
    soir: Object.fromEntries(ids.map(id => [id, soir])),
  }));

export const emptyState = (): State => ({
  hid: null, members: [], settings: { weekStart: 0, rhythm: defaultRhythm([], 'maison', 'maison'), boxesFromDinner: true },
  recipes: {}, slots: {}, preps: {}, shop: {}, staples: {}, aisles: {}, products: {}, paid: {}, agenda: { cals: {}, rules: {}, marks: {} }, watch: {}, tasks: {}, acked: new Set(),
});

export const current = (r: Recipe): RecipeContent => r.versions[r.versions.length - 1] as RecipeContent;
