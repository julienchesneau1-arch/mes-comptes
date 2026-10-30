// Icônes au trait (24 × 24, trait 1,9, bouts ronds), du même dessin que la barre d'onglets. Toujours à côté d'un texte : cachées au lecteur d'écran.
const P = {
    cart: '<path d="M3 4h2.2l2 10.3a2 2 0 0 0 2 1.7h7.4a2 2 0 0 0 2-1.5L20.5 8H6.1"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
    store: '<path d="M4 9.5 5.6 4.5h12.8L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-4.5h4V20"/>',
    share: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.6a4.5 4.5 0 0 1 4.7 4.9"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.3"/>',
    chevron: '<path d="m9.5 6 6 6-6 6"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3"/>',
    sparkle: '<path d="M11 4.5 12.7 9.3l4.8 1.7-4.8 1.7L11 17.5l-1.7-4.8L4.5 11l4.8-1.7Z"/><path d="M18.5 3.5v3.5M16.75 5.25h3.5"/>',
    home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5h13V9"/><path d="M10 19.5v-5h4v5"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    repeat: '<path d="M17 3.5 20 6.5l-3 3"/><path d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20"/><path d="M7 20.5 4 17.5l3-3"/><path d="M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4"/>',
};
export const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name]}</svg>`;
