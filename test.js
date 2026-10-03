// node test.js — vérifie l'import, la catégorisation et les calculs.
const assert = require('assert');
const C = require('./core.js');

assert.strictEqual(C.parseNumber('-1 234,56'), -1234.56);
assert.strictEqual(C.parseNumber('+1500,00'), 1500);
assert.strictEqual(C.parseNumber('-12.5'), -12.5);
assert.strictEqual(C.parseDate('13/09/2025'), '2025-09-13');
assert.strictEqual(C.parseDate('20250913120000[0:GMT]'), '2025-09-13');
assert.strictEqual(C.merchantKey('CB CARREFOUR MARKET 12/09 PARIS'), 'CARREFOUR');                 // une enseigne = une clé, quel que soit le magasin
assert.strictEqual(C.merchantKey('PRLV SEPA FREE MOBILE XP123'), 'FREE MOBILE');

const cz = (label, amount = -10) => C.categorize({ label, amount });
assert.strictEqual(cz('UBER EATS PARIS'), 'fastfood');
assert.strictEqual(cz('RESTAURANT LE ZINC'), 'restos');
assert.strictEqual(cz('CLINIQUE VETERINAIRE DU LAC'), 'animaux');
assert.strictEqual(cz('PRLV SEPA MATMUT ASSURANCES'), 'assurances');
assert.strictEqual(cz('ASSURANCE VIE LINXEA'), 'epargne');
assert.strictEqual(cz('VINCI AUTOROUTES PEAGE'), 'voiture');
assert.strictEqual(cz('EASYJET'), 'vacances');
assert.strictEqual(cz('TABAC PRESSE DU CENTRE'), 'tabac');
assert.strictEqual(cz('HELLOFRESH'), 'courses');
assert.strictEqual(cz('UBER BV TRIP'), 'transport');
assert.strictEqual(cz('BOULANGERIE DUPONT'), 'courses');
assert.strictEqual(cz('BOULANGER LYON'), 'maison');
assert.strictEqual(cz('GRAND FRAIS'), 'courses');
assert.strictEqual(cz('VIR SEPA SOCIETE XYZ', 2100), 'revenus');
assert.strictEqual(cz('AMAZON REMBOURSEMENT', 30), 'shopping'); // remboursement = moins de shopping
assert.strictEqual(cz('VIR SEPA SALAIRE HOPITAL', 1900), 'revenus');   // pas un remboursement santé
assert.strictEqual(cz('SALAIRE ACME SA', 2100), 'revenus');          // pas une facture téléphone
assert.strictEqual(cz('VIR CPAM REMBOURSEMENT', 25), 'sante');
assert.strictEqual(cz('INDEMNITES JOURNALIERES CPAM', 800), 'revenus');
assert.strictEqual(cz('VIR SEPA FNAC AVOIR', 40), 'shopping');
assert.strictEqual(C.categorize({ label: 'MAGASIN X', amount: -5, bpCat: 'Restaurants Loisirs' }), 'restos');

// Export CSV Banque Populaire
const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
15/09/2025;CARREFOUR MARKET;CB CARREFOUR MARKET 13/09;1;;Carte;Alimentation;Supermarché;-54,20;;13/09/2025;15/09/2025;0
16/09/2025;SALAIRE;VIR SEPA SOCIETE XYZ SALAIRE;2;;Virement;Revenus;Salaire;;+2 100,00;16/09/2025;16/09/2025;0
17/09/2025;VIR LIVRET A;VIR VERS LIVRET A;3;;Virement;Epargne;;-200,00;;17/09/2025;17/09/2025;0
17/09/2025;CAFE DU COIN;CB CAFE DU COIN;4;;Carte;Loisirs;Restaurants;-3,50;;17/09/2025;17/09/2025;0
17/09/2025;CAFE DU COIN;CB CAFE DU COIN;5;;Carte;Loisirs;Restaurants;-3,50;;17/09/2025;17/09/2025;0`;
const [p] = C.parseCSV(csv, '12345678901_01092025_30092025.csv');
assert.strictEqual(p.account, '12345678901');
assert.strictEqual(p.rows.length, 5);
assert.deepStrictEqual(p.rows[0], { date: '2025-09-13', amount: -54.2, label: 'CARREFOUR MARKET',
  detail: 'CB CARREFOUR MARKET 13/09', bpCat: 'Supermarché Alimentation' });
assert.strictEqual(p.rows[1].amount, 2100);

// Export OFX du livret : le même virement vu de l'autre côté
const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>99887766<ACCTTYPE>SAVINGS</BANKACCTFROM>
<BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20250918<TRNAMT>200,00<FITID>a<NAME>VIR DE CPT COURANT</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>5200,00<DTASOF>20250930</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const o = C.parseOFX(ofx);
assert.strictEqual(o[0].account, '99887766');
assert.strictEqual(o[0].savings, true);
assert.deepStrictEqual(o[0].balance, { amount: 5200, date: '2025-09-30' });

const S = { accounts: {}, tx: [], rules: {} };
assert.deepStrictEqual(C.importParsed(S, [p], 'Hugo'), { added: 5, dup: 0, created: ['12345678901'] });
assert.deepStrictEqual(C.importParsed(S, [p]), { added: 0, dup: 5, created: [] }); // réimport sans doublon
assert.strictEqual(S.accounts['12345678901'].owner, 'Hugo');
C.importParsed(S, o);
const byLabel = l => S.tx.find(t => t.label === l);
assert.strictEqual(byLabel('VIR LIVRET A').cat, 'epargne');
assert.strictEqual(byLabel('VIR DE CPT COURANT').cat, 'interne');

const st = C.monthStats(S, '2025-09');
assert.strictEqual(st.income, 2100);
assert.strictEqual(st.saved, 200); // compté une seule fois malgré les deux comptes
assert.strictEqual(Math.round(st.spent * 100) / 100, 61.2);
assert.strictEqual(st.by.restos, 7);

const grid = C.dayGrid(S, '2025-09');
assert.strictEqual(grid[12].state, 'spent'); // 13/09 Carrefour
assert.strictEqual(grid[13].state, 'free');  // 14/09
assert.strictEqual(grid[25].state, 'unknown'); // après la dernière donnée importée

assert.strictEqual(C.shiftMonth('2025-01', -1), '2024-12');

// Correspondance la plus longue + confiance
assert.strictEqual(cz('TOTAL ENERGIES FACTURE'), 'logement');
assert.strictEqual(cz('AMAZON PRIME FR'), 'abos');
assert.deepStrictEqual(C.classify({ label: 'SARL MACHIN', amount: -12 }), { cat: 'autres', conf: 'guess' });
assert.deepStrictEqual(C.classify({ label: 'MACHIN', amount: -12 }, { '-MACHIN': 'loisirs' }), { cat: 'loisirs', conf: 'sure' });

// Relevé PDF : positions x des colonnes Débit (420) / Crédit (500), relevé de janvier avec une opération de décembre
const it = (str, x, y) => ({ str, x, y, w: str.length * 5 });
const pdf = [[
  it('RELEVE DE COMPTE du 01/01/2026 au 31/01/2026', 40, 800),
  it('Compte courant N° 12345678901', 40, 780),
  it('Date', 40, 760), it('Libellé', 90, 760), it('Valeur', 330, 760), it('Débit', 420, 760), it('Crédit', 500, 760),
  it('31/12', 40, 740), it('CB CARREFOUR', 90, 740), it('02/01', 330, 740), it('54,20', 420, 740),
  it('FACT 301225', 90, 730),
  it('05/01', 40, 720), it('VIR SEPA SALAIRE ACME', 90, 720), it('05/01', 330, 720), it('2 450,00', 495, 720),
  it('06/01', 40, 700), it('PRLV SEPA EDF', 90, 700), it('1', 420, 700), it('234,56', 427, 700),
  it('31/01', 40, 680), it('NOUVEAU SOLDE', 90, 680), it('3 000,00', 495, 680),
]];
const [pp] = C.parsePDF(pdf, 'releve.pdf');
assert.strictEqual(pp.account, '12345678901');
assert.deepStrictEqual(pp.rows.map(r => [r.date, r.amount, r.label]), [
  ['2025-12-30', -54.2, 'CB CARREFOUR'],       // décembre de l'année précédente, date d'achat FACT
  ['2026-01-05', 2450, 'VIR SEPA SALAIRE ACME'],
  ['2026-01-06', -1234.56, 'PRLV SEPA EDF'],   // montant recollé
]);
assert.strictEqual(pp.rows[0].detail, 'FACT 301225');
assert.deepStrictEqual(pp.balance, { amount: 3000, date: '2026-01-31' }); // NOUVEAU SOLDE, colonne crédit
assert.throws(() => C.parsePDF([[it('Bonjour', 10, 10)]]), /Montant ou Débit/);

// Prélèvements réguliers
const R = { accounts: {}, tx: [], rules: {} };
const rows = [];
for (const m of ['06', '07', '08', '09']) {
  rows.push({ date: `2025-${m}-05`, amount: -13.49, label: 'NETFLIX' }, { date: `2025-${m}-01`, amount: 2450, label: 'SALAIRE ACME' });
  for (const d of ['07', '15', '22']) rows.push({ date: `2025-${m}-${d}`, amount: -20, label: 'UBER EATS' });
}
rows.push({ date: '2025-10-01', amount: 2450, label: 'SALAIRE ACME' });
C.importParsed(R, [{ account: 'A', rows }]);
assert.deepStrictEqual(C.recurring(R).map(r => r.name), ['SALAIRE ACME', 'NETFLIX']);
assert.deepStrictEqual(C.upcoming(R, '2025-10').map(r => [r.name, r.sign * r.amount]), [['NETFLIX', -13.49]]);

// Engagements : Uber Eats = 60 €/mois d'habitude, objectif 50 €, dépensé 35 € → réussi, 25 € gagnés
C.importParsed(R, [{ account: 'A', rows: [{ date: '2025-10-08', amount: -35, label: 'UBER EATS' }] }]);
// Mois pas encore complet (relevé arrêté au 8) : aucun verdict, aucun « gain » — il manque peut-être des dépenses.
assert.deepStrictEqual(C.engagementResults(R, '2025-10', 'all', { fastfood: 50 }), [{ cat: 'fastfood', target: 50, spent: 35, habit: 60, full: false, ok: false, gain: 0 }]);
R.accounts.A.balance = { amount: 1000, date: '2025-11-04' }; // le relevé d'octobre est arrivé
assert.deepStrictEqual(C.engagementResults(R, '2025-10', 'all', { fastfood: 50 }), [{ cat: 'fastfood', target: 50, spent: 35, habit: 60, full: true, ok: true, gain: 25 }]);
console.log('OK — tous les tests passent');

// Profils : un virement de Hugo vers Clara est une sortie vu de Hugo, un simple déplacement vu du foyer
const F = { accounts: {}, tx: [], rules: {} };
C.importParsed(F, [{ account: 'H', rows: [{ date: '2025-09-02', amount: -300, label: 'VIR SEPA CLARA' }, { date: '2025-09-03', amount: -50, label: 'CARREFOUR' }] }], 'Hugo');
C.importParsed(F, [{ account: 'M', rows: [{ date: '2025-09-02', amount: 300, label: 'VIR SEPA HUGO' }] }], 'Clara');
assert.strictEqual(C.monthStats(F, '2025-09', ['H']).by.couple, 300);
assert.strictEqual(C.monthStats(F, '2025-09', ['M']).income, 300);
assert.strictEqual(C.monthStats(F, '2025-09', 'all').by.couple, undefined);
assert.strictEqual(C.monthStats(F, '2025-09', 'all').spent, 50);

// Solde courant = dernier solde connu + opérations postérieures
F.accounts.H.balance = { amount: 1000, date: '2025-09-02' };
assert.strictEqual(C.balanceOf(F, 'H'), 950);
console.log('OK — profils et soldes');

// Solde reconstitué dans le passé et dans le futur
assert.strictEqual(C.balanceAt(F, 'H', '2025-09-02'), 1000);
assert.strictEqual(C.balanceAt(F, 'H', '2025-09-01'), 1300); // avant le virement de 300
assert.strictEqual(C.balanceAt(F, 'H', '2025-09-30'), 950);

// Fusion : le téléphone de Clara + celui de Hugo, sans perte ni doublon
const ph1 = { people: [], accounts: { H: { name: 'H', owner: 'p1' } }, tx: [], rules: { '-A': 'courses' }, budgets: { foyer: { courses: 400 } }, pots: [{ id: 'x', moves: [{ date: 'd', amount: 10, note: 'a' }] }], claimed: {}, challenges: {} };
C.importParsed(ph1, [{ account: 'H', rows: [{ date: '2025-09-01', amount: -10, label: 'A' }] }]);
const ph2 = JSON.parse(JSON.stringify(ph1));
ph2.accounts.M = { name: 'M', owner: 'p2' };
C.importParsed(ph2, [{ account: 'M', rows: [{ date: '2025-09-02', amount: -20, label: 'B' }] }]);
ph2.rules['-B'] = 'loisirs'; ph2.budgets.foyer.restos = 100; ph2.pots[0].moves.push({ date: 'e', amount: 5, note: 'b' });
const mg = C.mergeStates(ph1, ph2);
assert.strictEqual(mg.tx.length, 2);
assert.strictEqual(mg.tx.find(t => t.label === 'B').cat, 'loisirs');
assert.deepStrictEqual(mg.budgets.foyer, { courses: 400, restos: 100 });
assert.strictEqual(mg.pots[0].moves.length, 2);
assert.strictEqual(C.mergeStates(mg, mg).tx.length, 2); // refusionner ne duplique rien

// Compte joint : versements appariés + libellé appris
const Jt = { accounts: { H: { owner: 'p1' }, M: { owner: 'p2' }, K: { owner: 'commun' } }, tx: [], rules: {}, payers: { [C.ruleKey({ label: 'VIR CLARA AUTRE BANQUE', amount: 1 })]: 'p2' } };
C.importParsed(Jt, [{ account: 'H', rows: [{ date: '2025-09-03', amount: -800, label: 'VIR VERS JOINT' }] }]);
C.importParsed(Jt, [{ account: 'K', rows: [{ date: '2025-09-03', amount: 800, label: 'VIR DE HUGO' }, { date: '2025-09-04', amount: 600, label: 'VIR CLARA AUTRE BANQUE' }, { date: '2025-09-05', amount: 50, label: 'VIR INCONNU' }] }]);
const js = C.jointSplit(Jt, '2025-09');
assert.deepStrictEqual(js.by, { p1: 800, p2: 600 });
assert.deepStrictEqual(js.unknown.map(t => t.amount), [50]);

// Charges annuelles : taxe foncière vue une fois → 100 €/mois, prochaine en octobre
const An = { accounts: {}, tx: [], rules: {} };
C.importParsed(An, [{ account: 'A', rows: [{ date: '2025-10-15', amount: -1200, label: 'DGFIP TAXE FONCIERE' }, { date: '2025-11-02', amount: -45, label: 'CINEMA' }] }]);
assert.deepStrictEqual(C.annualCharges(An, '2026-03').map(a => [a.name, a.perMonth, a.next]), [['DGFIP TAXE', 100, '2026-10']]);
console.log('OK — fusion, compte joint, charges annuelles');

// Tableur de suivi (format de Clara, données fictives)
const treso = [
  ';juin-25;juil.-25;août-25;;Moyenne;',
  'Solde initial;;1 000,00 €;;;;',
  'Entrées ;2 000,00 €;2 100,00 €;;;;',
  'Salaire Clara;2 000,00 €;2 000,00 €;;;;',
  'Prime;;100,00 €;;;;',
  ';;;;;;',
  'Dépenses;500,00 €;600,00 €;;;;',
  'Dépenses communes;400,00 €;430,00 €;;;;',
  'Matmut ;100,00 €;100,00 €;;;100,00 €;NEGO',
  'Restaurant Fast food;300,00 €;350,00 €;;;325,00 €;PEUT DIMINUER',
  'Animaux - rbt assurance;;-20,00 €;;;;X',
  ';;;;;;',
  'Dépenses perso Hugo;100,00 €;170,00 €;;;;',
  ';;;;;;',
  'Solde final;;;;;;',
  'Livret A - Clara;2 165,00 €;2 365,00 €;;;;',
].join('\r\n');
assert.ok(C.isTreso(treso));
const tr = C.parseTreso(treso, [{ id: 'p1', name: 'Hugo' }, { id: 'p2', name: 'Clara' }]);
assert.deepStrictEqual(tr.levers, { cat: { fastfood: 'diminuer', animaux: 'essentiel' }, merchant: { MATMUT: 'nego' } });
assert.deepStrictEqual(tr.balances['Livret A - Clara'], { owner: 'p2', savings: true, months: { '2025-06': 2165, '2025-07': 2365 } });
const T = { people: [], accounts: {}, tx: [], rules: {}, levers: tr.levers };
C.importParsed(T, tr.parsed);
assert.strictEqual(C.monthStats(T, '2025-07').spent, 600);   // = ligne « Dépenses » du tableur
assert.strictEqual(C.monthStats(T, '2025-07').income, 2100);
assert.strictEqual(C.monthStats(T, '2025-07', ['HIST-P1']).spent, 170); // perso Hugo sans détail : total gardé
assert.strictEqual(T.accounts['HIST-P2'].owner, 'p2');
// Les vrais relevés remplacent l'historique du même mois, pour la même personne
T.accounts.REAL = { owner: 'p1' };
C.importParsed(T, [{ account: 'REAL', rows: [{ date: '2025-07-03', amount: -42, label: 'CARREFOUR' }] }]);
assert.strictEqual(C.monthStats(T, '2025-07', ['HIST-P1', 'REAL']).spent, 42);
assert.strictEqual(C.monthStats(T, '2025-06', ['HIST-P1', 'REAL']).spent, 100); // juin : pas de relevé → historique

// Plan d'épargne : assurance à renégocier (20 %), fast-food peut diminuer (15 %)
const plan = C.savingsPlan(T, '2025-08', ['HIST-COMMUN']);
assert.deepStrictEqual(plan.items.filter(i => i.gain).map(i => [i.key, i.lever, i.gain]), [['fastfood', 'diminuer', 49], ['MATMUT', 'nego', 20]]);

// Contrôle d'un relevé PDF : ancien solde + opérations = nouveau solde
const pdf2 = [[
  it('du 01/02/2026 au 28/02/2026', 40, 800), it('N° 555666777', 40, 780),
  it('Date', 40, 760), it('Libellé', 90, 760), it('Débit', 420, 760), it('Crédit', 500, 760),
  it('ANCIEN SOLDE CREDITEUR AU 31/01/2026', 90, 750), it('1 000,00', 495, 750),
  it('03/02', 40, 740), it('CB LIDL', 90, 740), it('50,00', 420, 740),
  it('NOUVEAU SOLDE CREDITEUR AU 28/02/2026', 90, 720), it('950,00', 495, 720),
]];
const [ok2] = C.parsePDF(pdf2);
assert.strictEqual(ok2.check, 0);
assert.deepStrictEqual(ok2.balance, { amount: 950, date: '2026-02-28' });
pdf2[0][pdf2[0].length - 1] = it('900,00', 495, 720);
assert.strictEqual(C.parsePDF(pdf2)[0].check, -50); // une opération a échappé à la lecture → signalé
console.log('OK — tableur, leviers, plan, contrôle des relevés');

// Habitude robuste : un mois de gros travaux ne fausse pas l'objectif
const Hb = { accounts: {}, tx: [], rules: {} };
C.importParsed(Hb, [{ account: 'A', rows: [{ date: '2026-03-31', amount: 2000, label: 'SALAIRE' }, // relevés complets d'avril à juin
  { date: '2026-04-10', amount: -2000, label: 'LEROY MERLIN' }, { date: '2026-05-10', amount: -150, label: 'LEROY MERLIN' }, { date: '2026-06-10', amount: -200, label: 'LEROY MERLIN' }] }]);
Hb.accounts.A.balance = { amount: 0, date: '2026-07-04' };
assert.strictEqual(C.habitBy(Hb, '2026-07').maison, 200);
assert.strictEqual(C.savingsPlan(Hb, '2026-07').items[0].avg, 200);
console.log('OK — habitude robuste');

// Relevé Banque Populaire réel (structure anonymisée) : colonne Montant signée, 3 dates, carte, référence,
// code dans la marge, récapitulatif des frais à ne pas recompter
const bp = [[
  it('Votre relevé de compte n°5 au 05/06/2026', 43, 557),
  it('DETAIL DES OPERATIONS DE VOTRE COMPTE CHEQUES N° 11122233344', 43, 517),
  it('LIBELLE / REFERENCE', 94, 460), it('MONTANT', 513, 460),
  it('SOLDE CREDITEUR AU 07/05/2026', 94, 439), it('1 000,00 €', 516, 439),
  it('08/05', 51, 426), it('VIR MME DUPONT', 102, 426), it('8602945', 310, 426), it('08/05', 368, 426), it('08/05', 429, 426), it('- 1 200,00 €', 511, 426),
  it('Virement vers Dupont', 108, 418),
  it('0001', 9, 407), it('11/05', 51, 407), it('100526 CB****1111', 102, 407), it('61BDREU', 310, 407), it('10/05', 368, 407), it('11/05', 429, 407), it('- 17,20 €', 522, 407),
  it('Spotify France 75PARIS', 108, 399),
  it('12/05', 51, 388), it('VIREMENT ACME SALAIRE', 102, 388), it('2420702', 310, 388), it('12/05', 368, 388), it('12/05', 429, 388), it('2 000,00 €', 516, 388),
  it('TOTAL DES MOUVEMENTS DEBITEURS', 94, 370), it('- 1 217,20 €', 511, 370),
  it('SOLDE CREDITEUR AU 05/06/2026*', 94, 350), it('1 782,80 €', 516, 350),
  it('RECAPITULATIF DES FRAIS ET SERVICES BANCAIRES', 94, 330),
  it('05/06', 52, 320), it('Cotis Pack Confort', 103, 320), it('0017724', 311, 320), it('04/06', 369, 320), it('04/06', 430, 320), it('- 24,30 €', 523, 320),
  it('DETAIL DE VOS PRELEVEMENTS SEPA RECUS', 94, 300), it('9 - Numero de compte : 1234567890', 94, 290),
]];
const [bpr] = C.parsePDF(bp, 'Extrait.pdf');
assert.strictEqual(bpr.account, '11122233344');
assert.deepStrictEqual(bpr.rows.map(r => [r.date, r.amount, r.label, r.detail]), [
  ['2026-05-08', -1200, 'VIR MME DUPONT', 'Virement vers Dupont'],
  ['2026-05-10', -17.2, 'Spotify France 75PARIS', 'Carte ••1111'],   // commerçant + date d'achat
  ['2026-05-12', 2000, 'VIREMENT ACME SALAIRE', ''],
]);
assert.strictEqual(bpr.check, 0);
assert.deepStrictEqual(bpr.balance, { amount: 1782.8, date: '2026-06-05' });
console.log('OK — relevé Banque Populaire');

// Chèques : jamais appris (chacun a un objet différent) · Wero : distingué par destinataire
const ch1 = { label: 'CHEQUE', amount: -40 }, w1 = { label: 'VIR INST ENVOI WERO ZOE', amount: -74 }, w2 = { label: 'VIR INST ENVOI WERO PAUL', amount: -20 };
assert.strictEqual(C.learnable(ch1), false);
assert.notStrictEqual(C.ruleKey(w1), C.ruleKey(w2));
assert.strictEqual(cz('FLOWBIRD FR 69/LYON'), 'voiture');
assert.strictEqual(cz('PRLV SEPA Assur Animaux'), 'animaux');
assert.strictEqual(cz('DR MARTIN 69LYON'), 'sante');
assert.strictEqual(cz('PRLV SEPA DIRECTION GENE'), 'impots');
console.log('OK — enseignes des vrais relevés');

// Relevé manquant : la fin de janvier n'est pas le départ de mars → février manque
const mk = (from, open, to, close) => [[it(`du ${from} au ${to}`, 40, 800), it('COMPTE CHEQUES N° 77788899900', 40, 780), it('LIBELLE', 94, 760), it('MONTANT', 513, 760),
  it(`SOLDE CREDITEUR AU ${from}`, 94, 750), it(open, 516, 750), it(to.slice(0, 5), 51, 740), it('CB LIDL', 102, 740), it('- 10,00 €', 516, 740),
  it(`SOLDE CREDITEUR AU ${to}`, 94, 730), it(close, 516, 730)]];
const G = { accounts: {}, tx: [], rules: {} };
C.importParsed(G, C.parsePDF(mk('05/01/2026', '100,00', '05/02/2026', '90,00')));
C.importParsed(G, C.parsePDF(mk('05/03/2026', '80,00', '05/04/2026', '70,00')));
assert.deepStrictEqual(G.accounts['77788899900'].gaps, [{ from: '2026-02-05', to: '2026-03-05' }]);
C.importParsed(G, C.parsePDF(mk('05/02/2026', '90,00', '05/03/2026', '80,00'))); // le relevé manquant arrive
assert.deepStrictEqual(G.accounts['77788899900'].gaps, []);
assert.strictEqual(G.accounts['77788899900'].check.diff, 0);
console.log('OK — relevé manquant détecté');

// Compte joint : une prévoyance versée sur le joint n'est pas « un versement de l'un de vous »
const Jp = { accounts: { K: { owner: 'commun' } }, tx: [], rules: {}, payers: {} };
C.importParsed(Jp, [{ account: 'K', rows: [{ date: '2026-06-03', amount: 463.5, label: 'VIREMENT HUMANIS - SANTE P', detail: 'HUMANIS - SANTE PREVOYANCE' }, { date: '2026-06-04', amount: 300, label: 'VIR M PAUL DUPONT' }] }]);
assert.deepStrictEqual(C.jointSplit(Jp, '2026-06').unknown.map(t => t.amount), [300]);
console.log('OK — compte joint : seuls les vrais versements');

// Remboursement relié : médecin 60 €, CPAM rembourse 42 € → coût réel 18 €
const Rb = { accounts: {}, tx: [], rules: {} };
C.importParsed(Rb, [{ account: 'A', rows: [{ date: '2026-03-02', amount: -60, label: 'DR MARTIN' }, { date: '2026-03-09', amount: 42, label: 'CPAM LYON' }] }]);
const med = Rb.tx.find(t => t.amount === -60);
assert.strictEqual(med.refunded, 42);
assert.strictEqual(Rb.tx.find(t => t.amount === 42).refundOf, med.id);
assert.strictEqual(C.monthStats(Rb, '2026-03').by.sante, 18);

// Découpage : un ticket de 100 € réparti 70 alimentation / 30 maison
const Sp = { accounts: {}, tx: [], rules: {} };
C.importParsed(Sp, [{ account: 'A', rows: [{ date: '2026-03-02', amount: -100, label: 'CARREFOUR' }] }]);
Sp.tx[0].splits = [{ cat: 'courses', amount: -70 }, { cat: 'maison', amount: -30 }];
assert.deepStrictEqual(C.monthStats(Sp, '2026-03').by, { courses: 70, maison: 30 });

// Prévision : solde 300 € au 05/06, loyer 800 € le 10 de chaque mois, salaire 1 000 € le 28 → découvert prévu le 10
const Fc = { accounts: { A: { owner: 'p1', balance: { amount: 300, date: '2026-06-05' } } }, tx: [], rules: {} };
const fr = [];
for (const m of ['03', '04', '05']) fr.push({ date: `2026-${m}-10`, amount: -800, label: 'PRLV LOYER SCI' }, { date: `2026-${m}-28`, amount: 1000, label: 'VIR SALAIRE ACME' });
C.importParsed(Fc, [{ account: 'A', rows: fr }]);
Fc.accounts.A.balance = { amount: 300, date: '2026-06-05' };
const fo = C.forecast(Fc, 'A');
assert.deepStrictEqual(fo.items.map(i => [i.date, i.amount]), [['2026-06-10', -800], ['2026-06-28', 1000], ['2026-07-10', -800]]);
assert.deepStrictEqual([fo.dueTotal, fo.need, fo.short, fo.nextIn.date], [800, 500, '2026-06-10', '2026-06-28']); // 300 € ne couvrent pas le loyer avant le salaire
console.log('OK — remboursements, découpage, prévision');

// Deux prêts au même libellé : chacun reconnu comme prélèvement régulier
const Lp = { accounts: {}, tx: [], rules: {} };
const lr = [];
for (const m of ['03', '04', '05']) lr.push({ date: `2026-${m}-05`, amount: -90.7, label: 'ECHEANCE PRET' }, { date: `2026-${m}-10`, amount: -1150.45, label: 'ECHEANCE PRET' });
C.importParsed(Lp, [{ account: 'A', rows: lr }]);
assert.deepStrictEqual(C.recurring(Lp).map(r => [r.name, r.amount, r.day]), [['ECHEANCE PRET', 90.7, 5], ['ECHEANCE PRET', 1150.45, 10]]);
assert.strictEqual(C.upcoming(Lp, '2026-06').length, 2);
console.log('OK — deux prêts au même libellé');

// Rentrées irrégulières : 2 × 700 € ou 1 × 1 400 € selon les mois → 1 400 € attendus, moins ce qui est déjà arrivé
const Ir = { accounts: { K: { owner: 'commun' } }, tx: [], rules: {} };
C.importParsed(Ir, [{ account: 'K', rows: [
  { date: '2026-02-02', amount: 1400, label: 'VIR MME CLARA' }, { date: '2026-03-02', amount: 700, label: 'VIR MME CLARA' }, { date: '2026-03-09', amount: 700, label: 'VIR MME CLARA' },
  { date: '2026-04-02', amount: 700, label: 'VIR MME CLARA' }, { date: '2026-04-12', amount: 700, label: 'VIR MME CLARA' }, { date: '2026-05-04', amount: 1400, label: 'VIR MME CLARA' },
  { date: '2026-06-02', amount: 700, label: 'VIR MME CLARA' }] }]);
Ir.accounts.K.balance = { amount: 500, date: '2026-06-03' };
assert.deepStrictEqual(C.forecast(Ir, 'K').items.map(i => [i.date, i.amount]), [['2026-06-04', 700], ['2026-07-02', 1400]]);
console.log('OK — rentrées irrégulières prévues');

// Déjà à découvert au dernier relevé, sans prélèvement à venir : l'alerte le dit quand même
const Od = { accounts: { A: { owner: 'p2', balance: { amount: -132, date: '2026-03-05' } } }, tx: [], rules: {} };
C.importParsed(Od, [{ account: 'A', rows: [{ date: '2026-03-02', amount: -20, label: 'LIDL' }] }]);
Od.accounts.A.balance = { amount: -132, date: '2026-03-05' };
assert.strictEqual(C.forecast(Od, 'A').need, 132);
console.log('OK — découvert déjà présent signalé');

// Saisie du jour puis relevé : la saisie est remplacée par la vraie opération, la famille est gardée, pas de doublon
const Q = { accounts: { A: { owner: 'p1' } }, tx: [], rules: {} };
assert.strictEqual(C.addPending(Q, { acc: 'A', date: '2026-10-03', amount: -12.5, label: 'Boulangerie', cat: 'restos' }), true);
assert.strictEqual(C.monthStats(Q, '2026-10').spent, 12.5); // compté tout de suite
C.importParsed(Q, [{ account: 'A', rows: [{ date: '2026-10-05', amount: -12.5, label: 'CB MAISON PAIN 69LYON' }, { date: '2026-10-05', amount: -30, label: 'CB AUTRE' }] }]);
assert.strictEqual(Q.tx.length, 2);
assert.strictEqual(Q.tx.find(t => t.amount === -12.5).cat, 'restos');
assert.strictEqual(Q.tx.some(t => t.pending), false);
assert.strictEqual(C.addPending(Q, { acc: 'A', date: '2026-10-03', amount: -12.5, label: 'Boulangerie' }), false); // réimport du journal : ignoré

// Journal Apple Pay (automatisation Raccourcis)
const jr = '2026-10-03;12,50 €;Carrefour City\n03/10/2026;4,20;Paul\n2026-10-04;+20,00 €;Remboursement Vinted';
assert.ok(C.isJournal(jr));
assert.deepStrictEqual(C.parseJournal(jr).map(r => [r.date, r.amount, r.label]),
  [['2026-10-03', -12.5, 'Carrefour City'], ['2026-10-03', -4.2, 'Paul'], ['2026-10-04', 20, 'Remboursement Vinted']]);
assert.strictEqual(C.isJournal('Date;Libelle;Montant\n03/10/2026;X;-1,00'), false);
console.log('OK — saisies du jour, rapprochement, journal Apple Pay');

// Notifications Android recopiées (MacroDroid) : texte libre
const nf = '2026-10-03;Paiement de 12,50 € chez CARREFOUR CITY le 03/10\n03/10/2026;Vous avez payé 4,20 € à Boulangerie Paul\n2026-10-04;Remboursement de 20,00 € reçu de VINTED';
assert.ok(C.isJournal(nf));
assert.deepStrictEqual(C.parseJournal(nf).map(r => [r.date, r.amount, r.label]),
  [['2026-10-03', -12.5, 'CARREFOUR CITY'], ['2026-10-03', -4.2, 'Boulangerie Paul'], ['2026-10-04', 20, 'VINTED']]);
console.log('OK — notifications Android en texte libre');

// Prévus automatiques : loyer, abonnement et salaire inscrits le jour J, puis remplacés par le relevé
const Au = { accounts: { A: { owner: 'p1' } }, tx: [], rules: {} };
const au = [];
for (const m of ['06', '07', '08']) au.push({ date: `2026-${m}-02`, amount: -800, label: 'PRLV LOYER SCI' }, { date: `2026-${m}-12`, amount: -142.6, label: 'PRLV EDF CLIENTS' },
  { date: `2026-${m}-12`, amount: -9.99, label: 'PRLV NETFLIX' }, { date: `2026-${m}-28`, amount: 2400, label: 'VIR SALAIRE ACME' });
C.importParsed(Au, [{ account: 'A', rows: au }]);
assert.strictEqual(C.autoRecurring(Au, '2026-09-15'), 3); // loyer 02/09, EDF et Netflix 12/09 (salaire le 28 : pas encore)
assert.strictEqual(C.autoRecurring(Au, '2026-09-15'), 0); // rien en double
assert.strictEqual(Math.round(C.monthStats(Au, '2026-09').spent), 953);
// le relevé arrive : EDF a un peu changé (152 €), Netflix a été résilié
C.importParsed(Au, [{ account: 'A', rows: [{ date: '2026-09-02', amount: -800, label: 'PRLV LOYER SCI' }, { date: '2026-09-13', amount: -152.3, label: 'PRLV EDF CLIENTS' },
  { date: '2026-09-20', amount: -3, label: 'CB CAFE' }] }]);
assert.deepStrictEqual(Au.tx.filter(t => t.pending).map(t => t.label), ['NETFLIX']); // encore « prévu » : le relevé ne va pas assez loin pour conclure
assert.strictEqual(Au.tx.filter(t => /EDF/.test(t.label) && t.date.startsWith('2026-09')).length, 1); // remplacé, pas de doublon
C.importParsed(Au, [{ account: 'A', rows: [{ date: '2026-09-28', amount: 2400, label: 'VIR SALAIRE ACME' }, { date: '2026-10-02', amount: -800, label: 'PRLV LOYER SCI' }] }]);
assert.deepStrictEqual(Au.tx.filter(t => t.pending).map(t => t.label), []); // Netflix n'a pas eu lieu : retiré tout seul
console.log('OK — prélèvements et rentrées prévus automatiquement');

// Prévus : les rentrées irrégulières (2 × 700 ou 1 × 1 400) sont prévues au total du mois, sinon le solde plonge
const Pv = { accounts: { K: { owner: 'commun' } }, tx: [], rules: {} };
const pv = [];
for (const m of ['03', '04', '05', '06']) pv.push({ date: `2026-${m}-10`, amount: -1150.45, label: 'ECHEANCE PRET' },
  ...(m === '04' ? [{ date: `2026-${m}-02`, amount: 1400, label: 'VIR MME CLARA' }] : [{ date: `2026-${m}-02`, amount: 700, label: 'VIR MME CLARA' }, { date: `2026-${m}-09`, amount: 700, label: 'VIR MME CLARA' }]));
C.importParsed(Pv, [{ account: 'K', rows: pv }]);
C.autoRecurring(Pv, '2026-08-15');
assert.deepStrictEqual(Pv.tx.filter(t => t.auto).map(t => [t.date, t.amount]).sort(), [['2026-08-02', 1400], ['2026-08-10', -1150.45]]); // mois en cours seulement
Pv.accounts.K.balance = { amount: 500, date: '2026-06-30' };
assert.strictEqual(C.balanceOf(Pv, 'K'), 500); // les prévus ne changent pas le solde
console.log('OK — prévus équilibrés (rentrées au total du mois)');

// Pas de faux chiffres : un mois à moitié importé n'est jamais une habitude
{
  const P = { accounts: {}, tx: [], rules: {} }, rows = [];
  for (const m of ['01', '02', '03', '04']) rows.push({ date: `2026-${m}-01`, amount: -300, label: 'CARREFOUR' }, { date: `2026-${m}-20`, amount: -100, label: 'CARREFOUR' });
  rows.push({ date: '2026-05-03', amount: -40, label: 'CARREFOUR' }); // relevé de mai arrêté au 3
  C.importParsed(P, [{ account: 'A', rows }]);
  assert.strictEqual(C.fullMonth(P, '2026-01'), true);
  assert.strictEqual(C.fullMonth(P, '2026-05'), false);       // à moitié
  assert.deepStrictEqual(C.lastFull(P, '2026-07'), ['2026-04', '2026-03', '2026-02']); // juin et mai sautés
  assert.strictEqual(Math.round(C.habitBy(P, '2026-07').courses), 400); // et non (400+400+40)/3
  // Un 2e compte pas importé depuis mars rend avril incomplet pour le foyer (ses dépenses manquent)
  C.importParsed(P, [{ account: 'B', rows: [{ date: '2025-12-30', amount: -5, label: 'BOULANGERIE' }, { date: '2026-03-31', amount: -20, label: 'BOULANGERIE' }] }]);
  assert.strictEqual(C.fullMonth(P, '2026-04'), false);
  assert.strictEqual(C.fullMonth(P, '2026-04', ['A']), true);
  P.accounts.A.gaps = [{ from: '2026-02-04', to: '2026-03-05' }]; // un relevé manque
  assert.deepStrictEqual(['2026-01', '2026-02', '2026-03'].map(m => C.fullMonth(P, m, ['A'])), [true, false, false]);
  delete P.accounts.A.gaps;
  // Calendrier : après le dernier relevé, un jour n'est « sans dépense » que s'il est déclaré
  const g = C.dayGrid(P, '2026-05', ['A']);
  assert.strictEqual(g[1].state, 'free');      // 2 mai, couvert par le relevé
  assert.strictEqual(g[9].state, 'unknown');   // 10 mai : on ne sait pas
  assert.strictEqual(C.dayGrid(P, '2026-05', ['A'], { '2026-05-10': 1 })[9].state, 'free'); // « rien dépensé » déclaré
}
console.log('OK — pas de faux chiffres (mois incomplets écartés)');

// Rituels : série de jours et rappels agenda
assert.strictEqual(C.streak({ '2026-10-01': 1, '2026-10-02': 1 }, '2026-10-03'), 2);   // pas encore fait aujourd'hui : la série tient
assert.strictEqual(C.streak({ '2026-10-01': 1, '2026-10-02': 1, '2026-10-03': 1 }, '2026-10-03'), 3);
assert.strictEqual(C.streak({ '2026-10-01': 1 }, '2026-10-03'), 0);                     // un jour manqué : on repart
{
  const ics = C.ritualsIcs({ day: '20:30', week: '18:00', month: '' }, 'https://x.io/', '2026-10-03');
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('DTSTART:20261003T203000\r\nDURATION:PT5M\r\nRRULE:FREQ=DAILY'));
  assert.ok(ics.includes('DTSTART:20261004T180000\r\nDURATION:PT5M\r\nRRULE:FREQ=WEEKLY;BYDAY=SU'));        // premier rappel un dimanche
  const g = C.googleCalLinks({ day: '20:30', week: '', month: '19:00' }, 'https://x.io/', '2026-10-03');
  assert.deepStrictEqual(g.map(x => x.k), ['day', 'month']);
  const q = new URL(g[1].href).searchParams;
  assert.deepStrictEqual([q.get('dates'), q.get('recur'), q.get('ctz')], ['20261006T190000/20261006T190500', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=6', 'Europe/Paris']); // le 6, à 19 h
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=SU') && ics.includes('BEGIN:VALARM') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\\],/.test(ics.split('SUMMARY:')[1].split('\r\n')[0]));                 // virgules échappées
}
// Fusion : les séries des deux téléphones se retrouvent
assert.deepStrictEqual(C.mergeStates({ accounts: {}, tx: [], rules: {}, checkins: { p1: { '2026-10-01': 1 } } }, { accounts: {}, tx: [], checkins: { p2: { '2026-10-02': 1 } } }).checkins,
  { p1: { '2026-10-01': 1 }, p2: { '2026-10-02': 1 } });
console.log('OK — rituels (série, rappels agenda, fusion)');

// Accueil : « dépensé depuis le 1er » comparé à la même date, seulement si le relevé couvre ces jours
{
  const P = { accounts: {}, tx: [], rules: {} }, rows = [];
  for (const m of ['05', '06', '07', '08']) rows.push({ date: `2026-${m}-01`, amount: -100, label: 'CARREFOUR' }, { date: `2026-${m}-08`, amount: -50, label: 'CARREFOUR' }, { date: `2026-${m}-20`, amount: -300, label: 'CARREFOUR' });
  rows.push({ date: '2026-09-02', amount: -60, label: 'CARREFOUR' }, { date: '2026-09-09', amount: -20, label: 'CARREFOUR' });
  C.importParsed(P, [{ account: 'A', rows }]);
  P.accounts.A.balance = { amount: 0, date: '2026-09-09' };
  { const pc = C.paceCompare(P, '2026-09'); assert.deepStrictEqual([pc.day, pc.spent, pc.usual, pc.months, Math.round(pc.by.courses), pc.usualBy.courses], [9, 80, 150, 3, 80, 150]); } // les 20 du mois d'avant ne comptent pas
  C.addPending(P, { acc: 'A', date: '2026-09-15', amount: -10, label: 'BOULANGERIE' });
  assert.strictEqual(C.paceCompare(P, '2026-09').day, 9);           // une saisie ne prolonge pas la couverture
  assert.strictEqual(C.paceCompare(P, '2026-10'), null);            // rien de réel ce mois-là : pas de comparaison
}
// Synchro par lien : aller-retour fidèle
(async () => {
  const st = { accounts: { A: { name: 'Compte' } }, tx: [{ id: 'x', acc: 'A', date: '2026-01-01', amount: -5, label: 'É€ç' }], rules: {} };
  const code = await C.syncEncode(st, 'p1');
  assert.ok(/^[A-Za-z0-9_-]+$/.test(code));
  const back = await C.syncDecode('https://x.io/mes-comptes/#sync=' + code);
  assert.deepStrictEqual([back.from, back.state], ['p1', st]);
  assert.strictEqual(await C.syncDecode('bonjour'), null);
  console.log('OK — accueil (même date) et synchro par lien');
})();

// Garde-fou : un lien ou une sauvegarde piégés ne peuvent rien injecter ni faire planter
{
  const evil = '"><img src=x onerror=alert(1)>';
  const bad = C.sanitizeState({
    people: [{ id: 'p1', name: 'Hugo' }, { id: 'p2" onclick="x', name: evil }],
    accounts: { A: { name: evil, owner: 'p1', balance: { amount: '12', date: '2026-01-31' } }, [evil]: { name: 'x' } },
    tx: [{ id: 'a', acc: 'A', date: '2026-01-02', amount: '-5', label: evil, cat: evil, splits: [{ cat: evil, amount: 'abc' }] },
      { id: 'b', acc: evil, date: '2026-01-02', amount: 1 }, { id: 'c', acc: 'A', date: 'demain', amount: 1 }, null, 42],
    pots: [{ id: evil, name: 'Japon', target: 'beaucoup', moves: [{ date: '2026-01-01', amount: '10' }, { date: '<b>' }] }],
    budgets: { p1: { [evil]: 5, courses: '200' }, [evil]: {} },
    levers: { cat: { courses: evil }, merchant: { '(((': 'passer', carrefour: 'nego' } },
    rules: { X: evil }, checkins: { p1: { '2026-01-01': 1, [evil]: 1 } }, lastSync: evil,
  });
  assert.deepStrictEqual(Object.keys(bad.accounts), ['A']);                              // compte au nom de code : écarté
  assert.deepStrictEqual(bad.tx.map(t => [t.id, t.amount, t.cat, t.splits[0].cat, t.splits[0].amount]), [['a', -5, 'autres', 'autres', 0]]);
  assert.strictEqual(bad.tx[0].label, evil);                                              // le texte est gardé (il est échappé à l'affichage)
  assert.ok(/^x/.test(bad.pots[0].id) && bad.pots[0].target === 1 && bad.pots[0].moves.length === 1 && bad.pots[0].moves[0].amount === 10);
  assert.deepStrictEqual(bad.budgets, { p1: { courses: 200 } });
  assert.deepStrictEqual(bad.levers, { cat: { courses: 'essentiel' }, merchant: { carrefour: 'nego' } }); // « ((( » ferait planter une expression régulière
  assert.deepStrictEqual([bad.people.length, bad.rules.X, Object.keys(bad.checkins.p1), bad.lastSync], [1, 'autres', ['2026-01-01'], undefined]);
  assert.deepStrictEqual(C.sanitizeState('n\'importe quoi').tx, []);
  // fiche de compte abîmée : l'opération est gardée, la fiche recréée
  const lost = C.sanitizeState({ accounts: { B: null }, tx: [{ id: 'k', acc: 'B', date: '2026-01-05', amount: -3, label: 'X' }] });
  assert.deepStrictEqual([lost.tx.length, lost.accounts.B.name], [1, 'Compte ••B']);                       // pas un objet : état vide, pas d'erreur
  // et une vraie sauvegarde ressort identique
  const good = C.sanitizeState(JSON.parse(JSON.stringify(F)));
  assert.deepStrictEqual(good.tx.map(t => [t.id, t.amount, t.cat]), F.tx.map(t => [t.id, t.amount, t.cat]));
}
console.log('OK — garde-fou des données entrantes');

// Chemins de l'app : chaque bouton mène à une action qui existe, chaque formulaire est traité, chaque onglet existe
{
  const html = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
  const block = html.slice(html.indexOf('const A = {'), html.indexOf('\n};', html.indexOf('const A = {')));
  const actions = new Set([...block.matchAll(/^ {2}(\w+):/gm)].map(m => m[1]));
  const used = new Set([...html.matchAll(/data-a="(\w+)"/g)].map(m => m[1]));
  for (const m of html.matchAll(/data-a="\$\{([^}]*)\}"/g)) for (const q of m[1].matchAll(/[?:]\s*'(\w+)'/g)) used.add(q[1]);
  const missing = [...used].filter(a => !actions.has(a));
  assert.deepStrictEqual(missing, [], 'boutons sans action : ' + missing);
  const forms = [...html.matchAll(/data-f="(\w+)"/g)].map(m => m[1]).filter(f => !html.includes(`dataset.f === '${f}'`));
  assert.deepStrictEqual(forms, [], 'formulaires non traités : ' + forms);
  const tabs = new Set(['home', 'ops', 'save', 'accounts', 'trends', 'set']), badTabs = [...html.matchAll(/data-t="(\w+)"/g)].map(m => m[1]).filter(t => !tabs.has(t));
  assert.deepStrictEqual(badTabs, [], 'onglets inconnus : ' + badTabs);
  assert.ok(!/\b(confirm|prompt|alert)\(/.test(html.replace(/onerror=alert\(1\)/g, '')), 'plus de fenêtre du navigateur');
  console.log(`OK — ${used.size} boutons reliés à ${actions.size} actions, ${new Set([...html.matchAll(/data-f="(\w+)"/g)].map(m => m[1])).size} formulaires`);
}

// Le libellé prime sur le détail : l'assurance n'est pas une taxe parce que le détail dit « Cotisation »
assert.strictEqual(C.classify({ label: 'PRLV SEPA MATMUT ASSURANCE', detail: 'Cotisation Assurance 123456789', amount: -154.2 }).cat, 'assurances');
assert.strictEqual(C.classify({ label: 'F Cotis Pack Confort', detail: 'CONTRAT CNV0000000000', amount: -21.9 }).cat, 'impots');
assert.strictEqual(C.classify({ label: 'GRAND FRAIS 69BRON', detail: '', amount: -64.15 }).cat, 'courses');
console.log('OK — le libellé prime sur le détail');

// Conseils tirés des faits
{
  const P = { accounts: {}, tx: [], rules: {} }, rows = [];
  for (const m of ['05', '06', '07', '08', '09']) rows.push({ date: `2026-${m}-04`, amount: -21.9, label: 'F Cotis Pack Confort' }, { date: `2026-${m}-03`, amount: -64.15, label: 'GRAND FRAIS 69BRON' },
    { date: `2026-${m}-05`, amount: -13.49, label: 'PRLV NETFLIX' }, { date: `2026-${m}-08`, amount: -10.99, label: 'PRLV SPOTIFY' }, { date: `2026-${m}-12`, amount: -9.99, label: 'PRLV DISNEY PLUS' },
    { date: `2026-${m}-28`, amount: 2000, label: 'VIR SALAIRE ACME' }, { date: `2026-${m}-02`, amount: -1900, label: 'VIR LOYER' });
  rows.push({ date: '2026-09-29', amount: -0.27, label: 'F AGIOS DE COMPTE' });
  C.importParsed(P, [{ account: 'A', rows }]);
  P.accounts.A.balance = { amount: 4400, date: '2026-09-30' }; // jamais sous ~2 400 € en 3 mois
  const ins = C.insights(P), by = Object.fromEntries(ins.map(i => [i.kind, i]));
  assert.deepStrictEqual([by.fees.total, by.fees.top, by.fees.n], [109.77, 'F Cotis Pack Confort', 6]);     // Grand Frais (magasin) exclu
  assert.strictEqual(by.subs.n, 3);
  assert.ok(!by.overdraft && by.idle && by.idle.min === 2400 && by.idle.move === 1900);
  // Un compte qui ne fait que recevoir et renvoyer des virements sert d'épargne : pas de « argent qui dort »
  const Q = { accounts: {}, tx: [], rules: {} };
  C.importParsed(Q, [{ account: 'E', rows: ['05', '06', '07', '08', '09'].map(m => ({ date: `2026-${m}-10`, amount: 1000, label: 'VIREMENT MME X' })) }]);
  Q.accounts.E.balance = { amount: 8000, date: '2026-09-30' };
  assert.ok(!C.insights(Q).some(i => i.kind === 'idle'));
  // Un découvert apparaît dès que le solde passe sous zéro
  C.importParsed(P, [{ account: 'A', rows: [{ date: '2026-09-15', amount: -2500, label: 'CB GARAGE' }] }]);
  P.accounts.A.balance = { amount: -100, date: '2026-09-30' };
  const od = C.insights(P).find(i => i.kind === 'overdraft');
  assert.ok(od && od.days > 0 && od.min < 0 && !C.insights(P).some(i => i.kind === 'idle'));
  // Solde jour par jour cohérent avec le solde connu
  const ser = C.dailyBalances(P, 'A', '2026-09-01', '2026-09-30');
  assert.strictEqual(ser[ser.length - 1][1], -100);
}
console.log('OK — conseils (frais, découvert, argent qui dort, abonnements)');

// Jeu de référence : libellés au format exact de la Banque Populaire (noms, lieux et numéros fictifs) → famille attendue
{
  const T = (label, amount, detail = '') => C.classify({ label, amount, detail }).cat;
  const cases = [
    ['RELAIS DES ALPSFR GRENOBLE', -22, 'voiture'],            // « S·FR » n'est pas l'opérateur SFR
    ['SNCF-VOYAGEURS DONT FRAIS: 0,00E', 24, 'transport'],     // remboursement de billet, pas des frais
    ['DAC AUCHAN CARB69LYON', -48, 'voiture'],        // pompe à essence Auchan
    ['STATION HYPER U44NANTES', -45, 'voiture'],
    ['INTERMARCHE ESS21DIJON', -50, 'voiture'],
    ['GRAND OPTICAL GFR LILLE', -204, 'sante'],
    ['PHCIE CENTRALE FR LYON', -32, 'sante'],
    ['BOULANGERIE DU FR NANTES', -29, 'courses'],
    ['MARIE BLACHERE 13MARSEILLE', -12, 'courses'],
    ['MONOP DAILY FR 11111111 CB', -9, 'fastfood'],
    ['CHAUSSEA FR LILLEMAG100', -69, 'shopping'],
    ['MARC ORIAN FR 69M010 MO 12', -81, 'shopping'],
    ['AUTOVISION CT FR VILLEURBANNE', -68, 'voiture'],
    ['STATIONNEMT VADFR 69/LYON', -3, 'voiture'],
    ['AERO PKG SUD 31BLAGNAC', -58, 'voiture'],
    ['TISSEO FR TOULOUSE', -3, 'transport'],
    ['SUMUP *TAXI SOL MALAGA', -34, 'transport'],
    ['CHEZ MARCEL FR LYON', -31, 'restos'],
    ['BAR PINTXOS FR BAYONNE', -72, 'restos'],
    ['AREAS AIRE NORD21BEAUNE', -82, 'restos'],
    ['BILLETTERIE WEBFR PARIS', -80, 'loisirs'],
    ['FEVER* EVENTOSES MADRID', -173, 'loisirs'],
    ['CENTRE AQUATIQU69LYON', -13, 'sport'],
    ['SMYTHS TOYS FR PARIS', -30, 'enfants'],
    ['SUNNYGUEST SL ES MALAGA', -72, 'vacances'],
    ['LE CHATEAU DE PAU', -20, 'autres', 'RETRAIT DU 01012026'],                 // un retrait, pas un château
    ['PRLV SEPA MATMUT ASSURANCE', -161, 'assurances', 'Cotisation Assurance'],
    ['VIR INST ENVOI WERO ZOE', -100, 'cadeaux', 'a1b2c3d4 · evjf lea'],
    ['VIR INST ENVOI WERO NOAH', -76, 'voiture', 'b2c3d4e5 · loc voiture we'],
    ['VIR INST WERO MR MOREAU', 110, 'vacances', 'c3d4e5f6 · AIRBNB LISBONNE'],      // un ami rembourse sa part : moins de vacances, pas un revenu
    ['VIR INST WERO DUPONT EM', 20, 'loisirs', 'd4e5f6a7 · places concert'],
    ['VIREMENT HUMANIS - SANTE P XXXXXXX', 80, 'sante'],
    ['VIREMENT C.P.A.M. LYON', 25, 'sante'],
    ['VIREMENT ALMERYS (FRANCE)', 30, 'sante', 'REGLEMENT ALMERYS 00000000000'],
    ['CB****2222 ZYKORA', 173, 'autres'],                                     // achat remboursé par carte : pas un revenu
    ['VIR M PAUL DURAND', -40, 'autres'],                                      // une personne, pas la boulangerie Paul
    ['CHEQUE', -40, 'autres'],
    ['CABINET OSTEOPATHE 69LYON', -60, 'sante'], ['PSYCHOTHERAPIE FR LYON', -55, 'sante'], ['MEGA CGR FR LILLE', -19, 'loisirs'],
  ];
  const bad = cases.filter(([l, a, want, d]) => T(l, a, d) !== want).map(([l, a, want, d]) => `${l} → ${T(l, a, d)} (attendu ${want})`);
  assert.deepStrictEqual(bad, []);
  // une enseigne = une clé : les 4 libellés d'Auchan se rangent d'un seul geste ; deux personnes restent distinctes
  assert.strictEqual(new Set(['AUCHAN LYON SUD69LYON', 'AUCHAN.FR 59ROUBAIX', 'AUCHAN 0001 SC 69LYON', 'AUCHAN DRIVE 69LYON'].map(l => C.merchantKey(l))).size, 1);
  assert.notStrictEqual(C.ruleKey({ label: 'VIR Dupont Lucas', amount: -5 }), C.ruleKey({ label: 'VIR Dupont Marie Claire', amount: -5 }));
  assert.notStrictEqual(C.merchantKey('GRAND FRAIS 69BRON'), C.merchantKey('GRAND OPTICAL GFR LILLE'));
  // une correction faite avec l'ancienne clé est toujours retrouvée
  assert.strictEqual(C.classify({ label: 'ZENKO DRIVE 69LYON', amount: -26 }, { [C.legacyKey({ label: 'ZENKO DRIVE 69LYON', amount: -26 })]: 'courses' }).cat, 'courses');
  // virements entre vous deux : jamais un revenu, même tronqués par la banque
  const H = { people: [{ id: 'p1', name: 'Paul' }, { id: 'p2', name: 'Claire' }], accounts: { A: {} }, tx: [
    { id: 1, acc: 'A', date: '2026-01-02', amount: 900, label: 'VIREMENT M PAUL DURAND' }, { id: 2, acc: 'A', date: '2026-01-03', amount: 300, label: 'VIREMENT MME DURAND CLAI' },
    { id: 3, acc: 'A', date: '2026-01-04', amount: -35, label: 'VIR INST ENVOI WERO PAU' }], rules: {} };
  C.recompute(H);
  assert.deepStrictEqual(H.tx.map(t => [t.cat, !!t.hh]), [['interne', true], ['interne', true], ['autres', false]]); // « PAU » sans « M/MME » : peut-être une Pauline
  assert.strictEqual(C.monthStats(H, '2026-01', 'all').income, 1200); // l'autre compte n'est pas importé : l'argent arrive bien dans le foyer
}
console.log('OK — jeu de référence du classement (format des vrais relevés)');

// En voyage : un commerce inconnu au milieu d'un séjour loin de chez soi → Vacances ; un achat isolé reste à ranger
{
  const V = { accounts: {}, tx: [], rules: {} }, rows = [];
  for (let m = 1; m <= 9; m++) for (const d of ['03', '10', '17', '24']) rows.push({ date: `2026-0${m}-${d}`, amount: -30, label: 'AUCHAN LYON SUD69LYON' }, { date: `2026-0${m}-${d}`, amount: -12, label: 'BOULANGERIE ROSFR LYON' });
  rows.push({ date: '2026-08-06', amount: -40, label: 'TIENDA LA PLAZAES MALAGA' }, { date: '2026-08-07', amount: -60, label: 'CASA PACO ES MALAGA' },
    { date: '2026-08-08', amount: -35, label: 'LA OLA AZUL ES MALAGA' }, { date: '2026-05-12', amount: -45, label: 'ZENKO 69LYON' });
  C.importParsed(V, [{ account: 'A', rows }]);
  const c = l => V.tx.find(t => t.label === l);
  assert.deepStrictEqual(['CASA PACO ES MALAGA', 'LA OLA AZUL ES MALAGA'].map(l => c(l).cat), ['vacances', 'vacances']);
  assert.deepStrictEqual([c('ZENKO 69LYON').cat, c('ZENKO 69LYON').conf], ['autres', 'guess']);
}
console.log('OK — dépenses de voyage');

// Export « Télécharger les opérations » de la Banque Populaire : ancien et nouveau format, et pas de doublon avec le relevé PDF
{
  const old = 'Compte;Date de comptabilisation;Date opération;Libellé;Référence;Date valeur;Montant\n'
    + '55566677788;26/05/2021;;250521 CB****3333 RELAIS DU LAC BLEU 74ANNECY;AAAAAAA;26/05/2021;-81,4\n'
    + '55566677788;26/05/2021;;CHEQUE 0000000000000000000000;;26/05/2021;-600\n'
    + '12345678901;27/05/2021;27/05/2021;PRLV SEPA NETFLIX;;27/05/2021;-13,49\n';
  const p = C.parseCSV(old, 'operations.csv');
  assert.deepStrictEqual(p.map(x => x.account), ['55566677788', '12345678901']);              // deux comptes dans un fichier
  assert.deepStrictEqual(p[0].rows.map(r => [r.date, r.amount, r.label, r.detail]), [
    ['2021-05-25', -81.4, 'RELAIS DU LAC BLEU 74ANNECY', 'Carte ••3333'],                     // date d'achat, comme le PDF
    ['2021-05-26', -600, 'CHEQUE 0000000000000000000000', '']]);
  assert.strictEqual(C.classify({ label: p[0].rows[0].label, amount: -81.4 }).cat, 'voiture'); // relais = station-service
  const nouveau = 'Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage\n'
    + '03/10/2026;CARREFOUR MARKET;021026 CB****1111 CARREFOUR MARKET 69LYON;;;Carte bancaire;Vie quotidienne;Alimentation - Supermarché;-54,20;;02/10/2026;03/10/2026;0\n'
    + '02/10/2026;VIR SALAIRE ACME;VIR SEPA SALAIRE ACME;;;Virement;Revenus;Salaires;;2450,00;02/10/2026;02/10/2026;0\n';
  const q = C.parseCSV(nouveau, 'releve_98765432100.csv')[0];
  assert.strictEqual(q.account, '98765432100');
  assert.deepStrictEqual(q.rows.map(r => [r.date, r.amount, r.label]), [['2026-10-02', -54.2, 'CARREFOUR MARKET'], ['2026-10-02', 2450, 'VIR SALAIRE ACME']]);
  // CSV de la semaine, puis relevé PDF du mois : les mêmes opérations ne sont pas comptées deux fois
  const D = { accounts: {}, tx: [], rules: {} };
  C.importParsed(D, C.parseCSV(old, 'operations.csv'));
  const r2 = C.importParsed(D, [{ account: '55566677788', rows: [{ date: '2021-05-25', amount: -81.4, label: 'RELAIS DU LAC BLEU 74ANNECY' }, { date: '2021-05-28', amount: -20, label: 'BOULANGERIE' }] }]);
  assert.deepStrictEqual([r2.added, r2.dup], [1, 1]);
}
console.log('OK — export CSV Banque Populaire (ancien et nouveau format, sans doublon avec le PDF)');

// Notifications Android (service worker) : le bon message au bon moment, jamais deux fois le même jour
(async () => {
  const vm = require('vm'), src = require('fs').readFileSync(__dirname + '/sw.js', 'utf8');
  const run = async (when, etat, seen = null) => {
    const store = new Map([['etat.json', JSON.stringify(etat)], ...(seen ? [['vu.json', JSON.stringify(seen)]] : [])]), shown = [], handlers = {};
    const RealDate = Date, fixed = new RealDate(when);
    class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed.getTime(); } }
    const ctx = { Date: FakeDate, JSON, Promise, Response: class { constructor(b) { this.b = b; } async json() { return JSON.parse(this.b); } },
      caches: { open: async () => ({ match: async k => (store.has(k) ? new ctx.Response(store.get(k)) : undefined), put: async (k, r) => store.set(k, r.b) }), keys: async () => [] },
      clients: {}, URL, fetch: () => {} };
    ctx.self = { addEventListener: (t, f) => (handlers[t] = f), registration: { showNotification: async (t, o) => shown.push(t + ' | ' + o.body) }, location: { origin: 'x' }, skipWaiting() {} };
    vm.runInNewContext(src, ctx);
    let p; handlers.periodicsync({ tag: 'rituel', waitUntil: x => (p = x) }); await p;
    return { shown, seen: store.has('vu.json') ? JSON.parse(store.get('vu.json')) : {} };
  };
  const base = { lastCheck: '2026-10-07', streak: 6, week: '2026-10-05', month: '2026-10', prev: 'septembre 2026', wx: '☀️ Ça roule', todo: 0 }; // wx : ancien champ, ne doit plus jamais s'afficher
  let r = await run('2026-10-08T20:00:00', base);                                   // jeudi soir, journée pas notée
  assert.ok(r.shown.length === 1 && /Ma journée/.test(r.shown[0]) && /6 jours d'affilée/.test(r.shown[0]));
  r = await run('2026-10-08T21:30:00', base, r.seen);                               // une heure plus tard : pas de doublon
  assert.strictEqual(r.shown.length, 0);
  r = await run('2026-10-08T15:00:00', base);                                       // l'après-midi : on ne dérange pas
  assert.strictEqual(r.shown.length, 0);
  r = await run('2026-10-08T20:00:00', { ...base, lastCheck: '2026-10-08' });       // déjà notée : rien
  assert.strictEqual(r.shown.length, 0);
  r = await run('2026-10-11T18:00:00', { ...base, lastCheck: '2026-10-11', week: '2026-09-28' }); // dimanche 18 h, semaine pas vue
  assert.ok(r.shown.length === 1 && /Notre semaine/.test(r.shown[0]) && !/Ça roule/.test(r.shown[0])); // rien de financier sur l'écran verrouillé
  r = await run('2026-11-06T10:00:00', { ...base, lastCheck: '2026-11-06' });       // le 6 novembre, rendez-vous d'octobre pas fait
  assert.ok(r.shown.length === 1 && /rendez-vous du mois/.test(r.shown[0]) && /septembre 2026/.test(r.shown[0]));
  console.log('OK — notifications Android (soir, dimanche, le 5 ; sans doublon)');
})();

// Le fichier de rappels publié avec l'app (ouvert par Safari sur iPhone) est exactement celui que l'app fabrique
assert.strictEqual(require('fs').readFileSync(__dirname + '/rappels.ics', 'utf8'),
  C.ritualsIcs({ day: '20:30', week: '18:00', month: '19:00' }, 'https://julienchesneau1-arch.github.io/mes-comptes/', '2026-10-01'));
console.log('OK — fichier de rappels publié');

// Chiffrement de ce qui quitte le téléphone : lien de synchro et sauvegarde illisibles sans le code du foyer
(async () => {
  const st = { accounts: { A: { name: 'Compte' } }, tx: [{ id: 'x', acc: 'A', date: '2026-01-01', amount: -5, label: 'Boulangerie' }], rules: {} };
  const code = C.newCode();
  assert.ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) && !/[01OI]/.test(code));
  const link = 'https://x.io/#sync=' + await C.syncEncode(st, 'p1', code);
  assert.ok(/#sync=e1\./.test(link) && !/Boulangerie/.test(link));
  assert.deepStrictEqual((await C.syncDecode(link, code.toLowerCase().replace(/-/g, ' '))).state, st);   // code tapé en minuscules, sans tirets : accepté
  await assert.rejects(C.syncDecode(link, 'AAAA-BBBB-CCCC'), e => e.needCode);                           // mauvais code : refusé
  await assert.rejects(C.syncDecode(link), e => e.needCode);                                              // pas de code : on le demande
  assert.deepStrictEqual((await C.syncDecode('#sync=' + await C.syncEncode(st, 'p1'))).state, st);         // ancien lien en clair : toujours lisible
  const file = await C.sealBackup(st, code);
  assert.ok(!/Boulangerie|Compte/.test(file));
  assert.deepStrictEqual(await C.openBackup(file, code), st);
  await assert.rejects(C.openBackup(file, 'AAAA-BBBB-CCCC'), e => e.needCode);
  assert.deepStrictEqual(await C.openBackup(JSON.stringify(st)), st);                                     // ancienne sauvegarde en clair
  assert.strictEqual(C.sanitizeState({ code: code.toLowerCase() }).code, code);
  console.log('OK — chiffrement des liens et des sauvegardes (code du foyer)');
})();

// Coffre du téléphone : données illisibles sans le code d'entrée ; codes trop faciles refusés
(async () => {
  assert.deepStrictEqual(['123456', '000000', '987654', '12345', 'abcdef', '274913', '58210496'].map(C.goodPin), [false, false, false, false, false, true, true]);
  const salt = C.newSalt(), key = await C.vaultKey('274913', salt, 1000), data = JSON.stringify({ tx: [{ label: 'CARREFOUR', amount: -54.2 }] });
  const box = await C.vaultSeal(data, key);
  assert.ok(!/CARREFOUR|54/.test(box));
  assert.strictEqual(await C.vaultOpen(box, await C.vaultKey('274913', salt, 1000)), data);
  await assert.rejects(C.vaultOpen(box, await C.vaultKey('274914', salt, 1000)), e => e.badCode);       // un chiffre faux : refusé
  await assert.rejects(C.vaultOpen(box, await C.vaultKey('274913', C.newSalt(), 1000)), e => e.badCode); // même code, autre téléphone : refusé
  console.log('OK — coffre chiffré par le code d\'entrée');
})();
