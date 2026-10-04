// Quantités exactes : fractions d'entiers, jamais de flottant binaire dans un calcul métier.
// 600 g × 5/3 portions = 1000 g pile ; 0,1 + 0,2 = 3/10, pas 0,30000000000000004.
const gcd = (a, b) => {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b)
        [a, b] = [b, a % b];
    return a || 1;
};
export function q(n, d = 1) {
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
        throw new RangeError(`fraction invalide ${n}/${d}`);
    if (d < 0) {
        n = -n;
        d = -d;
    }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
}
export const ZERO = q(0), ONE = q(1);
export const add = (a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => q(a.n * b.n, a.d * b.d);
export const div = (a, b) => { if (b.n === 0)
    throw new RangeError('division par zéro'); return q(a.n * b.d, a.d * b.n); };
export const cmp = (a, b) => Math.sign(a.n * b.d - b.n * a.d);
export const eq = (a, b) => a.n === b.n && a.d === b.d;
export const isZero = (a) => a.n === 0;
export const isInt = (a) => a.d === 1;
export const max = (a, b) => (cmp(a, b) >= 0 ? a : b);
export const sum = (xs) => xs.reduce(add, ZERO);
// Sérialisation stable pour le journal : « 3/2 », « 600 ».
export const qStr = (a) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
export function qFrom(s) {
    const m = /^(-?\d{1,12})(?:\/(\d{1,12}))?$/.exec(s);
    if (!m)
        return null;
    const d = m[2] === undefined ? 1 : Number(m[2]);
    return d === 0 ? null : q(Number(m[1]), d);
}
const UNICODE = { '½': q(1, 2), '¼': q(1, 4), '¾': q(3, 4), '⅓': q(1, 3), '⅔': q(2, 3), '⅛': q(1, 8) };
// Saisie humaine : « 1,5 » « 1.5 » « 3/4 » « 1 1/2 » « 1½ » « ½ ». Rien d'autre (pas de « quelques »).
export function parseQ(raw) {
    const s = raw.trim().replace(/\s+/g, ' ');
    if (!s)
        return null;
    const uni = /^(\d{0,6}) ?([½¼¾⅓⅔⅛])$/.exec(s);
    if (uni) {
        const f = UNICODE[uni[2] ?? ''];
        return f ? add(q(Number(uni[1] || 0)), f) : null;
    }
    const mixed = /^(\d{1,6}) (\d{1,6})\/(\d{1,6})$/.exec(s);
    if (mixed)
        return Number(mixed[3]) ? add(q(Number(mixed[1])), q(Number(mixed[2]), Number(mixed[3]))) : null;
    const frac = /^(\d{1,6})\/(\d{1,6})$/.exec(s);
    if (frac)
        return Number(frac[2]) ? q(Number(frac[1]), Number(frac[2])) : null;
    const dec = /^(\d{1,7})(?:[.,](\d{1,4}))?$/.exec(s);
    if (dec) {
        const f = dec[2] ?? '';
        return q(Number((dec[1] ?? '') + f), 10 ** f.length);
    }
    return null;
}
// Affichage : exact si possible (« 2,5 »), sinon arrondi visible (« ≈ 66,67 »).
export function formatQ(a, decimals = 2) {
    const scale = 10 ** decimals;
    const scaled = (a.n * scale) / a.d;
    const rounded = Math.round(scaled);
    const exact = (a.n * scale) % a.d === 0;
    let t = (rounded / scale).toFixed(decimals).replace(/\.?0+$/, '');
    if (t === '-0')
        t = '0';
    return { text: t.replace('.', ','), exact };
}
export const showQ = (a, decimals = 2) => { const f = formatQ(a, decimals); return (f.exact ? '' : '≈ ') + f.text; };
