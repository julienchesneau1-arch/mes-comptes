// Commander au drive Auchan, article par article : Foyer ouvre la bonne page, vous ajoutez au panier sur Auchan, puis « Ajouté ».
// Aucun robot, aucun identifiant Auchan : seuls le lien du produit choisi et sa contenance, saisis une fois, sont retenus (et synchronisés).
// Aucun prix à saisir : l'estimation vient des prix moyens Insee (refprice.ts).
import { type LocalDate, addDays, parseSlot, weekday, fmtDayShort } from '../../core/dates.ts';
import type { Draft } from '../../core/reduce.ts';
import type { Product } from '../../core/model.ts';
import { deriveShopping, checkSig } from '../../core/shopping.ts';
import { lineCost, cartEstimate, cartText, coverText } from '../../core/budget.ts';
import { monthText, perText } from '../../core/refprice.ts';
import { type Product as Offer, groupFor, productOf, VALUE_POINT } from '../../core/products.ts';
import { DRIVE_HOME, driveItems, cartChanges, type CartChange, productLink, parseSize, sizeDraft, sizeText, searchUrl, type DriveItem } from '../../core/drive.ts';
import { eur } from '../../core/money.ts';
import { S, dispatch } from '../state.ts';
import { openSheet, sheetHead, esc, toast, refreshSheet } from '../dom.ts';
import { CLICK, SUBMIT } from '../registry.ts';

const skipped = new Set<string>(), added = new Set<string>(); // séance en cours seulement : « Passer », « Ajouté au panier »

export function openDrive(week: LocalDate): void { openSheet({ id: 'drive', render: () => driveHtml(week) }); }

const packsLine = (it: DriveItem): string =>
  it.product && it.packs && it.packs.n !== null ? `<p>À mettre au panier : <strong>${esc(it.packs.text)}</strong></p>` : '';
// Estimation automatique de l'article (prix moyen Insee), sans rien saisir ; rien d'affiché si aucune référence ne correspond.
function costLine(week: LocalDate, it: DriveItem): string {
  if (!it.id.startsWith('l:')) return '';
  const l = deriveShopping(S(), week).lines.find(x => `l:${x.key}` === it.id), c = l ? lineCost(S(), l) : null;
  if (!c) return '';
  if (c.how === 'relevé' && c.product?.price && c.group) return `<p class="small muted">≈ ${esc(eur(c.cents))} au prix relevé du produit conseillé (${esc(eur(c.product.price.perCents))} ${perText(c.group)})</p>`;
  return c.ref ? `<p class="small muted">≈ ${esc(eur(c.cents))} · prix moyen Insee ${esc(c.ref.label.toLowerCase())} : ${esc(eur(c.ref.cents))} ${perText(c.ref)} (${esc(monthText(c.ref.period))})</p>`
    : `<p class="small muted">≈ ${esc(eur(c.cents))} (prix noté sur le produit retenu)</p>`;
}

// Étude qualité-prix d'un ingrédient : produits vendus chez Auchan (Open Food Facts) et leurs prix relevés (Open Prices).
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const dateText = (d: string): string => `${Number(d.slice(8, 10))} ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1] ?? ''} ${d.slice(0, 4)}`;
function productLine(p: Offer, per: 'kg' | 'l' | 'piece', tag: string): string {
  const price = p.price ? `${esc(eur(p.price.perCents))} ${perText({ per })} · relevé ${p.price.auchan ? 'chez Auchan' : `chez ${esc(p.price.where)}`} le ${esc(dateText(p.price.date))}` : 'prix pas encore relevé';
  return `<li><span class="badge">${tag}</span> <strong>${esc(p.name)}</strong>${p.brand ? ` · ${esc(p.brand)}` : ''}${p.qty ? ` · ${esc(p.qty)}` : ''}
    <br><span class="small muted">${esc(p.why.join(' · ') || 'qualité non renseignée')} · ${price}</span>
    <br><a class="small" href="${esc(searchUrl(`${p.brand} ${p.name}`))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`Chercher ${p.name} chez Auchan (nouvelle page)`)}">Chercher ce produit chez Auchan</a></li>`;
}
export function adviceHtml(name: string): string {
  const g = groupFor(name);
  if (!g) return '';
  const v = productOf(g, g.value), c = productOf(g, g.cheap), b = productOf(g, g.best);
  const shown = [[v, '✅ Meilleur rapport'], [c, '💶 Moins cher'], [b, '⭐ Mieux noté']] as const;
  const seen = new Set<string>();
  const items = shown.filter(([p]) => p && !seen.has(p.code) && seen.add(p.code)).map(([p, tag]) => productLine(p as Offer, g.per, tag));
  if (!items.length) return '';
  return `<details class="advice"${v ? ' open' : ''}><summary>Qualité-prix chez Auchan : ${esc(g.label.toLowerCase())}</summary><ul class="plain stack">${items.join('')}</ul>
    <p class="small muted">« Meilleur rapport » : chaque point de qualité justifie jusqu'à ${Math.round(VALUE_POINT * 100)} % de prix en plus que le moins cher. Points : Nutri-Score, transformation (NOVA), bio, Label Rouge, AOP/IGP. Sources : Open Food Facts et Open Prices (bases ouvertes, mises à jour chaque semaine) ; les prix sont des relevés de contributeurs, pas les prix du site Auchan.</p></details>`;
}
const openLink = (it: Pick<DriveItem, 'url' | 'product' | 'name'>, cls = 'btn block'): string =>
  `<a class="${cls}" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${it.product ? 'Ouvrir le produit' : 'Chercher'} ${it.name} chez Auchan (nouvelle page)`)}">${it.product ? 'Ouvrir le produit chez Auchan' : 'Chercher chez Auchan'}</a>`;

// Bloc « produit retenu » : partagé par la commande guidée et le détail d'une ligne de courses.
export function productForm(productKey: string, name: string, product: Product | null): string {
  const size = product ? sizeText(product) : '';
  return `<form data-f="productSet" data-key="${esc(productKey)}" data-name="${esc(name)}" class="stack">
    <label class="field">Lien du produit chez Auchan<input name="link" type="text" inputmode="url" autocomplete="off" placeholder="https://www.auchan.fr/…/pr-C…" value="${esc(product?.url ?? '')}" required></label>
    <label class="field">Contenance d'un paquet (facultatif)<input name="size" type="text" autocomplete="off" placeholder="300 g, 1 kg, 6 pièces, 4 x 125 g" value="${esc(size)}"></label>
    <button class="btn ghost">${product ? 'Mettre à jour' : 'Retenir ce produit'}</button></form>
  <p class="small muted">Sur la page du produit chez Auchan, copiez l'adresse, puis collez-la ici. Foyer ne lit rien sur le site : il garde l'adresse et la contenance, pour calculer le nombre de paquets.</p>
  ${product ? `<button class="btn quiet" data-a="productForget" data-key="${esc(productKey)}" data-name="${esc(name)}">Oublier ce produit</button>` : ''}`;
}
export function productSection(productKey: string, name: string, product: Product | null): string {
  return `<section class="card stack"><h3 class="section-title">Drive Auchan</h3>
    ${product ? `<p>Produit retenu : <strong>${esc(product.label)}</strong>${sizeText(product) ? ` · ${esc(sizeText(product))}` : ''}</p>` : '<p class="small muted">Aucun produit retenu : « Chercher chez Auchan » ouvre la recherche.</p>'}
    ${openLink({ url: product?.url ?? searchUrl(name), product, name }, 'btn ghost block')}
    <details><summary>${product ? 'Changer de produit' : 'Retenir le produit choisi (une seule fois)'}</summary>${productForm(productKey, name, product)}</details></section>`;
}

function driveHtml(week: LocalDate): string {
  const items = driveItems(S(), deriveShopping(S(), week));
  const todo = items.filter(i => !skipped.has(i.id));
  const head = sheetHead('Commander chez Auchan', 'Vous ajoutez au panier sur Auchan ; Foyer ouvre la bonne page et coche la liste.');
  const cur = todo[0];
  const addedNow = [...added].filter(id => !items.some(i => i.id === id)).length; // ajoutés et toujours cochés (une annulation les fait revenir)
  if (!cur) {
    return `${head}${items.length
      ? `<p>${items.length} article${items.length > 1 ? 's' : ''} passé${items.length > 1 ? 's' : ''}.</p><button class="btn soft block" data-a="driveAgain">Revoir les articles passés</button>`
      : '<p class="banner ok">Tout est au panier ou déjà traité.</p>'}
      <p>Il reste à finir sur Auchan : panier, créneau de retrait, paiement.</p><a class="btn ghost block" href="${DRIVE_HOME}" target="_blank" rel="noopener noreferrer">Aller sur Auchan (nouvelle page)</a>`;
  }
  return `${head}
  <section class="card stack" aria-live="polite">
    <p class="small muted">Article ${addedNow + items.length - todo.length + 1} sur ${addedNow + items.length}${skipped.size ? ` · ${skipped.size} passé${skipped.size > 1 ? 's' : ''}` : ''}</p>
    <h3>${esc(cur.name)}</h3>
    ${cur.qty ? `<p>Besoin : <strong>${esc(cur.qty)}</strong></p>` : ''}
    ${cur.product ? `<p>Produit retenu : ${esc(cur.product.label)}</p>${packsLine(cur)}` : '<p class="small muted">Aucun produit retenu : la recherche Auchan s\'ouvre.</p>'}
    ${costLine(week, cur)}
    ${adviceHtml(cur.name)}
    ${openLink(cur)}
    <div class="actions"><button class="btn soft" data-a="driveAdded" data-id="${esc(cur.id)}" data-week="${week}">Ajouté au panier</button><button class="btn ghost" data-a="driveSkip" data-id="${esc(cur.id)}">Passer</button></div>
  </section>
  <details class="card"><summary>${cur.product ? 'Changer de produit' : 'Retenir le produit choisi (une seule fois)'}</summary>${productForm(cur.productKey, cur.name, cur.product)}</details>
  <p class="small muted">« Ajouté au panier » coche l'article dans Foyer, sur les deux téléphones. Si le menu change ensuite, Courses dit quoi ajouter ou retirer du panier.</p>`;
}

CLICK['drive'] = d => { skipped.clear(); added.clear(); openDrive(d['week'] ?? ''); };
CLICK['driveSkip'] = d => { skipped.add(d['id'] ?? ''); refreshSheet(); };
CLICK['driveAgain'] = () => { skipped.clear(); refreshSheet(); };
CLICK['driveAdded'] = d => {
  const id = d['id'] ?? '', week = d['week'] ?? '';
  added.add(id);
  if (id.startsWith('m:')) {
    const it = S().shop[week]?.items[id.slice(2)];
    if (it) dispatch([{ t: 'shop.item', p: { week, id: id.slice(2), name: it.name, qty: it.qty, aisle: it.aisle, checked: true, removed: false } }], { toast: `${it.name} : au panier` });
    return;
  }
  const l = deriveShopping(S(), week).lines.find(x => `l:${x.key}` === id);
  if (l) dispatch([{ t: 'shop.check', p: { week, key: l.key, needAt: checkSig(l), name: l.name } }], { toast: `${l.name} : au panier` });
};
SUBMIT['productSet'] = (data, form) => {
  const key = form.dataset['key'] ?? '', name = form.dataset['name'] ?? '';
  const link = productLink(String(data.get('link') ?? ''));
  if (!link) { toast('Lien non reconnu : il doit venir de auchan.fr et finir par /pr-… (page d\'un produit)'); return; }
  const rawSize = String(data.get('size') ?? '').trim();
  const size = rawSize ? parseSize(rawSize) : null;
  if (rawSize && !size) { toast('Contenance non comprise : par exemple 300 g, 1 kg, 6 pièces ou 4 x 125 g'); return; }
  const prev = S().products[key];
  dispatch([{ t: 'product.set', p: { key, url: link.url, label: link.label, ...(size ? sizeDraft(size) : { size: null, unit: null }), price: prev?.url === link.url ? prev.price : null } }],
    { toast: `${prev ? 'Produit mis à jour' : 'Produit retenu'} pour ${name}` });
};
CLICK['productForget'] = d => dispatch([{ t: 'product.set', p: { key: d['key'] ?? '', url: null, label: '', size: null, unit: null } }], { toast: `Produit oublié pour ${d['name'] ?? ''}` });

/* ---------- Le panier suit le menu ---------- */

// Semaine de courses par défaut : la suivante dès le vendredi si elle a des plats (courses du samedi pour le batch du dimanche).
export function shopWeekFor(s: ReturnType<typeof S>, today: LocalDate, current: LocalDate): LocalDate {
  const next = addDays(current, 7);
  const hasNext = Object.values(s.preps).some(p => { const d = p.slot ? parseSlot(p.slot)?.date ?? '' : ''; return d >= next && d < addDays(next, 7); });
  return weekday(today) >= 5 && hasNext ? next : current;
}

// Changements depuis que des articles ont été mis au panier : à ajouter (déjà dans la commande guidée), en trop (à retirer sur Auchan).
export function cartChangesCard(week: LocalDate): string {
  const s = S();
  if (s.shop[week]?.spent) return '';
  const ch = cartChanges(s, deriveShopping(s, week));
  if (!ch.length) return '';
  const plus = ch.filter(c => c.kind === 'plus'), minus = ch.filter(c => c.kind !== 'plus');
  const row = (c: CartChange) => `<li><div class="item"><span class="grow"><span class="title">${c.kind === 'plus' ? '＋' : '−'} ${esc(c.name)}</span>
    <br><span class="sub">${c.kind === 'plus' ? `ajouter ${esc(c.qty || 'un peu plus')}` : c.kind === 'moins' ? `${esc(c.qty)} en trop` : 'plus au menu : à retirer du panier'}</span></span>
    ${c.kind === 'plus' ? '' : `<button class="btn small-btn ghost" data-a="cartFixed" data-week="${week}" data-key="${esc(c.key)}">Retiré</button>`}</div></li>`;
  return `<section class="card stack attention" aria-labelledby="cart-h"><h2 id="cart-h">🔄 Panier Auchan à mettre à jour</h2>
    <p class="small">Le menu a changé depuis que ces articles ont été mis au panier.</p>
    <ul class="list">${[...plus, ...minus].map(row).join('')}</ul>
    <div class="actions">${plus.length ? `<button class="btn" data-a="drive" data-week="${week}">Ajouter les manquants</button>` : ''}${minus.length ? `<button class="btn ghost" data-a="cartFixedAll" data-week="${week}">Tout est à jour</button>` : ''}</div></section>`;
}
const fixDrafts = (week: LocalDate, keys: readonly string[]): Draft[] => {
  const list = deriveShopping(S(), week);
  return cartChanges(S(), list).filter(c => c.kind !== 'plus' && keys.includes(c.key)).map(c => ({ t: 'shop.check' as const, p: { week, key: c.key, needAt: c.needAt, ...(c.needAt ? { name: c.name } : {}) } }));
};
CLICK['cartFixed'] = d => dispatch(fixDrafts(d['week'] ?? '', [d['key'] ?? '']), { toast: 'Panier à jour pour cet article' });
CLICK['cartFixedAll'] = d => { const w = d['week'] ?? ''; dispatch(fixDrafts(w, cartChanges(S(), deriveShopping(S(), w)).map(c => c.key)), { toast: 'Panier à jour' }); };

// Juste après « Valider la semaine » : le panier est prêt, un geste pour le remplir.
export function openCartReady(week: LocalDate): void {
  openSheet({ id: 'cartReady', render: () => {
    const s = S(), list = deriveShopping(s, week), cart = cartEstimate(s, list), n = driveItems(s, list).length;
    return `${sheetHead('🛒 Panier prêt', `Courses de la semaine du ${fmtDayShort(week)}, calculées d'après le menu.`)}
      <div class="stats" role="list"><span role="listitem"><strong>${n}</strong>article${n > 1 ? 's' : ''}</span><span role="listitem"><strong>${cart.priced ? esc(cartText(cart, eur)) : '–'}</strong>estimé${cart.priced ? ` · ${esc(coverText(cart))}` : ''}</span></div>
      <p class="small muted">Quantités en paquets, conseil qualité-prix par article. Si le menu change ensuite, Courses dira quoi ajouter ou retirer.</p>
      <div class="actions">${n ? `<button class="btn big block" data-a="drive" data-week="${week}">Remplir le panier Auchan</button>` : ''}<button class="btn ghost block" data-a="goShop" data-week="${week}">Voir la liste</button></div>`;
  } });
}
