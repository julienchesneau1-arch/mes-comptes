// Propositions en cartes, à la Jow : un repas à la fois. Glisser à droite (ou ❤) = « je prends », à gauche (ou ↻) = « autre idée »,
// « pas de plat » = ce repas reste libre. Rien n'est enregistré avant « Valider » ; les boutons font tout ce que font les gestes.
import { type LocalDate, type SlotKey, fmtSlot, fmtDay, weekOf, parseSlot } from '../../core/dates.ts';
import { batchDayFor, defaultIn, inWindow } from '../../core/batch.ts';
import type { Draft } from '../../core/reduce.ts';
import { current } from '../../core/model.ts';
import { type Proposal, proposeWeek, acceptDrafts, rank, nextDiscovery } from '../../core/propose.ts';
import type { Catalog } from '../../core/catalog.ts';
import { dishLook, type Look } from '../../core/visual.ts';
import { replay, stamp } from '../../core/reduce.ts';
import { deriveShopping } from '../../core/shopping.ts';
import { capital, prepTitle } from '../../core/status.ts';
import { presence } from '../../core/plan.ts';
import { loadCatalog } from '../catalog.ts';
import { A, S, clock, dispatch, thisWeek } from '../state.ts';
import { openSheet, sheetHead, closeSheet, esc, toast, confetti } from '../dom.ts';
import { CLICK, CHANGE } from '../registry.ts';
import { seenSet, markSeen } from '../seen.ts';
import { openCartReady } from './drive.ts';
import type { Variety } from '../../core/model.ts';

const VARIETY_LABEL: Record<Variety, string> = { max: 'maximum de nouveautés', equilibre: 'équilibré', 'mes-plats': 'surtout nos plats' };

interface Deck {
  props: Proposal[]; i: number; kept: Set<SlotKey>; tried: Map<SlotKey, Set<string>>; title: string; week: LocalDate; single: boolean; note: string; cat: Catalog | null;
  batchDay: LocalDate | null; batch: Set<SlotKey>;   // rituel : batch qui prépare la semaine, repas cuisinés à l'avance
}
let D: Deck | null = null;

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
const idOf = (p: Proposal): string => (p.dish?.kind === 'cook' ? p.dish.recipe : p.dish?.kind === 'new' ? `n:${p.dish.catalog.id}` : '');

// Ce que montre une carte : visuel, nom, étiquettes.
export function cardInfo(p: Proposal, all: readonly Proposal[] = []): { look: Look; name: string; badges: string[]; link: string | null } {
  const s = S(), d = p.dish;
  if (d?.kind === 'cook') {
    const r = s.recipes[d.recipe], c = r ? current(r) : null;
    const name = c?.name ?? 'Plat';
    return { look: dishLook(name, c?.ingredients.map(l => l.name) ?? []), name, badges: [...(D?.batch.has(p.slot) ? ['👩‍🍳 Batch'] : []), ...(c?.tags.includes('rapide') ? ['⚡ Rapide'] : [])], link: null };
  }
  if (d?.kind === 'new') return { look: dishLook(d.catalog.title, d.catalog.ingredients), name: d.catalog.title, badges: ['✨ Nouveau', ...(D?.batch.has(p.slot) ? ['👩‍🍳 Batch'] : [])], link: d.catalog.url };
  if (d?.kind === 'from') {
    const src = all.find(x => x.slot === d.source);
    const base = src ? cardInfo(src) : null;
    const sd = s.slots[d.source]?.dish, prep = sd?.kind === 'cook' ? s.preps[sd.prep] : undefined;
    const name = base?.name ?? (prep ? prepTitle(s, prep) : 'Plat');
    return { look: base?.look ?? dishLook(name), name: `Restes : ${name}`, badges: ['♻️ Restes'], link: null };
  }
  if (d?.kind === 'outside') return { look: { emoji: '🍽️', theme: 'grape' }, name: d.note || 'Repas extérieur', badges: [], link: null };
  return { look: { emoji: '🤔', theme: 'cream' }, name: 'Pas d\'idée pour ce repas', badges: [], link: null };
}

// Autre idée pour un repas, sans jamais revenir sur une idée déjà vue : en mode « maximum », les découvertes d'abord ;
// sinon vos plats (pas un plat prévu à moins de 2 semaines), puis les découvertes, puis vos plats récents. null quand tout a été vu.
function alternative(p: Proposal): Proposal | null {
  if (!D || (p.dish?.kind !== 'cook' && p.dish?.kind !== 'new')) return null;
  const d = D, tried = d.tried.get(p.slot) ?? new Set<string>([idOf(p)]);
  const others = new Set(d.props.filter(x => x !== p).map(idOf).filter(Boolean));
  const ownEx = new Set([...others, ...[...tried].filter(t => !t.startsWith('n:'))]);
  const own = (noRepeat: boolean): Proposal | null => {
    const r = rank(S(), p.slot, clock().date, ownEx, new Map(), { noRepeat })[0];
    if (!r) return null;
    tried.add(r.recipe); d.tried.set(p.slot, tried);
    return { ...p, dish: { kind: 'cook', recipe: r.recipe, extra: 0 }, reason: r.reason };
  };
  const fresh = (): Proposal | null => {
    if (!d.cat) return null;
    const ex = new Set([...[...others, ...tried].filter(t => t.startsWith('n:')).map(t => t.slice(2))]);
    const f = nextDiscovery(S(), d.cat, p.slot, d.week, ex, seenSet());
    if (!f) return null;
    tried.add(`n:${f.recipe.id}`); d.tried.set(p.slot, tried);
    return { ...p, dish: { kind: 'new', catalog: f.recipe, extra: 0 }, reason: f.reason };
  };
  return (S().settings.variety ?? 'max') === 'max' ? fresh() ?? own(true) ?? own(false) : own(true) ?? fresh() ?? own(false);
}

function eaters(p: Proposal): number {
  const s = S();
  return s.members.filter(m => (p.presence[m.id] ?? presence(s, p.slot, m.id)) !== 'dehors').length + (p.guests || s.slots[p.slot]?.guests || 0);
}

function cardHtml(p: Proposal, behind = false): string {
  const today = clock().date, info = cardInfo(p, D?.props ?? []);
  if (behind) return `<div class="deck-card behind" aria-hidden="true"><div class="deck-art t-${info.look.theme}"></div></div>`;
  const n = eaters(p);
  return `<article class="deck-card" aria-labelledby="deck-name">
    <div class="deck-art t-${info.look.theme}"><span class="art-emoji" aria-hidden="true">${info.look.emoji}</span>
      <span class="badge">${esc(capital(fmtSlot(p.slot, today)))}</span>${info.badges.length ? `<span class="badges">${info.badges.slice(0, 2).map(b => `<span class="badge new">${esc(b)}</span>`).join('')}</span>` : ''}
      <span class="stamp yes" aria-hidden="true">MIAM ❤</span><span class="stamp no" aria-hidden="true">AUTRE ↻</span></div>
    <div class="deck-body"><h3 id="deck-name">${esc(info.name)}</h3>
      <p class="why">${esc(capital(p.reason))}${n ? ` · pour ${n}` : ''}</p>
      ${info.link ? `<a class="small" href="${esc(info.link)}" target="_blank" rel="noopener noreferrer">Voir la recette (Wikilivres)</a>` : ''}</div></article>`;
}

function deckHtml(): string {
  if (!D) return '';
  const total = D.props.length;
  if (!total) {
    const has = Object.keys(S().recipes).length;
    return `${sheetHead(esc(D.title))}<div class="celebrate"><span class="big-emoji" aria-hidden="true">${has ? '👌' : '🥄'}</span><h3>${has ? 'Tout est déjà prévu' : 'Pas encore de plats'}</h3>
      <p class="muted">${has ? 'Les repas sont prévus, ou personne ne mange à la maison.' : 'Ajoutez quelques plats que vous faites souvent : Foyer vous les proposera.'}</p>
      ${has ? '' : '<button class="btn big" data-a="classics">Choisir nos plats</button>'}</div>`;
  }
  if (D.i >= total) return summaryHtml();
  const p = D.props[D.i] as Proposal;
  const canAlt = p.dish?.kind === 'cook' || p.dish?.kind === 'new';
  return `${sheetHead(esc(D.title), D.single ? 'Glissez à droite si ça vous dit, à gauche pour une autre idée.' : `Repas ${D.i + 1} sur ${total} · glissez à droite pour garder, à gauche pour changer.`)}
  ${D.note ? `<p class="banner info">${esc(D.note)}</p>` : ''}
  ${D.single || D.i ? '' : `<button class="tag" data-a="deckVariety" aria-label="Changer : ${esc(VARIETY_LABEL[S().settings.variety ?? 'max'])}">✨ ${esc(capital(VARIETY_LABEL[S().settings.variety ?? 'max']))} · changer</button>`}
  <section class="deck">
    ${D.single ? '' : `<div class="deck-progress" role="progressbar" aria-label="Repas décidés" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${D.i}"><span data-pct="${Math.round(100 * D.i / total)}"></span></div>`}
    <div class="deck-stage" aria-live="polite">${D.i + 1 < total ? cardHtml(D.props[D.i + 1] as Proposal, true) : ''}${cardHtml(p)}</div>
    <div class="deck-actions">
      <span class="round-lbl"><button class="round pass" data-a="deckSkip" aria-label="Pas de plat pour ce repas">✕</button>Pas de plat</span>
      ${canAlt ? '<span class="round-lbl"><button class="round no" data-a="deckOther" aria-label="Autre idée">↻</button>Autre idée</span>' : ''}
      <span class="round-lbl"><button class="round yes" data-a="deckYes" aria-label="Je prends ce plat">❤</button>Je prends</span>
    </div>
    ${D.single || D.i + 1 >= total ? '' : `<button class="btn quiet" data-a="deckAll">Garder tout le menu proposé (${total - D.i})</button>`}
  </section>`;
}

function keptProps(): Proposal[] { return D ? D.props.filter(p => D?.kept.has(p.slot)) : []; }

function summaryHtml(): string {
  if (!D) return '';
  const kept = keptProps(), today = clock().date;
  let shop = 0;
  try {
    const ev = stamp({ dev: 'apercu00', by: null, lc: A.r.maxLc, now: A.now() }, acceptDrafts(S(), kept));
    shop = deriveShopping(replay([...A.log, ...ev]).state, D.week).lines.filter(l => !l.done).length;
  } catch { shop = 0; }
  const cooks = kept.filter(p => p.dish?.kind === 'cook' || p.dish?.kind === 'new').length;
  const bd = D.batchDay, canBatch = (p: Proposal) => !!bd && (p.dish?.kind === 'cook' || p.dish?.kind === 'new') && inWindow(bd, parseSlot(p.slot)?.date ?? '');
  const inBatch = kept.filter(p => canBatch(p) && D?.batch.has(p.slot)).length;
  return `${sheetHead(esc(D.title))}
  <div class="celebrate"><span class="big-emoji" aria-hidden="true">${kept.length ? '🎉' : '🙂'}</span>
    <h3>${kept.length ? 'Votre semaine est prête\u00a0!' : 'Rien de retenu'}</h3>
    <p class="muted">${kept.length ? `${cooks} plat${cooks > 1 ? 's' : ''} à cuisiner${kept.length - cooks ? ` · ${kept.length - cooks} repas de restes` : ''}${shop ? ` · ${shop} article${shop > 1 ? 's' : ''} de courses` : ''}` : 'Aucun repas gardé : vous pouvez recommencer.'}</p></div>
  ${kept.length ? `<ul class="list recap">${kept.map(p => { const info = cardInfo(p, D?.props ?? []); return `<li><div class="item"><span class="look t-${info.look.theme}" aria-hidden="true">${info.look.emoji}</span>
    <span class="grow"><span class="title">${esc(info.name)}</span><br><span class="sub">${esc(capital(fmtSlot(p.slot, today)))}${p.dish?.kind === 'new' ? ' · ✨ nouveau' : ''}</span></span>
    ${canBatch(p) ? `<button class="tag" data-a="deckBatch" data-k="${p.slot}" aria-pressed="${!!D?.batch.has(p.slot)}" aria-label="Cuisiner ${esc(info.name)} au batch">👩‍🍳 Batch</button>` : ''}</div></li>`; }).join('')}</ul>` : ''}
  ${kept.filter(p => p.dish?.kind === 'new' && p.dish.catalog.yield === null).map(p => {
    const dsh = p.dish as { catalog: { title: string }; yield?: number };
    return `<fieldset class="card stack"><legend class="title">${esc(dsh.catalog.title)} : la recette ne dit pas pour combien de personnes</legend>
      <div class="seg" role="radiogroup" aria-label="Pour combien de personnes">${[2, 4, 6].map(n => `<label><input type="radio" name="y-${p.slot}" data-c="deckYield" data-k="${p.slot}" value="${n}" ${dsh.yield === n ? 'checked' : ''}>${n} personnes</label>`).join('')}</div>
      <p class="small muted">Sert à calculer les courses. Sans réponse, la liste de ce plat restera « à compléter ».</p></fieldset>`; }).join('')}
  ${bd && kept.some(canBatch) ? `<p class="banner info"><span><strong>👩‍🍳 Batch du ${esc(fmtDay(bd))} :</strong> ${inBatch ? `${inBatch} plat${inBatch > 1 ? 's' : ''} cuisiné${inBatch > 1 ? 's' : ''} à l'avance` : 'aucun plat pour l\'instant'}. Touchez « Batch » pour changer.</span></p>` : ''}
  <div class="actions">${kept.length ? `<button class="btn big block" data-a="deckOk">Valider la semaine</button>` : ''}<button class="btn ghost block" data-a="deckAgain">Recommencer</button></div>`;
}

// Geste : la carte suit le doigt, se tamponne « MIAM » ou « AUTRE », part au-delà de 100 px.
function mount(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-pct]')) el.style.width = `${el.dataset['pct'] ?? 0}%`; // CSP : pas de style écrit dans le HTML
  const card = root.querySelector<HTMLElement>('.deck-card:not(.behind)');
  if (!card) return;
  const yes = card.querySelector<HTMLElement>('.stamp.yes'), no = card.querySelector<HTMLElement>('.stamp.no');
  let x0 = 0, dx = 0, on = false;
  card.addEventListener('pointerdown', e => { if ((e.target as Element).closest('a, button')) return; on = true; x0 = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; });
  card.addEventListener('pointermove', e => {
    if (!on) return;
    dx = e.clientX - x0;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    if (yes) yes.style.opacity = String(Math.max(0, Math.min(1, dx / 100)));
    if (no) no.style.opacity = String(Math.max(0, Math.min(1, -dx / 100)));
  });
  const end = (): void => {
    if (!on) return;
    on = false;
    card.style.transition = 'transform .25s ease';
    if (dx > 100) act('yes');
    else if (dx < -100 && root.querySelector('[data-a="deckOther"]')) act('other');
    else { card.style.transform = ''; if (yes) yes.style.opacity = '0'; if (no) no.style.opacity = '0'; }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
  root.onkeydown = e => { if (e.key === 'ArrowRight') { e.preventDefault(); act('yes'); } else if (e.key === 'ArrowLeft' && root.querySelector('[data-a="deckOther"]')) { e.preventDefault(); act('other'); } };
}

function render(): void {
  const p = D && D.i < D.props.length ? D.props[D.i] : undefined;
  if (p?.dish?.kind === 'new') markSeen([p.dish.catalog.id]); // vue une fois : repassera après les autres
  openSheet({ id: 'deck', render: deckHtml, mount });
}

// Animation de départ (sauf si l'appareil demande moins d'animations), puis l'action.
function act(kind: 'yes' | 'other' | 'skip'): void {
  if (!D) return;
  const card = document.querySelector<HTMLElement>('#sheet .deck-card:not(.behind)');
  const dir = kind === 'yes' ? 1 : -1;
  const go = (): void => {
    if (!D) return;
    const p = D.props[D.i];
    if (!p) return;
    if (kind === 'yes') {
      D.kept.add(p.slot);
      if (D.single) { finish(); return; }
      D.i++;
      if (D.i >= D.props.length && D.kept.size) confetti();
    } else if (kind === 'other') {
      const alt = alternative(p);
      if (alt) D.props[D.i] = alt; else toast('Plus d\'autre idée pour ce repas');
    } else {
      // Pas de plat : ce repas et les restes qui en dépendaient sortent de la proposition.
      D.props = D.props.filter(x => x !== p && !(x.dish?.kind === 'from' && x.dish.source === p.slot));
      if (D.single) { closeSheet(); return; }
      if (D.i >= D.props.length && D.kept.size) confetti();
    }
    render();
  };
  if (!card || reduced()) { go(); return; }
  card.style.transition = 'transform .22s ease, opacity .22s ease';
  card.style.transform = kind === 'skip' ? 'translateY(30%) scale(.9)' : `translateX(${dir * 120}%) rotate(${dir * 16}deg)`;
  card.style.opacity = '0';
  window.setTimeout(go, 200);
}

function finish(): void {
  if (!D) return;
  const kept = keptProps();
  closeSheet();
  if (!kept.length) return;
  const drafts = acceptDrafts(S(), kept);
  // Rituel : les plats cochés « Batch » sont cuisinés le jour du batch (événement juste après leur création).
  const bd = D.batchDay, toBatch: Draft[] = [];
  if (bd) for (const x of drafts) if (x.t === 'slot.cook' && D.batch.has(x.p.slot) && inWindow(bd, parseSlot(x.p.slot)?.date ?? '')) toBatch.push({ t: 'prep.batch', p: { prep: x.p.prep, day: bd } });
  dispatch([...drafts, ...toBatch], { toast: kept.length === 1 ? `C'est noté : ${cardInfo(kept[0] as Proposal).name}` : `${kept.length} repas prévus${toBatch.length ? ` · ${toBatch.length} au batch` : ''} · courses à jour` });
  confetti();
  const week = D.week, single = D.single;
  D = null;
  if (!single) openCartReady(week); // le panier suit le menu : prêt à remplir tout de suite
}

CLICK['deckVariety'] = async () => {
  if (!D) return;
  const order: Variety[] = ['max', 'equilibre', 'mes-plats'], cur = S().settings.variety ?? 'max';
  const next = order[(order.indexOf(cur) + 1) % order.length] as Variety;
  dispatch([{ t: 'settings.set', p: { variety: next } }], { toast: `Propositions : ${VARIETY_LABEL[next]}` });
  await openWeekDeck(D.week);
};
CHANGE['deckYield'] = (d, el) => {
  const p = D?.props.find(x => x.slot === d['k']);
  if (p?.dish?.kind === 'new') p.dish = { ...p.dish, yield: Number((el as HTMLInputElement).value) };
};
CLICK['deckBatch'] = d => { if (!D) return; const k = d['k'] ?? ''; if (D.batch.has(k)) D.batch.delete(k); else D.batch.add(k); render(); };
CLICK['deckYes'] = () => act('yes');
CLICK['deckOther'] = () => act('other');
CLICK['deckSkip'] = () => act('skip');
CLICK['deckOk'] = () => finish();
CLICK['deckAll'] = () => { if (!D) return; for (const p of D.props.slice(D.i)) D.kept.add(p.slot); D.i = D.props.length; confetti(); render(); };
CLICK['deckAgain'] = async () => { if (D) await openWeekDeck(D.week); };

export async function openWeekDeck(week: LocalDate): Promise<void> {
  const c = clock(), cat = await loadCatalog(); // hors ligne sans catalogue : vos plats seulement
  const props = proposeWeek(S(), week, c.date, c.hour, cat, seenSet());
  const r = S().settings.ritual, bd = r ? batchDayFor(r, week) : null, batchDay = bd && bd >= c.date ? bd : null; // un batch passé ne prépare plus rien
  const batch = new Set(batchDay ? props.filter(p => (p.dish?.kind === 'cook' || p.dish?.kind === 'new') && defaultIn(batchDay, parseSlot(p.slot)?.date ?? '')).map(p => p.slot) : []);
  D = { props, i: 0, kept: new Set(), tried: new Map(props.map(p => [p.slot, new Set([idOf(p)].filter(Boolean))])), title: week === thisWeek() ? 'Le menu de la semaine' : 'Le menu de la semaine prochaine',
    week, single: false, note: cat ? '' : 'Découvertes indisponibles hors ligne : vos plats seulement.', cat, batchDay, batch };
  render();
}

// « Ce soir, on mange quoi ? » : une carte pour un seul repas, on fait défiler les idées.
export async function openIdea(slot: SlotKey): Promise<void> {
  const c = clock(), cat = await loadCatalog(), week = weekOf(slot.slice(0, 10), S().settings.weekStart);
  let p = proposeWeek(S(), week, c.date, c.hour, cat, seenSet()).find(x => x.slot === slot && (x.dish?.kind === 'cook' || x.dish?.kind === 'new'));
  if (!p) {
    const own = rank(S(), slot, c.date, new Set(), new Map(), { noRepeat: true })[0] ?? rank(S(), slot, c.date)[0];
    const fresh = !own && cat ? nextDiscovery(S(), cat, slot, week, new Set(), seenSet()) : undefined;
    p = own ? { slot, dish: { kind: 'cook', recipe: own.recipe, extra: 0 }, reason: own.reason, presence: {}, guests: 0 }
      : fresh ? { slot, dish: { kind: 'new', catalog: fresh.recipe, extra: 0 }, reason: fresh.reason, presence: {}, guests: 0 } : undefined;
  }
  D = { props: p ? [p] : [], i: 0, kept: new Set(), tried: new Map(p ? [[slot, new Set([idOf(p)])]] : []), title: `${capital(fmtSlot(slot, c.date))}, on mange quoi\u00a0?`, week, single: true, note: '', cat, batchDay: null, batch: new Set() };
  render();
}
CLICK['idea'] = d => { void openIdea(d['k'] ?? ''); };
