// Nos plats : saisie minimale (un nom suffit), ingrédients en texte libre analysé en direct, collage d'une recette entière.
import { type RecipeContent, type AheadTask, current } from '../../core/model.ts';
import { parseIngredient, lineLabel, aisleOf, AISLE } from '../../core/ingredients.ts';
import { parseRecipeText, lineText, fromWeb, type ParsedRecipe } from '../../core/recipe-text.ts';
import type { WebRecipe } from '../../core/recipe-web.ts';
import { RELAY } from '../config.ts';
import { TAGS } from '../../core/propose.ts';
import { newId } from '../../core/reduce.ts';
import { portions } from '../../core/plan.ts';
import { prepTitle } from '../../core/status.ts';
import { qFrom, mul, div, q } from '../../core/rational.ts';
import { UNIT, toBase, showQty } from '../../core/units.ts';
import { fmtSlot } from '../../core/dates.ts';
import { S, clock, dispatch } from '../state.ts';
import { openSheet, sheetHead, closeSheet, esc, $, toast, keepAwake } from '../dom.ts';
import { CLICK, CHANGE, INPUT, SUBMIT } from '../registry.ts';

interface Draft { id: string | null; name: string; yield: string; ing: string; steps: string; veille: string; matin: string; tags: Set<string>; note: string; banner: string }
let draft: Draft | null = null;

const fromContent = (id: string | null, c: RecipeContent | null, banner = ''): Draft => ({
  id, name: c?.name ?? '', yield: c?.yield ? String(c.yield) : '', ing: (c?.ingredients ?? []).map(lineText).join('\n'), steps: (c?.steps ?? []).join('\n'),
  veille: (c?.ahead ?? []).filter(a => a.when === 'veille').map(a => a.label).join('\n'), matin: (c?.ahead ?? []).filter(a => a.when === 'matin').map(a => a.label).join('\n'),
  tags: new Set(c?.tags ?? []), note: c?.note ?? '', banner,
});

export function openRecipe(id: string | null): void {
  const r = id ? S().recipes[id] : undefined;
  draft = fromContent(id, r ? current(r) : null);
  show();
}
const show = () => openSheet({ id: 'recipe', render, onClose: () => { draft = null; } });

function preview(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '<p class="small muted">Aucun ingrédient : le plat peut être prévu, la liste de courses le signalera comme partielle.</p>';
  return `<ul class="parsed" aria-label="Lecture des ingrédients">${lines.map(l => {
    const p = parseIngredient(l);
    const aisle = AISLE[aisleOf(p.line.name, p.line.form, S().aisles)]?.label ?? '';
    return `<li class="${p.review || !p.line.qty ? 'review' : ''}">${esc(lineLabel(p.line))}${p.line.qty ? '' : ' — quantité non renseignée'}${p.review ? ` — à vérifier (${esc(p.review)})` : ''} <span class="muted small">· ${esc(aisle)}</span></li>`;
  }).join('')}</ul>`;
}

function render(): string {
  const d = draft;
  if (!d) return '';
  const r = d.id ? S().recipes[d.id] : undefined;
  return `${sheetHead(d.id ? `Modifier ${esc(d.name || 'le plat')}` : 'Nouveau plat', r ? `version ${r.versions.length} · les plats déjà préparés gardent leur version` : 'Seul le nom est obligatoire.')}
  ${d.banner ? `<p class="banner partial">${esc(d.banner)}</p>` : ''}
  <form data-f="recipeSave" class="stack">
    <label class="field">Nom du plat<input type="text" name="name" required maxlength="80" value="${esc(d.name)}" data-i="rName" autocomplete="off"></label>
    <label class="field">Les quantités ci-dessous sont pour combien de portions ?<span class="hint">Rendement de référence. Indispensable pour calculer les courses.</span>
      <input type="number" name="yield" min="1" max="50" inputmode="numeric" value="${esc(d.yield)}" data-i="rYield"></label>
    <label class="field">Ingrédients<span class="hint">Une ligne par ingrédient : « 600 g de poulet », « 2 oignons », « sel ».</span>
      <textarea name="ing" rows="6" data-i="rIng" spellcheck="false">${esc(d.ing)}</textarea></label>
    <div id="ing-preview" aria-live="polite">${preview(d.ing)}</div>
    <fieldset><legend>Étiquettes</legend><div class="chips">${TAGS.map(t => `<button type="button" class="tag" data-a="rTag" data-t="${t}" aria-pressed="${d.tags.has(t)}">${t}</button>`).join('')}</div>
      <p class="small muted">« rapide » : proposé d'abord les soirs de semaine · « week-end » : le week-end · « plat entier » : on prépare toujours toute la recette, le surplus devient des restes.</p></fieldset>
    <details ${d.steps || d.veille || d.matin ? 'open' : ''}><summary>Étapes et choses à faire avant</summary><div class="stack">
      <label class="field">Étapes<span class="hint">Une par ligne. Facultatif : leur absence ne bloque pas les courses.</span><textarea name="steps" rows="4" data-i="rSteps">${esc(d.steps)}</textarea></label>
      <label class="field">À faire la veille<span class="hint">Ex. : « Sortir le poulet du congélateur ». Apparaît dans Aujourd'hui la veille du repas.</span><textarea name="veille" rows="2" data-i="rVeille">${esc(d.veille)}</textarea></label>
      <label class="field">À faire le matin même<span class="hint">Ex. : « Mettre la viande à mariner ».</span><textarea name="matin" rows="2" data-i="rMatin">${esc(d.matin)}</textarea></label>
      <label class="field">Note<textarea name="note" rows="2" data-i="rNote">${esc(d.note)}</textarea></label></div></details>
    <div class="actions"><button class="btn" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-a="close">Annuler</button>
      ${d.id ? `<button class="btn ghost" type="button" data-a="rDup">Dupliquer</button><button class="btn ghost" type="button" data-a="rArchive">${r?.archived ? 'Ressortir' : 'Ranger'}</button>` : '<button class="btn quiet" type="button" data-a="pasteRecipe">Coller une recette</button>'}</div>
  </form>`;
}

const field = (k: keyof Draft) => (_: DOMStringMap, el: HTMLElement): void => { if (draft) (draft as unknown as Record<string, string>)[k] = (el as HTMLInputElement).value; };
INPUT['rName'] = field('name'); INPUT['rYield'] = field('yield'); INPUT['rSteps'] = field('steps'); INPUT['rVeille'] = field('veille'); INPUT['rMatin'] = field('matin'); INPUT['rNote'] = field('note');
INPUT['rIng'] = (_d, el) => { if (!draft) return; draft.ing = (el as HTMLTextAreaElement).value; const p = $('#ing-preview'); if (p) p.innerHTML = preview(draft.ing); };
CLICK['rTag'] = (d, el) => { if (!draft) return; const t = d['t'] ?? ''; if (draft.tags.has(t)) draft.tags.delete(t); else draft.tags.add(t); el.setAttribute('aria-pressed', String(draft.tags.has(t))); };

function content(d: Draft): RecipeContent | string {
  const name = d.name.trim();
  if (!name) return 'Donnez un nom au plat.';
  const ingredients = d.ing.split('\n').map(l => l.trim()).filter(Boolean).map(l => parseIngredient(l).line).filter(l => l.name);
  const y = d.yield.trim() ? Number(d.yield) : null;
  if (y !== null && (!Number.isInteger(y) || y < 1 || y > 50)) return 'Le nombre de portions doit être un entier entre 1 et 50.';
  if (y === null && ingredients.some(l => l.qty)) return 'Indiquez pour combien de portions sont ces quantités : sans cela, les courses ne peuvent pas être calculées.';
  const lines = (t: string) => t.split('\n').map(l => l.trim()).filter(Boolean);
  const ahead: AheadTask[] = [...lines(d.veille).map(label => ({ label: label.slice(0, 120), when: 'veille' as const })), ...lines(d.matin).map(label => ({ label: label.slice(0, 120), when: 'matin' as const }))];
  return { name: name.slice(0, 80), yield: y, ingredients: ingredients.slice(0, 60), steps: lines(d.steps).slice(0, 40).map(s => s.slice(0, 500)), ahead: ahead.slice(0, 10),
    tags: [...d.tags].slice(0, 10), note: d.note.slice(0, 1000) };
}

SUBMIT['recipeSave'] = () => {
  if (!draft) return;
  const c = content(draft);
  if (typeof c === 'string') { toast(c); return; }
  const id = draft.id ?? newId();
  closeSheet();
  dispatch([{ t: 'recipe.save', p: { recipe: id, content: c } }], { toast: `${c.name} enregistré` });
};
CLICK['rArchive'] = () => {
  if (!draft?.id) return;
  const r = S().recipes[draft.id];
  if (!r) return;
  closeSheet();
  dispatch([{ t: 'recipe.archive', p: { recipe: r.id, archived: !r.archived } }], { toast: r.archived ? 'Plat ressorti' : 'Plat rangé : il ne sera plus proposé' });
};
CLICK['rDup'] = () => { if (!draft) return; draft = { ...draft, id: null, name: `${draft.name} (copie)`, tags: new Set(draft.tags), banner: 'Copie : le contenu est repris, pas les préparations ni les portions.' }; show(); };
CLICK['recipe'] = d => openRecipe(d['id'] ?? null);
CLICK['newRecipe'] = () => openRecipe(null);

/* ---------- Coller une recette ---------- */
let pasted = '';
let webUrl = '';
CLICK['pasteRecipe'] = () => {
  pasted = '';
  openSheet({ id: 'paste', render: () => `${sheetHead('Ajouter une recette existante', 'Lecture sans IA, toujours à relire avant d\'enregistrer.')}
    ${RELAY ? `<form data-f="webImport" class="stack"><label class="field">Adresse de la page (Marmiton, 750g, un blog…)<input type="url" name="url" inputmode="url" autocomplete="off" placeholder="https://…" value="${esc(webUrl)}" data-i="webUrl"></label>
      <button class="btn">Importer depuis le site</button></form><hr class="sep">` : ''}
    <label class="field">Ou collez le texte de la recette<textarea rows="8" data-i="pasteText" placeholder="Curry (pour 4)&#10;Ingrédients&#10;600 g de poulet&#10;…&#10;Préparation&#10;1. …">${esc(pasted)}</textarea></label>
    <div class="actions"><button class="btn ${RELAY ? 'ghost' : ''}" data-a="pasteGo">Analyser le texte</button><button class="btn ghost" data-a="close">Annuler</button></div>` });
};
INPUT['webUrl'] = (_d, el) => { webUrl = (el as HTMLInputElement).value; };
// Import d'une page : la fonction du relais lit les données schema.org de la page ; Foyer les analyse comme une saisie.
SUBMIT['webImport'] = async data => {
  const url = String(data.get('url') ?? '').trim();
  if (!RELAY || !/^https?:\/\/\S+\.\S+/.test(url)) { toast('Adresse à vérifier (elle commence par https://)'); return; }
  toast('Lecture de la page…');
  try {
    const r = await fetch(`${RELAY.url}/functions/v1/foyer-import`, { method: 'POST', headers: { apikey: RELAY.key, Authorization: `Bearer ${RELAY.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const body = (await r.json()) as WebRecipe & { error?: string };
    if (!r.ok || body.error) { toast(body.error ?? `Import impossible (${r.status})`); return; }
    webUrl = '';
    showParsed(fromWeb(body), `Importé de ${new URL(url).hostname}`, body.source);
  } catch { toast('Import impossible : pas de réseau ou relais injoignable. Copiez plutôt le texte de la recette.'); }
};
INPUT['pasteText'] = (_d, el) => { pasted = (el as HTMLTextAreaElement).value; };
CLICK['pasteGo'] = () => {
  if (!pasted.trim()) { toast('Collez d\'abord le texte'); return; }
  showParsed(parseRecipeText(pasted), 'Lu', '');
};
function showParsed(r: ParsedRecipe, origin: string, source: string): void {
  const review = r.ingredients.filter(i => i.review || !i.line.qty).length;
  draft = fromContent(null, { name: r.name, yield: r.yield, ingredients: r.ingredients.map(i => i.line), steps: r.steps, ahead: [], tags: [], note: source ? `Source : ${source}` : '' },
    `${origin} : ${r.ingredients.length} ingrédient(s), ${r.steps.length} étape(s)${r.yield ? `, pour ${r.yield}` : ', rendement non trouvé'}${review ? ` · ${review} ligne(s) à vérifier` : ''}. Relisez avant d'enregistrer.`);
  show();
}

/* ---------- Mode cuisine : quantités pour les portions réellement prévues, étapes à cocher ---------- */
export function openCook(prepId: string): void {
  void keepAwake(true);
  openSheet({ id: `cook:${prepId}`, onClose: () => { void keepAwake(false); }, render: () => {
    const s = S(), prep = s.preps[prepId];
    if (!prep) return sheetHead('Plat introuvable');
    const r = s.recipes[prep.recipe];
    const c = r ? r.versions[(prep.done?.version ?? r.versions.length) - 1] ?? current(r) : null;
    if (!c) return sheetHead('Recette introuvable');
    const n = portions(s, prep).planned;
    const scaled = c.ingredients.map(l => {
      const qty = l.qty ? qFrom(l.qty) : null, unit = l.unit ? UNIT[l.unit] : undefined;
      if (!qty || !unit || !c.yield) return `${esc(l.name)}${l.qty ? ` (${esc(lineLabel(l))} pour ${c.yield ?? '?'})` : ''}`;
      return `<strong>${esc(showQty(toBase(div(mul(qty, q(n)), q(c.yield)), unit), unit.dim, unit))}</strong> ${esc(l.name)}${l.form ? ` (${esc(l.form)})` : ''}`;
    });
    return `${sheetHead(esc(prepTitle(s, prep)), `${prep.slot ? esc(fmtSlot(prep.slot, clock().date)) + ' · ' : ''}pour ${n} portion${n > 1 ? 's' : ''}`)}
    ${scaled.length ? `<section class="card"><h3 class="section-title">Ingrédients pour ${n}</h3><ul class="parsed">${scaled.map(x => `<li>${x}</li>`).join('')}</ul></section>` : ''}
    ${c.steps.length ? `<section class="card"><h3 class="section-title">Étapes</h3><ul class="list">${c.steps.map((st, i) => {
      const key = `step:${prepId}:${i}`; const done = !!s.tasks[key]?.done;
      return `<li class="${done ? 'done-line' : ''}"><div class="item"><label class="check"><input type="checkbox" data-c="task" data-key="${esc(key)}" ${done ? 'checked' : ''} aria-label="Étape ${i + 1} faite"><span></span></label><span class="title">${i + 1}. ${esc(st)}</span></div></li>`; }).join('')}</ul></section>`
      : '<p class="muted">Aucune étape renseignée pour ce plat.</p>'}
    <p class="small muted">L'écran reste allumé tant que cette page est ouverte. Durées non renseignées : Foyer n'estime pas de temps de cuisson.</p>`;
  } });
}
CLICK['cook'] = d => openCook(d['id'] ?? '');
CHANGE['task'] = (d, el) => dispatch([{ t: 'task.set', p: { key: d['key'] ?? '', done: (el as HTMLInputElement).checked } }]);
