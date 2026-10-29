// Bilan d'une semaine : les repas où quelqu'un mange (présence de chacun, agenda appliqué, invités) face aux plats prévus, compté
// en plats à cuisiner. Un midi nourri par le dîner de la veille (boîtes, ou tous les midis si le foyer cuisine le soir avec des
// portions en plus) n'est pas un plat de plus : il suit son dîner. « Il manque » : plats à cuisiner sans plat prévu. « En trop » :
// portions sans repas pour les manger (portions « en plus » d'un plat pas encore cuisiné, restes déjà préparés et libres) et plats
// posés sur un repas où personne ne mange. Fonction pure de l'état et de l'heure : le bilan suit l'agenda, les présences, les plats.
import { type LocalDate, type SlotKey, SLOTS, addDays, slotKey, parseSlot, slotOrder, daysBetween, fmtSlot, prevSlot } from './dates.ts';
import type { State } from './model.ts';
import type { Draft } from './reduce.ts';
import { servings, portions, fedByDinner } from './plan.ts';
import { isUpcoming, leftovers } from './propose.ts';
import { prepTitle } from './status.ts';
import { fromDrafts, REUSE_DAYS } from './commands.ts';
import { plural } from './text.ts';

export interface Spare { prep: string; name: string; n: number; ready: boolean; from: SlotKey | null } // ready : déjà préparé (restes)
export interface Coverage {
  meals: SlotKey[];     // repas à venir de la semaine où quelqu'un mange
  missing: SlotKey[];   // plats à cuisiner encore sans plat (un midi nourri par un dîner à prévoir n'y est pas)
  need: number;         // portions de ces repas
  fed: SlotKey[];       // midis nourris par le dîner de la veille (prévu, ou à prévoir)
  boxes: { slot: SlotKey; prep: string }[]; // dont le dîner est prévu mais pas encore relié : « + N portions » d'un toucher
  idle: SlotKey[];      // plats à cuisiner posés sur un repas où personne ne mange (ni boîte, ni portions en plus)
  spares: Spare[];      // portions en trop
  spare: number;        // leur total
  lunches: SlotKey[];   // midis sans plat dont la veille au soir quelqu'un mange : ce que le réglage « le midi = restes du dîner » éviterait de cuisiner
}

export function coverage(s: State, week: LocalDate, today: LocalDate, hour: number): Coverage {
  const meals: SlotKey[] = [], missing: SlotKey[] = [], idle: SlotKey[] = [], fed: SlotKey[] = [], lunches: SlotKey[] = [];
  const boxes: { slot: SlotKey; prep: string }[] = [];
  let need = 0;
  for (let i = 0; i < 7; i++) for (const sl of SLOTS) {
    const k = slotKey(addDays(week, i), sl), slot = s.slots[k];
    if (!isUpcoming(k, today, hour) || slot?.eaten) continue;
    const n = servings(s, k);
    if (n > 0) {
      meals.push(k);
      const src = prevSlot(k), dinner = s.slots[src];
      if (sl === 'midi' && servings(s, src) > 0 && !dinner?.eaten && (slot?.dish?.kind === 'from' || !slot?.dish)) {
        if (fedByDinner(s, k)) {
          if (dinner?.dish?.kind === 'cook') { fed.push(k); if (!slot?.dish) boxes.push({ slot: k, prep: dinner.dish.prep }); continue; }
          if (!dinner?.dish && isUpcoming(src, today, hour)) { fed.push(k); continue; } // le dîner, à prévoir, le nourrira
          if (slot?.dish) { fed.push(k); continue; }
        } else if (!slot?.dish) lunches.push(k);
      }
      if (!slot?.dish) { missing.push(k); need += n; }
    } else if (slot?.dish?.kind === 'cook') { const p = s.preps[slot.dish.prep]; if (p && !p.done && portions(s, p).planned === 0) idle.push(k); }
  }
  const end = addDays(week, 6), spares: Spare[] = [];
  // Portions « en plus » d'un plat de la semaine pas encore cuisiné, que rien ne reprend encore.
  for (const p of Object.values(s.preps)) {
    const d = p.slot ? parseSlot(p.slot)?.date : undefined;
    if (p.done || !p.slot || !d || d < week || d > end || p.extra <= 0 || !isUpcoming(p.slot, today, hour)) continue;
    spares.push({ prep: p.id, name: prepTitle(s, p), n: p.extra, ready: false, from: p.slot });
  }
  // Restes déjà préparés et libres : seulement pour la semaine en cours (ils se mangent maintenant).
  if (today >= week && today <= end) for (const x of leftovers(s, today)) spares.push({ prep: x.prep, name: x.name, n: x.free, ready: true, from: null });
  return { meals, missing, need, fed, boxes, idle, spares, spare: spares.reduce((t, x) => t + x.n, 0), lunches };
}

// Gestes d'un toucher, dans l'ordre : nourrir un midi avec le dîner prévu la veille (portions en plus ce soir-là), reprendre des
// portions en trop sur un repas sans plat (le même plat, sans le cuisiner deux fois ; des portions « en plus » seulement dans les
// 6 jours qui suivent leur cuisson), puis déplacer un plat posé sur un repas où personne ne mange vers un repas sans plat.
// Trois au plus.
export interface Fix { label: string; drafts: Draft[] }
export function coverageFixes(s: State, c: Coverage, today: LocalDate): Fix[] {
  const out: Fix[] = [], left = new Map(c.spares.map(x => [x.prep, x.n])), open = [...c.missing];
  for (const b of c.boxes) {
    const n = servings(s, b.slot);
    out.push({ label: `♻️ ${prepTitle(s, s.preps[b.prep])} aussi ${fmtSlot(b.slot, today)} (+${n} portion${n > 1 ? 's' : ''} la veille)`, drafts: fromDrafts(s, b.slot, b.prep, n) });
  }
  for (const k of [...open]) {
    const n = servings(s, k), at = parseSlot(k)?.date ?? '';
    const x = c.spares.find(sp => (left.get(sp.prep) ?? 0) >= n && (sp.ready || (!!sp.from && slotOrder(sp.from) < slotOrder(k)
      && daysBetween(parseSlot(sp.from)?.date ?? at, at) <= REUSE_DAYS)));
    if (!x) continue;
    left.set(x.prep, (left.get(x.prep) ?? 0) - n);
    open.splice(open.indexOf(k), 1);
    out.push({ label: `♻️ ${x.ready ? `Restes de ${x.name}` : x.name} ${fmtSlot(k, today)}`, drafts: fromDrafts(s, k, x.prep, n) });
  }
  for (const k of c.idle) {
    const to = open.shift();
    if (!to) break;
    out.push({ label: `Déplacer ${prepTitle(s, s.preps[(s.slots[k]?.dish as { prep: string }).prep])} à ${fmtSlot(to, today)}`, drafts: [{ t: 'slot.move', p: { from: k, to, swap: false } }] });
  }
  return out.slice(0, 3);
}

// En une phrase : ce qui manque, ce qui est en trop, ou que tout est prévu. Vide s'il ne reste aucun repas à venir.
// hint : midis qu'on cuisine encore alors que la veille au soir on mange ensemble (proposer « le midi = restes du dîner »).
export function coverageText(s: State, c: Coverage, today: LocalDate): { level: 'ok' | 'manque' | 'trop'; title: string; detail: string; hint: number } | null {
  if (!c.meals.length && !c.idle.length && !c.spare) return null;
  const slots = (ks: SlotKey[]): string => (ks.length > 4 ? `${ks.slice(0, 3).map(k => fmtSlot(k, today)).join(', ')} et ${ks.length - 3} autres` : ks.map(k => fmtSlot(k, today)).join(', '));
  const per = Math.max(1, Math.round(c.meals.reduce((t, k) => t + servings(s, k), 0) / Math.max(1, c.meals.length))); // portions d'un repas, en moyenne
  const trop = [...c.spares.map(x => `${x.ready ? `restes de ${x.name}` : x.name} : ${plural(x.n, 'portion', 'portions')} en plus`),
    ...c.idle.map(k => `${prepTitle(s, s.preps[(s.slots[k]?.dish as { prep: string }).prep])} ${fmtSlot(k, today)}, où personne ne mange`)];
  const hint = !s.settings.lunchFromDinner && c.lunches.length >= 2 ? c.lunches.length : 0;
  const fedText = c.fed.length ? ` ${plural(c.fed.length, 'midi suit', 'midis suivent')} le dîner de la veille (portions en plus le soir).` : '';
  const dishes = c.meals.length - c.fed.length;
  if (c.missing.length && (c.spare || c.idle.length)) {
    const fill = coverageFixes(s, c, today).length; // midis reliés, restes reposés ou plat déplacé : des repas sans plat en moins
    return { level: 'manque', title: `Il manque ${plural(c.missing.length, 'plat', 'plats')} à cuisiner pour finir la semaine, mais il y a du trop`,
      detail: `Sans plat : ${slots(c.missing)}. En trop : ${trop.join(' · ')}.${fill ? ` De quoi couvrir ${plural(fill, 'repas', 'repas')} sans rien cuisiner de plus.` : ''}${fedText}`, hint };
  }
  if (c.missing.length) return { level: 'manque', title: `Pas assez de plats : il manque ${plural(c.missing.length, 'plat', 'plats')} à cuisiner pour finir la semaine`,
    detail: `${slots(c.missing)} (${plural(c.need, 'portion', 'portions')}).${fedText}`, hint };
  if (c.spare || c.idle.length) return { level: 'trop', title: `Trop de plats : ${c.spare ? `${plural(c.spare, 'portion', 'portions')} en trop` : plural(c.idle.length, 'plat sans personne pour le manger', 'plats sans personne pour les manger')}`,
    detail: `${trop.join(' · ')}.${c.spare >= per ? ` De quoi faire ≈ ${plural(Math.floor(c.spare / per), 'repas', 'repas')} de restes.` : ''}`, hint };
  return { level: 'ok', title: `Semaine couverte : ${plural(dishes, 'plat', 'plats')} pour ${plural(c.meals.length, 'repas', 'repas')}, rien en trop`, detail: c.boxes.length ? '' : fedText.trim(), hint };
}
