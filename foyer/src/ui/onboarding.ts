// Premier usage : créer le foyer (prénoms, qui utilise ce téléphone), choisir explicitement le rythme, poser quelques classiques.
// Aucun équipement, budget ni inventaire demandé. On peut aussi rejoindre un foyer existant avec un lien, ou découvrir un exemple.
import { type Presence, defaultRhythm } from '../core/model.ts';
import { newId, type Draft } from '../core/reduce.ts';
import { newCode } from '../core/sync.ts';
import { A, dispatch, setDevice } from './state.ts';
import { esc, toast } from './dom.ts';
import { CLICK, INPUT, SUBMIT, CHANGE } from './registry.ts';
import { receive } from './sheets/settings.ts';

type Step = 'welcome' | 'names' | 'rhythm' | 'classics' | 'join';
let step: Step = 'welcome';
let names = ['', ''];
let meIdx = 0;
let preset: 'tout' | 'dehors' | 'boite' | null = null;
const picks = new Set<string>();
let custom = '';
let joinText = '';

// Noms seuls, sans quantités : ce ne sont pas des recettes validées, juste un raccourci pour constituer votre liste.
export const CLASSICS = ['Pâtes bolognaise', 'Curry de poulet', 'Chili con carne', 'Lasagnes', 'Gratin dauphinois', 'Quiche lorraine', 'Croque-monsieur',
  'Omelette', 'Soupe de légumes', 'Salade composée', 'Tartiflette', 'Hachis parmentier', 'Poulet rôti', 'Pizza maison', 'Tacos', 'Burgers maison', 'Risotto',
  'Pâtes carbonara', 'Saumon et légumes', 'Wok de légumes', 'Dahl de lentilles', 'Riz cantonais', 'Ratatouille', 'Blanquette de veau', 'Couscous', 'Crêpes salées',
  'Steak et haricots verts', 'Poisson pané et purée'];

const mark = `<svg class="hero-mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#fde8d7"/><circle cx="400" cy="124" r="42" fill="#c2580e"/>
  <path d="M200 196c-18-28 18-40 0-76M256 196c-18-28 18-40 0-76M312 196c-18-28 18-40 0-76" stroke="#3b6449" stroke-width="20" fill="none" stroke-linecap="round"/>
  <rect x="80" y="232" width="352" height="30" rx="15" fill="#2a231c"/><path d="M104 262h304a152 152 0 0 1-304 0Z" fill="#2a231c"/></svg>`;

export function onboardingView(): string {
  const dots = (n: number) => `<p class="muted small">Étape ${n} sur 3</p>`;
  switch (step) {
    case 'welcome': return `<main id="main" class="onb" tabindex="-1">${mark}<h1>Foyer</h1>
      <p><strong>Une semaine visible. Des courses utiles. Moins de décisions le soir.</strong></p>
      <p class="muted">Vos repas de la semaine, la liste de courses calculée toute seule, les restes et les boîtes du midi. Sur vos deux téléphones, sans compte ni serveur.</p>
      <button class="btn block" data-a="onb" data-s="names">Créer notre foyer</button>
      <button class="btn ghost block" data-a="onb" data-s="join">L'autre téléphone a déjà Foyer</button>
      <button class="btn quiet block" data-a="demo">Découvrir avec un exemple</button></main>`;
    case 'names': return `<main id="main" class="onb" tabindex="-1">${dots(1)}<h1>Qui mange à la maison ?</h1>
      <form data-f="onbNames" class="stack">${names.map((n, i) => `<label class="field">Prénom de la personne ${i + 1}${i > 0 ? ' (facultatif)' : ''}<input type="text" maxlength="40" value="${esc(n)}" data-i="onbName" data-n="${i}" ${i === 0 ? 'required' : ''}></label>`).join('')}
      ${names.length < 6 ? '<button type="button" class="btn quiet" data-a="onbAdd">+ Une personne de plus</button>' : ''}
      <fieldset><legend>Qui utilise ce téléphone ?</legend><div class="seg" role="radiogroup" aria-label="Qui utilise ce téléphone">${names.map((n, i) => `<label><input type="radio" name="me" value="${i}" data-c="onbMe" ${meIdx === i ? 'checked' : ''}>${esc(n || `Personne ${i + 1}`)}</label>`).join('')}</div></fieldset>
      <button class="btn block">Continuer</button></form></main>`;
    case 'rhythm': return `<main id="main" class="onb" tabindex="-1">${dots(2)}<h1>Votre rythme habituel</h1>
      <p class="muted">C'est la base de chaque semaine (combien de portions servir). Les exceptions se changent ensuite d'un geste, pas besoin de confirmer chaque repas.</p>
      <fieldset class="stack"><legend class="sr-only">Rythme</legend>
      ${([['tout', 'Tout le monde à la maison, midi et soir'], ['dehors', 'Le soir ensemble ; en semaine, le midi dehors (cantine, travail)'], ['boite', 'Le soir ensemble ; en semaine, le midi en boîte (restes du dîner)']] as const)
        .map(([id, label]) => `<label class="card item"><input type="radio" name="preset" value="${id}" data-c="onbPreset" ${preset === id ? 'checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>
      <p class="small muted">Week-end : tout le monde à la maison. Tout se règle ensuite dans Maison › Réglages.</p>
      <div class="actions"><button class="btn ghost" data-a="onb" data-s="names">Retour</button><button class="btn grow" data-a="onb" data-s="classics" ${preset ? '' : 'disabled'}>Continuer</button></div></main>`;
    case 'classics': return `<main id="main" class="onb" tabindex="-1">${dots(3)}<h1>Vos plats habituels</h1>
      <p class="muted">Touchez ceux que vous faites souvent. Un nom suffit : les ingrédients s'ajoutent quand vous voulez, la liste de courses vous dira ce qui manque.</p>
      <div class="chips">${CLASSICS.map(c => `<button class="tag" data-a="onbPick" data-c="${esc(c)}" aria-pressed="${picks.has(c)}">${esc(c)}</button>`).join('')}
        ${[...picks].filter(p => !CLASSICS.includes(p)).map(c => `<button class="tag" data-a="onbPick" data-c="${esc(c)}" aria-pressed="true">${esc(c)}</button>`).join('')}</div>
      <form data-f="onbCustom" class="addbar"><label class="sr-only" for="onb-custom">Autre plat</label><input id="onb-custom" type="text" maxlength="80" placeholder="Autre plat…" value="${esc(custom)}" data-i="onbCustom"><button class="btn ghost">Ajouter</button></form>
      <div class="actions"><button class="btn ghost" data-a="onb" data-s="rhythm">Retour</button><button class="btn grow" data-a="onbDone">${picks.size ? `Créer le foyer avec ${picks.size} plat${picks.size > 1 ? 's' : ''}` : 'Créer le foyer (plats plus tard)'}</button></div></main>`;
    case 'join': return `<main id="main" class="onb" tabindex="-1"><h1>Rejoindre votre foyer</h1>
      <ol><li>Sur l'autre téléphone : Maison › Réglages › Synchro › <strong>Envoyer mes changements</strong>.</li><li>Ici : collez le lien reçu, puis tapez le code du foyer (affiché sur l'autre téléphone).</li></ol>
      <button class="btn block" data-a="pasteSync">Coller le lien reçu</button>
      <form data-f="onbJoin" class="stack"><label class="field">Ou collez le message ici<textarea rows="3" data-i="onbJoin">${esc(joinText)}</textarea></label><button class="btn ghost">Importer</button></form>
      <button class="btn quiet" data-a="onb" data-s="welcome">Retour</button></main>`;
  }
}

const go = (s: Step) => { step = s; A.render(); document.getElementById('main')?.focus(); };
CLICK['onb'] = d => go((d['s'] ?? 'welcome') as Step);
CLICK['onbAdd'] = () => { names.push(''); A.render(); };
INPUT['onbName'] = (d, el) => { names[Number(d['n'])] = (el as HTMLInputElement).value; };
CHANGE['onbMe'] = (_d, el) => { meIdx = Number((el as HTMLInputElement).value); };
SUBMIT['onbNames'] = () => {
  const clean = names.map(n => n.trim()).filter(Boolean);
  if (!clean.length) { toast('Au moins un prénom'); return; }
  meIdx = Math.min(meIdx, clean.length - 1);
  names = clean;
  go('rhythm');
};
CHANGE['onbPreset'] = (_d, el) => { preset = (el as HTMLInputElement).value as typeof preset; A.render(); };
CLICK['onbPick'] = (d, el) => { const c = d['c'] ?? ''; if (picks.has(c)) picks.delete(c); else picks.add(c); el.setAttribute('aria-pressed', String(picks.has(c))); const b = document.querySelector('[data-a="onbDone"]'); if (b) b.textContent = picks.size ? `Créer le foyer avec ${picks.size} plat${picks.size > 1 ? 's' : ''}` : 'Créer le foyer (plats plus tard)'; };
INPUT['onbCustom'] = (_d, el) => { custom = (el as HTMLInputElement).value; };
SUBMIT['onbCustom'] = () => { const c = custom.trim().slice(0, 80); if (c) { picks.add(c.charAt(0).toUpperCase() + c.slice(1)); custom = ''; A.render(); document.getElementById('onb-custom')?.focus(); } };
INPUT['onbJoin'] = (_d, el) => { joinText = (el as HTMLTextAreaElement).value; };
SUBMIT['onbJoin'] = () => { void receive(joinText); };

CLICK['onbDone'] = () => {
  const ids = names.map(() => newId(8));
  const p: Presence = preset === 'dehors' ? 'dehors' : preset === 'boite' ? 'boite' : 'maison';
  const drafts: Draft[] = [{ t: 'household.init', p: { hid: newId(), members: names.map((n, i) => ({ id: ids[i] as string, name: n })),
    settings: { weekStart: 0, rhythm: defaultRhythm(ids, p, 'maison'), boxesFromDinner: preset === 'boite' } } }];
  for (const name of picks) drafts.push({ t: 'recipe.save', p: { recipe: newId(), content: { name, yield: null, ingredients: [], steps: [], ahead: [], tags: [], note: '' } } });
  setDevice({ me: ids[meIdx] ?? null, code: newCode() });
  A.ui.tab = 'semaine';
  location.hash = '#semaine';
  dispatch(drafts, { toast: 'Foyer créé. Touchez « Proposer les repas vides » ou un créneau pour poser un premier plat.', undo: false });
  step = 'welcome'; names = ['', '']; picks.clear(); preset = null;
};
