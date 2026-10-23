// File d'exceptions : on ne montre jamais une tâche, seulement ce qu'aucune règle n'a pu trancher, avec une action d'un toucher.
// Fonction pure de l'état (et de l'heure) : rien n'est enregistré ; une exception disparaît dès que l'état devient cohérent.
// Les règles par défaut sont des réglages (événements rejoués, synchronisés, annulables) ; « plus tard » vaut 24 h au plus, par personne.
import { addDays, fmtSlot, parseSlot, slotKey, SLOTS, daysBetween, weekOf } from './dates.js';
import { dependents, portions, servings } from './plan.js';
import { isUpcoming, leftovers } from './propose.js';
import { capital, prepTitle } from './status.js';
import { weekRange } from './batch.js';
export const MAX_SHOWN = 5; // au-delà : « + N autres », repliées ; une file de 12 cartes est une corvée
export const RULE_AFTER = 3;
const BASE = { conflit: 800, personne: 600, cuisson: 500, surveille: 450, restes: 400, menu: 350, semaine: 300 };
const HAS_RULE = new Set(['restes']);
// Créneaux à venir (14 prochains repas) où un plat peut être posé sans conflit : vide, pas mangé, quelqu'un y mange.
function freeSlots(s, today, hour, fits, days = 7) {
    const out = [];
    for (let i = 0; i <= days; i++)
        for (const sl of SLOTS) {
            const k = slotKey(addDays(today, i), sl), slot = s.slots[k], n = servings(s, k);
            if (isUpcoming(k, today, hour) && !slot?.dish && !slot?.eaten && n > 0 && fits(n))
                out.push(k);
        }
    return out;
}
// Échéance : un repas d'aujourd'hui ou de demain passe devant.
const soon = (k, today) => {
    const d = k ? parseSlot(k)?.date : undefined;
    return d && daysBetween(today, d) <= 1 ? 200 : 0;
};
export function exceptions(r, t, me, now) {
    const s = r.state, { date: today, hour } = t, out = [];
    const add = (x) => { out.push({ ...x, rule: HAS_RULE.has(x.code) && (s.snoozed[x.code] ?? 0) >= RULE_AFTER }); };
    // Blocages et alertes déjà détectés (conflits de synchro, portions qui manquent, DLC) : mêmes cartes, une action chacune.
    for (const p of t.checks) {
        const act = p.event ? { label: 'Vu', open: 'ack', arg: p.event } : p.watch ? { label: 'Ouvrir', open: 'watch', arg: p.watch } : { label: 'Régler', open: 'slot', arg: p.slot ?? '' };
        const code = p.level === 'conflit' ? 'conflit' : 'surveille';
        add({ key: `${code}:${p.key.slice(0, 100)}`, code, prio: BASE[code] + soon(p.slot, today), title: p.text, sub: '', actions: p.slot || p.event || p.watch ? [act] : [] });
    }
    // Personne à la maison mais un plat prévu : le déplacer vers un repas où quelqu'un mange, ou le retirer.
    for (const [k, slot] of Object.entries(s.slots)) {
        const d = slot.dish;
        if (!d || d.kind === 'outside' || slot.eaten || !isUpcoming(k, today, hour) || (parseSlot(k)?.date ?? '') > addDays(today, 7) || servings(s, k) > 0)
            continue;
        const prep = s.preps[d.prep];
        if (!prep)
            continue;
        if (d.kind === 'cook' && (prep.done || portions(s, prep).planned > 0))
            continue; // cuisiné pour des boîtes ou « en plus » : voulu
        const to = freeSlots(s, today, hour, () => true).slice(0, 2);
        add({ key: `personne:${k}`, code: 'personne', prio: BASE.personne + soon(k, today),
            title: `Personne à la maison ${fmtSlot(k, today)}, mais ${prepTitle(s, prep)} est prévu`, sub: 'Le déplacer, le retirer, ou ajouter des invités.',
            actions: [...to.map(x => ({ label: `Déplacer ${fmtSlot(x, today)}`, drafts: [{ t: 'slot.move', p: { from: k, to: x, swap: false } }] })),
                { label: 'Retirer du menu', drafts: [{ t: 'slot.clear', p: { slot: k } }] }, { label: 'Des invités', open: 'slot', arg: k }] });
    }
    // Préparation commencée, jamais déclarée prête : un toucher avec les portions prévues.
    for (const p of Object.values(s.preps)) {
        if (p.status !== 'started' || p.done)
            continue;
        const day = p.batch ?? (p.slot ? parseSlot(p.slot)?.date : undefined);
        const n = portions(s, p).planned, rc = s.recipes[p.recipe];
        if (!day || day > today || n < 1 || n > 99 || !rc)
            continue;
        add({ key: `cuisson:${p.id}`, code: 'cuisson', prio: BASE.cuisson + 200, title: `${capital(prepTitle(s, p))} commencé : c'est prêt ?`,
            sub: `${n} portion${n > 1 ? 's' : ''} prévue${n > 1 ? 's' : ''}${p.batch ? ' (batch)' : ''}.`,
            actions: [{ label: `C'est prêt (${n})`, drafts: [{ t: 'prep.done', p: { prep: p.id, yield: n, planned: n, version: rc.versions.length } }] },
                ...(p.slot ? [{ label: 'Autre nombre', open: 'slot', arg: p.slot }] : [])] });
    }
    // Restes libres sans repas prévu : la règle par défaut décide de ce qui est proposé.
    const rule = s.settings.leftovers ?? 'auto';
    if (rule !== 'manual')
        for (const x of leftovers(s, today)) {
            if (dependents(s, x.prep).some(k => !s.slots[k]?.eaten && isUpcoming(k, today, hour)))
                continue; // déjà placés quelque part
            const options = freeSlots(s, today, hour, n => n <= x.free);
            if (!options.length)
                continue;
            const natural = rule === 'auto' ? options.find(k => k.endsWith('|midi')) ?? options[0] : undefined;
            const picks = natural ? [natural, ...options.filter(k => k !== natural)].slice(0, 3) : options.slice(0, 3);
            add({ key: `restes:${x.prep}`, code: 'restes', prio: BASE.restes + soon(picks[0], today),
                title: `${x.free} portion${x.free > 1 ? 's' : ''} de ${x.name} en attente`,
                sub: natural ? `Proposé d'office : ${fmtSlot(natural, today)}${x.age ? ` · préparé il y a ${x.age} j` : ''}.` : `Placer où ?${x.age ? ` · préparé il y a ${x.age} j` : ''}`,
                actions: picks.map(k => ({ label: capital(fmtSlot(k, today)), drafts: [{ t: 'slot.from', p: { slot: k, prep: x.prep } }] })) });
        }
    // Menu généré en attente d'approbation (sur ce téléphone ou l'autre) : il remplace la carte « repas sans plat » de sa semaine.
    const thisWk = weekOf(today, s.settings.weekStart), nextWk = addDays(thisWk, 7);
    for (const w of [thisWk, nextWk]) {
        const d = s.drafts[w];
        if (!d)
            continue;
        const who = d.by && d.by !== me ? s.members.find(m => m.id === d.by)?.name : undefined;
        add({ key: `menu:${w}`, code: 'menu', prio: BASE.menu + (w === thisWk ? 20 : 0), title: `Menu ${w === thisWk ? 'de la semaine' : `${weekRange(w)}`} proposé${who ? ` par ${who}` : ''} : ${d.items.length} repas à approuver`,
            sub: 'Approuvez tout, ou changez un repas.', actions: [{ label: 'Voir et approuver', open: 'propose', arg: w }] });
    }
    // Repas sans plat : rien que le rituel du batch ne propose déjà.
    const rit = t.ritual, ritualMenu = !!rit && (rit.kind === 'menu' || rit.kind === 'choose' || (rit.kind === 'courses' && rit.menuEmpty));
    if (t.empty && !s.drafts[thisWk])
        add({ key: `semaine:${today}`, code: 'semaine', prio: BASE.semaine, title: `${t.empty} repas sans plat d'ici la fin de la semaine`, sub: '',
            actions: [{ label: `✨ Compléter cette semaine (${t.empty} repas)`, open: 'propose', arg: '' }] });
    if (t.nextWeekEmpty && !ritualMenu && !s.drafts[nextWk]) {
        const next = nextWk;
        add({ key: `semaine:${next}`, code: 'semaine', prio: BASE.semaine - 10, title: 'La semaine prochaine est vide', sub: '',
            actions: [{ label: `✨ Choisir les repas ${weekRange(next)}`, open: 'propose', arg: next }] });
    }
    const later = (x) => { const u = s.snooze[`${me ?? '-'}|${x.key}`]; return !!u && Date.parse(u) > now.getTime(); };
    const live = out.filter(x => !later(x)).sort((a, b) => b.prio - a.prio || (a.key < b.key ? -1 : 1));
    return { shown: live.slice(0, MAX_SHOWN), hidden: live.slice(MAX_SHOWN) };
}
