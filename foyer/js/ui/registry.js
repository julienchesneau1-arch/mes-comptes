export const CLICK = {};
export const CHANGE = {};
export const INPUT = {};
export const SUBMIT = {};
export function wire(root) {
    root.addEventListener('click', e => {
        const el = e.target?.closest('[data-a]');
        if (!el || el.matches(':disabled'))
            return;
        const fn = CLICK[el.dataset['a'] ?? ''];
        if (fn) {
            e.preventDefault();
            fn(el.dataset, el);
        }
    });
    root.addEventListener('change', e => {
        const el = e.target;
        const fn = el?.dataset['c'] ? CHANGE[el.dataset['c']] : undefined;
        if (el && fn)
            fn(el.dataset, el);
    });
    root.addEventListener('input', e => {
        const el = e.target;
        const fn = el?.dataset['i'] ? INPUT[el.dataset['i']] : undefined;
        if (el && fn)
            fn(el.dataset, el);
    });
    root.addEventListener('submit', e => {
        const form = e.target;
        const fn = form.dataset['f'] ? SUBMIT[form.dataset['f']] : undefined;
        if (fn) {
            e.preventDefault();
            fn(new FormData(form), form);
        }
    });
}
export const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
