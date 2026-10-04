// Lecture d'agendas iCalendar : formats Google / iCloud / Outlook, récurrences, exceptions, occurrences déplacées,
// changement d'heure, journées entières ; ce qui n'est pas compris est signalé, jamais deviné.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCalendar, parseDuration, hash16 } from '../src/core/ical.ts';

const cal = (...events: string[]): string => ['BEGIN:VCALENDAR', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'VERSION:2.0', 'X-WR-TIMEZONE:Europe/Paris',
  'BEGIN:VTIMEZONE', 'TZID:Europe/Paris', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'END:VTIMEZONE',
  ...events.flatMap(e => ['BEGIN:VEVENT', ...e.trim().split('\n').map(l => l.trim()), 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 16);
const read = (text: string) => readCalendar(text, '2026-10-04', '2026-11-04', 'agenda01');

test('événement hebdomadaire Google : exception, occurrence déplacée, changement d\'heure du 25 octobre', () => {
  const r = read(cal(`
    DTSTART;TZID=Europe/Paris:20260908T193000
    DTEND;TZID=Europe/Paris:20260908T213000
    RRULE:FREQ=WEEKLY;BYDAY=TU
    EXDATE;TZID=Europe/Paris:20261013T193000
    UID:foot0001@google.com
    SUMMARY:Foot
    TRANSP:OPAQUE`, `
    DTSTART;TZID=Europe/Paris:20261021T200000
    DTEND;TZID=Europe/Paris:20261021T220000
    RECURRENCE-ID;TZID=Europe/Paris:20261020T193000
    UID:foot0001@google.com
    SUMMARY:Foot (décalé)`));
  assert.deepEqual(r.occurrences.map(o => [iso(o.start), iso(o.end), o.title]), [
    ['2026-10-06T17:30', '2026-10-06T19:30', 'Foot'],            // heure d'été : 19 h 30 à Paris = 17 h 30 UTC
    ['2026-10-21T18:00', '2026-10-21T20:00', 'Foot (décalé)'],   // le 20 déplacé au mercredi 21 à 20 h
    ['2026-10-27T18:30', '2026-10-27T20:30', 'Foot'],            // heure d'hiver : toujours 19 h 30 à Paris
    ['2026-11-03T18:30', '2026-11-03T20:30', 'Foot'],
  ]); // le 13 est exclu (EXDATE)
  assert.ok(r.occurrences.every(o => o.recurring && o.busy && !o.allDay));
  // L'occurrence déplacée garde l'identifiant de son créneau d'origine : une décision prise sur elle la suit.
  assert.equal(r.occurrences[1]?.id, hash16(`agenda01|foot0001@google.com|${Date.parse('2026-10-20T17:30:00Z')}`));
  assert.deepEqual(read(cal(`
    DTSTART;TZID=Europe/Paris:20260908T193000
    DTEND;TZID=Europe/Paris:20260908T213000
    RRULE:FREQ=WEEKLY;BYDAY=TU
    UID:foot0001@google.com
    SUMMARY:Foot`)).occurrences[0]?.id, r.occurrences[0]?.id); // même identifiant d'une lecture à l'autre
});

test('journées entières, heure UTC, texte échappé, ligne repliée, annulé, Outlook et fuseau inconnu', () => {
  const r = read(cal(`
    DTSTART;VALUE=DATE:20261015
    DTEND;VALUE=DATE:20261017
    UID:sem@google.com
    SUMMARY:Séminaire à Lyon
    TRANSP:TRANSPARENT`, `
    DTSTART:20261007T103000Z
    DTEND:20261007T120000Z
    UID:dej@google.com
    SUMMARY:Déjeuner client\\, Paris 8e`, `
    DTSTART;TZID=Europe/Paris:20261010T200000
    DTEND;TZID=Europe/Paris:20261010T230000
    UID:annule@google.com
    STATUS:CANCELLED
    SUMMARY:Dîner annulé`, `
    DTSTART;TZID="Romance Standard Time":20261009T200000
    DTEND;TZID="Romance Standard Time":20261009T220000
    UID:040000008200E00074C5B7101A82E008@outlook.com
    SUMMARY:Restaurant avec l'équipe`, `
    DTSTART;TZID=Zone/Inconnue:20261012T123000
    DURATION:PT1H30M
    UID:tz@exemple
    SUMMARY:Rendez-vous`).replace('SUMMARY:Séminaire à Lyon', 'SUMMARY:Séminaire\r\n  à Lyon'));
  assert.deepEqual(r.occurrences.map(o => [o.title, o.allDay ? o.days : [iso(o.start), iso(o.end)], o.busy, o.tzGuess]), [
    ['Déjeuner client, Paris 8e', ['2026-10-07T10:30', '2026-10-07T12:00'], true, false],
    ['Restaurant avec l\'équipe', ['2026-10-09T18:00', '2026-10-09T20:00'], true, false], // fuseau Windows reconnu
    ['Rendez-vous', ['2026-10-12T10:30', '2026-10-12T12:00'], true, true],               // fuseau inconnu : Paris supposé, signalé
    ['Séminaire à Lyon', ['2026-10-15', '2026-10-17'], false, false],                    // jeudi et vendredi ; « disponible »
  ]);
  assert.equal(r.events, 5);
});

test('récurrences mensuelles et annuelles, nombre d\'occurrences, date de fin, un sur deux', () => {
  const titles = (text: string) => read(text).occurrences.map(o => `${o.title} ${new Date(o.start).toISOString().slice(0, 10)}`);
  assert.deepEqual(titles(cal(`
    DTSTART;TZID=Europe/Paris:20260101T200000
    DTEND;TZID=Europe/Paris:20260101T220000
    RRULE:FREQ=MONTHLY;BYDAY=2TH
    UID:a
    SUMMARY:Club`, `
    DTSTART;TZID=Europe/Paris:20260130T190000
    DTEND;TZID=Europe/Paris:20260130T230000
    RRULE:FREQ=MONTHLY;BYDAY=-1FR
    UID:b
    SUMMARY:Afterwork`, `
    DTSTART;VALUE=DATE:20261002
    RRULE:FREQ=DAILY;COUNT=3
    UID:c
    SUMMARY:Stage`, `
    DTSTART;TZID=Europe/Paris:20261001T120000
    DTEND;TZID=Europe/Paris:20261001T133000
    RRULE:FREQ=WEEKLY;UNTIL=20261020T215959Z
    UID:d
    SUMMARY:Cantine`, `
    DTSTART;TZID=Europe/Paris:20260928T190000
    DTEND;TZID=Europe/Paris:20260928T203000
    RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE
    UID:e
    SUMMARY:Piscine`, `
    DTSTART;VALUE=DATE:20201031
    RRULE:FREQ=YEARLY
    UID:f
    SUMMARY:Halloween`, `
    DTSTART;TZID=Europe/Paris:20260105T120000
    DTEND;TZID=Europe/Paris:20260105T130000
    RRULE:FREQ=MONTHLY;BYMONTHDAY=-1
    UID:g
    SUMMARY:Fin de mois`)).sort(), [
    'Afterwork 2026-10-30', 'Cantine 2026-10-08', 'Cantine 2026-10-15', 'Club 2026-10-08', 'Fin de mois 2026-10-31',
    'Halloween 2026-10-30', // minuit à Paris = 30 octobre 23 h UTC
    'Piscine 2026-10-12', 'Piscine 2026-10-14', 'Piscine 2026-10-26', 'Piscine 2026-10-28', 'Stage 2026-10-03',
  ].sort()); // Stage : 2, 3, 4 octobre → seul le 4 (minuit Paris = 3 octobre 22 h UTC) est dans la fenêtre
});

test('ce qui n\'est pas compris est écarté et signalé', () => {
  const r = read(cal(`
    DTSTART;TZID=Europe/Paris:20261001T120000
    RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO,TU,WE,TH,FR
    UID:x
    SUMMARY:Dernier jour ouvré`, `
    DTSTART:2026-10-07
    UID:y
    SUMMARY:Date mal écrite`, `
    DTSTART;TZID=Europe/Paris:20261008T120000
    DURATION:1 heure
    UID:z
    SUMMARY:Durée en toutes lettres`));
  assert.deepEqual(r.occurrences, []);
  assert.deepEqual(r.skipped, [
    { title: 'Dernier jour ouvré', why: 'récurrence non comprise (BYSETPOS)' },
    { title: 'Date mal écrite', why: 'date de début illisible' },
    { title: 'Durée en toutes lettres', why: 'durée illisible' },
  ]);
  assert.equal(readCalendar('<html>Connexion requise</html>', '2026-10-04', '2026-11-04', 's').skipped[0]?.why, 'ce n\'est pas un agenda au format iCalendar');
  assert.equal(parseDuration('P1DT2H'), 93600);
  assert.equal(parseDuration('P'), null);
});

test('la fonction serveur lit les agendas avec exactement le même code que l\'app', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['ical.ts', 'dates.ts']) {
    assert.equal(readFileSync(new URL(`../supabase/functions/foyer-agenda/${f}`, import.meta.url), 'utf8'), readFileSync(new URL(`../src/core/${f}`, import.meta.url), 'utf8'), f);
  }
  const src = readFileSync(new URL('../supabase/functions/foyer-agenda/index.ts', import.meta.url), 'utf8');
  const host = new RegExp(/AGENDA_HOST = \/(.+)\/;/.exec(src)?.[1] ?? '$^');
  for (const ok of ['calendar.google.com', 'p52-caldav.icloud.com', 'outlook.office365.com', 'outlook.live.com', 'calendar.proton.me']) assert.ok(host.test(ok), ok);
  for (const bad of ['calendar.google.com.evil.fr', 'evil.fr', '169.254.169.254', 'p52-caldav.icloud.com.evil.fr', 'localhost']) assert.ok(!host.test(bad), bad);
});
