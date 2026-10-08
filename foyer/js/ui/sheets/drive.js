import { deriveShopping, checkSig } from '../../core/shopping.js';
import { DRIVE_HOME, driveItems, productLink, parseSize, sizeDraft, sizeText, searchUrl } from '../../core/drive.js';
import { eur, parseEuros } from '../../core/money.js';
import { S, dispatch } from '../state.js';
import { openSheet, sheetHead, esc, toast, refreshSheet } from '../dom.js';
import { CLICK, SUBMIT } from '../registry.js';
const skipped = new Set(), added = new Set(); // séance en cours seulement : « Passer », « Ajouté au panier »
export function openDrive(week) { openSheet({ id: 'drive', render: () => driveHtml(week) }); }
const packsLine = (it) => {
    if (!it.product || !it.packs)
        return '';
    const price = it.product.price;
    return it.packs.n !== null ? `<p>À mettre au panier : <strong>${esc(it.packs.text)}</strong>${price ? ` · ${it.packs.n} × ${esc(eur(price))} = <strong>${esc(eur(it.packs.n * price))}</strong>` : ''}</p>` : '';
};
// Prix vu sur Auchan, noté une fois : il sert au panier estimé (jamais lu sur le site).
const priceForm = (it) => !it.product ? '' : `<details><summary>${it.product.price ? `Prix noté : ${esc(eur(it.product.price))} · changer` : 'Noter le prix (facultatif)'}</summary><form data-f="priceSet" data-key="${esc(it.productKey)}" class="price-row">
  <label class="field">Prix d'un paquet vu chez Auchan (€)<input name="eur" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 4,99" value="${it.product.price ? esc(eur(it.product.price).replace(/\s?€$/, '').replace(/\u202f/g, '')) : ''}"></label>
  <button class="btn ghost">${it.product.price ? 'Mettre à jour' : 'Noter le prix'}</button></form></details>`;
const openLink = (it, cls = 'btn block') => `<a class="${cls}" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${it.product ? 'Ouvrir le produit' : 'Chercher'} ${it.name} chez Auchan (nouvelle page)`)}">${it.product ? 'Ouvrir le produit chez Auchan' : 'Chercher chez Auchan'}</a>`;
// Bloc « produit retenu » : partagé par la commande guidée et le détail d'une ligne de courses.
export function productForm(productKey, name, product) {
    const size = product ? sizeText(product) : '';
    return `<form data-f="productSet" data-key="${esc(productKey)}" data-name="${esc(name)}" class="stack">
    <label class="field">Lien du produit chez Auchan<input name="link" type="text" inputmode="url" autocomplete="off" placeholder="https://www.auchan.fr/…/pr-C…" value="${esc(product?.url ?? '')}" required></label>
    <label class="field">Contenance d'un paquet (facultatif)<input name="size" type="text" autocomplete="off" placeholder="300 g, 1 kg, 6 pièces, 4 x 125 g" value="${esc(size)}"></label>
    <label class="field">Prix d'un paquet en euros (facultatif)<input name="eur" type="text" inputmode="decimal" autocomplete="off" placeholder="4,99" value="${product?.price ? esc(eur(product.price).replace(/\s?€$/, '').replace(/\u202f/g, '')) : ''}"></label>
    <button class="btn ghost">${product ? 'Mettre à jour' : 'Retenir ce produit'}</button></form>
  <p class="small muted">Sur la page du produit chez Auchan, copiez l'adresse, puis collez-la ici. Foyer ne lit rien sur le site : il garde l'adresse, la contenance et le prix que vous indiquez, pour calculer le nombre de paquets et le panier estimé.</p>
  ${product ? `<button class="btn quiet" data-a="productForget" data-key="${esc(productKey)}" data-name="${esc(name)}">Oublier ce produit</button>` : ''}`;
}
export function productSection(productKey, name, product) {
    return `<section class="card stack"><h3 class="section-title">Drive Auchan</h3>
    ${product ? `<p>Produit retenu : <strong>${esc(product.label)}</strong>${sizeText(product) ? ` · ${esc(sizeText(product))}` : ''}</p>` : '<p class="small muted">Aucun produit retenu : « Chercher chez Auchan » ouvre la recherche.</p>'}
    ${openLink({ url: product?.url ?? searchUrl(name), product, name }, 'btn ghost block')}
    <details><summary>${product ? 'Changer de produit' : 'Retenir le produit choisi (une seule fois)'}</summary>${productForm(productKey, name, product)}</details></section>`;
}
function driveHtml(week) {
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
    ${priceForm(cur)}
    ${openLink(cur)}
    <div class="actions"><button class="btn soft" data-a="driveAdded" data-id="${esc(cur.id)}" data-week="${week}">Ajouté au panier</button><button class="btn ghost" data-a="driveSkip" data-id="${esc(cur.id)}">Passer</button></div>
  </section>
  <details class="card"><summary>${cur.product ? 'Changer de produit' : 'Retenir le produit choisi (une seule fois)'}</summary>${productForm(cur.productKey, cur.name, cur.product)}</details>
  <p class="small muted">« Ajouté au panier » coche l'article dans Foyer, sur les deux téléphones. Le prix noté sert au panier estimé ; les promotions restent sur Auchan.</p>`;
}
CLICK['drive'] = d => { skipped.clear(); added.clear(); openDrive(d['week'] ?? ''); };
CLICK['driveSkip'] = d => { skipped.add(d['id'] ?? ''); refreshSheet(); };
CLICK['driveAgain'] = () => { skipped.clear(); refreshSheet(); };
CLICK['driveAdded'] = d => {
    const id = d['id'] ?? '', week = d['week'] ?? '';
    added.add(id);
    if (id.startsWith('m:')) {
        const it = S().shop[week]?.items[id.slice(2)];
        if (it)
            dispatch([{ t: 'shop.item', p: { week, id: id.slice(2), name: it.name, qty: it.qty, aisle: it.aisle, checked: true, removed: false } }], { toast: `${it.name} : au panier` });
        return;
    }
    const l = deriveShopping(S(), week).lines.find(x => `l:${x.key}` === id);
    if (l)
        dispatch([{ t: 'shop.check', p: { week, key: l.key, needAt: checkSig(l) } }], { toast: `${l.name} : au panier` });
};
SUBMIT['productSet'] = (data, form) => {
    const key = form.dataset['key'] ?? '', name = form.dataset['name'] ?? '';
    const link = productLink(String(data.get('link') ?? ''));
    if (!link) {
        toast('Lien non reconnu : il doit venir de auchan.fr et finir par /pr-… (page d\'un produit)');
        return;
    }
    const rawSize = String(data.get('size') ?? '').trim();
    const size = rawSize ? parseSize(rawSize) : null;
    if (rawSize && !size) {
        toast('Contenance non comprise : par exemple 300 g, 1 kg, 6 pièces ou 4 x 125 g');
        return;
    }
    const rawPrice = String(data.get('eur') ?? '').trim();
    const price = rawPrice ? parseEuros(rawPrice) : null;
    if (rawPrice && !price) {
        toast('Prix non compris : par exemple 4,99');
        return;
    }
    const prev = S().products[key];
    dispatch([{ t: 'product.set', p: { key, url: link.url, label: link.label, ...(size ? sizeDraft(size) : { size: null, unit: null }), price: price ?? (prev?.url === link.url ? prev.price : null) } }], { toast: `${prev ? 'Produit mis à jour' : 'Produit retenu'} pour ${name}` });
};
SUBMIT['priceSet'] = (data, form) => {
    const key = form.dataset['key'] ?? '', p = S().products[key];
    const price = parseEuros(String(data.get('eur') ?? ''));
    if (!p)
        return;
    if (!price) {
        toast('Prix non compris : par exemple 4,99');
        return;
    }
    dispatch([{ t: 'product.set', p: { key, url: p.url, label: p.label, size: p.size, unit: p.unit, price } }], { toast: `Prix noté : ${eur(price)} le paquet` });
};
CLICK['productForget'] = d => dispatch([{ t: 'product.set', p: { key: d['key'] ?? '', url: null, label: '', size: null, unit: null } }], { toast: `Produit oublié pour ${d['name'] ?? ''}` });
