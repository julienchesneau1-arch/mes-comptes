var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { readPrinted } from '../core/printed.js';
import { toGray, toRGBA, binarize, blobs, dotMatrix, close, clearLarge, skew } from '../core/scan.js';
const MAX = 1600, PITCH = 9;
// Confiance de Tesseract (0-100) au-dessus de laquelle une date lue est reportée d'office (toujours à vérifier) ; en dessous, elle
// est seulement proposée. Mesure sur 190 étiquettes simulées (docs/PLAN.md, V3.20) : au-dessus de 80, 108 dates justes sur 109 ;
// en dessous, 14 justes et 13 fausses.
export const SURE = 80;
let worker = null, idle;
// Le cœur WebAssembly avec SIMD si l'appareil le permet (iOS 16.4 et plus), sinon la version simple ; LSTM seul (plus léger).
const simd = () => { try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
}
catch {
    return false;
} };
function getWorker() {
    clearTimeout(idle);
    worker ??= (async () => {
        const base = new URL('vendor/tesseract/', document.baseURI).href;
        const lib = (await import(__rewriteRelativeImportExtension(`${base}tesseract.esm.min.js`))).default;
        return lib.createWorker('fra', 1, { workerPath: `${base}worker.min.js`, corePath: `${base}${simd() ? 'tesseract-core-simd-lstm.js' : 'tesseract-core-lstm.js'}`,
            langPath: base.slice(0, -1), workerBlobURL: false, cacheMethod: 'none', gzip: true });
    })();
    worker.catch(() => { worker = null; });
    return worker;
}
// Mémoire rendue une minute après la dernière photo.
function release() { clearTimeout(idle); idle = setTimeout(() => { const w = worker; worker = null; void w?.then(x => x.terminate()).catch(() => { }); }, 60_000); }
export const warmOcr = () => { void getWorker().then(release, () => { }); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const ctx = (c) => c.getContext('2d', { willReadFrequently: true });
// L'image source à l'échelle k, tournée de deg degrés, sur fond blanc.
function draw(src, k, deg) {
    const a = (deg * Math.PI) / 180, w = src.width * k, h = src.height * k;
    const c = canvas(Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a)), Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))), g = ctx(c);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.translate(c.width / 2, c.height / 2);
    g.rotate(a);
    g.drawImage(src, -w / 2, -h / 2, w, h);
    return c;
}
const pixels = (c) => ctx(c).getImageData(0, 0, c.width, c.height).data;
function ink(c, bin) {
    const o = canvas(c.width, c.height);
    ctx(o).putImageData(new ImageData(toRGBA(bin, c.width, c.height), c.width, c.height), 0, 0);
    return o;
}
// Points reliés : image agrandie pour un pas de 9 px, seuil local, fermeture du rayon de l'espace entre deux points.
function joinDots(src, dots, more) {
    const s = Math.min(4, Math.max(0.5, PITCH / dots.pitch), 2600 / Math.max(src.width, src.height));
    const c = draw(src, s, 0), bin = binarize(toGray(pixels(c), c.width, c.height));
    const r = Math.max(1, Math.ceil((PITCH - dots.diameter * s) / 2)) + more;
    return ink(c, clearLarge(close(bin, c.width, c.height, r), c.width, c.height));
}
export async function readPhoto(src, today) {
    const t0 = performance.now(), w = await getWorker();
    try {
        const k = Math.min(3, MAX / Math.max(src.width, src.height));
        let c = draw(src, k, 0), bin = binarize(toGray(pixels(c), c.width, c.height));
        const angle = skew(bin, c.width);
        if (Math.abs(angle) >= 2) {
            c = draw(c, 1, -angle);
            bin = binarize(toGray(pixels(c), c.width, c.height));
        }
        const dots = dotMatrix(blobs(bin, c.width, c.height).list);
        const run = async (img, sauvola) => {
            await w.setParameters({ thresholding_method: sauvola ? '2' : '0', debug_file: '/dev/null' }); // messages de Tesseract tus (console)
            return (await w.recognize(img)).data;
        };
        // Lectures successives tant qu'aucune n'est sûre ; la meilleure est gardée (une date lue, puis la plus grande confiance).
        // Points : reliés au pas mesuré, puis plus largement, puis comme un texte plein (au cas où des petites lettres rondes auraient
        // été prises pour des points). Texte plein : seuil Sauvola, puis encre seule, grands aplats effacés.
        const passes = dots
            ? [() => [joinDots(c, dots, 0), false], () => [joinDots(c, dots, 1), false], () => [c, true]]
            : [() => [c, true], () => [ink(c, clearLarge(bin, c.width, c.height)), false]];
        let r = { text: '', confidence: 0 }, printed = null;
        for (const pass of passes) {
            const [img, sauvola] = pass(), x = await run(img, sauvola), p = readPrinted(x.text, today);
            if (!printed && !r.text.trim())
                r = x; // texte à montrer même sans date
            if (p && (!printed || x.confidence > r.confidence)) {
                r = x;
                printed = p;
            }
            if (printed && r.confidence >= SURE)
                break;
        }
        return { text: r.text.replace(/[ \t]+/g, ' ').trim(), printed, confidence: Math.round(r.confidence), dots: !!dots, angle, ms: Math.round(performance.now() - t0) };
    }
    finally {
        release();
    }
}
