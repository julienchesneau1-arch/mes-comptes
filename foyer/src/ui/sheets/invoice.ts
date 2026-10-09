// Lire une facture du drive : le PDF est lu sur ce téléphone par pdf.js (Mozilla, embarqué, chargé seulement ici), sans IA ni envoi.
// Foyer propose l'ingrédient de chaque produit, la personne vérifie, puis les prix payés et le montant de la facture sont retenus.
// Seuls nom imprimé, contenance et prix des produits sont enregistrés (et synchronisés, chiffrés) : rien qui identifie le foyer.
import { type LocalDate, weekOf, fmtDayShort, addDays } from '../../core/dates.ts';
import type { Draft } from '../../core/reduce.ts';
import { MAX_CENTS } from '../../core/model.ts';
import { type Candidate, type Invoice, type PdfLib, candidates, matchKey, parseInvoice, pdfItems, toLines } from '../../core/invoice.ts';
import { eur } from '../../core/money.ts';
import { capitalize, nameKey, norm } from '../../core/text.ts';
import { S, clock, dispatch } from '../state.ts';
import { openSheet, sheetHead, esc, refreshSheet, closeSheet } from '../dom.ts';
import { CLICK, CHANGE, INPUT, SUBMIT } from '../registry.ts';
import { shopWeekFor } from './drive.ts';

interface Reading { inv: Invoice; week: LocalDate; cands: Candidate[]; picks: string[] }
let reading: Reading | null = null, busy = false, error = '';

export function openInvoice(): void { reading = null; busy = false; error = ''; openSheet({ id: 'invoice', render: invoiceHtml }); }

// pdf.js : 1,8 Mo, chargé au premier usage seulement (puis gardé hors ligne par le service worker).
type PdfModule = PdfLib & { GlobalWorkerOptions: { workerSrc: string } };
let lib: Promise<PdfLib> | null = null;
function pdfLib(): Promise<PdfLib> {
  lib ??= (import(new URL('vendor/pdfjs/pdf.min.js', document.baseURI).href) as Promise<PdfModule>).then(m => {
    m.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.js', document.baseURI).href;
    return m;
  }).catch((e: unknown) => { lib = null; throw e; });
  return lib;
}
const pdfError = (e: unknown): string => {
  const name = e instanceof Error ? e.name : '';
  if (name === 'PasswordException') return 'Facture protégée par un mot de passe : Foyer ne peut pas la lire.';
  if (name === 'InvalidPDFException') return 'Ce fichier n\'est pas un PDF lisible.';
  return 'Lecture impossible de ce PDF.';
};

// Semaine des courses payées par cette facture : celle du jour de la facture, ou la suivante dès le vendredi si des plats y sont prévus.
function show(lines: readonly string[]): void {
  const inv = parseInvoice(lines);
  if (!inv.lines.length) {
    error = lines.some(l => l.trim()) ? 'Aucune ligne de produit reconnue. Ce format n\'est pas encore connu de Foyer : envoyez une facture anonymisée pour qu\'il l\'apprenne.'
      : 'Ce PDF ne contient pas de texte (facture scannée ?) : Foyer ne lit pas les images.';
    return;
  }
  const s = S(), day = inv.day ?? clock().date, week = shopWeekFor(s, day, weekOf(day, s.settings.weekStart));
  const cands = candidates(s, [week, addDays(week, 7), addDays(week, -7)]).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  reading = { inv, week, cands, picks: inv.lines.map(l => capitalize(matchKey(l.label, cands)?.name ?? '')) };
}

const lineText = (l: Invoice['lines'][number]): string => l.loose && l.weight !== null
  ? `${String(l.weight).replace('.', ',')} kg à ${eur(l.unitCents)} le kg = ${eur(l.cents)}`
  : `${l.n > 1 ? `${l.n} × ${eur(l.unitCents)} = ` : ''}${eur(l.cents)}`;

function invoiceHtml(): string {
  const head = sheetHead('🧾 Lire une facture du drive', 'Les prix payés remplacent les estimations, et le montant payé se note tout seul.');
  const privacy = '<p class="small muted">🔒 Lue sur ce téléphone, sans IA ni envoi. Seuls les produits, leur contenance et leur prix sont gardés : nom, adresse, carte de fidélité et numéro de commande ne sont jamais enregistrés.</p>';
  if (!reading) {
    return `${head}<section class="card stack">
      <ol class="small"><li>Sur Auchan : Mon compte › Mes commandes › la commande › Télécharger la facture.</li><li>Ici : choisissez ce PDF (dans Fichiers ou Téléchargements).</li></ol>
      <label class="btn big block">${busy ? 'Lecture…' : 'Choisir la facture (PDF)'}<input type="file" accept="application/pdf,.pdf" data-c="invoiceFile" class="sr-only"${busy ? ' disabled' : ''}></label>
      <p aria-live="polite" class="small">${busy ? 'Lecture de la facture…' : ''}</p>
      ${error ? `<p class="banner partial" role="alert">${esc(error)}</p>` : ''}
      <details><summary>Ou coller le texte de la facture</summary><form data-f="invoiceText" class="stack">
        <label class="field">Texte copié depuis la facture<textarea name="text" rows="6" maxlength="60000"></textarea></label><button class="btn ghost">Lire ce texte</button></form></details>
    </section>${privacy}`;
  }
  const { inv, week, cands, picks } = reading, spent = S().shop[week]?.spent ?? null;
  const check = inv.total === null ? '<p class="small muted">Total de la facture non trouvé : vérifiez les lignes.</p>'
    : inv.total === inv.sum ? '<p class="banner ok">Lecture complète : les lignes lues font exactement le total de la facture.</p>'
      : `<p class="banner partial">Lignes lues : ${esc(eur(inv.sum))} · total facturé : ${esc(eur(inv.total))}. L'écart vient des remises, des frais ou de lignes non comprises.</p>`;
  const rows = inv.lines.map((l, i) => `<li class="stack"><span><strong>${esc(l.label)}</strong><br><span class="small muted">${esc(lineText(l))}${l.sure ? '' : ' · calcul non vérifiable'}</span></span>
    <label class="field">Ingrédient<input type="text" name="k${i}" list="invoice-cands" value="${esc(picks[i] ?? '')}" autocomplete="off" maxlength="80" placeholder="vide : ne pas retenir" data-i="invoicePick" data-n="${i}"></label></li>`).join('');
  return `${head}
    <p><strong>${inv.lines.length}</strong> produit${inv.lines.length > 1 ? 's' : ''} lu${inv.lines.length > 1 ? 's' : ''}${inv.day ? ` · facture du ${esc(fmtDayShort(inv.day))} ${inv.day.slice(0, 4)}` : ''}</p>
    ${check}
    <form data-f="invoiceSave" class="stack">
      <p class="small">Vérifiez l'ingrédient proposé pour chaque produit ; videz le champ pour ne pas le retenir.</p>
      <ul class="plain stack">${rows}</ul>
      <datalist id="invoice-cands">${cands.map(c => `<option value="${esc(capitalize(c.name))}"></option>`).join('')}</datalist>
      ${inv.total !== null && inv.total <= MAX_CENTS ? `<label class="item"><input type="checkbox" name="spent"${spent ? '' : ' checked'}><span>Noter ${esc(eur(inv.total))} payés pour les courses de la semaine du ${esc(fmtDayShort(week))}${spent ? ` (remplace ${esc(eur(spent.cents))})` : ''}</span></label>` : ''}
      <button class="btn big block">Retenir ces prix</button>
    </form>
    <button class="btn quiet" data-a="invoiceAgain">Lire une autre facture</button>
    ${privacy}`;
}

CHANGE['invoiceFile'] = async (_d, el) => {
  const input = el as HTMLInputElement, f = input.files?.[0];
  input.value = '';
  if (!f || busy) return;
  if (f.size > 10_000_000) { error = 'Fichier trop volumineux (10 Mo au plus).'; refreshSheet(); return; }
  busy = true; error = ''; refreshSheet();
  try {
    const pdf = await pdfLib().catch(() => null);
    if (!pdf) error = 'Lecteur de PDF pas encore disponible hors connexion : réessayez une fois connecté.';
    else show(toLines(await pdfItems(pdf, new Uint8Array(await f.arrayBuffer()))));
  } catch (e) { error = pdfError(e); }
  finally { busy = false; refreshSheet(); }
};
SUBMIT['invoiceText'] = data => { error = ''; show(String(data.get('text') ?? '').split(/\r?\n/)); refreshSheet(); };
CLICK['invoiceAgain'] = () => { reading = null; error = ''; refreshSheet(); };
// Saisie gardée pendant la vérification : un nouvel affichage de la feuille (synchro) ne l'efface pas.
INPUT['invoicePick'] = (d, el) => { if (reading) reading.picks[Number(d['n'])] = (el as HTMLInputElement).value; };

SUBMIT['invoiceSave'] = data => {
  if (!reading) return;
  const { inv, week, cands } = reading, day = inv.day ?? clock().date, byName = new Map(cands.map(c => [norm(c.name), c.key]));
  const drafts: Draft[] = [], seen = new Set<string>();
  inv.lines.forEach((l, i) => {
    const name = String(data.get(`k${i}`) ?? '').trim().slice(0, 80);
    const key = name ? byName.get(norm(name)) ?? nameKey(name) : '';
    // Un ingrédient, un prix : le premier produit de la facture pour cet ingrédient.
    if (!key || seen.has(key) || l.unitCents < 1 || l.unitCents > 100_000) return;
    seen.add(key);
    drafts.push({ t: 'price.paid', p: { key, label: l.label, cents: l.unitCents, size: l.size, unit: l.unit, loose: l.loose, day } });
  });
  const paid = data.get('spent') !== null && inv.total !== null && inv.total <= MAX_CENTS;
  if (paid && inv.total !== null) drafts.push({ t: 'shop.spent', p: { week, cents: inv.total } });
  if (!drafts.length) { error = ''; closeSheet(); return; }
  reading = null;
  closeSheet();
  dispatch(drafts, { toast: `${seen.size} prix payé${seen.size > 1 ? 's' : ''} retenu${seen.size > 1 ? 's' : ''}${paid && inv.total !== null ? ` · ${eur(inv.total)} notés` : ''}` });
};
CLICK['invoice'] = () => openInvoice();
