// Gestionnaires d'interface déclarés par chaque module : data-a (clic), data-c (changement), data-i (saisie), data-f (formulaire).
export type Handler = (d: DOMStringMap, el: HTMLElement) => void;
export type FormHandler = (data: FormData, form: HTMLFormElement) => void;

export const CLICK: Record<string, Handler> = {};
export const CHANGE: Record<string, Handler> = {};
export const INPUT: Record<string, Handler> = {};
export const SUBMIT: Record<string, FormHandler> = {};

export function wire(root: Document): void {
  root.addEventListener('click', e => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-a]');
    if (!el || el.matches(':disabled')) return;
    const fn = CLICK[el.dataset['a'] ?? ''];
    if (fn) { e.preventDefault(); fn(el.dataset, el); }
  });
  root.addEventListener('change', e => {
    const el = e.target as HTMLElement | null;
    const fn = el?.dataset['c'] ? CHANGE[el.dataset['c']] : undefined;
    if (el && fn) fn(el.dataset, el);
  });
  root.addEventListener('input', e => {
    const el = e.target as HTMLElement | null;
    const fn = el?.dataset['i'] ? INPUT[el.dataset['i']] : undefined;
    if (el && fn) fn(el.dataset, el);
  });
  root.addEventListener('submit', e => {
    const form = e.target as HTMLFormElement;
    const fn = form.dataset['f'] ? SUBMIT[form.dataset['f']] : undefined;
    if (fn) { e.preventDefault(); fn(new FormData(form), form); }
  });
}

export const num = (v: string | undefined, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };
