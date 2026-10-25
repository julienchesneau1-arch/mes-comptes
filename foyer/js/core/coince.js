// « Ça coince » : les gênes notées sur ce téléphone pendant l'essai, pour les corriger ensuite. Jamais synchronisées ni envoyées :
// la personne copie la liste quand elle le veut. Gardés : l'heure, l'écran, le genre de gêne, son mot (280 signes) et les noms
// des derniers gestes (« pick », « slot »…), jamais ce qui a été saisi ailleurs dans l'app. 100 notes au plus, les plus anciennes partent.
export const KINDS = ['long', 'flou', 'faux', 'manque', 'autre'];
export const KIND_LABEL = { long: 'Trop long', flou: 'Pas compris', faux: 'Résultat faux', manque: 'Il manque quelque chose', autre: 'Autre' };
export const MAX_FRICTIONS = 100, MAX_NOTE = 280, MAX_STEPS = 8;
const STEP_RE = /^[A-Za-z0-9:]{1,40}$/;
const clean = (s, n) => s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// Relu au démarrage : une entrée mal formée est ignorée (rien d'inventé à l'affichage).
export function readFrictions(x) {
    if (!Array.isArray(x))
        return [];
    const out = [];
    for (const o of x.slice(-MAX_FRICTIONS)) {
        if (typeof o !== 'object' || o === null)
            continue;
        const f = o;
        if (typeof f['at'] !== 'string' || typeof f['screen'] !== 'string' || !KINDS.includes(f['kind']) || typeof f['note'] !== 'string' || !Array.isArray(f['steps']))
            continue;
        out.push({ at: clean(f['at'], 20), screen: clean(f['screen'], 20), kind: f['kind'], note: clean(f['note'], MAX_NOTE),
            steps: f['steps'].filter((s) => typeof s === 'string' && STEP_RE.test(s)).slice(-MAX_STEPS) });
    }
    return out;
}
export function addFriction(list, f) {
    const one = { at: clean(f.at, 20), screen: clean(f.screen, 20), kind: f.kind, note: clean(f.note, MAX_NOTE), steps: f.steps.filter(s => STEP_RE.test(s)).slice(-MAX_STEPS) };
    return [...list, one].slice(-MAX_FRICTIONS);
}
// Texte à copier pour l'envoyer : une ligne par gêne, la plus récente d'abord.
export const report = (list, version) => [`Foyer ${version} · ${list.length} gêne${list.length > 1 ? 's' : ''} notée${list.length > 1 ? 's' : ''}`,
    ...[...list].reverse().map(f => `${f.at} · ${f.screen} · ${KIND_LABEL[f.kind]}${f.note ? ` · « ${f.note} »` : ''}${f.steps.length ? ` · après : ${f.steps.join(' › ')}` : ''}`)].join('\n');
