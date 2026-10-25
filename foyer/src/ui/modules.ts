// Mode essentiel (core/modules.ts) côté écran : une fonction avancée s'affiche si elle sert déjà ou si ce téléphone l'a activée.
// Le mode découverte montre tout. Réglages › Fonctions : une case par fonction, un choix explicite l'emporte.
import { type Mod, MODS, MOD_TEXT, inUse, shown } from '../core/modules.ts';
import { A, S, setDevice } from './state.ts';
import { esc, toast } from './dom.ts';
import { CHANGE } from './registry.ts';

export const on = (m: Mod): boolean => A.demo || shown(S(), A.device.mods, m);
// Les réglages d'une fonction en service restent accessibles même masquée, pour pouvoir l'arrêter.
export const settingsOn = (m: Mod): boolean => on(m) || inUse(S(), m);

export function modulesSection(): string {
  const s = S();
  return `<section class="card stack"><h2>Fonctions</h2>
    <p class="small muted">Mode essentiel : Aujourd'hui, Semaine, Courses et vos plats. Le reste apparaît dès que vous vous en servez, ou en cochant ici (sur ce téléphone).</p>
    ${MODS.map(m => `<label class="item"><input type="checkbox" data-c="modSet" data-v="${m}" ${on(m) ? 'checked' : ''}><span class="grow"><strong>${esc(MOD_TEXT[m].label)}</strong>${inUse(s, m) ? ' · en service' : ''}<br><span class="small muted">${esc(MOD_TEXT[m].what)}</span></span></label>`).join('')}
  </section>`;
}
CHANGE['modSet'] = (d, el) => {
  const m = d['v'] as Mod, v = (el as HTMLInputElement).checked;
  if (!(MODS as readonly string[]).includes(m)) return;
  setDevice({ mods: { ...A.device.mods, [m]: v } });
  toast(`${MOD_TEXT[m].label} : ${v ? 'affiché' : 'masqué (rien n\'est effacé)'}`);
  A.render();
};
