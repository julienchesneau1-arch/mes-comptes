// Aperçu avant d'enregistrer : on simule les événements, on compare avant/après, on décrit les conséquences.
// Si le journal a changé entre l'aperçu et la validation (synchro reçue), l'aperçu est refait : jamais d'écrasement silencieux.
import { type LocalDate, type SlotKey, parseSlot, weekOf, fmtSlot } from './dates.ts';
import type { AnyEv, State } from './model.ts';
import { type Ctx, type Draft, type Replay, replay, stamp } from './reduce.ts';
import { portions } from './plan.ts';
import { slotView, problems, prepTitle, capital } from './status.ts';
import { deriveShopping, lineQty } from './shopping.ts';

export interface Impact { level: 'info' | 'attention' | 'conflit'; text: string }
export interface Preview { drafts: Draft[]; events: AnyEv[]; impacts: Impact[]; blocked: boolean; base: number; after: Replay }

export function previewChange(log: readonly AnyEv[], ctx: Ctx, drafts: Draft[], today: LocalDate, hour: number, before: Replay = replay(log)): Preview {
  const events = stamp(ctx, drafts);
  const after = replay([...log, ...events]);
  const impacts: Impact[] = [];
  let blocked = false;

  for (const e of events) {
    const rj = after.rejected.get(e.id);
    if (rj && rj.severity === 'conflict') { blocked = true; impacts.push({ level: 'conflit', text: `Impossible : ${rj.reason}` }); }
  }

  const a = before.state, b = after.state;
  const keys = new Set<SlotKey>([...Object.keys(a.slots), ...Object.keys(b.slots)]);
  const weeks = new Set<LocalDate>();
  for (const k of [...keys].sort()) {
    const va = slotView(a, k, today, hour), vb = slotView(b, k, today, hour);
    const ta = va.title || (va.status === 'personne' ? '' : 'rien'), tb = vb.title || (vb.status === 'personne' ? '' : 'rien');
    const changedDish = ta !== tb || va.status === 'exterieur' !== (vb.status === 'exterieur');
    const changedPeople = va.servings !== vb.servings;
    if (!changedDish && !changedPeople) continue;
    const date = parseSlot(k)?.date;
    if (date) weeks.add(weekOf(date, b.settings.weekStart));
    const parts: string[] = [];
    if (changedDish) parts.push(`${ta || 'rien'} → ${tb || 'rien'}`);
    if (changedPeople) parts.push(`${va.servings} → ${vb.servings} portion${vb.servings > 1 ? 's' : ''} à servir`);
    impacts.push({ level: 'info', text: `${capital(fmtSlot(k, today))} : ${parts.join(' · ')}` });
  }

  for (const id of new Set([...Object.keys(a.preps), ...Object.keys(b.preps)])) {
    const pa = a.preps[id], pb = b.preps[id];
    if (pa && pb) {
      const na = portions(a, pa).planned, nb = portions(b, pb).planned;
      if (na !== nb && !pb.done) impacts.push({ level: 'info', text: `${prepTitle(b, pb)} : préparer ${na} → ${nb} portions` });
      if (pa.slot && !pb.slot && pb.done) impacts.push({ level: 'info', text: `Les portions déjà préparées de ${prepTitle(b, pb)} restent dans « Portions »` });
      if (pb.slot) { const d = parseSlot(pb.slot)?.date; if (d) weeks.add(weekOf(d, b.settings.weekStart)); }
    }
  }

  for (const w of weeks) shoppingDiff(a, b, w, impacts);

  const pa = new Map(problems(before, today, hour).map(p => [p.key, p]));
  const pb = new Map(problems(after, today, hour).filter(p => !p.event).map(p => [p.key, p]));
  for (const [key, p] of pb) if (!pa.has(key)) impacts.push({ level: p.level === 'manque' ? 'attention' : p.level, text: p.text });
  for (const [key, p] of pa) if (!pb.has(key) && !p.event) impacts.push({ level: 'info', text: `Résolu : ${p.text}` });

  return { drafts, events, impacts, blocked, base: before.count, after };
}

function shoppingDiff(a: State, b: State, week: LocalDate, out: Impact[]): void {
  const la = new Map(deriveShopping(a, week).lines.map(l => [l.key, l]));
  const lb = new Map(deriveShopping(b, week).lines.map(l => [l.key, l]));
  const changes: string[] = [];
  for (const [k, l] of lb) {
    const o = la.get(k);
    if (!o) changes.push(`+ ${l.name}${lineQty(l, 'need') ? ` ${lineQty(l, 'need')}` : ''}`);
    else if (o.needAt !== l.needAt) changes.push(`${l.name} ${lineQty(o, 'need') || '?'} → ${lineQty(l, 'need') || '?'}`);
    if (o?.pantry?.active && l.pantry && !l.pantry.active) out.push({ level: 'attention', text: `« On en a déjà » à revérifier : ${l.name}` });
  }
  for (const [k, l] of la) if (!lb.has(k)) changes.push(`− ${l.name}${l.check ? ' (déjà pris : il reste acheté)' : ''}`);
  if (changes.length) out.push({ level: 'info', text: `Courses : ${changes.slice(0, 6).join(' · ')}${changes.length > 6 ? ` · et ${changes.length - 6} autre(s)` : ''}` });
}
