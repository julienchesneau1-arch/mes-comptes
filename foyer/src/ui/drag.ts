// Glisser-déposer un repas vers un autre créneau : un confort, jamais le seul moyen (le bouton « Déplacer » reste).
// Souris : on glisse après 8 px. Doigt : appui long (350 ms) puis glisser, pour ne pas gêner le défilement.
// Lâcher sur un créneau ouvre l'aperçu des conséquences ; rien n'est enregistré sans validation.
import { S } from './state.ts';
import { CLICK } from './registry.ts';

interface Drag { from: string; el: HTMLElement; ghost: HTMLElement | null; sx: number; sy: number; x: number; y: number; started: boolean; timer: number; touch: boolean; over: HTMLElement | null }
let drag: Drag | null = null;
let swallowClick = false;

const slotAt = (x: number, y: number): HTMLElement | null => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('button.slot[data-k]') ?? null;

function begin(): void {
  if (!drag) return;
  drag.started = true;
  const g = document.createElement('div');
  g.className = 'drag-ghost';
  g.setAttribute('aria-hidden', 'true');
  g.textContent = drag.el.querySelector('.t')?.textContent ?? '';
  document.body.append(g);
  drag.ghost = g;
  drag.el.classList.add('dragging');
  document.body.classList.add('is-dragging');
  place(drag.x, drag.y);
}
function place(x: number, y: number): void {
  if (!drag?.ghost) return;
  drag.ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
  const over = slotAt(x, y);
  if (over !== drag.over) { drag.over?.classList.remove('drop-target'); if (over && over !== drag.el) over.classList.add('drop-target'); drag.over = over; }
}
function end(drop: boolean): void {
  if (!drag) return;
  const d = drag;
  drag = null;
  window.clearTimeout(d.timer);
  d.ghost?.remove();
  d.el.classList.remove('dragging');
  d.over?.classList.remove('drop-target');
  document.body.classList.remove('is-dragging');
  if (!d.started) return;
  swallowClick = true;
  setTimeout(() => { swallowClick = false; }, 0);
  const to = d.over?.dataset['k'];
  if (drop && to && to !== d.from) CLICK['moveTo']?.({ k: d.from, to }, d.el);
}

export function wireDrag(root: Document): void {
  root.addEventListener('pointerdown', e => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('button.slot[data-k]');
    if (!el || e.button !== 0) return;
    const k = el.dataset['k'] ?? '';
    const slot = S().slots[k];
    if (!slot?.dish || slot.eaten) return; // seul un repas prévu et pas encore mangé se déplace
    const touch = e.pointerType !== 'mouse';
    drag = { from: k, el, ghost: null, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, started: false, timer: 0, touch, over: null };
    if (touch) drag.timer = window.setTimeout(begin, 350);
  });
  root.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.started) {
      const dist = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
      if (drag.touch) { if (dist > 10) end(false); return; } // le doigt bouge avant l'appui long : c'est un défilement
      if (dist < 8) return;
      begin();
    }
    place(e.clientX, e.clientY);
  });
  root.addEventListener('pointerup', () => end(true));
  root.addEventListener('pointercancel', () => end(false));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && drag) end(false); });
  // Une fois le glisser commencé au doigt, la page ne défile plus sous le doigt.
  root.addEventListener('touchmove', e => { if (drag?.started) e.preventDefault(); }, { passive: false });
  root.addEventListener('click', e => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  root.addEventListener('contextmenu', e => { if (drag?.started) e.preventDefault(); });
}
