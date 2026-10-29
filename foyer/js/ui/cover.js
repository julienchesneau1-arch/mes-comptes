// Bilan de la semaine (core/coverage.ts) : carte en haut de l'écran Semaine, et une demi-phrase après chaque plat posé.
import { parseSlot, weekOf } from '../core/dates.js';
import { coverage, coverageFixes, coverageText } from '../core/coverage.js';
import { plural } from '../core/text.js';
import { A, S, clock, dispatch } from './state.js';
import { esc } from './dom.js';
import { CLICK } from './registry.js';
import { toDecide } from './agenda.js';
const cov = (week) => { const c = clock(); return coverage(S(), week, c.date, c.hour); };
export function coverageCard(week) {
    const s = S(), today = clock().date, c = cov(week), t = coverageText(s, c, today);
    if (!t)
        return '';
    const fixes = coverageFixes(s, c, today), pending = A.demo ? 0 : toDecide(), cals = Object.keys(s.agenda.cals).length;
    const agenda = pending ? `<div class="row"><p class="small grow">L'agenda change encore ${plural(pending, 'repas', 'repas')}, à décider : le bilan suivra.</p><button class="btn small-btn quiet" data-a="agendaOpen">Voir</button></div>`
        : `<p class="small muted">${cals ? 'Agenda compris (absences, invités).' : 'D\'après qui mange à chaque repas ; un agenda branché (Réglages › Agendas) règle les absences.'}</p>`;
    return `<section class="card stack cover" aria-labelledby="cov-h"><h2 id="cov-h" class="section-title">Bilan de la semaine <span class="chip ${t.level === 'ok' ? 's-pret' : 'attention'}">${t.level === 'ok' ? 'Complet' : t.level === 'manque' ? 'Il manque' : 'En trop'}</span></h2>
    <p><strong>${esc(t.title)}</strong>${t.detail ? `<br><span class="small">${esc(t.detail)}</span>` : ''}</p>
    ${fixes.length || c.missing.length ? `<div class="actions">${fixes.map((f, i) => `<button class="btn small-btn ghost" data-a="coverFix" data-week="${week}" data-n="${i}">${esc(f.label)}</button>`).join('')}
      ${c.missing.length > fixes.filter(f => f.drafts.some(d => d.t === 'slot.from' || d.t === 'slot.move')).length ? `<button class="btn small-btn" data-a="propose" data-week="${week}">✨ Compléter la semaine</button>` : ''}</div>` : ''}
    ${agenda}</section>`;
}
CLICK['coverFix'] = d => {
    const week = d['week'] ?? '', c = cov(week), f = coverageFixes(S(), c, clock().date)[Number(d['n'] ?? -1)];
    if (f)
        dispatch(f.drafts, { toast: () => `${f.label.replace(/^♻️ /, '')}${coverNote(week)}` });
};
// « · encore 2 repas sans plat cette semaine », « · 4 portions en trop cette semaine », « · semaine couverte ✓ ».
export function coverNote(at) {
    const d = parseSlot(at)?.date ?? at, c = cov(weekOf(d, S().settings.weekStart));
    if (!c.meals.length)
        return '';
    return c.missing.length ? ` · encore ${plural(c.missing.length, 'repas', 'repas')} sans plat cette semaine`
        : c.spare || c.idle.length ? ` · ${c.spare ? `${plural(c.spare, 'portion', 'portions')} en trop` : 'un plat sans personne pour le manger'} cette semaine` : ' · semaine couverte ✓';
}
