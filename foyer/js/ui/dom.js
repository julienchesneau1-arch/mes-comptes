// Outils d'interface : feuilles (dialogues natifs accessibles), message bref avec « Annuler », icônes.
export { esc } from '../core/text.js';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let current = null;
let opener = null;
function dialog() {
    let d = $('#sheet');
    if (!d) {
        d = document.createElement('dialog');
        d.id = 'sheet';
        d.className = 'sheet';
        d.setAttribute('aria-labelledby', 'sheet-title');
        // Fermeture signalée après coup : si une autre feuille a été ouverte entre-temps, elle reste suivie.
        d.addEventListener('close', () => { if (d?.open)
            return; const c = current; current = null; c?.onClose?.(); opener?.focus?.(); opener = null; });
        d.addEventListener('click', e => { if (e.target === d)
            d?.close(); }); // toucher le fond ferme
        document.body.append(d);
    }
    return d;
}
export function openSheet(s) {
    const d = dialog();
    if (!current)
        opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    current = s;
    paint(d, s, true);
    if (!d.open)
        d.showModal();
}
function paint(d, s, focusFirst) {
    const active = document.activeElement;
    const keep = active && d.contains(active) ? active.dataset['focus'] ?? active.id : null;
    const scroll = d.querySelector('.sheet-in')?.scrollTop ?? 0;
    d.innerHTML = `<div class="sheet-in">${s.render()}</div>`;
    const inner = d.querySelector('.sheet-in');
    if (inner)
        inner.scrollTop = scroll;
    s.mount?.(d);
    const target = keep ? d.querySelector(`[data-focus="${CSS.escape(keep)}"], #${CSS.escape(keep)}`) : null;
    if (target)
        target.focus();
    else if (focusFirst)
        (d.querySelector('[autofocus]') ?? d.querySelector('h2'))?.focus();
}
export function refreshSheet() { const d = $('#sheet'); if (d?.open && current)
    paint(d, current, false); }
export function closeSheet() { const d = $('#sheet'); if (d?.open)
    d.close(); }
export const sheetOpen = (id) => !!current && (!id || current.id === id);
export const sheetHead = (title, sub = '') => `<div class="sheet-head"><div class="grow"><h2 id="sheet-title" tabindex="-1">${title}</h2>${sub ? `<p class="muted small sub-head">${sub}</p>` : ''}</div>
  <button class="icon-btn" data-a="close" aria-label="Fermer">✕</button></div>`;
/* ---------- Fête : confettis (rien si l'appareil demande moins d'animations) ---------- */
const COLORS = ['#ff5a2a', '#ffc233', '#2fd38a', '#4da3ff', '#ff5c9a', '#8b5cf6'];
export function confetti(n = 48) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches)
        return;
    const box = document.createElement('div');
    box.className = 'confetti';
    box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < n; i++) {
        const p = document.createElement('i');
        p.style.left = `${Math.random() * 100}%`;
        p.style.background = COLORS[i % COLORS.length];
        p.style.animationDelay = `${Math.random() * .35}s`;
        p.style.animationDuration = `${1.2 + Math.random() * .9}s`;
        p.style.transform = `rotate(${Math.random() * 360}deg)`;
        box.append(p);
    }
    document.body.append(box);
    window.setTimeout(() => box.remove(), 2600);
}
/* ---------- Message bref ---------- */
let toastTimer = 0;
export function toast(text, undo, ms = 6000) {
    let t = $('#toast');
    if (!t)
        return;
    window.clearTimeout(toastTimer);
    t.hidden = false;
    t.innerHTML = `<span class="grow"></span>${undo ? '<button class="btn small-btn" id="toast-undo">Annuler</button>' : ''}`;
    const span = t.querySelector('span');
    if (span)
        span.textContent = text; // texte brut : jamais interprété comme HTML
    const b = $('#toast-undo');
    if (b && undo)
        b.addEventListener('click', () => { if (t)
            t.hidden = true; undo(); }, { once: true });
    toastTimer = window.setTimeout(() => { t = $('#toast'); if (t)
        t.hidden = true; }, ms);
}
/* ---------- Fichier à garder (sauvegarde, agenda) : feuille de partage si possible, sinon téléchargement ---------- */
export async function saveFile(name, type, content) {
    const file = new File([content], name, { type });
    try {
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: name });
            return 'partage';
        }
    }
    catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError')
            return 'annule';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return 'telechargement';
}
/* ---------- Écran allumé (mode cuisine, mode magasin) : repris au retour dans l'app ---------- */
let lock = null;
let wanted = false;
export async function keepAwake(on) {
    wanted = on;
    const wl = navigator.wakeLock;
    if (!on) {
        await lock?.release().catch(() => undefined);
        lock = null;
        return false;
    }
    if (!wl)
        return false;
    try {
        lock = await wl.request('screen');
        return true;
    }
    catch {
        return false;
    }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && wanted)
    void keepAwake(true); });
/* ---------- Icônes (traits simples, aria-hidden : le texte porte toujours le sens) ---------- */
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
    today: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    week: svg('<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3"/>'),
    shop: svg('<path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>'),
    home: svg('<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5h13V9"/><path d="M10 19.5v-5h4v5"/>'),
};
