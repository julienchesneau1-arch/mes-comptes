// Feuille d'aperçu : avant un changement qui a des conséquences, on montre exactement ce qui va changer, puis on applique.
// Si l'état a changé entre-temps (synchro reçue), l'aperçu est recalculé au lieu d'écraser.
import {} from '../../core/reduce.js';
import { previewChange } from '../../core/preview.js';
import { A, clock, dispatch } from '../state.js';
import { openSheet, sheetHead, closeSheet, esc, toast } from '../dom.js';
import { CLICK, CHANGE } from '../registry.js';
let spec = null;
let mode = '';
let pv = null;
function compute() {
    if (!spec)
        return null;
    const c = clock();
    return previewChange(A.log, { dev: A.device.dev, by: A.device.me, lc: A.r.maxLc, now: A.now() }, spec.build(mode), c.date, c.hour, A.r);
}
export function openPreview(s) {
    spec = s;
    mode = s.modes?.[0]?.id ?? '';
    pv = compute();
    openSheet({ id: 'preview', render, onClose: () => { spec = null; pv = null; } });
}
function render() {
    if (!spec || !pv)
        return '';
    const imp = pv.impacts.length ? pv.impacts : [{ level: 'info', text: 'Aucune autre conséquence.' }];
    return `${sheetHead(esc(spec.title), spec.sub ? esc(spec.sub) : '')}
  ${spec.modes && spec.modes.length > 1 ? `<fieldset><legend>Que faire des repas liés ?</legend>${spec.modes.map(m => `
    <label class="item"><input type="radio" name="pvmode" value="${m.id}" data-c="pvMode" ${m.id === mode ? 'checked' : ''}>
    <span><span class="title">${esc(m.label)}</span>${m.hint ? `<br><span class="sub">${esc(m.hint)}</span>` : ''}</span></label>`).join('')}</fieldset>` : ''}
  <section aria-labelledby="pv-h"><h3 id="pv-h" class="section-title">Ce qui va changer</h3>
  <ul class="impacts">${imp.map(i => `<li class="${i.level}">${i.level === 'conflit' ? '<strong>À résoudre : </strong>' : i.level === 'attention' ? '<strong>Attention : </strong>' : ''}${esc(i.text)}</li>`).join('')}</ul></section>
  ${pv.impacts.some(i => i.level === 'conflit') && !pv.blocked ? '<p class="small muted">Vous pouvez enregistrer quand même : ce sera noté comme une intention avec un problème à résoudre, pas comme un plan validé.</p>' : ''}
  <div class="actions"><button class="btn ghost" data-a="close">Annuler</button>
  <button class="btn" data-a="pvApply" ${pv.blocked ? 'disabled' : ''}>${esc(spec.confirm)}</button></div>`;
}
CHANGE['pvMode'] = (_d, el) => { mode = el.value; pv = compute(); openSheet({ id: 'preview', render, onClose: () => { spec = null; pv = null; } }); };
CLICK['pvApply'] = () => {
    if (!spec || !pv)
        return;
    if (pv.base !== A.r.count) {
        pv = compute();
        toast('La situation a changé entre-temps : vérifiez le nouvel aperçu.');
        openSheet({ id: 'preview', render });
        return;
    }
    const s = spec;
    closeSheet();
    dispatch(pv.drafts, { toast: s.done });
    s.after?.();
};
