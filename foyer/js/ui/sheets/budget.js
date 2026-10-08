// Économies : panier estimé (prix notés par le foyer), budget de la semaine, montant payé, bilan des semaines passées.
// Chiffres tirés uniquement de ce que le foyer a saisi ; un article sans prix est compté « sans prix », jamais estimé.
import { addDays, fmtDayShort } from '../../core/dates.js';
import { cartEstimate, weekReport } from '../../core/budget.js';
import { batchStreak } from '../../core/batch.js';
import { eur, parseEuros } from '../../core/money.js';
import { A, S, clock, dispatch, thisWeek } from '../state.js';
import { esc, toast } from '../dom.js';
import { CLICK, SUBMIT } from '../registry.js';
const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const amount = (c) => esc(eur(c).replace(/\s?€$/, '').replace(/ /g, ''));
// Carte en tête des courses : panier estimé, par portion, payé, et la jauge du budget s'il y en a un.
export function budgetCard(week, list) {
    const s = S(), cart = cartEstimate(s, list), spent = s.shop[week]?.spent ?? null, budget = s.settings.budget ?? null;
    if (!list.meals && !spent)
        return '';
    const base = spent?.cents ?? (cart.priced ? cart.cents : null);
    const ratio = budget && base !== null ? base / budget : null;
    const state = ratio === null ? '' : ratio > 1 ? 'over' : ratio >= .9 ? 'warn' : '';
    const meter = budget && base !== null
        ? `<div class="meter ${state}" role="meter" aria-label="Budget de la semaine" aria-valuemin="0" aria-valuemax="${budget}" aria-valuenow="${Math.min(base, budget)}"><span data-pct="${Math.min(100, Math.round(100 * (ratio ?? 0)))}"></span></div>
      <p class="small">${esc(eur(base))} ${spent ? 'payés' : 'estimés'} sur ${esc(eur(budget))} · ${ratio !== null && ratio > 1 ? `<strong>${esc(eur(base - budget))} au-dessus du budget</strong>` : `reste ${esc(eur(budget - base))}`}</p>` : '';
    return `<section class="card stack" aria-labelledby="bud-h"><div class="row"><h2 id="bud-h" class="grow">💶 Budget de la semaine</h2>${budget ? '' : '<button class="btn small-btn ghost" data-a="ritual">Fixer un budget</button>'}</div>
    <div class="stats" role="list">
      <span role="listitem"><strong>${cart.priced ? `${cart.partial ? '≥\u00a0' : ''}${esc(eur(cart.cents))}` : '–'}</strong>panier estimé</span>
      <span role="listitem"><strong>${cart.perPortion ? `${cart.partial ? '≥\u00a0' : ''}${esc(eur(cart.perPortion))}` : '–'}</strong>par portion</span>
      <span role="listitem"><strong>${spent ? esc(eur(spent.cents)) : '–'}</strong>payé</span>
    </div>
    ${meter}
    ${cart.unpriced ? `<p class="small muted">${plural(cart.unpriced, 'article')} sans prix noté : l'estimation ne les compte pas (≥ = au moins). Le prix se note dans « Commander chez Auchan », une fois par produit.</p>` : ''}
    <form data-f="spentSet" data-week="${week}" class="price-row"><label class="field">Montant payé au drive (€)<input name="eur" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 64,30" value="${spent ? amount(spent.cents) : ''}"></label>
      <button class="btn ghost">${spent ? 'Corriger' : 'Noter'}</button>${spent ? `<button class="btn quiet" type="button" data-a="spentClear" data-week="${week}">Effacer</button>` : ''}</form></section>`;
}
SUBMIT['spentSet'] = (data, form) => {
    const week = form.dataset['week'] ?? '', c = parseEuros(String(data.get('eur') ?? ''));
    if (!c) {
        toast('Montant non compris : par exemple 64,30');
        return;
    }
    dispatch([{ t: 'shop.spent', p: { week, cents: c } }], { toast: `${eur(c)} notés pour la semaine du ${fmtDayShort(week)}` });
};
CLICK['spentClear'] = d => dispatch([{ t: 'shop.spent', p: { week: d['week'] ?? '', cents: null } }], { toast: 'Montant effacé' });
// Maison › Bilan : les 4 dernières semaines en chiffres clés, puis le détail des 8 dernières en tableau.
export function reportView() {
    const s = S(), today = clock().date, start = thisWeek();
    // La semaine prochaine compte dès que ses courses sont payées (drive du samedi pour le batch du dimanche).
    const next = weekReport(A.r, addDays(start, 7));
    const weeks = [...(next.spent !== null ? [next] : []), ...Array.from({ length: 8 }, (_, i) => weekReport(A.r, addDays(start, -7 * i)))].slice(0, 8);
    const month = weeks.slice(0, 4);
    const paid = month.reduce((n, w) => n + (w.spent ?? 0), 0), paidWeeks = month.filter(w => w.spent !== null).length;
    const portions = month.reduce((n, w) => n + w.estimate.portions, 0);
    const paidPortions = month.filter(w => w.spent !== null).reduce((n, w) => n + w.estimate.portions, 0);
    const thrown = month.reduce((n, w) => n + w.thrown, 0), streak = batchStreak(s, today);
    const any = weeks.some(w => w.spent !== null || w.estimate.portions || w.home);
    return `<section class="card stack" aria-labelledby="rep-h"><h2 id="rep-h">Bilan des 4 dernières semaines</h2>
    <div class="stats" role="list">
      <span role="listitem"><strong>${paidWeeks ? esc(eur(paid)) : '–'}</strong>payés${paidWeeks && paidWeeks < 4 ? ` (${paidWeeks} sem.)` : ''}</span>
      <span role="listitem"><strong>${paidPortions ? esc(eur(Math.round(paid / paidPortions))) : '–'}</strong>par portion</span>
      <span role="listitem"><strong>${portions}</strong>portions cuisinées</span>
      <span role="listitem"><strong>${thrown}</strong>jeté${thrown > 1 ? 's' : ''}</span>
      ${s.settings.ritual ? `<span role="listitem"><strong>${streak ? `🔥 ${streak}` : '0'}</strong>batch${streak > 1 ? 's' : ''} d'affilée</span>` : ''}
    </div>
    <p class="small muted">Payé = montants notés après le drive. Par portion = payé ÷ portions cuisinées ces semaines-là. Jetés = portions et produits déclarés jetés. Rien n'est estimé à votre place.</p></section>
  ${any ? `<section class="card"><h2>Semaine par semaine</h2><div class="table-wrap" tabindex="0" role="region" aria-label="Bilan semaine par semaine"><table class="report">
    <thead><tr><th scope="col">Semaine</th><th scope="col">Payé</th><th scope="col">Estimé</th><th scope="col">Portions</th><th scope="col">€/portion</th><th scope="col">Jetés</th></tr></thead>
    <tbody>${weeks.map(w => `<tr><th scope="row">${esc(fmtDayShort(w.week))}${w.week === start ? ' (en cours)' : w.week > start ? ' (à venir)' : ''}</th><td>${w.spent !== null ? esc(eur(w.spent)) : '–'}</td>
      <td>${w.estimate.priced ? `${w.estimate.partial ? '≥\u00a0' : ''}${esc(eur(w.estimate.cents))}` : '–'}</td><td>${w.estimate.portions || '–'}</td><td>${w.perPortion !== null ? `${w.partial ? '≥\u00a0' : ''}${esc(eur(w.perPortion))}` : '–'}</td><td>${w.thrown}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">€/portion : payé si noté, sinon panier estimé (≥ quand des articles n'ont pas de prix).</p></section>`
        : '<p class="empty"><strong>Pas encore de chiffres</strong>Notez le montant payé après chaque drive (Courses › Budget) : le bilan se remplit semaine après semaine.</p>'}`;
}
