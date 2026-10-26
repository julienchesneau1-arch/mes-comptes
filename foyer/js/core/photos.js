const SRC_RE = /^img\/plats\/wb\d{1,9}\.(?:jpg|png|webp)$/;
const PAGE_RE = /^https:\/\/(?:commons\.wikimedia\.org|fr\.wikibooks\.org)\/wiki\/[^\s"<>]{1,300}$/;
export const FREE_LICENSE = /^(?:cc[ -]?by(?:-sa)?(?: \d\.\d)?(?: [a-z]{2})?|cc0(?: 1\.0)?|public domain|domaine public|pd|gfdl(?: 1\.[23])?)$/i;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const validPhoto = (x) => {
    if (typeof x !== 'object' || x === null)
        return false;
    const p = x;
    return typeof p['src'] === 'string' && SRC_RE.test(p['src']) && typeof p['author'] === 'string' && p['author'].length >= 1 && p['author'].length <= 120
        && typeof p['license'] === 'string' && FREE_LICENSE.test(p['license']) && typeof p['page'] === 'string' && PAGE_RE.test(p['page']);
};
// Texte d'un champ « Artist » de Commons (HTML : liens, balises) : texte seul, espaces resserrés.
export const plainText = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
// Réponse « imageinfo » de l'API MediaWiki pour un fichier → photo retenue et adresse de la vignette à télécharger, ou rien.
// Écartés : dessins (SVG, GIF), petites images (icônes, logos), licence non libre, auteur inconnu.
export function photoFrom(id, page) {
    if (typeof page !== 'object' || page === null || !/^wb\d{1,9}$/.test(id))
        return null;
    const info = page['imageinfo']?.[0];
    if (!info)
        return null;
    const meta = (info['extmetadata'] ?? {});
    const val = (k) => (typeof meta[k]?.value === 'string' ? plainText(meta[k]?.value) : '');
    const ext = EXT[String(info['mime'] ?? '')], w = Number(info['width']), h = Number(info['height']), thumb = String(info['thumburl'] ?? '');
    const license = val('LicenseShortName'), author = (val('Artist') || val('Credit')).slice(0, 120), url = String(info['descriptionurl'] ?? '');
    if (!ext || !(w >= 300 && h >= 200) || !/^https:\/\/upload\.wikimedia\.org\//.test(thumb) || !FREE_LICENSE.test(license) || !author)
        return null;
    const photo = { src: `img/plats/${id}.${ext}`, author, license, page: url };
    return validPhoto(photo) ? { photo, thumb } : null;
}
