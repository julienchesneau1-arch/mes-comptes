// Bilan de la semaine (core/coverage.ts) : carte en haut de l'écran Semaine, et une demi-phrase après chaque plat posé.
import { type LocalDate, type SlotKey, parseSlot, weekOf, fmtSlot } from '../core/dates.ts';
import { coverage, coverageFixes, coverageText } from '../core/coverage.ts';
import { plural } from '../core/text.ts';
import { A, S, clock, dispatch } from './state.ts';
import { esc } from './dom.ts';
import { CLICK } from './registry.ts';
import { toDecide } from './agenda.ts';

const cov = (week: LocalDate) => { const c = clock(); return coverage(S(), week, c.date, c.hour); };

export function coverageCard(week: LocalDate): string {
  const s = S(), today = clock().date, c = cov(week), t = coverageText(s, c, today);
  if (!t) return '';
  const fixes = coverageFixes(s, c, today), pending = A.demo ? 0 : toDecide(), cals = Object.keys(s.agenda.cals).length;
  const agenda = pending ? `<div class="row"><p class="small grow">L'agenda change encore ${plural(pending, 'repas', 'repas')}, à décider : le bilan suivra.</p><button class="btn small-btn quiet" data-a="agendaOpen">Voir</button></div>`
    : `<p class="small muted">${cals ? 'Agenda compris (absences, invités).' : 'D\'après qui mange à chaque repas ; un agenda branché (Réglages › Agendas) règle les absences.'}</p>`;
  return `<section class="card stack cover" aria-labelledby="cov-h"><h2 id="cov-h" class="section-title">Bilan de la semaine <span class="chip ${t.level === 'ok' ? 's-pret' : 'attention'}">${t.level === 'ok' ? 'Complet' : t.level === 'manque' ? 'Il manque' : 'En trop'}</span></h2>
    <p><strong>${esc(t.title)}</strong></p>
    ${fixes.length || c.missing.length ? `<div class="actions">${fixes.map((f, i) => `<button class="btn small-btn ghost" data-a="coverFix" data-week="${week}" data-n="${i}">${esc(f.label)}</button>`).join('')}
      ${c.missing.length > fixes.filter(f => f.drafts.some(d => d.t === 'slot.from' || d.t === 'slot.move')).length ? `<button class="btn small-btn" data-a="propose" data-week="${week}">✨ Compléter la semaine</button>` : ''}</div>` : ''}
    ${t.hint ? `<div class="banner info"><p class="grow">Vous cuisinez le soir avec des portions en plus pour le midi du lendemain ? ${plural(t.hint, 'midi', 'midis')} de moins à cuisiner cette semaine.</p><button class="btn small-btn" data-a="lunchOn">🥡 Oui : le midi = restes du dîner</button></div>` : ''}
    ${t.detail || agenda ? `<details class="more"><summary>Le détail</summary>${t.detail ? `<p class="small">${esc(t.detail)}</p>` : ''}${agenda}</details>` : ''}</section>`;
}
// Tous les midis : les restes du dîner de la veille (Réglages › Décisions automatiques pour revenir en arrière).
CLICK['lunchOn'] = () => dispatch([{ t: 'settings.set', p: { lunchFromDinner: true } }], { toast: () => `Le midi = restes du dîner de la veille : chaque dîner se cuisine avec des portions en plus${coverNote(clock().date)}` });
// « · + 2 portions pour demain midi » : le dîner posé nourrit aussi le midi du lendemain.
export const lunchNote = (w: { lunch: SlotKey | null; n: number }): string => (w.lunch ? ` · +${plural(w.n, 'portion', 'portions')} pour ${fmtSlot(w.lunch, clock().date)}` : '');
CLICK['coverFix'] = d => {
  const week = d['week'] ?? '', c = cov(week), f = coverageFixes(S(), c, clock().date)[Number(d['n'] ?? -1)];
  if (f) dispatch(f.drafts, { toast: () => `${f.label.replace(/^♻️ /, '')}${coverNote(week)}` });
};

// « · encore 2 plats à cuisiner cette semaine », « · 4 portions en trop cette semaine », « · semaine couverte ✓ ».
export function coverNote(at: SlotKey | LocalDate): string {
  const d = parseSlot(at)?.date ?? at, c = cov(weekOf(d, S().settings.weekStart));
  if (!c.meals.length) return '';
  return c.missing.length ? ` · encore ${plural(c.missing.length, 'plat', 'plats')} à cuisiner cette semaine`
    : c.spare || c.idle.length ? ` · ${c.spare ? `${plural(c.spare, 'portion', 'portions')} en trop` : 'un plat sans personne pour le manger'} cette semaine` : ' · semaine couverte ✓';
}
