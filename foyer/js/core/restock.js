// Produits de la maison (dentifrice, papier toilette, essuie-tout…) : ils ne suivent pas les repas mais le temps qui passe.
// Foyer estime quand chacun devrait manquer et ne l'ajoute aux courses qu'à ce moment-là : la catégorie apparaît de temps en
// temps, jamais toutes les semaines. Estimation de départ : une hypothèse écrite (contenance et usage courants), rapportée au
// nombre de personnes du foyer. Elle se corrige d'elle-même : dès qu'un achat est noté (coche dans la liste, facture lue),
// l'écart réel entre deux achats prend le relais. Déterministe, sans réseau : mêmes événements, mêmes dates sur les deux téléphones.
import { addDays, daysBetween } from './dates.js';
import { norm } from './text.js';
export const RESTOCK = [
    { id: 'dentifrice', name: 'Dentifrice', group: 'hygiene', pack: '1 tube', share: 'partage', days: 50, on: true,
        why: 'tube de 75 ml (≈ 100 g) : ≈ 1 g par brossage, 2 brossages par jour', match: /dentifrice/ },
    { id: 'brosseadents', name: 'Brosses à dents', group: 'hygiene', pack: '1 par personne', share: 'chacun', days: 90, on: true,
        why: 'à changer tous les 3 mois, le conseil courant des dentistes', match: /brosses? a dents?/ },
    { id: 'papiertoilette', name: 'Papier toilette', group: 'hygiene', pack: '1 paquet de 12 rouleaux', share: 'partage', days: 48, on: true,
        why: '≈ 1 rouleau tous les 4 jours par personne', match: /papier (?:toilette|hygienique|wc)/ },
    { id: 'geldouche', name: 'Gel douche', group: 'hygiene', pack: '1 flacon', share: 'partage', days: 25, on: true,
        why: 'flacon de 250 ml : ≈ 10 ml par douche, une douche par jour', match: /gel (?:douche|lavant)|douche (?:creme|gel)/ },
    { id: 'shampooing', name: 'Shampooing', group: 'hygiene', pack: '1 flacon', share: 'partage', days: 60, on: true,
        why: 'flacon de 250 ml : ≈ 10 ml par lavage, 3 lavages par semaine', match: /shamp(?:o|oo)ing/ },
    { id: 'deodorant', name: 'Déodorant', group: 'hygiene', pack: '1 par personne', share: 'chacun', days: 45, on: true,
        why: '≈ 6 semaines par déodorant', match: /deodorant|\bdeo\b/ },
    { id: 'savonmains', name: 'Savon pour les mains', group: 'hygiene', pack: '1 flacon', share: 'partage', days: 40, on: true,
        why: 'flacon de 300 ml : ≈ 1,5 ml par lavage, 5 lavages par jour', match: /savon/ },
    { id: 'mouchoirs', name: 'Mouchoirs', group: 'hygiene', pack: '1 boîte', share: 'partage', days: 40, on: true,
        why: 'boîte d\'≈ 100 : 2 à 3 par jour en moyenne sur l\'année', match: /mouchoir/ },
    { id: 'cotontiges', name: 'Cotons-tiges', group: 'hygiene', pack: '1 boîte', share: 'partage', days: 200, on: false,
        why: 'boîte d\'≈ 200 : ≈ 1 par jour', match: /cotons?.?tiges?/ },
    { id: 'demaquillant', name: 'Cotons démaquillants', group: 'hygiene', pack: '1 paquet', share: 'foyer', days: 45, on: false,
        why: 'paquet d\'≈ 80 : ≈ 2 par jour', match: /demaquill/ },
    { id: 'rasoirs', name: 'Lames de rasoir', group: 'hygiene', pack: '1 paquet', share: 'foyer', days: 30, on: false,
        why: 'paquet de 4 : ≈ 1 lame par semaine', match: /rasoir/ },
    { id: 'protections', name: 'Protections périodiques', group: 'hygiene', pack: '1 paquet', share: 'foyer', days: 28, on: false,
        why: 'un cycle ≈ 28 jours', match: /serviettes? hygien|tampons?|protege.?slips?/ },
    { id: 'essuietout', name: 'Essuie-tout (Sopalin)', group: 'entretien', pack: '1 paquet de 4 rouleaux', share: 'partage', days: 40, on: true,
        why: '≈ 1 rouleau tous les 10 jours par personne', match: /essuie.?tout|sopalin/ },
    { id: 'liquidevaisselle', name: 'Liquide vaisselle', group: 'entretien', pack: '1 flacon', share: 'partage', days: 60, on: true,
        why: 'flacon de 500 ml : ≈ 1 mois pour 2 personnes', match: /(?:liquide|produit) vaisselle/ },
    { id: 'eponges', name: 'Éponges', group: 'entretien', pack: '1 lot de 3', share: 'foyer', days: 21, on: true,
        why: 'une éponge neuve par semaine, pour l\'hygiène', match: /eponge/ },
    { id: 'sacspoubelle', name: 'Sacs poubelle', group: 'entretien', pack: '1 rouleau de 20', share: 'partage', days: 80, on: true,
        why: '≈ 1 sac tous les 4 jours par personne', match: /sacs? (?:poubelle|(?:a|pour) dechets)/ },
    { id: 'lessive', name: 'Lessive', group: 'entretien', pack: '1 bidon', share: 'partage', days: 105, on: true,
        why: 'bidon d\'≈ 30 lavages : ≈ 2 machines par semaine et par personne', match: /lessive/ },
    { id: 'nettoyant', name: 'Nettoyant multi-usage', group: 'entretien', pack: '1 flacon', share: 'foyer', days: 45, on: true,
        why: 'un spray ≈ 6 semaines', match: /multi.?usages?|nettoyant (?:menager|surfaces?)/ },
    { id: 'gelwc', name: 'Nettoyant WC', group: 'entretien', pack: '1 flacon', share: 'foyer', days: 45, on: true,
        why: 'un flacon ≈ 6 semaines', match: /\bwc\b/, not: /papier/ },
    { id: 'tablettes', name: 'Tablettes lave-vaisselle', group: 'entretien', pack: '1 boîte de 40', share: 'partage', days: 80, on: false,
        why: 'boîte de 40 : ≈ 1 lavage tous les 2 jours par personne', match: /(?:tablettes?|pastilles?|capsules?) (?:pour )?lave.?vaisselle|lave.?vaisselle.*(?:tablettes?|pastilles?|capsules?)/ },
    { id: 'sellv', name: 'Sel lave-vaisselle', group: 'entretien', pack: '1 paquet', share: 'foyer', days: 120, on: false,
        why: '≈ 1 kg tous les 4 mois (selon la dureté de l\'eau)', match: /\bsel\b.*lave.?vaisselle|sel regenerant/ },
    { id: 'rincage', name: 'Liquide de rinçage', group: 'entretien', pack: '1 flacon', share: 'foyer', days: 90, on: false,
        why: 'un flacon ≈ 3 mois', match: /rince.?eclat|rincage/ },
    { id: 'adoucissant', name: 'Adoucissant', group: 'entretien', pack: '1 bidon', share: 'partage', days: 105, on: false,
        why: 'comme la lessive : ≈ 30 lavages', match: /adoucissant/ },
    { id: 'javel', name: 'Eau de Javel', group: 'entretien', pack: '1 bouteille', share: 'foyer', days: 90, on: false,
        why: 'une bouteille ≈ 3 mois', match: /javel/ },
    { id: 'aluminium', name: 'Papier aluminium', group: 'entretien', pack: '1 rouleau', share: 'foyer', days: 120, on: false,
        why: 'un rouleau ≈ 4 mois', match: /aluminium|papier alu\b/ },
    { id: 'film', name: 'Film alimentaire', group: 'entretien', pack: '1 rouleau', share: 'foyer', days: 120, on: false,
        why: 'un rouleau ≈ 4 mois', match: /film (?:alimentaire|etirable)/ },
    { id: 'cuisson', name: 'Papier cuisson', group: 'entretien', pack: '1 rouleau', share: 'foyer', days: 90, on: false,
        why: 'un rouleau ≈ 3 mois', match: /papier cuisson|sulfurise/ },
    { id: 'congelation', name: 'Sacs congélation', group: 'entretien', pack: '1 boîte', share: 'foyer', days: 90, on: false,
        why: 'une boîte ≈ 3 mois', match: /congelation|sacs? zip/ },
    { id: 'filtrescafe', name: 'Filtres à café', group: 'entretien', pack: '1 boîte', share: 'foyer', days: 60, on: false,
        why: 'boîte de 80 : ≈ 1 à 2 par jour', match: /filtres? (?:a )?cafe/ },
];
export const RESTOCK_DEF = Object.fromEntries(RESTOCK.map(d => [d.id, d]));
export const GROUP_LABEL = { hygiene: 'Hygiène', entretien: 'Cuisine et entretien' };
export const MIN_DAYS = 3, MAX_DAYS = 365;
const clamp = (n) => Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(n)));
const people = (s) => Math.max(1, s.members.length);
// Estimation de départ pour ce foyer (null : produit ajouté par le foyer, sans hypothèse).
export function estimate(def, n) {
    if (!def)
        return null;
    return clamp(def.share === 'partage' ? def.days / Math.max(1, n) : def.days);
}
export const nameOf = (id, it) => RESTOCK_DEF[id]?.name ?? it?.name ?? id;
export function packOf(id, n) {
    const d = RESTOCK_DEF[id];
    if (!d)
        return '';
    return d.share === 'chacun' ? `${n} (un par personne)` : d.pack;
}
// Achats à moins de 5 jours d'écart : un seul passage (coche puis facture, ou les deux téléphones).
export const SAME_TRIP = 5;
export function trips(dates) {
    const out = [];
    for (const d of [...new Set(dates)].sort())
        if (!out.length || daysBetween(out[out.length - 1], d) >= SAME_TRIP)
            out.push(d);
    return out;
}
const median = (xs) => { const v = [...xs].sort((a, b) => a - b), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
// Rythme : celui choisi par le foyer ; sinon l'écart médian des 3 derniers intervalles entre achats (un oubli ne fausse pas tout) ;
// avec un seul intervalle connu, la moyenne entre lui et l'estimation ; sans achat, l'estimation de départ.
export function rhythm(s, id) {
    const it = s.restock[id];
    if (!it)
        return null;
    const t = trips(it.bought), gaps = t.slice(1).map((d, i) => daysBetween(t[i], d)).slice(-3);
    if (it.days !== null)
        return { days: it.days, basis: 'choisi', gaps };
    const est = estimate(RESTOCK_DEF[id], people(s));
    if (est === null)
        return null;
    if (!gaps.length)
        return { days: est, basis: 'estimation', gaps };
    return { days: clamp(gaps.length === 1 ? (est + gaps[0]) / 2 : median(gaps)), basis: 'achats', gaps };
}
export const lastBought = (it) => trips(it.bought).at(-1) ?? null;
// Prochain achat : la date forcée (« il en faut », « il en reste ») tant qu'aucun achat n'est noté depuis ; sinon dernier
// achat + rythme ; jamais acheté depuis le suivi : produit supposé à moitié entamé au départ.
export function nextDue(s, id) {
    const it = s.restock[id], r = rhythm(s, id);
    if (!it || !r)
        return null;
    const last = lastBought(it);
    if (it.due && (!last || last < it.due.set))
        return it.due.day;
    return last ? addDays(last, r.days) : addDays(it.since, Math.round(r.days / 2));
}
// « Il en reste » : reporté d'un quart du rythme, une semaine au moins.
export const later = (days) => Math.max(7, Math.round(days / 4));
// Lignes d'une semaine de courses. Semaine en cours (celle des prochaines courses) : tout ce qui manque d'ici sa fin, retard compris,
// et ce qui a été acheté pour elle (du samedi d'avant à sa fin) ; semaine à venir : ce qui manquera seulement là ; passée : rien.
export function restockFor(s, week, current, today) {
    if (week < current)
        return [];
    const end = addDays(week, 6), n = people(s), out = [];
    for (const [id, it] of Object.entries(s.restock)) {
        const due = it.on ? nextDue(s, id) : null, r = rhythm(s, id);
        if (!due || !r)
            continue;
        const last = lastBought(it), done = week === current && !!last && last >= addDays(week, -2) && last <= end;
        const show = done || (week === current ? due <= end : due >= week && due <= end);
        if (show)
            out.push({ id, name: nameOf(id, it), qty: packOf(id, n), due, last, rhythm: r, done, late: !done && due < today });
    }
    return out.sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due) || a.name.localeCompare(b.name, 'fr'));
}
// Produits suivis reconnus sur une facture du drive (« AUCHAN Dentifrice 75ml », « PAPIER TOILETTE x12 ») : achat noté au jour de la facture.
export function restockFromInvoice(s, labels) {
    const out = [];
    for (const [id, it] of Object.entries(s.restock)) {
        const d = RESTOCK_DEF[id];
        if (!it.on || !d)
            continue;
        if (labels.some(l => { const t = norm(l); return d.match.test(t) && !d.not?.test(t); }))
            out.push(id);
    }
    return out;
}
// Texte du rythme, pour la liste et la fiche : « ≈ tous les 24 jours · d'après vos 3 derniers achats ».
export function rhythmText(r) {
    const every = `≈ tous les ${r.days} jours`;
    if (r.basis === 'choisi')
        return `tous les ${r.days} jours (votre choix)`;
    if (r.basis === 'achats')
        return `${every} · d'après ${r.gaps.length > 1 ? `vos ${r.gaps.length} derniers intervalles d'achat` : 'votre dernier intervalle d\'achat et l\'estimation'}`;
    return `${every} · estimation de départ`;
}
