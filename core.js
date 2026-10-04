// Logique pure, sans DOM ni réseau. Testée par `node test.js`.

// Catégories alignées sur un vrai tableau de suivi de foyer (fast-food ≠ restaurants, animaux, maison, vacances…).
const CATS = [
  { id: 'revenus',    name: 'Revenus',                             emoji: '💶', color: '#16a34a', kind: 'in' },
  { id: 'logement',   name: 'Logement',                  emoji: '🏠', color: '#6366f1', kind: 'fixe' },
  { id: 'credit',     name: 'Prêts',                               emoji: '🏦', color: '#8b5cf6', kind: 'fixe' },
  { id: 'assurances', name: 'Assurances',              emoji: '🛡️', color: '#7c3aed', kind: 'fixe' },
  { id: 'abos',       name: 'Abonnements',               emoji: '📱', color: '#a855f7', kind: 'fixe' },
  { id: 'impots',     name: 'Impôts & frais',            emoji: '🧾', color: '#64748b', kind: 'fixe' },
  { id: 'courses',    name: 'Alimentation',                        emoji: '🛒', color: '#0ea5e9', kind: 'var' },
  { id: 'fastfood',   name: 'Fast-food',               emoji: '🍔', color: '#fb923c', kind: 'var' },
  { id: 'restos',     name: 'Restaurants',                         emoji: '🍽️', color: '#f97316', kind: 'var' },
  { id: 'voiture',    name: 'Voiture', emoji: '🚗', color: '#14b8a6', kind: 'var' },
  { id: 'transport',  name: 'Transports',                          emoji: '🚆', color: '#06b6d4', kind: 'var' },
  { id: 'sante',      name: 'Santé',                               emoji: '🩺', color: '#ec4899', kind: 'var' },
  { id: 'animaux',    name: 'Animaux',                             emoji: '🐶', color: '#a16207', kind: 'var' },
  { id: 'maison',     name: 'Maison',          emoji: '🛠️', color: '#78716c', kind: 'var' },
  { id: 'shopping',   name: 'Shopping',        emoji: '🛍️', color: '#eab308', kind: 'var' },
  { id: 'sport',      name: 'Sport',                   emoji: '🏃', color: '#22c55e', kind: 'var' },
  { id: 'loisirs',    name: 'Sorties',                   emoji: '🎉', color: '#f43f5e', kind: 'var' },
  { id: 'vacances',   name: 'Vacances',                            emoji: '✈️', color: '#0284c7', kind: 'var' },
  { id: 'cadeaux',    name: 'Cadeaux',                emoji: '🎁', color: '#d946ef', kind: 'var' },
  { id: 'enfants',    name: 'Famille',                   emoji: '👨‍👩‍👧', color: '#84cc16', kind: 'var' },
  { id: 'tabac',      name: 'Tabac',                               emoji: '🚬', color: '#9ca3af', kind: 'var' },
  { id: 'autres',     name: 'Autres',                              emoji: '❔', color: '#94a3b8', kind: 'var' },
  { id: 'epargne',    name: 'Épargne',                             emoji: '🐷', color: '#10b981', kind: 'epargne' },
  { id: 'interne',    name: 'Virement interne',                   emoji: '🔁', color: '#cbd5e1', kind: 'neutre' },
];
const HINTS = { logement: 'loyer, électricité, eau, ordures', assurances: 'auto, habitation, mutuelle, prévoyance', abos: 'box, mobile, streaming',
  impots: 'impôts, taxe foncière, frais bancaires', courses: 'courses, boulangerie, paniers repas', fastfood: 'fast-food, livraisons', voiture: 'essence, péage, parking, entretien',
  maison: 'travaux, bricolage, mobilier, électroménager', shopping: 'vêtements, beauté, achats en ligne', sport: 'salle, clubs, activités', loisirs: 'cinéma, sorties, jeux',
  cadeaux: 'cadeaux, mariages, événements', enfants: 'enfants, aide aux proches', interne: 'd\'un de vos comptes à un autre' };
for (const c of CATS) c.hint = HINTS[c.id] || '';
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const cat = id => CAT[id] || CAT.autres;
// acc = 'all', un identifiant de compte, ou une liste (les comptes d'un profil).
const inAcc = (acc, id) => acc === 'all' || (Array.isArray(acc) ? acc.includes(id) : acc === id);
// Virement vers un compte hors de la vue (ex. de l'un vers l'autre) : vu d'un seul profil,
// c'est une vraie sortie ou une vraie entrée, pas un simple déplacement.
CAT.couple = { id: 'couple', name: 'Versé à l\'autre', emoji: '💞', color: '#db2777', kind: 'var' };

// La correspondance la plus longue gagne (« UBER EATS » > « UBER », « ASSURANCE VIE » > « ASSURANCE »).
// Enseignes françaises courantes + indices génériques (PHCIE, BOUL, STATIONNEMT…). Testé sur de vrais relevés Banque Populaire.
const KEYWORDS = [
  ['logement',   /LOYER|\bEDF\b|ENGIE|TOTAL ?ENERGIES|EKWATEUR|\bGAZ\b|VEOLIA|\bSAUR\b|SUEZ|SYNDIC|FONCIA|NEXITY|ORDURES|DECHETS|\bEAU\b|ENEDIS|\bGRDF\b|OCTOPUS ENERGY|MINT ENERGIE|PLENITUDE|ILEK|\bOHM ENERGIE|COPROPRIETE|ORPI|CENTURY 21|LAFORET|GUY HOQUET|CITYA|SQUARE HABITAT/],
  ['credit',     /ECHEANCE|\bPRETS?\b|CREDIT IMMO|COFIDIS|CETELEM|SOFINCO|\bFLOA\b|\bONEY\b|FRANFINANCE|YOUNITED|TABLEAU AMORT/],
  ['assurances', /ASSURANCE|\bASSU\b|\bMAAF\b|\bMAIF\b|MACIF|MATMUT|\bGMF\b|\bAXA\b|ALLIANZ|GROUPAMA|\bAPRIL\b|GENERALI|AVIVA|SWISSLIFE|HARMONIE|MUTUELLE|\bMGEN\b|MALAKOFF|AG2R|PREVOYANCE|\bMMA\b|DIRECT ASSURANCE|OLIVIER ASSURANCE|LEOCARE|LUKO|ALAN\b|ASSUR/],
  ['epargne',    /LIVRET|\bLDDS\b|\bLEP\b|\bPEL\b|\bPEA\b|ASSURANCE VIE|EPARGNE|YOMONI|NALO|LINXEA|BOURSORAMA PLACEMENT/],
  ['abos',       /NETFLIX|SPOTIFY|DEEZER|DISNEY ?PLUS|CANAL|AMAZON PRIME|PRIME VIDEO|APPLE ?COM|ICLOUD|GOOGLE|YOUTUBE|ORANGE|\bSFR\b|BOUYGUES|FREE ?MOBILE|FREE ?TELECOM|\bFREE\b|\bSOSH\b|AUDIBLE|PARAMOUNT|CRUNCHYROLL|\bDAZN\b|\bBEIN\b|MOLOTOV|APPLE MUSIC|QOBUZ|OPENAI|CHATGPT|MICROSOFT|ADOBE|DROPBOX|NORD ?VPN|PLAYSTATION PLUS|GAME PASS|LA POSTE MOBILE|RED BY SFR|B ?& ?YOU|PRIXTEL|AMZ DIGITAL|KINDLE|CANVA|LINKEDIN|STRAVA|CALM\b|HEADSPACE/],
  ['fastfood',   /CLASS CROUTE|BUFFALO|BRIOCHE DOREE|POMME DE PAIN|MC ?DO|MAC ?DONALD|MCDONALD|BURGER|\bKFC\b|\bQUICK\b|SUBWAY|DOMINO|PIZZA HUT|UBER ?EATS|DELIVEROO|JUST ?EAT|KEBAB|TACOS|FIVE GUYS|POPEYES|O TACOS|DEJBOX|EAT SALAD|\bPOKE\b|\bIMUA\b|SUSHI SHOP|PLANET SUSHI|BAGEL|COLUMBUS|LA CROISSANTERIE|PITAYA|\bNOOD|FRITERIE|\bSNACK|SANDWICH|PANINI|MONOP DAILY|BIG FERNAND|STEAK N SHAKE|NEW YORKER|PRET A MANGER|EXKI|COJEAN|BOCO|FOODCHERI|FRICHTI/],
  ['restos',     /RESTAU|BRASSERIE|\bCAFE\b|\bBAR\b|SUSHI|STARBUCKS|BISTRO|CREPERIE|PIZZERIA|TRATTORIA|\bPIZZ|\bRESTO|RISTORANTE|TABERNA|TAVERNE|TAPAS|PINTXO|BODEGA|AUBERGE|\bGRILL|\bWOK\b|\bTHAI\b|\bSIAM\b|\bPHO\b|RAMEN|\bCREPE|GALETTE|\bPUB\b|GUINGUETTE|AU BUREAU|HIPPOPOTAMUS|COURTEPAILLE|LEON DE BRUXELLES|DEL ?ARTE|MAMIE BIGOUDE|BIGOUD|SALON DE THE|GLACIER|\bAREAS\b|VINS SUR|BAR A VIN|\bCANTINA|BOUILLON|TRAITEUR ASIA|L ENTRECOTE|LA PATATERIE|FLUNCH|IL RISTORANTE|POULET BRAISE/],
  ['courses',    /CARREFOUR|LECLERC|AUCHAN|INTERMARCHE|\bLIDL\b|\bALDI\b|MONOPRIX|\bMONOP\b|FRANPRIX|CASINO|SUPER ?U\b|HYPER ?U\b|\bU EXPRESS|\bCORA\b|NETTO|PICARD|GRAND FRAIS|BIOCOOP|NATURALIA|BOULANGERIE|BOUCHERIE|PRIMEUR|\bSPAR\b|PROXI|HELLO ?FRESH|QUITOQUE|MARIE BLACHERE|\bPAUL\b|\bBOUL\b|BOULANG|PATISS|FOURNEE|FOURNIL|BAGUETTE|\bPAIN\b|MIETTES?\b|DELICES|ROTISS|CRIEE|POISSONN|FROMAGER|EPICERIE|\bHALLES?\b|\bCAVE\b|\bNICOLAS\b|\bMIEL\b|CHOCOLAT|LA VIE CLAIRE|SO BIO|LEADER PRICE|\bG20\b|AMAZON FRESH|LA FOURCHE|\bMATCH\b|SIMPLY MARKET|BIO C BON|CHARCUT|TERROIR/],
  ['impots',     /DGFIP|DIRECTION GENE|\bCOTIS\b|\bC S G\b|PRELEV SOCIAUX|IMPOT|TRESOR PUBLIC|AMENDE|ANTAI|\bFRAIS\b|COTISATION|COMMISSION|AGIOS|URSSAF|TAXE FONCIERE/],
  ['voiture',    /STATION (HYPER U|SUPER U|AUCHAN|LECLERC|CARREFOUR|INTERMARCHE|AVIA|ESSO|TOTAL|G20)|(INTERMARCHE|LECLERC|AUCHAN|CARREFOUR|SUPER U|HYPER U|CASINO) ?(ESS|CARB|CARBU|STATION)\b|FLOWBIRD|EASYPARK|HORODATEUR|COFIROUTE|PAYBYPHONE|\bULYS\b|TOTAL|ESSO|SHELL|\bAVIA\b|CARBU|STATION|PEAGE|VINCI AUTO|SANEF|APRR|\bASF\b|AUTOROUTE|PARKING|INDIGO|NORAUTO|FEU VERT|SPEEDY|MIDAS|CONTROLE TECH|DEKRA|AUTOSUR|EUROMASTER|PNEU|GARAGE|CARTE GRISE|LAVAGE|STATIONN|\bPARK\b|\bPKG\b|EFFIA|SAEMES|ONEPARK|ZENPARK|SECURITAS|AUTOVISION|DYNEFF|\bDAC\b|\bCARB\b|BIP ?& ?GO|ESCOTA|\bATMB\b|CARTER CASH|POINT S\b|VULCO|OSCARO|MISTER AUTO|ELEPHANT BLEU|IONITY|GETAROUND|UBEEQO|EUROPCAR|HERTZ|\bSIXT\b|RENT A CAR|\bADA\b|RELAIS|\bREL\b|AIRE DES?\b/],
  ['transport',  /SNCF|\bTER\b|RATP|NAVIGO|\bUBER\b|BLABLA|\bLIME\b|\bDOTT\b|\bTCL\b|TISSEO|\bBOLT\b|HEETCH|\bG7\b|TAXI|TRANSDEV|KEOLIS|OUIGO|TRAINLINE|FLIXBUS|BLABLACAR|CITYSCOOT|VELIB|FREENOW|\bTIER\b|\bVOI\b/],
  ['sante',      /\bDR\b|DOCTEUR|PHARMA|DOCTOLIB|MEDEC|DENTI|KINE|OPTIC|LABO|HOPITAL|CLINIQUE|OSTEO|\bCPAM\b|C P A M|AMELI|PODOLOG|ORTHO|RADIOLOG|PHCIE|\bPHIE\b|OPTIQUE|AUDITION|INFIRM|SAGE FEMME|\bPSY|CENTRE MEDICAL|MAISON DE SANTE|SOS MEDECIN|\bATOL\b|AFFLELOU|\bKRYS\b|GENERALE D OPTIQUE|DERMATO|GYNECO|OPHTALMO|ANALYSES|BIOLOGIE|PSYCHOTHERA|\bPSY\b/],
  ['animaux',    /ANIMAL|BULLE ?BLEUE|VETERINAI|\bVETO\b|CHRONOVET|ANIMALIS|MAXI ?ZOO|ZOOPLUS|TOILETTAGE|CROQUETTE|BULLE BLEUE|ANIMAUX|\bCHIENS?\b|TRUFFAUT ANIMAL|WANIMO|VETOSHOP|MEDIVET/],
  ['maison',     /IKEA|LEROY|CASTORAMA|BRICO|WELDOM|POINT P|MAISONS DU MONDE|\bBUT\b|CONFORAMA|\bDARTY\b|\bBOULANGER\b|GIFI|ALINEA|JARDILAND|TRUFFAUT|BOTANIC|GAMM VERT|MANOMANO|FOIR FOUILLE|CENTRAKOR|\bNOZ\b|HABITAT|ZODIO|LINVOSGES|SAINT MACLOU|LAPEYRE|CEDEO|BRICOMARCHE|BRICOMAN|LA HALLE|BLANC CERISE|BECQUET|LA REDOUTE INTERIEUR|BUREAU VALLEE|CULINARION|DE NEUVILLE|JARDIN|MAISON COTE SUD|COTE MAISON/],
  ['shopping',   /\bETAM\b|BLISSIM|\bHEMA\b|AMAZON|\bAMZN?\b|FNAC|ZARA|\bH ?& ?M\b|KIABI|\bACTION\b|SEPHORA|ZALANDO|VINTED|SHEIN|CDISCOUNT|REDOUTE|PRIMARK|LEBONCOIN|NOCIBE|YVES ROCHER|MARIONNAUD|\bJULES\b|CELIO|PIMKIE|BERSHKA|UNIQLO|GALERIES LAFAYETTE|COIFF|CHAUSS|SPRINGFIELD|\bMOA\b|LOUIS PION|RITUALS|\bNORMAL\b|STOKOMANI|ADIDAS|\bNIKE\b|\bPUMA\b|SNIPES|COURIR|FOOT LOCKER|PANDORA|CLAIRE S|HISTOIRE D OR|DOUGLAS|\bLUSH\b|\bKIKO\b|PROMOD|CAMAIEU|CACHE CACHE|BONOBO|GRAIN DE MALICE|DEVRED|\bBRICE\b|\bIKKS\b|SEZANE|SANDRO|\bMAJE\b|\bMANGO\b|C ?& ?A\b|PULL ?& ?BEAR|STRADIVARIUS|LEFTIES|\bTEMU\b|ALIEXPRESS|\bETSY\b|BACK ?MARKET|APPLE STORE|SAMSUNG|\bLDLC\b|RAKUTEN|REDUC FACTORY|\bLA POSTE\b|MARC ORIAN|BOUTIQUE|BIJOU|OPTICAL CENTER|MAROQUIN|\bGEMO\b|LA HALLE AUX|DUNELACE|GOOGLE STORE|BARBIER|ONGLERIE|ESTHETIQUE|INSTITUT/],
  ['sport',      /BASIC ?FIT|FITNESS|DECATHLON|INTERSPORT|GO SPORT|PISCINE|ESCALADE|YOGA|KEEP ?COOL|NEONESS|\bCLUB\b|LICENCE|SALLE DE SPORT|CENTRE AQUATIQU|\bAQUA|PATINOIRE|SPORT 2000|ORANGE BLEUE|CROSSFIT|PADEL|TENNIS|\bGOLF\b|EQUITATION|\bSURF\b|SKIMIUM|DECIMAL SPORT/],
  ['loisirs',    /\bFDJ\b|CINEMA|\bUGC\b|PATHE|GAUMONT|\bCGR\b|TICKETMASTER|FNAC SPECTACLE|STEAM|PLAYSTATION|NINTENDO|XBOX|BOWLING|KARTING|MUSEE|MUSEO|CONCERT|DISNEYLAND|ESCAPE|LASER|CULTURA|FESTIVAL|BILLETTERIE|BILLET|TICKET|\bFEVER\b|WECANDOO|HELLOCSE|ACCROBRANCHE|FUTUROSCOPE|PUY DU FOU|ASTERIX|\bZOO\b|AQUARIUM|ALCAZAR|CATEDRAL|CATHEDRALE|EXPOSITION|THEATRE|OPERA|SPECTACLE|LOISIR|MINI GOLF|CANDLELIGHT|LIBRAIRIE|\bRELAY\b|MAISON DE LA PRESSE|\bPRESSE\b|\bPMU\b|PARC D ATTRACTION|CIRQUE|ATELIER CREATIF|FIGURED ART/],
  ['vacances',   /BOOKING|AIRBNB|HOTEL|\bIBIS\b|ACCOR|CAMPING|AIR FRANCE|EASYJET|RYANAIR|TRANSAVIA|VOLOTEA|VUELING|ABRITEL|GITES?\b|CENTER PARCS|PIERRE ET VACANCES|LASTMINUTE|EXPEDIA|OPODO|CLUB MED|GUEST|HOSTEL|APPART ?HOTEL|VILLAGE VACANCES|ODALYS|BELAMBRA|\bVVF\b|AZUREVA|CHAMBRE D HOTE|AVOLTA|DUTY FREE|AEROPORT|AIRPORT|EUROSTAR|RENFE|TRENITALIA|IBERIA|LUFTHANSA|\bKLM\b|WIZZ|BRITTANY FERRIES|CORSICA LINEA|FERRY|HOMEAWAY|VRBO/],
  ['cadeaux',    /CADEAU|SMARTBOX|WONDERBOX|INTERFLORA|FLEURISTE|NATURE ?(ET|&) ?DECOUV|MARIAGE|MIKAPOLI|\bAROMA ZONE/],
  ['enfants',    /CRECHE|NOUNOU|CANTINE|ECOLE|PERISCOL|JOUET|VERBAUDET|OKAIDI|CYRILLUS|AUBERT|ORCHESTRA|SMYTHS|\bTOYS\b|JOUE ?CLUB|GRANDE RECRE|DU PAREIL|SERGENT MAJOR|TAPE A L OEIL|AUTOUR DE BEBE|NATALYS|GARDERIE|CENTRE DE LOISIRS/],
  ['tabac',      /TABAC PRESSE|BAR TABAC|TABAC|CIGAR|VAPOTEUR|\bVAPE\b/],
];

// Le motif d'un virement entre particuliers (« evjf lea », « airbnb lisbonne », « cadeau tom ») dit à quoi il sert.
const MOTIFS = [
  ['vacances', /AIRBNB|LOGEMENT|\bGITE|HOTEL|VACANCES|VOYAGE|WEEK ?END|BOOKING|\bRESA\b|SEJOUR|LOCATION MAISON|CAMPING/],
  ['cadeaux',  /\bEVJF\b|\bEVG\b|ANNIV|CADEAU|\bKDO\b|MARIAGE|NAISSANCE|\bNOEL\b|CAGNOTTE|POT DE DEPART|BAPTEME/],
  ['loisirs',  /CONCERT|CANDLELIGHT|\bPLACES?\b|BILLETS?\b|\bCINE|SPECTACLE|SOIREE|FESTIVAL|BOWLING|ESCAPE|PARC\b/],
  ['restos',   /RESTO|RESTAU|DINER|\bDEJ|\bREPAS|BRUNCH|APERO|\bBAR\b|\bVERRES?\b/],
  ['fastfood', /FAST ?FOOD|\bMCDO|KEBAB|PIZZA|SUSHI|UBER EATS|DELIVEROO/],
  ['courses',  /\bCOURSES\b|SUPERMARCHE/],
  ['voiture',  /ESSENCE|CARBURANT|PEAGE|LOC(ATION)? VOITURE|COVOIT|PARKING/],
  ['transport', /\bTRAIN\b|\bSNCF\b|\bBUS\b/],
  ['logement', /\bLOYER\b|CAUTION|CHARGES/],
  ['sante',    /MEDECIN|PHARMA|DENTISTE|KINE|OSTEO/],
  ['sport',    /\bSPORT|\bFOOT\b|SALLE\b|\bCOURS\b|LICENCE|COTISATION CLUB/],
  ['enfants',  /NOUNOU|CRECHE|BABY ?SIT|GARDE/],
];

// Indices génériques, après les enseignes : « CHEZ GASTON », « CHEZ LULU »… sont presque toujours des restaurants.
const GENERIC_HINTS = [['restos', /^(CHEZ|AU|A LA|LA TABLE|LE COMPTOIR|L ATELIER DE LA)\b/]];

const INCOME = /SALAIRE|\bPAIE\b|REMUNERATION|PENSION|RETRAITE|\bCAF\b|ALLOCATION|POLE EMPLOI|FRANCE TRAVAIL|INDEMNIT|DIVIDENDE|INTERETS|PREVOYANCE/;
// Remboursements santé : Sécu, mutuelles et leurs gestionnaires (Almerys, « règlement AXA »…).
const HEALTH_REFUND = /\bCPAM\b|C P A M|AMELI|MUTUELLE|\bRBT\b|REMBOURSEMENT SANTE|SANTE|MERCER|HARMONIE|\bMGEN\b|REGLEMENT AXA|ALMERYS|VIAMEDIS|SP SANTE|SWISSLIFE PREV/;

// Catégories proposées par la Banque Populaire dans l'export CSV : utilisées en dernier recours.
const BP_MAP = [
  ['fastfood',   /FAST/],
  ['restos',     /RESTAU|\bBAR\b/],
  ['courses',    /ALIMENTATION|SUPERMARCHE|COURSES/],
  ['logement',   /LOGEMENT|ENERGIE|LOYER|\bEAU\b|ELECTRICITE/],
  ['credit',     /CREDIT|\bPRET|EMPRUNT/],
  ['assurances', /ASSURANCE|MUTUELLE/],
  ['voiture',    /CARBURANT|VEHICULE|AUTO|PARKING|PEAGE/],
  ['transport',  /TRANSPORT/],
  ['sante',      /SANTE|PHARMACIE|MEDICAL/],
  ['animaux',    /ANIMA/],
  ['maison',     /MAISON|BRICOL|MOBILIER|JARDIN|BRICOLAGE/],
  ['abos',       /ABONNEMENT|TELECOM|TELEPHON|INTERNET|MULTIMEDIA/],
  ['impots',     /IMPOT|TAXE|FRAIS BANCAIRE|BANQUE/],
  ['epargne',    /EPARGNE|PLACEMENT/],
  ['enfants',    /ENFANT|SCOLAR|EDUCATION|FAMILLE/],
  ['vacances',   /VOYAGE|VACANCE|HOTEL/],
  ['sport',      /SPORT/],
  ['cadeaux',    /CADEAU/],
  ['tabac',      /TABAC/],
  ['loisirs',    /LOISIR|SORTIE|CULTURE/],
  ['shopping',   /SHOPPING|HABILLEMENT|ACHAT|EQUIPEMENT|HIGH TECH|BEAUTE/],
  ['revenus',    /REVENU|SALAIRE/],
];

const norm = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9&]+/g, ' ').trim();

// Libellé nettoyé : « DONT FRAIS: 0,00E » (mention de la banque, pas des frais), préfixes des terminaux de paiement
// des petits commerçants (SumUp, Zettle, Lydia pro, PayPal…), qui cachent le vrai nom du commerce.
const cleanLabel = s => String(s || '').replace(/\s*DONT FRAIS\s*:?.*$/i, '')
  .replace(/^(SUMUP|SUM UP|ZETTLE_?|IZETTLE|LW|LMW|MOL|FH|MP|SP|LS|SQ|PAYPAL|PAYPLUG|STRIPE|LYF|PAYGREEN|PAYZEN)\s*\*\s*/i, '')
  .replace(/^(SP|LS|MP) (?=[A-Z])/, '');
// Paiement carte Banque Populaire : « nom du commerce (15 car.) + pays ou département + ville »
// « CAFE DES SPORTFR LYON », « AUCHAN LYON SUD69LYON », « QUICK 33MERIGNAC », « LE GRAND BLEU FR NICE »
const COUNTRIES = 'FR|ES|IT|DE|BE|LU|IE|NL|PT|GB|UK|US|CH|AT|GR|MA|SE|DK|PL|CZ|HR|MT|CA|TN|NO|FI|HU|RO|BG|SI|SK|CY|EE|LV|LT|TR|TH|JP|AE';
// Codes séparés par des espaces : seulement ceux qui ne sont pas aussi des mots (« MAISON DE LA PRESSE » n'est pas allemand).
const SPACED = 'FR|ES|US|GB|UK|IE|PT|NL|LU|CH|GR';
// Le nom du commerce occupe 15 caractères : un code collé est donc toujours juste après le 15e.
const CARD_RE = [new RegExp(`^(.{14,15})(${COUNTRIES}) +(.+)$`), new RegExp(`^(.{3,15}?) (${SPACED}) +(.+)$`), /^(.{15})(\d{2})([A-Z].*)$/, /^(.{3,32}?) (\d{2})([A-Z][A-Z' -]{2,})$/];
const NOT_CARD = /^(PRLV|PRELEV|VIR|VIREMENT|CHEQUE|CHQ|REMISE|ENVOI|WERO|ECHEANCE|F |INT |C S G|COMMISSION|AGIOS|TABLEAU|COTIS|RETRAIT|GAB|DAB|AVOIR|REMBOURSEMENT|FRAIS)/;
function cardParts(label) {
  const raw = String(label || '').replace(/\s+/g, ' ').trim().toUpperCase(), s = cleanLabel(raw).toUpperCase();
  if (NOT_CARD.test(norm(s) + ' ')) return null;
  // la largeur de 15 caractères compte le préfixe du terminal (« MP*CARREFOUR MA » + « 13 » + « MARSEILLE »)
  for (const [i, re] of CARD_RE.entries()) for (const txt of [raw, s]) {
    const m = txt.match(re);
    if (!m) continue;
    m[1] = cleanLabel(m[1]);
    if (norm(m[1]).length < 3) continue;
    const place = norm(m[3]).replace(/^(\d+ )+/, '');
    const online = /\b(WWW|COM|NET|HTTP)\b|\.(COM|FR|NET|EU)\b|\d{4,}|PAYLI|CEDEX/.test(m[3].toUpperCase()) || /\.(COM|FR|NET)\b|\bAMAZON\b/.test(m[1]);
    return { merchant: norm(m[1]), country: i < 2 ? (m[2] === 'UK' ? 'GB' : m[2]) : 'FR', dept: i >= 2 ? m[2] : null, city: place.split(' ').slice(0, 3).join(' '), online };
  }
  return null;
}

const NOISE = / (CB|CARTE|PAIEMENT|PAR|FACTURE|PRLV|PRELEVEMENT|SEPA|VIR|VIREMENT|INST|INSTANTANE|EUR|FR|DE|DU|DES|LE|LA|LES|ET|X\d+|\d\S*)(?= )/g;
// Mots trop génériques pour désigner seuls un commerce (« BOULANGERIE », « RESTAURANTE ») : on garde le mot suivant.
const GENERIC_FIRST = /^(RESTAURANTE?|RISTORANTE|BOULANGERIE|PATISSERIE|PHARMACIE|PHCIE|PHARMA|CAFE|BAR|HOTEL|STATION|GARAGE|BISTROT?|BRASSERIE|PIZZERIA|CINEMA|PARKING|LIBRAIRIE|BOUCHERIE|MAISON|ATELIER|BOUTIQUE|SARL|SAS|EURL|SA|SC|CHEZ|AU|AUX|DR|MME|MR|MLLE|CENTRE|RELAIS|REL|LATELIER|EPICERIE|CAVE|INSTITUT|SALON|LYCEE|ECOLE|MAIRIE|GAB\d?|CB|ASSURANCES?|MUTUELLE|BANQUE|CREDIT|CAISSE|SOCIETE|STE|GROUPE|AGENCE|CABINET|ASSOCIATION|ASS|CLUB|ECHEANCE|COTISATION|VIREMENT|SERVICE|SERVICES|DIRECTION|INTERETS?|SALAIRE|PAIE|REMBOURSEMENT|REGLEMENT|PAIEMENT|LOYER|FACTURE|ABONNEMENT|COMMANDE|DGFIP|TRESOR|IMPOTS?|TAXE|URSSAF|CPAM|AMENDE|ENVOI|WERO|LYDIA|GRAND|GRANDE|PETIT|PETITE|SUPER|HYPER|NOUVEAU|MARIE|LOUIS|SAINT|STE|LES|DES)$/;
// « CB CARREFOUR MARKET 12/09 PARIS » -> « CARREFOUR » ; « AUCHAN LYON SUD69LYON » et « AUCHAN.FR » -> « AUCHAN »
function merchantKey(label) {
  const card = cardParts(label), base = card && !/^(VIR|VIREMENT|PRLV|CHEQUE|ENVOI WERO|WERO)\b/.test(norm(label)) ? card.merchant : norm(cleanLabel(label));
  const words = (' ' + base + ' ').replace(NOISE, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return norm(label).split(' ').slice(0, 2).join(' ');
  return words[0].length >= 5 && !GENERIC_FIRST.test(words[0]) ? words[0] : words.slice(0, 2).join(' ');
}
// Ancienne clé (avant la lecture fine des paiements carte) : gardée pour retrouver les corrections déjà faites.
function legacyMerchantKey(label) {
  const words = (' ' + norm(label) + ' ').replace(NOISE, ' ').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(' ') || norm(label).split(' ').slice(0, 2).join(' ');
}
// Le signe fait partie de la clé : ton employeur Orange (+) n'est pas ta facture Orange (-).
// Chèques et virements Wero se ressemblent tous : on garde tout le libellé pour les distinguer.
const GENERIC_LABEL = /^(CHEQUE|REMISE CHEQUE|ENVOI WERO|WERO)\b/;
const keyOf = (t, mk) => {
  const full = (' ' + norm(t.label) + ' ').replace(NOISE, ' ').trim();
  return (t.amount > 0 ? '+' : '-') + (GENERIC_LABEL.test(full) || (mk === merchantKey && isPerson(norm(cleanLabel(t.label)))) ? full : mk(t.label));
};
const ruleKey = t => keyOf(t, merchantKey), legacyKey = t => keyOf(t, legacyMerchantKey);
const learnable = t => !/^[+-](CHEQUE|REMISE CHEQUE)$/.test(ruleKey(t));

// Virement entre particuliers (« VIR M PAUL… », « ENVOI WERO NINA », « VIR INST WERO MLLE … ») : pas de nom de commerce,
// on ne cherche donc pas d'enseigne dans le nom de la personne (« PAUL » n'est pas la boulangerie).
const PERSON_TRANSFER = /^(VIR|VIREMENT)( INST(ANTANE)?)?( SEPA)?( WERO)? (M|MME|MLLE|MLE|MR|MONSIEUR|MADAME|MADEMOISELLE)\b|^(VIR( INST)? )?(ENVOI )?WERO\b|^LYDIA\b/;
// « VIR Dupont Lucas », « VIR Marie Martin » : un virement à un nom propre, sans enseigne connue dedans
const isPerson = l => PERSON_TRANSFER.test(l) || (/^VIR( INST)? [A-Z]+( [A-Z]+){1,3}$/.test(l) && !best(l.replace(/^VIR( INST)? /, ''), KEYWORDS));

const G = new Map(); // versions « globales » des expressions, pour examiner toutes les correspondances
const best = (txt, list) => {
  let cat = null, len = 0;
  for (const [c, re] of list) {
    if (!G.has(re)) G.set(re, new RegExp(re.source, 'g'));
    for (const m of txt.matchAll(G.get(re))) if (m[0].length > len) { cat = c; len = m[0].length; }
  }
  return cat;
};

// Repris d'Assemblages : la correspondance la plus spécifique (la plus longue) gagne,
// et la confiance dépend de la source. sure = ta correction · likely = enseigne connue ·
// guess = rien de solide, l'opération ira dans « À ranger » au lieu d'être rangée en silence.
function classify(t, rules = {}) {
  const r = rules[ruleKey(t)] || rules[legacyKey(t)];
  if (r) return { cat: r, conf: 'sure' };
  const label = norm(cleanLabel(t.label)), detail = norm(t.detail), n = (label + ' ' + detail).trim();
  // Espèces et chèques : connus, mais on ne peut pas savoir à quoi ils ont servi. Rangés en « Autres » sans rien demander.
  if (/^(GAB\d?|DAB|RETRAIT)\b/.test(label) || /^RETRAIT\b/.test(detail)) return { cat: 'autres', conf: 'likely' };
  if (/^(CHEQUE|CHQ)\b/.test(label)) return t.amount > 0 ? { cat: 'revenus', conf: 'likely' } : { cat: 'autres', conf: 'likely' };
  const person = isPerson(label);
  // Une rentrée d'argent : salaire / allocations d'abord (« SALAIRE HOPITAL » n'est pas un remboursement santé),
  // un remboursement d'ami se range dans la famille de la dépense (« airbnb lisbonne » → vacances),
  // et un virement reçu n'est un remboursement que s'il le dit.
  if (t.amount > 0) {
    const refund = cardParts(t.label) || /^CB\b/.test(label);
    if (refund) { const c = best((cardParts(t.label) || {}).merchant || label, KEYWORDS); return { cat: c || 'autres', conf: 'likely' }; }
    if (INCOME.test(n) && !person) return { cat: 'revenus', conf: 'likely' };
    if (HEALTH_REFUND.test(n)) return { cat: 'sante', conf: 'likely' };
    if (person) { const m = best(detail, MOTIFS); return { cat: m || 'revenus', conf: 'likely' }; }
    if (/^(VIR|VIREMENT)\b/.test(label) && !/REMB|AVOIR/.test(n)) return { cat: 'revenus', conf: 'likely' };
  }
  if (person) { const m = best(detail, MOTIFS); return m ? { cat: m, conf: 'likely' } : { cat: 'autres', conf: 'guess' }; }
  // Paiement carte : on cherche l'enseigne dans le nom du commerce seulement (« RELAIS DES ALPS·FR » n'est pas SFR).
  const card = cardParts(t.label);
  for (const txt of card ? [card.merchant, detail] : [label, n]) {
    const c = best(txt, KEYWORDS);
    if (c) return { cat: c, conf: 'likely' };
  }
  const g = best(card ? card.merchant : label, GENERIC_HINTS);
  if (g) return { cat: g, conf: 'likely' };
  const b = norm(t.bpCat);
  if (b) for (const [c, re] of BP_MAP) if (re.test(b)) return { cat: c, conf: 'likely' };
  return t.amount > 0 ? { cat: 'revenus', conf: 'likely' } : { cat: 'autres', conf: 'guess' };
}
const categorize = (t, rules) => classify(t, rules).cat;

function parseNumber(s) {
  if (s == null) return NaN;
  s = String(s).replace(/\u2212/g, '-').replace(/[^\d,.+-]/g, '').replace(/^\+/, ''); // « € », « EUR », espaces insécables… disparaissent ; « − » typographique = moins
  if (!s) return NaN;
  s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  return parseFloat(s);
}

function parseDate(s = '') {
  s = String(s).trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function splitLine(line, d) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
}

const round2 = n => Math.round(n * 100) / 100;

// CSV Banque Populaire / BPCE (et la plupart des CSV bancaires FR). Retourne [{account, rows}].
// Lignes d'un CSV : un libellé entre guillemets peut contenir des retours à la ligne (Crédit Agricole…).
function csvRecords(text) {
  const out = []; let cur = '', q = false;
  for (const ch of String(text).replace(/^﻿/, '')) {
    if (ch === '"') q = !q;
    if (!q && (ch === '\n' || ch === '\r')) { if (cur.trim()) out.push(cur); cur = ''; }
    else cur += ch === '\n' || ch === '\r' ? ' ' : ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
// Fichier sans ligne de titres (LCL…) : les colonnes sont reconnues à leur contenu (date, montant, texte le plus long).
function guessColumns(lines) {
  const sample = lines.slice(0, 300), d = [';', '\t', ','].map(x => [x, splitLine(sample[0], x).length]).sort((a, b) => b[1] - a[1])[0][0];
  const R = sample.map(l => splitLine(l, d)), w = Math.max(...R.map(r => r.length));
  const isDate = v => /^\s*\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(v || '') && !!parseDate(v);
  const isAmt = v => /^\s*[-+−]?\s?\d{1,3}([ . ]?\d{3})*[.,]\d{2}\s?(€|EUR)?\s*$/.test(v || '') || /^\s*[-−]\s?\d+\s*$/.test(v || '');
  const rate = f => Array.from({ length: w }, (_, i) => R.filter(r => f(r[i])).length / R.length);
  const dates = rate(isDate), nums = rate(isAmt), filled = rate(v => (v || '').trim() !== '');
  const iDate = dates.findIndex(x => x >= 0.6);
  const money = nums.map((x, i) => [x, i]).filter(([x, i]) => i !== iDate && x >= 0.25 && x >= filled[i] * 0.9).map(([, i]) => i);
  const letters = Array.from({ length: w }, (_, i) => i === iDate || money.includes(i) ? -1 : R.reduce((a, r) => a + ((r[i] || '').match(/[A-Za-zÀ-ÿ]/g) || []).length, 0));
  const iLabel = letters.indexOf(Math.max(...letters));
  if (iDate < 0 || !money.length || iLabel < 0) return null;
  // Une seule colonne de montants (signés), ou deux qui se partagent les lignes : débit puis crédit
  return { d, iDate, iLabel, ...(money.length === 1 || nums[money[0]] > 0.9 ? { iAmount: money[0] } : { iDebit: money[0], iCredit: money[1] }) };
}
function parseCSV(text, filename = '') {
  const lines = csvRecords(text);
  const hi = lines.findIndex(l => /DATE|BOOKING/.test(norm(l)) && /LIBELLE|MONTANT|DEBIT|AMOUNT|LABEL|DESCRIPTION|PAYEE|PARTNER NAME/.test(norm(l)));
  let d, H = [];
  if (hi >= 0) { d = [';', '\t', ','].find(x => lines[hi].includes(x)) || ';'; H = splitLine(lines[hi], d).map(norm); }
  const col = (...res) => { for (const re of res) { const i = H.findIndex(h => re.test(h)); if (i >= 0) return i; } return -1; };
  // Titres des colonnes, banque par banque : BP/CE, Crédit Agricole, BNP, Société Générale, Crédit Mutuel, Banque Postale,
  // Fortuneo, Boursorama (dateOp, label, amount), Revolut (Started Date, Description, Amount, Fee, State), N26 (Payee, Partner Name).
  let iDate = col(/^DATE OPERATION/, /^DATE DE L ?OPERATION/, /^DATEOP$/, /^STARTED DATE/, /^BOOKING DATE/, /^DATE DE COMPTABILISATION/, /^DATE$/, /^DATE/);
  const iSimple = col(/^LIBELLE SIMPLIFIE/);
  let iLabel = col(/^LIBELLE OPERATION/, /^LIBELLE/, /^LABEL$/, /^DESCRIPTION/, /^PARTNER NAME/, /^PAYEE/, /^BENEFICIAIRE/, /^INTITULE/);
  let iAmount = col(/^MONTANT/, /^AMOUNT/), iDebit = col(/^DEBIT/), iCredit = col(/^CREDIT/);
  const iDetail = col(/^DETAIL DE L ?ECRITURE/, /^PAYMENT REFERENCE/), iFee = col(/^FEE$/), iState = col(/^STATE$/), iCur = col(/^CURRENCY$/, /^DEVISE$/);
  const iSub = col(/^SOUS CATEGORIE/), iCat = col(/^CATEGORIE/);
  const iBook = col(/^DATE DE COMPTABILISATION/, /^DATE COMPTA/, /^COMPLETED DATE/), iAcc = col(/^COMPTE$/, /^NUMERO DE COMPTE/, /^ACCOUNTNUM$/);
  if (hi < 0 || iDate < 0 || iLabel < 0) {
    const g = guessColumns(lines);
    if (!g) throw new Error(hi < 0 ? 'fichier non reconnu (pas de colonnes Date / Libellé / Montant)' : 'colonnes non reconnues : ' + H.join(' | '));
    ({ d, iDate, iLabel } = g); iAmount = g.iAmount ?? -1; iDebit = g.iDebit ?? -1; iCredit = g.iCredit ?? -1;
  }
  const rows = [], byAcc = {};
  for (const l of lines.slice(hi + 1)) {
    const c = splitLine(l, d);
    let date = parseDate(c[iDate]) || parseDate(c[iBook]); // « Date opération » parfois vide : la date de comptabilisation
    if (!date) continue;
    if (iState >= 0 && c[iState] && !/^(COMPLETED|TERMINEE?|EFFECTUEE?)$/.test(norm(c[iState]))) continue; // annulée, refusée, en attente
    if (iCur >= 0 && c[iCur] && norm(c[iCur]) !== 'EUR') continue;                                            // autre devise
    let amount = parseNumber(c[iAmount]);
    if (isNaN(amount)) {
      const db = parseNumber(c[iDebit]), cr = parseNumber(c[iCredit]);
      amount = (isNaN(cr) ? 0 : Math.abs(cr)) - (isNaN(db) ? 0 : Math.abs(db));
    }
    const fee = parseNumber(c[iFee]); if (!isNaN(fee) && fee) amount -= Math.abs(fee);
    if (!amount) continue;
    let full = (c[iLabel] || '').replace(/\s+/g, ' ').trim(), simple = (c[iSimple] || '').replace(/\s+/g, ' ').trim(), card = '';
    // Carte : « 250521 CB****5217 RELAIS DU CHEVAL BLANC 51BAYE » → date d'achat et commerce, comme dans le relevé PDF
    // (même date que le PDF : importer le CSV puis le relevé du mois ne crée aucun doublon).
    const cb = full.match(/^(\d{2})(\d{2})(\d{2}) CB\*+(\d{4}) ?(.*)$/);
    if (cb) {
      const buy = `20${cb[3]}-${cb[2]}-${cb[1]}`;
      if (parseDate(`${cb[1]}/${cb[2]}/20${cb[3]}`) === buy && dayNum(date) - dayNum(buy) >= 0 && dayNum(date) - dayNum(buy) <= 40) date = buy;
      card = `Carte ••${cb[4]}`; full = cb[5] || full;
      if (simple && /^(\d{6} )?CB\b|^PAIEMENT/i.test(simple)) simple = '';
    }
    const extra = (c[iDetail] || '').replace(/\s+/g, ' ').trim();
    const row = {
      date, amount: round2(amount),
      label: simple || full || extra || '—', detail: [simple && simple !== full ? full : '', extra !== (simple || full) ? extra : '', card].filter(Boolean).join(' · '),
      bpCat: [c[iSub], c[iCat]].filter(Boolean).join(' '),
    };
    const acc = iAcc >= 0 && /\d{6,}/.test(c[iAcc] || '') ? c[iAcc].replace(/\D/g, '') : '';
    if (acc) (byAcc[acc] ||= []).push(row); else rows.push(row);
  }
  // Ancien format : le numéro de compte est dans une colonne (un fichier peut en contenir plusieurs)
  if (Object.keys(byAcc).length) return Object.entries(byAcc).map(([account, rows]) => ({ account, rows }));
  const pre = lines.slice(0, Math.max(hi, 0)).join(' ').match(/(\d{8,})/);
  if (pre) return [{ account: pre[1], rows }];
  // Sans numéro dans le fichier : le nom du fichier n'est qu'un indice (« weak ») ; l'app retrouve le compte par ses opérations.
  const fromName = filename.match(/\d{6,}/), base = filename.replace(/\.\w+$/, '').replace(/\s*\(\d+\)$/, '').trim();
  if (fromName) return [{ account: fromName[0], rows, weak: 'digits' }];
  return [{ account: base || 'Compte', name: base || 'Compte importé', rows, weak: 'name' }];
}

// Fichier sans numéro de compte : à quel compte connu appartient-il ? Les exports se chevauchent toujours de quelques jours ;
// on compte ses opérations (date + montant, ce qui fait l'identité d'une opération) déjà présentes dans chaque compte.
function matchAccount(state, rows) {
  let best = null;
  for (const [id, a] of Object.entries(state.accounts)) {
    if (a.hist) continue;
    const have = {};
    for (const t of state.tx) if (t.acc === id && !t.auto && !t.pending) { const k = t.date + '|' + t.amount; have[k] = (have[k] || 0) + 1; }
    let n = 0; for (const r of rows) { const k = r.date + '|' + r.amount; if (have[k] > 0) { have[k]--; n++; } }
    if (n && (!best || n > best.n)) best = { id, n };
  }
  return best && best.n >= Math.min(3, rows.length) ? best.id : null;
}

// OFX (format « Money ») : gère plusieurs comptes dans le même fichier.
function parseOFX(text) {
  const tag = (src, t) => {
    const m = src.match(new RegExp('<' + t + '>([^<\\r\\n]*)', 'i'));
    return m ? m[1].trim().replace(/&amp;/g, '&') : '';
  };
  return text.split(/<(?:CC)?STMTRS>/i).slice(1).map(b => ({
    account: tag(b, 'ACCTID') || 'Compte',
    savings: /SAVINGS/i.test(tag(b, 'ACCTTYPE')),
    balance: (() => { const l = b.split(/<LEDGERBAL>/i)[1]; const v = l && parseNumber(tag(l, 'BALAMT'));
      return l && !isNaN(v) ? { amount: round2(v), date: parseDate(tag(l, 'DTASOF')) || parseDate(tag(b, 'DTEND')) } : null; })(),
    rows: b.split(/<STMTTRN>/i).slice(1).map(t => {
      const name = tag(t, 'NAME'), memo = tag(t, 'MEMO');
      return { date: parseDate(tag(t, 'DTPOSTED')), amount: round2(parseNumber(tag(t, 'TRNAMT'))),
               label: name || memo, detail: memo !== name ? memo : '' };
    }).filter(r => r.date && r.amount),
  }));
}

// Relevé PDF (texte extrait par pdf.js côté page, positions comprises). Méthode :
// l'en-tête « Débit / Crédit » donne la position des deux colonnes ; un montant
// est un débit ou un crédit selon la colonne dont il est le plus proche.
// pages = [[{str, x, y, w}]]. Aucune devinette : sans en-tête, on refuse le fichier.
const AMOUNT = /^[-+]?\d{1,3}(?:[ .  ]?\d{3})*,\d{2}€?$/;
const DMY = /^(\d{2})[\/.](\d{2})(?:[\/.](\d{2,4}))?$/;

function pdfLines(pages) {
  const lines = [];
  pages.forEach((items, p) => {
    for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const last = lines[lines.length - 1];
      if (last && last.p === p && Math.abs(last.y - it.y) <= 2.5) last.items.push(it);
      else lines.push({ p, y: it.y, items: [it] });
    }
  });
  for (const l of lines) {
    const toks = [];
    for (const it of l.items.sort((a, b) => a.x - b.x)) {
      const re = /\S+/g, s = it.str, w = it.w || s.length * 5; let m;
      while ((m = re.exec(s))) toks.push({ s: m[0], x: it.x + w * m.index / s.length, w: w * m[0].length / s.length });
    }
    // « 1 234,56 » peut arriver en deux morceaux : on recolle.
    // « - 1 200,00 € » arrive en morceaux : signe, milliers et « € » sont recollés / ignorés.
    l.toks = toks.filter(t => t.s !== '€').reduce((acc, t) => {
      const a = acc[acc.length - 1];
      if (a && /^[-+]$/.test(a.s) && /^\d/.test(t.s) && t.x - (a.x + a.w) < 8) { a.s += t.s; a.w = t.x + t.w - a.x; }
      else if (a && /^[-+]?\d{1,3}(?:[ .]\d{3})*$/.test(a.s) && /^\d{3}(?:,\d{2})?$/.test(t.s) && t.x - (a.x + a.w) < 8) {
        a.s += ' ' + t.s; a.w = t.x + t.w - a.x;
      } else acc.push({ ...t });
      return acc;
    }, []);
    l.text = l.toks.map(t => t.s).join(' ');
  }
  return lines;
}

function parsePDF(pages, filename = '') {
  const lines = pdfLines(pages);
  const all = lines.map(l => l.text).join(' ').toUpperCase();
  const au = all.match(/\bAU (\d{2})[\/.](\d{2})[\/.](\d{4})/);
  const endDate = au ? `${au[3]}-${au[2]}-${au[1]}`
    : [...all.matchAll(/\b(\d{2})[\/.](\d{2})[\/.](\d{4})\b/g)].map(m => `${m[3]}-${m[2]}-${m[1]}`).sort().pop() || new Date().toISOString().slice(0, 10);
  const [endY, endM] = endDate.split('-').map(Number);
  const balances = {}, opening = {};
  const nameNum = filename.match(/\d{8,}/);
  // mode 'dc' : colonnes Débit / Crédit · mode 'signed' : une colonne Montant signée (Banque Populaire)
  let acc = nameNum ? nameNum[0] : 'Relevé PDF', debitX = null, creditX = null, mode = null, inOps = false, prev = null;
  const byAcc = {};

  for (const l of lines) {
    let T = l.toks;
    const n = norm(l.text);
    // Code d'impression dans la marge (« 0001 », « 20251205*223139*EXTCL02… ») sur la ligne d'une opération : on l'écarte.
    const i0 = T.findIndex(t => DMY.test(t.s));
    if (i0 > 0 && i0 <= 3 && T.slice(0, i0).every(t => /^[\d*A-Z\/]+$/.test(t.s) && t.x < T[i0].x - 10)) T = T.slice(i0);
    if (/NOUVEAU SOLDE|ANCIEN SOLDE|SOLDE PRECEDENT|SOLDE (CREDITEUR |DEBITEUR )?AU|SOLDE FINAL/.test(n)) {
      const a = T.filter(t => AMOUNT.test(t.s)).pop();
      if (a) {
        const ax = a.x + a.w / 2;
        const sign = /DEBITEUR/.test(n) ? -1 : /CREDITEUR/.test(n) || mode !== 'dc' ? Math.sign(parseNumber(a.s)) || 1 : Math.abs(ax - creditX) < Math.abs(ax - debitX) ? 1 : -1;
        const v = round2(sign * Math.abs(parseNumber(a.s)));
        // Avant toute opération du compte = solde de départ ; après = solde de fin.
        const ld = l.text.toUpperCase().match(/AU (\d{2})[\/.](\d{2})[\/.](\d{4})/);
        if (/ANCIEN|PRECEDENT/.test(n) || (!/NOUVEAU|FINAL/.test(n) && !(byAcc[acc] || []).length)) opening[acc] = { amount: v, date: ld ? `${ld[3]}-${ld[2]}-${ld[1]}` : null };
        else { const d = l.text.toUpperCase().match(/AU (\d{2})[\/.](\d{2})[\/.](\d{4})/); balances[acc] = { amount: v, date: d ? `${d[3]}-${d[2]}-${d[1]}` : endDate }; }
      }
      prev = null; continue;
    }
    const d0 = T[0] && T[0].s.match(DMY);
    if (!d0) {
      // Après les totaux viennent des récapitulatifs (prélèvements / virements SEPA) : ce ne sont pas de nouvelles opérations.
      if (/DETAIL DE VOS|TOTAL DES MOUVEMENTS|RECAPITULATIF/.test(n)) { inOps = false; prev = null; continue; }
      const hD = T.find(t => /^DEBIT/.test(norm(t.s))), hC = T.find(t => /^CREDIT/.test(norm(t.s))), hM = T.find(t => /^MONTANT/.test(norm(t.s)));
      if (hD && hC) { mode = 'dc'; debitX = hD.x + hD.w / 2; creditX = hC.x + hC.w / 2; inOps = true; prev = null; continue; }
      if (hM && !hD && !hC) { mode = 'signed'; inOps = true; prev = null; continue; }
      const a = !/CLIENT|SIRET|ORIAS|CAPITAL|TEL/.test(n) && l.text.match(/COMPTE\b[^\d]{0,30}N\s?[°O]\.?\s*(\d[\d ]{6,}\d)/i);
      if (a) { acc = a[1].replace(/\s/g, ''); prev = null; continue; }
      if (prev && inOps && !T.some(t => AMOUNT.test(t.s)) && l.text.length < 90 && !/SOLDE|TOTAL|PAGE|RELEVE/.test(n)) prev.lines.push(l.text.trim().replace(/^\d{4} (?=\D)/, ''));
      else prev = null;
      continue;
    }
    const amts = T.filter(t => AMOUNT.test(t.s));
    if (!amts.length || !inOps || !mode || /SOLDE|TOTAL/.test(n)) { prev = null; continue; }
    const a = amts[amts.length - 1], ax = a.x + a.w / 2;
    const amount = mode === 'signed' ? round2(parseNumber(a.s))
      : round2((Math.abs(ax - creditX) < Math.abs(ax - debitX) ? 1 : -1) * Math.abs(parseNumber(a.s)));
    // Plusieurs dates (comptable, opération, valeur) : on garde celle de l'opération, comme l'export CSV.
    const ds = T.filter(t => DMY.test(t.s)).map(t => t.s.match(DMY)), [, dd, mm, yy] = ds.length >= 3 ? ds[1] : ds[0];
    const y = yy ? (yy.length === 2 ? 2000 + +yy : +yy) : (+mm > endM ? endY - 1 : endY);
    const words = T.slice(1).filter(t => !amts.includes(t) && !DMY.test(t.s)).map(t => t.s);
    prev = { date: `${y}-${mm}-${dd}`, amount, raw: words.join(' '), lines: [],
      label: words.filter(w => !/^(?=.*\d)[A-Z0-9]{5,}$/.test(w)).join(' ') }; // sans les références (« 00UT6A2 »)
    (byAcc[acc] ||= []).push(prev);
  }
  for (const rows of Object.values(byAcc)) for (const r of rows) {
    // Carte Banque Populaire : « 100526 CB****1111 » puis le commerçant sur la ligne suivante.
    const cb = r.raw.match(/^(\d{2})(\d{2})(\d{2}) CB\*+(\d{4})/);
    if (cb) {
      const d = `20${cb[3]}-${cb[2]}-${cb[1]}`, gap = dayNum(r.date) - dayNum(d);
      if (gap >= 0 && gap <= 10) r.date = d;
      if (r.lines[0]) r.label = r.lines.shift();
      r.lines.unshift(`Carte ••${cb[4]}`);
    }
    // Autres banques : la date d'achat « FACT 120925 » est plus juste que la date de passage en banque.
    const f = (r.label + ' ' + r.lines.join(' ')).match(/\bFACT\s?(\d{2})(\d{2})(\d{2})\b/);
    if (f) { const d = `20${f[3]}-${f[2]}-${f[1]}`, gap = dayNum(r.date) - dayNum(d); if (gap >= 0 && gap <= 10) r.date = d; }
    r.detail = r.lines.join(' · ');
    delete r.raw; delete r.lines;
  }
  // Contrôle (comme la ligne « Contrôle » d'un tableur) : départ + opérations lues = solde de fin ?
  const out = Object.entries(byAcc).map(([account, rows]) => ({ account, rows, balance: balances[account] || null,
    opening: opening[account] || null,
    check: balances[account] && opening[account] ? round2(balances[account].amount - opening[account].amount - rows.reduce((a, r) => a + r.amount, 0)) : null }));
  if (!out.length) throw new Error(!mode ? 'colonnes Montant ou Débit / Crédit introuvables dans ce PDF' : 'aucune opération trouvée dans ce PDF');
  return out;
}

// Tableur de suivi mensuel (lignes = postes, colonnes = mois « juin-25 »…). Devient un historique :
// une opération par poste et par mois, au 15, sur des comptes « historique » (commun / chaque personne).
const MOIS = { JANV: 1, JAN: 1, FEVR: 2, FEV: 2, MARS: 3, MAR: 3, AVR: 4, MAI: 5, JUIN: 6, JUIL: 7, AOUT: 8, SEPT: 9, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const monthCell = c => { const m = norm(c).match(/^([A-Z]+) (\d{2})$/); return m && MOIS[m[1]] ? `20${m[2]}-${String(MOIS[m[1]]).padStart(2, '0')}` : null; };
const isTreso = text => { const l = text.replace(/^﻿/, '').split(/\r?\n/)[0] || ''; return splitLine(l, l.includes(';') ? ';' : ',').filter(monthCell).length >= 3; };
const HIST_MAP = [
  [/FAST ?FOOD/, 'fastfood'], [/RESTAU/, 'restos'], [/CHIEN|CHAT|ANIMA/, 'animaux'], [/ALIMENT|HELLO ?FRESH|COURSES/, 'courses'],
  [/MOBILIER|EQUIPEMENT|BRICOL|MAISON/, 'maison'], [/^SORTIE/, 'loisirs'], [/LOISIR|SPORT|ACTIVIT/, 'sport'], [/VACANCE|VOYAGE/, 'vacances'],
  [/VOITURE|ESSENCE|PARKING|PEAGE|ACHAT C\d|CARBU/, 'voiture'], [/CADEAU|EVJF|MARIAGE/, 'cadeaux'], [/SANTE/, 'sante'], [/CIGARET|TABAC/, 'tabac'],
  [/SHOPPING|VETEMENT|BEAUTE/, 'shopping'], [/MAMAN|PAPA|FAMILLE|ENFANT/, 'enfants'], [/PRET/, 'credit'], [/TAXE|IMPOT|FRAIS BANC/, 'impots'],
  [/ASSUR|MUTUELLE/, 'assurances'], [/EDF|VEOLIA|ORDURES|\bEAU\b|\bGAZ\b|LOYER/, 'logement'], [/FREE|ORANGE|SPOTIFY|NETFLIX|GOOGLE|APPLI/, 'abos'],
];
const LEVER_OF = { X: 'essentiel', 'PEUT SE PASSER': 'passer', 'PEUT DIMINUER': 'diminuer', SORTIES: 'diminuer', NEGO: 'nego', 'A NEGO': 'nego' };
const GENERIC = new Set(['ASSURANCES', 'ASSURANCE', 'FRAIS', 'TAXE', 'ALIMENTATION', 'DEPENSES']);

function parseTreso(text, people = []) {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/), d = rows[0].includes(';') ? ';' : ',';
  const head = splitLine(rows[0], d), months = head.map(monthCell), iMoy = head.findIndex(h => /MOYENNE/.test(norm(h)));
  const person = label => { const n = norm(label); const p = people.find(x => n.includes(norm(x.name))); return p ? p.id : null; };
  const accOf = owner => owner ? 'HIST-' + owner.toUpperCase() : 'HIST-COMMUN';
  const out = {}, levers = { cat: {}, merchant: {} }, balances = {};
  const push = (owner, r) => { const a = accOf(owner); (out[a] ||= { account: a, owner: owner || 'commun', hist: true, rows: [] }).rows.push(r); };
  let section = null, owner = null, header = null, details = 0;
  const flushLump = () => { // section sans détail (ex. « Dépenses perso Paul ») : on garde le total
    if (section === 'out' && header && !details) header.vals.forEach((v, i) => v && push(owner, { date: months[i] + '-15', amount: -v, label: header.label, cat: 'autres' }));
  };
  for (const line of rows.slice(1)) {
    const c = splitLine(line, d), label = (c[0] || '').trim(), n = norm(label);
    const vals = months.map((m, i) => { if (!m) return 0; const v = parseNumber(c[i]); return isNaN(v) ? 0 : round2(v); });
    if (!n) continue;
    if (/^SOLDE FINAL/.test(n)) { flushLump(); section = 'bal'; continue; }
    if (/^(SOLDE INITIAL|CONTROLE|TOTAL|EPARGNE TOTALE|COMPTES COURANTS)$/.test(n)) continue;
    if (n === 'ENTREES') { flushLump(); section = 'in'; owner = null; header = null; continue; }
    if (n === 'DEPENSES') { flushLump(); section = null; header = null; continue; }
    const sec = n.match(/^DEPENSES (COMMUNES|PERSO (.+))$/);
    if (sec) { flushLump(); section = 'out'; owner = sec[2] ? person(sec[2]) : null; header = { label, vals }; details = 0; continue; }
    if (section === 'bal') {
      balances[label] = { owner: person(label) || (/COMMUN/.test(n) ? 'commun' : null), savings: /LIVRET|EPARGNE|LDDS|LEP|PEL/.test(n),
        months: Object.fromEntries(vals.map((v, i) => [months[i], v]).filter(([m, v]) => m && v)) };
      continue;
    }
    if (!section) continue;
    details++;
    const o = section === 'in' ? person(label) : owner;
    const k = section === 'in' ? 'revenus' : ((HIST_MAP.find(([re]) => re.test(n)) || [])[1] || classify({ label, amount: -1 }).cat);
    vals.forEach((v, i) => v && push(o, { date: months[i] + '-15', amount: section === 'in' ? v : -v, label, cat: k }));
    const lever = LEVER_OF[norm(c[iMoy + 1] || '')];
    if (lever && section === 'out') {
      if (cat(k).kind === 'fixe' || k === 'voiture') { const tok = n.split(' ').find(w => !GENERIC.has(w) && w.length > 2); if (tok) levers.merchant[tok] ||= lever; }
      else levers.cat[k] ||= lever;
    }
  }
  flushLump();
  const names = { 'HIST-COMMUN': 'Historique tableur · commun' };
  for (const p of people) names[accOf(p.id)] = `Historique tableur · ${p.name}`;
  return { parsed: Object.values(out).map(a => ({ ...a, name: names[a.account] || a.account })), levers, balances };
}

// Leviers d'économie (les annotations du tableur) : essentiel · à renégocier · peut diminuer · peut se passer.
const LEVERS = {
  essentiel: { label: 'Essentiel', emoji: '✅', rate: 0 },
  nego: { label: 'À renégocier', emoji: '🤝', rate: 0.2 },
  diminuer: { label: 'Peut baisser', emoji: '📉', rate: 0.15 },
  passer: { label: 'On peut s\'en passer', emoji: '✂️', rate: 1 },
};
const DEFAULT_LEVER = { courses: 'diminuer', fastfood: 'diminuer', restos: 'diminuer', maison: 'diminuer', shopping: 'diminuer', loisirs: 'diminuer',
  vacances: 'diminuer', cadeaux: 'diminuer', sport: 'diminuer', tabac: 'diminuer' }; // « Autres » : on ne promet rien sur ce qu'on ne connaît pas
const leverOf = (state, c) => ((state.levers || {}).cat || {})[c] || DEFAULT_LEVER[c] || 'essentiel';
function merchantLever(state, t) {
  const n = norm(t.label + ' ' + (t.detail || ''));
  for (const [tok, l] of Object.entries((state.levers || {}).merchant || {})) if (new RegExp('\\b' + tok + '\\b').test(n)) return [tok, l];
  return null;
}

// Mois complet = tous les comptes suivis ont leurs relevés du 1er au dernier jour. Un mois à moitié importé
// (début de l'historique, relevé pas encore arrivé, mois en cours) n'est JAMAIS pris pour une habitude :
// il ferait croire à une baisse des dépenses qui n'existe pas.
function coverage(state, id) {
  let first = '', end = (state.accounts[id].balance || {}).date || '';
  for (const t of state.tx) if (t.acc === id && !t.pending) { if (!first || t.date < first) first = t.date; if (t.date > end) end = t.date; }
  return first ? { first, end } : null;
}
function fullMonth(state, m, acc = 'all') {
  const a = `${m}-01`, z = `${m}-${String(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate()).padStart(2, '0')}`;
  const ids = Object.keys(state.accounts).filter(id => inAcc(acc, id) && !state.accounts[id].savings);
  const cov = Object.fromEntries(ids.filter(id => !isHist(state, id)).map(id => [id, coverage(state, id)]).filter(x => x[1]));
  const latest = Object.values(cov).reduce((x, c) => (c.end > x ? c.end : x), '');
  let any = false;
  for (const id of ids) {
    if (isHist(state, id)) { if (state.tx.some(t => t.acc === id && t.date.startsWith(m))) any = true; continue; }
    const c = cov[id];
    if (!c || c.first > z) continue; // compte pas encore suivi ce mois-là
    if (c.end < z && dayNum(latest) - dayNum(c.end) > 120) continue; // ponytail: plus importé depuis 4 mois = compte fermé
    if (c.first > a || c.end < z) return false;
    if ((state.accounts[id].gaps || []).some(g => g.from < z && g.to > a)) return false; // relevé manquant au milieu
    any = true;
  }
  return any;
}
// Les n derniers mois complets avant `month` (sur un an au plus).
const lastFull = (state, month, acc = 'all', n = 3) => Array.from({ length: 12 }, (_, i) => shiftMonth(month, -1 - i)).filter(m => fullMonth(state, m, acc)).slice(0, n);

// Plan d'épargne : sur tes 3 derniers mois, ce que chaque levier libère par mois (estimations prudentes).
function savingsPlan(state, month, acc = 'all') {
  const ms = lastFull(state, month, acc);
  if (!ms.length) return { items: [], total: 0, months: 0 };
  const byCat = {}, byMer = {}, zero = () => ms.map(() => 0);
  for (const t of activeTx(state)) {
    const i = ms.indexOf(t.date.slice(0, 7));
    if (i < 0 || !inAcc(acc, t.acc) || !['var', 'fixe'].includes(cat(t.cat).kind)) continue;
    const ml = merchantLever(state, t);
    if (ml) (byMer[ml[0]] ||= { lever: ml[1], v: zero(), cat: t.cat }).v[i] -= t.amount;
    else (byCat[t.cat] ||= zero())[i] -= t.amount;
  }
  const items = [];
  for (const [tok, x] of Object.entries(byMer)) items.push({ kind: 'merchant', key: tok, name: tok, cat: x.cat, lever: x.lever, avg: typical(x.v.map(v => Math.max(0, v))) });
  for (const [c, v] of Object.entries(byCat)) if (cat(c).kind === 'var') items.push({ kind: 'cat', key: c, name: cat(c).name, cat: c, lever: leverOf(state, c), avg: typical(v.map(x => Math.max(0, x))) });
  for (const it of items) it.gain = Math.max(0, Math.round(it.avg * LEVERS[it.lever].rate));
  items.sort((a, b) => b.gain - a.gain || b.avg - a.avg);
  return { items: items.filter(i => i.avg >= 1), total: items.reduce((a, i) => a + i.gain, 0), months: ms.length };
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// Ce qui tombe chaque mois : même marchand, ≥ 3 des 4 derniers mois, montant et jour stables.
function recurring(state, acc = 'all', opts = {}) {
  const months = [...new Set(state.tx.filter(t => !t.pending).map(t => t.date.slice(0, 7)))].sort().slice(-4);
  if (months.length < 3) return [];
  const g = {};
  for (const t of state.tx) {
    if (!months.includes(t.date.slice(0, 7)) || !inAcc(acc, t.acc) || (t.cat === 'interne' && !opts.internal) || isHist(state, t.acc) || t.pending) continue;
    (g[ruleKey(t)] ||= []).push(t);
  }
  const out = [];
  for (const [k, all] of Object.entries(g)) {
    // Même libellé, montants différents (deux prêts « ECHEANCE PRET ») : on sépare par montant voisin.
    const clusters = [];
    for (const t of [...all].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))) {
      const c = clusters[clusters.length - 1], a = Math.abs(t.amount);
      if (c && a <= c.ref * 1.3 + 5) c.ts.push(t); else clusters.push({ ref: a, ts: [t] });
    }
    for (const { ts } of clusters) {
      const ms = new Set(ts.map(t => t.date.slice(0, 7)));
      if (ms.size < 3 || ts.length > ms.size + 1) continue;
      const amts = ts.map(t => Math.abs(t.amount)), days = ts.map(t => +t.date.slice(8));
      if (Math.max(...days) - Math.min(...days) > 8) continue;
      out.push({ key: k, name: k.slice(1), sign: k[0] === '+' ? 1 : -1, amount: median(amts), day: median(days), cat: ts[ts.length - 1].cat });
    }
  }
  return out.sort((a, b) => a.day - b.day);
}

// Récurrents pas encore passés ce mois-ci.
const sameRec = (t, r) => ruleKey(t) === r.key && Math.abs(Math.abs(t.amount) - r.amount) <= r.amount * 0.3 + 5;
function upcoming(state, month, acc = 'all') {
  const tx = state.tx.filter(t => t.date.startsWith(month) && inAcc(acc, t.acc));
  return recurring(state, acc).filter(r => !tx.some(t => sameRec(t, r)));
}

// « Habitude » d'une famille : la médiane des 3 mois d'avant (une grosse dépense exceptionnelle,
// comme des travaux, ne gonfle ni l'objectif ni le gain annoncé). Avec 1 ou 2 mois : la moyenne.
const typical = vals => vals.length >= 3 ? [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)] : vals.reduce((a, v) => a + v, 0) / (vals.length || 1);
function habitBy(state, month, acc = 'all') {
  const per = lastFull(state, month, acc).map(m => monthStats(state, m, acc).by), out = {};
  for (const c of new Set(per.flatMap(Object.keys))) out[c] = typical(per.map(b => Math.max(0, b[c] || 0)));
  return out;
}

// Engagements : un objectif de dépense par famille pour le mois. Le gain est mesuré honnêtement,
// par rapport à vos habitudes (moyenne des 3 mois d'avant), pas par rapport à l'objectif.
function engagementResults(state, month, acc, targets) {
  const st = monthStats(state, month, acc), avg = habitBy(state, month, acc), full = fullMonth(state, month, acc);
  return Object.entries(targets).filter(([, v]) => v > 0).map(([c, target]) => {
    const spent = Math.max(0, st.by[c] || 0), habit = Math.round(avg[c] || 0);
    // Pas de verdict ni de « gain » sur un mois incomplet : il manquerait des dépenses.
    return { cat: c, target, spent, habit, full, ok: full && spent <= target, gain: full && habit ? Math.max(0, Math.round(habit - spent)) : 0 };
  });
}

const dayNum = d => Date.parse(d + 'T00:00:00Z') / 864e5;

// Un débit sur un compte + le même crédit sur un autre compte à ±3 jours = virement entre mes comptes.
// ponytail: appariement O(n²), suffisant pour quelques milliers d'opérations ; indexer par montant si ça rame.
function pairTransfers(state) {
  const sv = a => !!(state.accounts[a] && state.accounts[a].savings);
  const isMove = t => !cardParts(t.label) && !/^(GAB\d?|DAB|RETRAIT|CB|CHEQUE|REMISE CHEQUE)\b/.test(norm(t.label));
  const txs = state.tx.filter(t => !t.manual && isMove(t)).sort((a, b) => a.date.localeCompare(b.date));
  const used = new Set();
  for (const o of txs) {
    if (o.amount >= 0 || used.has(o)) continue;
    const i = txs.find(t => !used.has(t) && t.acc !== o.acc && t.amount === -o.amount
                         && Math.abs(dayNum(t.date) - dayNum(o.date)) <= 3);
    if (!i) continue;
    used.add(o); used.add(i);
    // Vers / depuis l'épargne : on compte le mouvement côté compte courant, une seule fois.
    const ep = !(sv(o.acc) && sv(i.acc)) && (sv(o.acc) || sv(i.acc) || o.cat === 'epargne' || i.cat === 'epargne');
    const cur = sv(i.acc) ? o : sv(o.acc) ? i : o.cat === 'epargne' ? o : i;
    o.cat = i.cat = 'interne';
    o.conf = i.conf = 'sure';
    o.pair = i.acc; i.pair = o.acc;
    if (ep) cur.cat = 'epargne';
  }
}

// Remboursements (Sécu, mutuelle…) reliés à la dépense qu'ils couvrent : même famille, avant, à 45 jours max.
// Les totaux sont déjà nets ; ce lien sert à afficher le vrai coût d'une dépense.
const REFUNDABLE = new Set(['sante', 'animaux', 'assurances']);
function linkRefunds(state) {
  for (const t of state.tx) { delete t.refundOf; delete t.refunded; }
  const exp = {};
  for (const t of state.tx) if (t.amount < 0 && REFUNDABLE.has(t.cat)) (exp[t.cat] ||= []).push(t);
  for (const r of [...state.tx].sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.amount <= 0 || !REFUNDABLE.has(r.cat)) continue;
    const e = (exp[r.cat] || []).filter(e => e.date <= r.date && dayNum(r.date) - dayNum(e.date) <= 45 && -e.amount - (e.refunded || 0) >= r.amount - 0.005)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (e) { r.refundOf = e.id; e.refunded = round2((e.refunded || 0) + r.amount); }
  }
}

// Rentrées d'un compte : ce qui est régulier, c'est le TOTAL du mois (2 × 700 € ou 1 × 1 400 €), pas chaque virement.
// Médiane des 4 mois complets avant « refM », jour habituel de la première rentrée.
function monthlyCredits(own, refM) {
  const past = [1, 2, 3, 4].map(i => shiftMonth(refM, -i)), byKey = {};
  for (const t of own) if (t.amount > 0 && !t.pending && past.includes(t.date.slice(0, 7))) {
    const x = (byKey[ruleKey(t)] ||= {}), cur = (x[t.date.slice(0, 7)] ||= { sum: 0, day: 31 });
    cur.sum += t.amount; cur.day = Math.min(cur.day, +t.date.slice(8));
  }
  return Object.entries(byKey).filter(([, per]) => Object.keys(per).length >= 3).map(([k, per]) => {
    const v = Object.values(per);
    return { key: k, name: k.slice(1), total: median(v.map(x => x.sum)), day: median(v.map(x => x.day)), cat: (own.find(t => ruleKey(t) === k) || {}).cat };
  });
}

// Les prochaines semaines d'un compte : prélèvements fixes à venir et rentrées habituelles.
// Testé sur 16 mois réels : le solde de fin de mois n'est PAS prévisible de façon fiable (travaux, virements,
// remboursements variables → ±900 € en moyenne). On ne promet donc qu'une chose vérifiable : le solde actuel
// couvre-t-il les prélèvements qui tombent avant les prochaines rentrées habituelles ?
function forecast(state, id, days = 35) {
  const start = balanceOf(state, id);
  if (start === null) return null;
  const own = state.tx.filter(t => t.acc === id && !t.auto);
  const ref = own.reduce((a, t) => (t.date > a ? t.date : a), state.accounts[id].balance.date), refM = ref.slice(0, 7), end = dayNum(ref) + days, items = [];
  const next3 = [refM, shiftMonth(refM, 1), shiftMonth(refM, 2)];
  // Rentrées attendues = total habituel du mois − déjà reçu ce mois-ci, à la date habituelle.
  for (const { key: k, total, day, cat: cat0 } of monthlyCredits(own, refM)) {
    for (const m of next3) {
      const got = m === refM ? own.filter(t => t.date.startsWith(m) && ruleKey(t) === k).reduce((a, t) => a + t.amount, 0) : 0;
      const remain = round2(total - got);
      if (remain < Math.max(5, total * 0.1)) continue;
      const dim = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate();
      let d = `${m}-${String(Math.min(day, dim)).padStart(2, '0')}`;
      if (d <= ref) { if (m !== refM) continue; d = ref.slice(0, 8) + String(Math.min(dim, +ref.slice(8) + 1)).padStart(2, '0'); if (d <= ref) continue; }
      if (dayNum(d) <= end) items.push({ date: d, name: k.slice(1), amount: remain, cat: cat0, expected: true });
    }
  }
  const recs = recurring(state, [id], { internal: true }).filter(r => r.sign < 0);
  for (const r of recs) for (const m of next3) {
    const dim = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate(), d = `${m}-${String(Math.min(r.day, dim)).padStart(2, '0')}`;
    if (d <= ref || dayNum(d) > end) continue;
    if (m === refM && own.some(t => t.date.startsWith(m) && sameRec(t, r))) continue; // déjà passé ce mois-ci
    items.push({ date: d, name: r.name, amount: round2(r.sign * r.amount), cat: r.cat });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  const nextIn = items.find(i => i.amount > 0) || null;
  const due = items.filter(i => i.amount < 0 && (!nextIn || i.date < nextIn.date));
  // Vérifié sur 16 mois réels : 16 alertes justes sur 16, aucune fausse alerte.
  let run = start, short = start < 0 ? ref : null; // déjà à découvert au dernier relevé : on le dit aussi
  for (const i of due) { run = round2(run + i.amount); if (run < 0 && !short) short = i.date; }
  return { start, from: ref, items, nextIn, due, dueTotal: round2(-due.reduce((a, i) => a + i.amount, 0)), need: run < 0 ? Math.ceil(-run) : 0, short };
}

// Saisies du jour (à la main ou via Apple Pay) : comptées tout de suite, puis remplacées par la vraie opération
// du relevé (même compte, même montant, de 3 jours avant à 10 jours après). La famille choisie est gardée.
function addPending(state, { acc, date, amount, label, cat, uid = '', auto = false }) {
  const id = `Q|${acc}|${date}|${round2(amount)}|${norm(label)}${uid ? '|' + uid : ''}`;
  if (state.tx.some(t => t.id === id) || (state.reconciled || []).includes(id)) return false;
  state.tx.push({ id, acc, date, amount: round2(amount), label, detail: '', bpCat: '', cat: cat || classify({ label, amount }).cat, manual: true, conf: 'sure', pending: true, ...(auto ? { auto: true } : {}) });
  return true;
}
function reconcilePending(state) {
  const used = new Set();
  const lastReal = {};
  for (const t of state.tx) if (!t.pending && !(lastReal[t.acc] >= t.date)) lastReal[t.acc] = t.date;
  for (const p of state.tx.filter(t => t.pending).sort((a, b) => a.date.localeCompare(b.date))) {
    const near = t => dayNum(t.date) >= dayNum(p.date) - (p.auto ? 5 : 3) && dayNum(t.date) <= dayNum(p.date) + 10;
    const same = p.auto ? t => ruleKey(t) === ruleKey(p) && Math.sign(t.amount) === Math.sign(p.amount) && Math.abs(Math.abs(t.amount) - Math.abs(p.amount)) <= Math.abs(p.amount) * 0.3 + 5
                        : t => Math.abs(t.amount - p.amount) < 0.01;
    const real = state.tx.find(t => !t.pending && !used.has(t) && t.acc === p.acc && same(t) && near(t));
    if (!real) {
      // Prévu qui n'a pas eu lieu (abonnement arrêté…) : le relevé couvre la date depuis longtemps → on l'enlève.
      if (p.auto && lastReal[p.acc] && dayNum(lastReal[p.acc]) > dayNum(p.date) + 12) { (state.reconciled ||= []).push(p.id); state.tx.splice(state.tx.indexOf(p), 1); }
      continue;
    }
    used.add(real);
    if (!real.manual) { real.cat = p.cat; real.manual = true; real.conf = 'sure'; }
    (state.reconciled ||= []).push(p.id);
    state.tx.splice(state.tx.indexOf(p), 1);
  }
}

// Prélèvements et rentrées réguliers inscrits tout seuls le jour où ils tombent (« prévus »), entre le dernier relevé
// et aujourd'hui. Le relevé les remplace ensuite par les vraies opérations (montant exact).
function autoRecurring(state, now) {
  let n = 0;
  for (const id of Object.keys(state.accounts)) {
    if (state.accounts[id].hist) continue;
    const last = state.tx.filter(t => t.acc === id && !t.pending).reduce((m, t) => (t.date > m ? t.date : m), '');
    if (!last) continue;
    const own = state.tx.filter(t => t.acc === id), credits = monthlyCredits(own, last.slice(0, 7));
    const items = recurring(state, [id], { internal: true }).filter(r => r.sign < 0 || !credits.some(c => c.key === r.key))
      .map(r => ({ key: r.key, name: r.name, amount: r.sign * r.amount, day: r.day, cat: r.cat, seen: (t, m) => t.date.startsWith(m) && sameRec(t, r) }))
      .concat(credits.map(c => ({ key: c.key, name: c.name, amount: round2(c.total), day: c.day, cat: c.cat, seen: (t, m) => t.date.startsWith(m) && ruleKey(t) === c.key })));
    for (const r of items) {
      // Mois en cours seulement : pour un mois passé sans relevé, on signale le relevé manquant au lieu d'inventer
      // (testé : extrapoler sans les achats du quotidien donne des soldes faux de plusieurs milliers d'euros).
      for (let m = last.slice(0, 7) > now.slice(0, 7) ? last.slice(0, 7) : now.slice(0, 7); m <= now.slice(0, 7); m = shiftMonth(m, 1)) {
        const dim = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate(), d = `${m}-${String(Math.min(r.day, dim)).padStart(2, '0')}`;
        if (d <= last || d > now || own.some(t => r.seen(t, m))) continue;
        if (addPending(state, { acc: id, date: d, amount: r.amount, label: r.name, cat: r.cat, auto: true })) n++;
      }
    }
  }
  return n;
}

// Journal de paiements (ex. automatisation iPhone « Transaction » Apple Pay) : une ligne « date;montant;commerçant ».
const JOURNAL_LINE = /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\s*;\s*([-+]?[\d\s\u00a0\u202f.,]+)\s*(?:€|EUR)?\s*;\s*(.+?)\s*$/i;
// Ou « date;texte de la notification » (Android : MacroDroid recopie la notification Google Wallet / Banque Populaire).
const JOURNAL_FREE = /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\s*;\s*(.*?(\d{1,3}(?:[ .\u00a0\u202f]\d{3})*,\d{2}|\d+[.,]\d{2})\s*(?:€|EUR).*?)\s*$/i;
const isJournal = text => !/LIBELLE|OFXHEADER/i.test(text) && text.split(/\r?\n/).some(l => JOURNAL_LINE.test(l) || JOURNAL_FREE.test(l));
// « Paiement de 12,50 € chez CARREFOUR CITY » → commerçant « CARREFOUR CITY »
const merchantOf = txt => {
  const m = txt.match(/(?:^|\s)(?:chez|aupr[eè]s de|à|au|at|reçu de|recu de|de la part de)\s+(.+?)(?:\s+(?:le|du|avec|par|via)\s.*)?[.!]?$/i);
  return (m ? m[1] : txt.replace(/[-+]?\d[\d\s\u00a0\u202f.,]*\s*(?:€|EUR)/gi, ' ').replace(/\b(paiement|achat|transaction|carte|de|d'un montant|effectué|e|par|cb)\b/gi, ' ')).replace(/\s+/g, ' ').trim() || 'Paiement';
};
function parseJournal(text) {
  return text.split(/\r?\n/).map(l => {
    let m = l.match(JOURNAL_LINE);
    if (m) {
      const v = parseNumber(m[2]);
      // un paiement est une dépense : « 12,50 » devient −12,50 ; « +20 » reste une rentrée (remboursement)
      return { date: parseDate(m[1]), amount: /^\s*\+/.test(m[2]) ? Math.abs(v) : -Math.abs(v), label: m[3] };
    }
    m = l.match(JOURNAL_FREE);
    if (!m) return null;
    const v = Math.abs(parseNumber(m[3])), credit = /rembours|crédit|credit|reçu|recu|versement re/i.test(m[2]);
    return { date: parseDate(m[1]), amount: credit ? v : -v, label: merchantOf(m[2]) };
  }).filter(r => r && r.date && r.amount);
}

// Virements entre vous deux, reconnus à vos prénoms : « VIR M PAUL MARTIN », « VIREMENT MME CLAIRE DU »,
// et même tronqués par la banque : « VIREMENT MME MARTIN CLA ». Jamais un revenu ni une dépense pour le foyer.
function householdTransfers(state) {
  const names = (state.people || []).map(p => norm(p.name)).filter(n => n.length >= 3 && n !== 'MOI');
  for (const t of state.tx) {
    delete t.hh;
    if (t.pending || !names.length) continue;
    const l = norm(cleanLabel(t.label)), w = l.split(' ');
    if (!/^(VIR|VIREMENT)\b|\bWERO\b/.test(l)) continue;
    const last = w[w.length - 1];
    const civ = /\b(M|MME|MLLE|MR|MONSIEUR|MADAME)\b/.test(l);
    const hit = names.some(n => w.includes(n) || (civ && l.length >= 22 && last.length >= 3 && n.startsWith(last)));
    if (!hit) continue;
    t.hh = true;
    if (!t.manual) { t.cat = 'interne'; t.conf = 'likely'; }
  }
}

// En voyage : un commerce inconnu payé loin de chez vous (à l'étranger, ou dans un autre département, ville inhabituelle)
// au milieu d'autres paiements loin de chez vous sur plusieurs jours → « Vacances ». Les enseignes connues gardent leur famille.
function tripSpending(state) {
  const card = state.tx.filter(t => !t.pending && t.amount < 0 && !isHist(state, t.acc)).map(t => ({ t, p: cardParts(t.label) })).filter(x => x.p && !x.p.online);
  if (card.length < 20) return;
  const town = c => { const w = c.replace(/\bSAINTE\b/g, 'STE').replace(/\bSAINT\b/g, 'ST').split(' '); return w[0] + (/^(ST|STE|LE|LA|LES)$/.test(w[0]) && w[1] ? ' ' + w[1].slice(0, 5) : ''); };
  const dept = {}, cityMonths = {}, keyMonths = {}, local = new Set();
  for (const { t, p } of card) {
    if (p.dept) dept[p.dept] = (dept[p.dept] || 0) + 1;
    (cityMonths[town(p.city)] ||= new Set()).add(t.date.slice(0, 7));
    (keyMonths[ruleKey(t)] ||= new Set()).add(t.date.slice(0, 7));
  }
  const home = Object.entries(dept).sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const { p } of card) if (p.dept === home) local.add(town(p.city)); // une ville déjà vue avec le département de la maison est locale
  // département écrit : il fait foi (deux villes du même nom dans deux départements ne sont pas le même lieu) ; sinon, la ville
  const away = ({ p }) => p.country !== 'FR' || (p.dept ? p.dept !== home : !local.has(town(p.city)) && (cityMonths[town(p.city)] || new Set()).size < 3);
  const strong = ({ p }) => p.country !== 'FR' || (p.dept && p.dept !== home); // à l'étranger, ou département écrit et différent
  // indices de voyage : paiements loin de chez soi, hors commerces habituels (abonnements en ligne domiciliés à Paris…)
  const ev = card.filter(x => away(x) && (keyMonths[ruleKey(x.t)] || new Set()).size < 3);
  for (const x of card) {
    if (x.t.manual || x.t.conf !== 'guess') continue;
    const near = ev.filter(e => e.t !== x.t && Math.abs(dayNum(e.t.date) - dayNum(x.t.date)) <= 3);
    const sameTownStrong = near.some(e => strong(e) && town(e.p.city) === town(x.p.city)); // « FR CARNAC » à côté de « 56CARNAC »
    if (!away(x) && !sameTownStrong) continue;
    const days = new Set([x.t.date, ...near.map(e => e.t.date)]).size;
    // un séjour : plusieurs achats dans la même ville de bord de mer…, ou un lieu sans ambiguïté (étranger, autre département)
    if (near.length >= 2 && days >= 2 && (strong(x) || sameTownStrong || near.some(e => town(e.p.city) === town(x.p.city)))) { x.t.cat = 'vacances'; x.t.conf = 'likely'; x.t.trip = x.p.city; }
  }
}

// On ne dérange pas pour un achat unique de moins de 25 € chez un commerce inconnu : « Autres », sans question.
// Tout ce qui revient, ou coûte plus, est demandé une fois (et retenu pour toutes les opérations du marchand).
const QUIET = 25;
function quietSmall(state) {
  const n = {};
  for (const t of state.tx) if (t.conf === 'guess' && !t.manual) n[ruleKey(t)] = (n[ruleKey(t)] || 0) + 1;
  for (const t of state.tx) if (t.conf === 'guess' && !t.manual && t.amount < 0 && -t.amount < QUIET && n[ruleKey(t)] === 1 && !isPerson(norm(cleanLabel(t.label)))) { t.cat = 'autres'; t.conf = 'likely'; }
}

function recompute(state) {
  reconcilePending(state);
  for (const t of state.tx) {
    t.pair = null; delete t.trip;
    if (t.manual) { t.conf = 'sure'; continue; }
    Object.assign(t, classify(t, state.rules));
  }
  householdTransfers(state);
  tripSpending(state);
  quietSmall(state);
  pairTransfers(state);
  linkRefunds(state);
}

function importParsed(state, parsed, owner = null) {
  let added = 0, dup = 0;
  const seen = new Set(state.tx.map(t => t.id)), created = [];
  const done = [];
  for (const p of parsed) {
    const { rows, savings } = p;
    let account = safeKey(p.account); // le même identifiant qu'à la relecture
    // Compte nommé d'après un fichier sans numéro : identifiant unique (deux téléphones peuvent importer « Relevé d'opérations.csv »
    // pour deux comptes différents ; la synchro ne doit pas les fusionner). Le nom du fichier reste comme indice (src).
    const src = p.weak === 'name' && !state.accounts[account] ? account : null;
    if (src) account = src.slice(0, 50) + '-' + Math.random().toString(36).slice(2, 7);
    if (!state.accounts[account]) {
      state.accounts[account] = { name: p.name || (savings ? 'Livret ••' : 'Compte ••') + account.slice(-4), savings: !!savings,
        owner: p.owner !== undefined ? p.owner : owner, ...(p.hist ? { hist: true } : {}), ...(src ? { src } : {}) };
      created.push(account);
    }
    done.push(p);
    const count = {};
    for (const r of rows) {
      // Sans le libellé : le même mois importé en CSV puis en PDF ne crée pas de doublon.
      const base = [account, r.date, r.amount].join('|');
      count[base] = (count[base] || 0) + 1; // deux cafés identiques le même jour restent deux opérations
      const id = base + '#' + count[base];
      if (seen.has(id)) { dup++; continue; }
      seen.add(id); added++;
      state.tx.push({ id, acc: account, date: r.date, amount: r.amount, label: r.label,
                      detail: r.detail || '', bpCat: r.bpCat || '', cat: r.cat || null, manual: !!r.cat });
    }
  }
  // Soldes : on garde le plus récent. Contrôles : chaque relevé doit tomber juste (départ + opérations = fin),
  // et la fin d'un relevé doit être le départ du suivant ; sinon il manque un relevé entre les deux.
  for (const { account, balance, check, opening: op } of done) {
    const a = state.accounts[account];
    if (check !== null && check !== undefined && (!a.check || Math.abs(check) >= 0.01 || Math.abs(a.check.diff) < 0.01)) a.check = { to: balance.date, diff: check };
    if (balance && op && op.date) {
      a.periods = (a.periods || []).filter(x => x.to !== balance.date).concat({ from: op.date, to: balance.date, open: op.amount, close: balance.amount });
      a.periods.sort((x, y) => x.to.localeCompare(y.to));
      a.gaps = a.periods.slice(1).map((x, i) => [a.periods[i], x]).filter(([p, x]) => Math.abs(p.close - x.open) >= 0.01 || p.to !== x.from).map(([p, x]) => ({ from: p.to, to: x.from }));
    }
    if (balance && balance.date && (!a.balance || balance.date >= a.balance.date)) a.balance = balance;
  }
  recompute(state);
  return { added, dup, created };
}

const isHist = (state, id) => !!(state.accounts[id] && state.accounts[id].hist);
function activeTx(state) {
  const key = t => ((state.accounts[t.acc] || {}).owner || '') + '|' + t.date.slice(0, 7);
  const real = new Set(state.tx.filter(t => !isHist(state, t.acc)).map(key));
  return state.tx.filter(t => !isHist(state, t.acc) || !real.has(key(t)));
}

function monthStats(state, month, acc = 'all') {
  const tx = activeTx(state).filter(t => t.date.startsWith(month) && inAcc(acc, t.acc));
  const by = {}; let income = 0, saved = 0;
  // Une opération découpée (« splits ») compte pour chacune de ses parts.
  for (const t of tx.flatMap(t => t.splits ? t.splits.map(p => ({ ...t, cat: p.cat, amount: p.amount, splits: null })) : [t])) {
    if (t.cat === 'interne' && (t.pair ? !inAcc(acc, t.pair) : t.hh)) {
      if (t.amount > 0) income += t.amount; else by.couple = (by.couple || 0) - t.amount;
      continue;
    }
    const k = cat(t.cat).kind;
    if (k === 'neutre') continue;
    if (k === 'in') income += t.amount;
    else if (k === 'epargne') saved -= t.amount;
    else by[t.cat] = (by[t.cat] || 0) - t.amount; // un remboursement réduit la dépense de sa famille
  }
  const spent = Object.values(by).reduce((a, b) => a + b, 0);
  return { tx, by, income, saved, spent, rest: income - spent - saved };
}

function balanceOf(state, id) {
  const b = state.accounts[id] && state.accounts[id].balance;
  if (!b) return null;
  return round2(b.amount + state.tx.filter(t => t.acc === id && t.date > b.date && !t.auto).reduce((s, t) => s + t.amount, 0)); // un prévu n'est pas de l'argent parti
}

const shiftMonth = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

// Solde d'un compte à une date donnée, reconstitué depuis le dernier solde connu (avant ou après).
function balanceAt(state, id, d) {
  const b = state.accounts[id] && state.accounts[id].balance;
  if (!b) return null;
  let v = b.amount;
  for (const t of state.tx) {
    if (t.acc !== id) continue;
    if (t.date > b.date && t.date <= d) v += t.amount;
    else if (t.date > d && t.date <= b.date) v -= t.amount;
  }
  return round2(v);
}

// Fusion de deux sauvegardes (ton téléphone + celui de l'autre) : rien n'est perdu, en cas de conflit l'appareil local gagne.
function mergeStates(local, other) {
  const out = JSON.parse(JSON.stringify(local)), o = JSON.parse(JSON.stringify(other));
  for (const [id, a] of Object.entries(o.accounts || {})) {
    const m = out.accounts[id];
    if (!m) { out.accounts[id] = a; continue; }
    if (!m.owner && a.owner) m.owner = a.owner;
    if (a.balance && (!m.balance || a.balance.date > m.balance.date)) m.balance = a.balance;
    m.savings = m.savings || a.savings;
  }
  const byId = new Map(out.tx.map(t => [t.id, t]));
  for (const t of o.tx || []) {
    const m = byId.get(t.id);
    if (!m) { out.tx.push(t); byId.set(t.id, t); } else if (t.manual && !m.manual) { m.cat = t.cat; m.manual = true; }
  }
  out.rules = { ...(o.rules || {}), ...out.rules };
  out.payers = { ...(o.payers || {}), ...(out.payers || {}) };
  out.claimed = { ...(o.claimed || {}), ...(out.claimed || {}) };
  out.annualHide = { ...(o.annualHide || {}), ...(out.annualHide || {}) };
  out.levers = { cat: { ...((o.levers || {}).cat || {}), ...((out.levers || {}).cat || {}) }, merchant: { ...((o.levers || {}).merchant || {}), ...((out.levers || {}).merchant || {}) } };
  out.histBal ||= o.histBal || null;
  out.reconciled = [...new Set([...(out.reconciled || []), ...(o.reconciled || [])])];
  out.tx = out.tx.filter(t => !(t.pending && out.reconciled.includes(t.id))); // saisie déjà remplacée sur l'autre téléphone
  for (const k of ['budgets', 'challenges', 'checkins', 'noSpend', 'rit']) {
    out[k] ||= {};
    for (const [w, v] of Object.entries(o[k] || {})) out[k][w] = { ...v, ...(out[k][w] || {}) };
  }
  for (const k of ['pots', 'loans', 'assets']) {
    out[k] ||= [];
    for (const p of o[k] || []) {
      const m = out[k].find(x => x.id === p.id);
      if (!m) { out[k].push(p); continue; }
      if (p.moves) {
        const seen = new Set(m.moves.map(x => x.date + x.amount + x.note));
        for (const mv of p.moves) if (!seen.has(mv.date + mv.amount + mv.note)) m.moves.push(mv);
      }
      if (k !== 'pots' && p.date > m.date) Object.assign(m, p);
    }
  }
  recompute(out);
  return out;
}

// Compte joint : qui a versé quoi ce mois-ci. Un virement apparié vient du titulaire du compte d'origine ;
// sinon (autre banque, compte non importé) on se sert de ce que tu as appris (« ce libellé = Claire »).
function jointSplit(state, month) {
  const commun = Object.keys(state.accounts).filter(id => state.accounts[id].owner === 'commun');
  const by = {}, unknown = [];
  for (const t of state.tx) {
    if (!t.date.startsWith(month) || !commun.includes(t.acc) || t.amount <= 0 || isHist(state, t.acc) || t.auto) continue;
    const src = t.pair && state.accounts[t.pair] ? state.accounts[t.pair].owner : null;
    const who = (src && src !== 'commun' && src) || (state.payers || {})[ruleKey(t)];
    if (who === 'autre') continue;
    if (who) by[who] = round2((by[who] || 0) + t.amount);
    // Salaire, prévoyance, CAF… versés directement sur le joint ne sont pas « un versement de l'un de vous ».
    else if (t.cat === 'interne' || (t.cat === 'revenus' && !INCOME.test(norm(t.label + ' ' + t.detail)))) unknown.push(t);
  }
  return { by, unknown };
}

// Charges annuelles : grosses dépenses vues 1 ou 2 fois sur 12 mois (taxe foncière, assurance auto…),
// pour les lisser en « tant par mois à mettre de côté ».
const ANNUAL_HINT = /ASSUR|TAXE|FONCIER|IMPOT|MUTUELLE|COTISATION|ANNUEL|MAIF|MACIF|MATMUT|\bGMF\b|\bAXA\b|ALLIANZ|GROUPAMA|CARTE GRISE|CHAUDIERE|RAMONAGE|ENTRETIEN|DGFIP/;
function annualCharges(state, month, acc = 'all') {
  const from = shiftMonth(month, -12), monthly = new Set(recurring(state, acc).map(r => r.key));
  const g = {};
  for (const t of state.tx) {
    const m = t.date.slice(0, 7);
    if (m <= from || m > month || t.amount >= 0 || !inAcc(acc, t.acc) || ['interne', 'epargne'].includes(t.cat) || isHist(state, t.acc)) continue;
    (g[ruleKey(t)] ||= []).push(t);
  }
  const out = [];
  for (const [k, ts] of Object.entries(g)) {
    if (monthly.has(k) || (state.annualHide || {})[k]) continue;
    const ms = [...new Set(ts.map(t => t.date.slice(0, 7)))].sort();
    const total = ts.reduce((a, t) => a - t.amount, 0), big = Math.max(...ts.map(t => -t.amount));
    if (ms.length > 2 || big < 150) continue;
    if (!ANNUAL_HINT.test(norm(ts[0].label + ' ' + ts[0].detail)) && cat(ts[0].cat).kind !== 'fixe') continue;
    const step = ms.length === 2 ? 6 : 12;
    let next = shiftMonth(ms[ms.length - 1], step);
    while (next <= month) next = shiftMonth(next, step);
    out.push({ key: k, name: k.slice(1), total: round2(total), perMonth: Math.ceil(total / 12), next, cat: ts[0].cat });
  }
  return out.sort((a, b) => a.next.localeCompare(b.next));
}

// Moyenne par famille sur les n mois précédents qui ont des données.
function avgBy(state, month, acc = 'all', n = 3) {
  const ms = lastFull(state, month, acc, n), sum = {};
  for (const x of ms) for (const [c, v] of Object.entries(monthStats(state, x, acc).by)) sum[c] = (sum[c] || 0) + v;
  for (const c in sum) sum[c] /= ms.length;
  return sum;
}

// Calendrier : jour libre = aucune dépense « variable » (les charges fixes ne comptent pas).
function dayGrid(state, month, acc = 'all', nothing = {}) {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Après le dernier relevé, on ne sait pas : un jour « libre » doit être prouvé par le relevé (ou déclaré « rien dépensé »).
  const last = state.tx.filter(t => inAcc(acc, t.acc) && !t.pending && !isHist(state, t.acc)).reduce((a, t) => (t.date > a ? t.date : a), '');
  const spent = new Set(state.tx.filter(t => t.date.startsWith(month) && inAcc(acc, t.acc) && !isHist(state, t.acc)
    && t.amount < 0 && cat(t.cat).kind === 'var').map(t => t.date));
  return Array.from({ length: n }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { d, state: spent.has(d) ? 'spent' : d <= last || nothing[d] ? 'free' : 'unknown' };
  });
}

// Conseils : uniquement des faits tirés des relevés (jamais une promesse de taux ou une prévision).
const addDay = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
// Solde de fin de journée, jour par jour, d'après les seules opérations réelles du relevé.
function dailyBalances(state, id, from, to) {
  const b = state.accounts[id] && state.accounts[id].balance;
  if (!b || from > to) return [];
  const real = state.tx.filter(t => t.acc === id && !t.pending), byDay = {};
  let v = b.amount;
  for (const t of real) { if (t.date > b.date && t.date < from) v += t.amount; else if (t.date >= from && t.date <= b.date) v -= t.amount; }
  for (const t of real) if (t.date >= from && t.date <= to) byDay[t.date] = (byDay[t.date] || 0) + t.amount;
  const out = [];
  for (let d = from; d <= to; d = addDay(d, 1)) { v = round2(v + (byDay[d] || 0)); out.push([d, v]); }
  return out;
}
// Frais Banque Populaire : libellés « F … » (F Cotis Pack, F AGIOS, F Frais…), commissions, agios. « GRAND FRAIS » est un magasin.
const FEE = /^F |\bAGIOS\b|COMMISSION D ?INTERVENTION|\bCOTIS(ATION)? (CARTE|PACK|CONVENTION|OFFRE)|FRAIS (DE )?TENUE|INTERETS DEBITEURS|FRAIS BANCAIRES/;
const isFee = t => t.amount < 0 && !/GRAND FRAIS/.test(norm(t.label)) && FEE.test(norm(t.label));
function insights(state, acc = 'all') {
  const ids = Object.keys(state.accounts).filter(id => inAcc(acc, id) && !isHist(state, id)), out = [];
  const real = state.tx.filter(t => ids.includes(t.acc) && !t.pending), last = real.reduce((a, t) => (t.date > a ? t.date : a), '');
  if (!last) return out;
  // 1. Frais bancaires sur un an
  const fees = real.filter(t => t.date > addDay(last, -365) && isFee(t)), feeTot = round2(-fees.reduce((a, t) => a + t.amount, 0));
  if (feeTot >= 30) {
    const g = {}; for (const t of fees) g[t.label] = (g[t.label] || 0) - t.amount;
    const top = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
    out.push({ kind: 'fees', total: feeTot, perMonth: Math.round(feeTot / 12), top: top[0], topTotal: round2(top[1]), n: fees.length });
  }
  for (const id of ids) {
    const a = state.accounts[id];
    if (a.savings || !a.balance || (state.pots || []).some(p => p.acc === id)) continue; // relié à un objectif = de l'épargne
    const own = real.filter(t => t.acc === id), first = own.reduce((m, t) => (!m || t.date < m ? t.date : m), ''), end = own.reduce((m, t) => (t.date > m ? t.date : m), '');
    if (!first) continue;
    const from = addDay(end, -89), series = dailyBalances(state, id, from < first ? first : from, end);
    if (series.length < 30) continue;
    const neg = series.filter(([, v]) => v < 0), min = Math.min(...series.map(([, v]) => v));
    // 2. Découvert : combien de jours, jusqu'où
    if (neg.length) out.push({ kind: 'overdraft', id, days: neg.length, min: Math.round(min), last: neg[neg.length - 1][0], span: series.length });
    // 3. Argent qui dort : le compte n'est jamais descendu sous ce montant ; on garde 500 € de marge
    // (seulement un compte du quotidien : un compte qui ne fait que recevoir des virements sert déjà d'épargne)
    else if (series.length >= 60 && min >= 1000 && own.filter(t => t.date >= from && t.amount < 0 && ['var', 'fixe'].includes(cat(t.cat).kind)).length >= 5) out.push({ kind: 'idle', id, min: Math.round(min), move: Math.floor((min - 500) / 100) * 100, span: series.length });
  }
  // 4. Abonnements qui s'additionnent
  const subs = recurring(state, ids).filter(r => r.sign < 0 && r.cat === 'abos');
  if (subs.length >= 3) out.push({ kind: 'subs', n: subs.length, total: round2(subs.reduce((x, r) => x + r.amount, 0)), names: subs.map(r => r.name) });
  return out;
}

// Garde-fou : tout ce qui entre (synchro par lien, sauvegarde, version précédente, stockage) est vérifié et nettoyé.
// Chaque identifiant affiché dans l'app a un format sûr, chaque montant est un nombre, chaque famille existe :
// un lien piégé ne peut ni injecter de code, ni faire planter un écran.
const SAFE_ID = /^[\w.\- ]{1,60}$/, DATE = /^\d{4}-\d{2}-\d{2}$/, MONTH = /^\d{4}-\d{2}$/;
// Identifiant de compte sûr, toujours le même pour le même nom : un CSV sans numéro de compte prend le nom du fichier
// (« Relevé d'opérations (1) ») ; refusé tel quel à la relecture, il faisait disparaître le compte et toutes ses opérations.
function safeKey(k) {
  k = String(k == null ? '' : k);
  if (SAFE_ID.test(k) && !/^(__proto__|constructor|prototype)$/.test(k)) return k;
  let h = 5381; for (const ch of k) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return (k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\- ]/g, '_').slice(0, 50) || 'compte') + '-' + h.toString(36);
}
function sanitizeState(d) {
  const o = d && typeof d === 'object' ? d : {}, obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {}), arr = x => (Array.isArray(x) ? x : []);
  const str = (x, n = 300) => (typeof x === 'string' ? x : x == null ? '' : String(x)).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
  const num = x => (typeof x === 'number' && isFinite(x) ? x : typeof x === 'string' && isFinite(+x) && x.trim() ? +x : 0);
  const date = x => (typeof x === 'string' && DATE.test(x) ? x : null), okCat = c => (CAT[c] ? c : 'autres');
  const id = (x, fb) => (typeof x === 'string' && SAFE_ID.test(x) ? x : fb());
  let n = 0; const newId = () => 'x' + Date.now().toString(36) + (n++);
  const people = arr(o.people).filter(p => p && SAFE_ID.test(p.id)).map(p => ({ id: p.id, name: str(p.name, 40) || p.id })).slice(0, 4);
  const who = new Set(['foyer', 'commun', ...people.map(p => p.id)]), owner = x => (who.has(x) ? x : null);
  const dmap = x => Object.fromEntries(Object.entries(obj(x)).filter(([k]) => DATE.test(k)).map(([k]) => [k, 1]));
  const byWho = (x, f) => Object.fromEntries(Object.entries(obj(x)).filter(([k]) => who.has(k)).map(([k, v]) => [k, f(v)]));
  const accounts = {};
  for (const [k0, a] of Object.entries(obj(o.accounts))) {
    const k = safeKey(k0);
    if (!a || typeof a !== 'object') continue;
    const b = obj(a.balance), per = arr(a.periods).filter(x => x && date(x.from) && date(x.to));
    accounts[k] = { ...(a.hist ? { hist: true } : {}), ...(typeof a.src === 'string' && SAFE_ID.test(a.src) ? { src: a.src } : {}), name: str(a.name, 60) || str(k0, 60), owner: owner(a.owner), savings: !!a.savings,
      ...(date(b.date) ? { balance: { amount: num(b.amount), date: b.date } } : {}),
      ...(per.length ? { periods: per.map(x => ({ from: x.from, to: x.to, open: num(x.open), close: num(x.close) })) } : {}),
      ...(arr(a.gaps).length ? { gaps: arr(a.gaps).filter(g => g && date(g.from) && date(g.to)).map(g => ({ from: g.from, to: g.to })) } : {}),
      ...(a.check && typeof a.check === 'object' ? { check: { diff: num(a.check.diff), ...(date(a.check.to) ? { to: a.check.to } : {}) } } : {}) };
  }
  // Une opération dont la fiche de compte a été abîmée : on recrée la fiche plutôt que de perdre l'opération.
  for (const t of arr(o.tx)) if (t && typeof t.acc === 'string' && !accounts[safeKey(t.acc)]) accounts[safeKey(t.acc)] = { name: str('Compte ••' + t.acc.slice(-4), 60), owner: null, savings: false };
  const tx = [];
  for (const t of arr(o.tx)) {
    const acc = t && typeof t.acc === 'string' ? safeKey(t.acc) : '';
    if (!t || typeof t !== 'object' || !accounts[acc] || !date(t.date) || typeof t.id !== 'string' || !t.id) continue;
    const x = { id: str(t.id, 400), acc, date: t.date, amount: round2(num(t.amount)), label: str(t.label, 200) || '—', detail: str(t.detail, 300), bpCat: str(t.bpCat, 60), cat: okCat(t.cat),
      manual: !!t.manual, pair: null, conf: ['sure', 'likely', 'guess'].includes(t.conf) ? t.conf : 'guess' };
    for (const k of ['pending', 'auto', 'hh']) if (t[k]) x[k] = true;
    if (typeof t.trip === 'string') x.trip = t.trip.slice(0, 40);
    if (typeof t.pair === 'string' && accounts[safeKey(t.pair)]) x.pair = safeKey(t.pair);
    if (typeof t.refundOf === 'string') { x.refundOf = t.refundOf.slice(0, 400); } if (t.refunded) x.refunded = round2(num(t.refunded));
    if (Array.isArray(t.splits) && t.splits.length) x.splits = t.splits.slice(0, 6).map(p => ({ cat: okCat(p && p.cat), amount: round2(num(p && p.amount)) }));
    tx.push(x);
  }
  const things = (list, f) => { const seen = new Set(); return arr(list).filter(x => x && typeof x === 'object').map(x => { let i = id(x.id, newId); if (seen.has(i)) i = newId(); seen.add(i); return { ...f(x), id: i }; }); };
  const levers = obj(o.levers), lv = l => (LEVERS[l] ? l : 'essentiel');
  return {
    people: people.length ? people : [{ id: 'p1', name: 'Moi' }],
    ...(o.setup ? { setup: true } : {}), ...(['bp', 'ce', 'autre'].includes(o.bank) ? { bank: o.bank } : {}),
    accounts, tx,
    rules: Object.fromEntries(Object.entries(obj(o.rules)).map(([k, c]) => [str(k, 120), okCat(c)])),
    budgets: byWho(o.budgets, v => Object.fromEntries(Object.entries(obj(v)).filter(([c]) => CAT[c]).map(([c, x]) => [c, Math.max(0, num(x))]))),
    pots: things(o.pots, p => ({ owner: owner(p.owner) || 'foyer', name: str(p.name, 60) || 'Objectif', emoji: str(p.emoji, 8) || '🎯', target: Math.max(1, num(p.target)),
      moves: arr(p.moves).filter(m => m && date(m.date)).map(m => ({ date: m.date, amount: round2(num(m.amount)), note: str(m.note, 40) })), ...(typeof p.acc === 'string' && accounts[safeKey(p.acc)] ? { acc: safeKey(p.acc) } : {}) })),
    loans: things(o.loans, l => ({ owner: owner(l.owner) || 'foyer', name: str(l.name, 60) || 'Prêt', remaining: num(l.remaining), date: date(l.date) || '2000-01-01' })),
    assets: things(o.assets, a => ({ owner: owner(a.owner) || 'foyer', name: str(a.name, 60) || 'Placement', value: num(a.value), date: date(a.date) || '2000-01-01' })),
    claimed: Object.fromEntries(Object.entries(obj(o.claimed)).map(([k, v]) => [str(k, 120), v === 'skip' ? 'skip' : str(v, 60)])),
    challenges: {},
    payers: Object.fromEntries(Object.entries(obj(o.payers)).map(([k, v]) => [str(k, 200), who.has(v) || v === 'autre' ? v : 'autre'])),
    annualHide: Object.fromEntries(Object.entries(obj(o.annualHide)).map(([k]) => [str(k, 120), true])),
    levers: { cat: Object.fromEntries(Object.entries(obj(levers.cat)).filter(([c]) => CAT[c]).map(([c, l]) => [c, lv(l)])),
      // un mot-clé de marchand devient une expression régulière : lettres, chiffres et espaces seulement
      merchant: Object.fromEntries(Object.entries(obj(levers.merchant)).filter(([k]) => /^[a-z0-9 ]{1,60}$/.test(k)).map(([k, l]) => [k, lv(l)])) },
    histBal: o.histBal && typeof o.histBal === 'object' ? Object.fromEntries(Object.entries(o.histBal).map(([k, b]) => [str(k, 60), { owner: owner(obj(b).owner), savings: !!obj(b).savings,
      months: Object.fromEntries(Object.entries(obj(obj(b).months)).filter(([m]) => MONTH.test(m)).map(([m, v]) => [m, num(v)])) }])) : null,
    done: Object.fromEntries(Object.entries(obj(o.done)).map(([k, v]) => [str(k, 160), str(v, 10)])),
    snooze: Object.fromEntries(Object.entries(obj(o.snooze)).map(([k, v]) => [str(k, 160), str(v, 10)])),
    quickAcc: byWho(o.quickAcc, v => (typeof v === 'string' && accounts[safeKey(v)] ? safeKey(v) : null)),
    reconciled: arr(o.reconciled).filter(x => typeof x === 'string').map(x => x.slice(0, 400)).slice(-5000),
    checkins: byWho(o.checkins, dmap), noSpend: byWho(o.noSpend, dmap),
    rit: byWho(o.rit, r => Object.fromEntries(['day', 'week', 'month', 'ics'].filter(k => typeof obj(r)[k] === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(r[k])).map(k => [k, r[k]]))),
    cv: typeof o.cv === 'number' ? o.cv : 0,
    ...(validCode(o.code) ? { code: fmtCode(o.code) } : {}), ...(o.codeShown ? { codeShown: true } : {}),
    seen: Object.fromEntries(Object.entries(obj(o.seen)).filter(([k]) => /^\w{1,30}$/.test(k)).map(([k]) => [k, 1])),
    ...Object.fromEntries(['lastBackup', 'lastImport', 'lastSync', 'lastRecv'].filter(k => typeof o[k] === 'string' && !isNaN(Date.parse(o[k]))).map(k => [k, new Date(o[k]).toISOString()])),
  };
}

// « Dépensé depuis le 1er, comparé à d'habitude à la même date » : uniquement des opérations réelles.
// Le mois en cours doit être couvert par un relevé jusqu'au jour J (sinon des paiements manqueraient → fausse « baisse »),
// et la comparaison se fait sur les mêmes J premiers jours des derniers mois complets (médiane).
function paceCompare(state, month, acc = 'all') {
  const real = state.tx.filter(t => inAcc(acc, t.acc) && !t.pending && !isHist(state, t.acc) && t.date.startsWith(month));
  const lastDay = real.reduce((a, t) => (t.date > a ? t.date : a), '');
  if (!lastDay) return null;
  const D = +lastDay.slice(8), ms = lastFull(state, month, acc);
  if (D < 3 || !ms.length) return null;
  const upTo = m => monthStats({ ...state, tx: state.tx.filter(t => !t.auto && (t.date.slice(0, 7) !== m || +t.date.slice(8) <= D)) }, m, acc);
  const now = upTo(month), past = ms.map(upTo), usualBy = {};
  for (const c of new Set(past.flatMap(p => Object.keys(p.by)))) usualBy[c] = Math.round(typical(past.map(p => Math.max(0, p.by[c] || 0))));
  return { day: D, spent: Math.round(now.spent), usual: Math.round(typical(past.map(p => p.spent))), months: ms.length, by: now.by, usualBy };
}

// Synchro entre téléphones par un simple lien (#sync=…) : les données compressées voyagent dans le message,
// jamais sur un serveur (le « # » d'une adresse n'est pas envoyé au site).
const b64u = { enc: u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) };
// Code du foyer : tout ce qui quitte le téléphone (lien de synchro, sauvegarde) est chiffré avec lui (AES-256-GCM,
// clé tirée du code par PBKDF2-SHA256, 210 000 tours). Sans le code, un lien ou un fichier est illisible, même pour qui le stocke.
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 signes, sans 0/O ni 1/I : facile à recopier
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fmtCode = c => normCode(c).replace(/(.{4})(?=.)/g, '$1-');
const validCode = c => /^[A-Z0-9]{12}$/.test(normCode(c));
function newCode() { const b = crypto.getRandomValues(new Uint8Array(12)); return fmtCode([...b].map(x => CODE_ALPHA[x & 31]).join('')); }
async function keyFrom(code, salt, iterations = 210000, raw = false) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(raw ? String(code) : normCode(code)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Coffre du téléphone : toutes les données sont chiffrées avec une clé tirée du code d'entrée (PBKDF2-SHA256, 600 000 tours,
// AES-256-GCM). La clé ne quitte jamais la mémoire et n'est jamais enregistrée : sans le code, le stockage est illisible.
const VAULT_ITER = 600000;
const goodPin = c => /^\d{6,12}$/.test(c) && !/^(\d)\1+$/.test(c) && !'01234567890123'.includes(c) && !'98765432109876'.includes(c);
async function vaultKey(code, saltB64, iter = VAULT_ITER) { return keyFrom(code, b64u.dec(saltB64), iter, true); }
const newSalt = () => b64u.enc(crypto.getRandomValues(new Uint8Array(16)));
// Format « v2. » : chiffré sans compression (la compression par flux est le maillon fragile sur certains iPhone) ;
// l'ancien format, compressé, reste lisible.
async function vaultSeal(str, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(str)));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return 'v2.' + b64u.enc(out);
}
async function vaultOpen(b64, key) {
  const v2 = b64.startsWith('v2.'), u = b64u.dec(v2 ? b64.slice(3) : b64);
  let plain;
  try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, key, u.subarray(12))); }
  catch { const e = new Error('code incorrect'); e.badCode = true; throw e; }
  return v2 ? new TextDecoder().decode(plain) : unzip(plain);
}
async function seal(bytes, code) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(code, salt), bytes));
  const out = new Uint8Array(28 + ct.length); out.set(salt); out.set(iv, 16); out.set(ct, 28); return out;
}
async function unseal(bytes, code) {
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(16, 28) }, await keyFrom(code, bytes.subarray(0, 16)), bytes.subarray(28))); }
  catch { const e = new Error('code du foyer incorrect'); e.needCode = true; throw e; }
}
// Sans Blob : Safari refuse de lire un Blob pendant la fermeture de l'app (moment où l'on enregistre la reprise).
// Par morceaux de 32 Ko : un seul gros morceau peut bloquer le flux de compression sur certains iPhone.
const pump = async (u8, stream) => {
  const w = stream.writable.getWriter(), out = new Response(stream.readable).arrayBuffer();
  for (let i = 0; i < u8.length; i += 32768) await w.write(u8.subarray(i, i + 32768));
  await w.close(); return new Uint8Array(await out);
};
const zip = str => pump(new TextEncoder().encode(str), new CompressionStream('deflate-raw'));
const unzip = async u8 => new TextDecoder().decode(await pump(u8, new DecompressionStream('deflate-raw')));

// Synchro entre téléphones par un simple lien (#sync=…) : les données compressées et chiffrées voyagent dans le message,
// jamais sur un serveur (le « # » d'une adresse n'est pas envoyé au site).
async function syncEncode(state, from, code) {
  const z = await zip(JSON.stringify({ v: 1, from, at: new Date().toISOString(), state }));
  return code ? 'e1.' + b64u.enc(await seal(z, code)) : b64u.enc(z);
}
async function syncDecode(text, code) {
  const m = String(text).match(/sync=(e1\.)?([A-Za-z0-9_-]+)/);
  if (!m) return null;
  let bytes = b64u.dec(m[2]);
  if (m[1]) { if (!validCode(code)) { const e = new Error('code du foyer nécessaire'); e.needCode = true; throw e; } bytes = await unseal(bytes, code); }
  const d = JSON.parse(await unzip(bytes));
  return d && d.v === 1 && d.state && Array.isArray(d.state.tx) ? { ...d, sealed: !!m[1] } : null;
}
// Fichier de sauvegarde chiffré : { "mescomptes": 1, "chiffre": "…" } ; un ancien fichier en clair reste lisible.
async function sealBackup(state, code) { return JSON.stringify({ mescomptes: 1, chiffre: b64u.enc(await seal(await zip(JSON.stringify(state)), code)) }); }
async function openBackup(text, code) {
  const d = JSON.parse(text);
  if (d && typeof d.chiffre === 'string') { if (!validCode(code)) { const e = new Error('code du foyer nécessaire'); e.needCode = true; throw e; } return JSON.parse(await unzip(await unseal(b64u.dec(d.chiffre), code))); }
  return d;
}

// Série : jours d'affilée où l'on a fait son point du jour. Pas encore fait aujourd'hui = la série tient jusqu'à ce soir.
const prevDay = d => new Date(Date.parse(d + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
function streak(days = {}, today) {
  let n = 0, d = days[today] ? today : prevDay(today);
  while (days[d]) { n++; d = prevDay(d); }
  return n;
}

// Rappels sans serveur : un fichier agenda (.ics) que le téléphone transforme en notifications répétées.
// Fonctionne sur iPhone comme sur Android, sans compte ni service tiers.
const RITUALS = {
  day: { title: '💸 Mes Comptes · ma journée en 10 secondes', text: 'Ouvrez Mes Comptes : un favori, une dépense, ou « rien dépensé ». Gardez votre série 🔥', rule: 'FREQ=DAILY' },
  week: { title: '📊 Mes Comptes · notre semaine', text: 'Ouvrez Mes Comptes : engagements, jours sans dépense, objectif. Chiffres pas à jour ? ⚡ Mise à jour express (2 min).', rule: 'FREQ=WEEKLY;BYDAY=SU' },
  month: { title: '📥 Mes Comptes · le rendez-vous du mois', text: 'Relevés du mois (appli de votre banque) → ＋ Importer. Puis le bilan et ce qu\'on met de côté.', rule: 'FREQ=MONTHLY;BYMONTHDAY=6' },
};
// Premier rappel le bon jour (un dimanche, un 6) : sinon l'agenda ajoute un rappel en trop le jour de départ.
function firstDay(k, start) {
  let d = start;
  if (k === 'week') while (new Date(d + 'T12:00:00Z').getUTCDay() !== 0) d = addDay(d, 1);
  if (k === 'month') while (+d.slice(8) !== 6) d = addDay(d, 1);
  return d;
}
function ritualsIcs(pick, url, start) {
  const esc = t => t.replace(/[\\;,]/g, m => '\\' + m), d = start.replace(/-/g, '');
  const ev = Object.entries(pick).filter(([k, t]) => RITUALS[k] && t).map(([k, time]) => {
    const r = RITUALS[k], hm = time.replace(':', ''), first = firstDay(k, start).replace(/-/g, '');
    return ['BEGIN:VEVENT', `UID:mescomptes-${k}@mes-comptes`, `DTSTAMP:${d}T000000Z`, `DTSTART:${first}T${hm}00`, 'DURATION:PT5M', `RRULE:${r.rule}`,
      `SUMMARY:${esc(r.title)}`, `DESCRIPTION:${esc(r.text)}\\n${url}`, `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${esc(r.title)}`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mes Comptes//FR', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR', ''].join('\r\n');
}

// Android : Google Agenda n'importe pas bien les fichiers .ics ; un lien « créer l'événement » par rappel, prérempli et répété.
function googleCalLinks(pick, url, start) {
  return Object.entries(pick).filter(([k, t]) => RITUALS[k] && t).map(([k, time]) => {
    const r = RITUALS[k], day = firstDay(k, start).replace(/-/g, ''), [h, m] = time.split(':').map(Number), e = h * 60 + m + 5;
    const hm = time.replace(':', ''), endHm = String(Math.floor(e / 60) % 24).padStart(2, '0') + String(e % 60).padStart(2, '0');
    const q = new URLSearchParams({ action: 'TEMPLATE', text: r.title, dates: `${day}T${hm}00/${day}T${endHm}00`, ctz: 'Europe/Paris', recur: `RRULE:${r.rule}`, details: `${r.text}\n${url}` });
    return { k, title: r.title, href: 'https://calendar.google.com/calendar/render?' + q };
  });
}

// Mode découverte : un foyer fictif, sur les 7 derniers mois jusqu'à hier, pour essayer l'app sans rien importer.
// Aucun chiffre réel ; rien n'est enregistré tant qu'on est dans ce mode.
function demoState(todayStr, people = [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }]) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = (a, b) => round2(a + rnd() * (b - a));
  const end = addDay(todayStr, -1), months = Array.from({ length: 7 }, (_, i) => shiftMonth(end.slice(0, 7), i - 6)), R = { A: [], B: [], C: [], LA: [] };
  const add = (acc, m, d, amount, label) => { const date = `${m}-${String(d).padStart(2, '0')}`; if (date <= end) R[acc].push({ date, amount, label }); };
  for (const [i, m] of months.entries()) {
    add('A', m, 1, -4.2, 'CB BOULANGERIE PAUL'); add('B', m, 1, -3.9, 'CB BOULANGERIE PAUL'); add('C', m, 1, -6.4, 'CB BOULANGERIE PAUL'); add('LA', m, 1, 0.01, 'INTERETS');
    add('A', m, 28, 2380, 'VIR SALAIRE HOPITAL'); add('B', m, 27, 2140, 'VIR SALAIRE ORANGE');
    add('A', m, 2, -950, 'VIR COMPTE COMMUN'); add('C', m, 2, 950, 'VIR COMPTE JOINT'); add('B', m, 2, -950, 'VIR COMPTE COMMUN'); add('C', m, 2, 950, 'VIR COMPTE JOINT');
    add('C', m, 4, -200, 'VIR LIVRET A'); add('LA', m, 4, 200, 'VIR COMPTE COMMUN');
    add('C', m, 5, -985.4, 'ECHEANCE PRET IMMO'); add('C', m, 7, -68.2, 'PRLV MATMUT ASSURANCES'); add('C', m, 10, -pick(80, 110), 'PRLV EDF');
    add('A', m, 12, -10.99, 'PRLV SPOTIFY'); add('A', m, 8, -15.99, 'PRLV FREE MOBILE'); add('B', m, 5, -13.49, 'PRLV NETFLIX'); add('B', m, 8, -15.99, 'PRLV FREE MOBILE');
    const late = i >= 4;
    for (const d of [3, 9, 16, 23, 30]) add('C', m, d, -pick(late ? 70 : 85, late ? 105 : 125), d % 2 ? 'CB CARREFOUR MARKET' : 'CB AUCHAN DRIVE');
    for (const d of [6, 13, 20, 27]) add('C', m, d, -pick(4, 9), 'CB BOULANGERIE PAUL');
    for (const d of (late ? [11, 25] : [6, 11, 18, 25])) add('A', m, d, -pick(18, 32), 'CB UBER EATS');
    for (const d of (late ? [15] : [9, 21])) add('B', m, d, -pick(9, 15), 'CB MCDONALDS');
    add('C', m, 14, -pick(48, 75), 'CB LE BISTROT'); add('B', m, 19, -pick(20, 30), 'CB PATHE CINEMA');
    add('B', m, 17, -pick(25, 80), 'CB ZARA'); add('A', m, 22, -pick(20, 60), 'CB FNAC'); add('A', m, 24, -pick(35, 60), 'CB SNCF'); add('B', m, 13, -pick(8, 22), 'CB PHARMACIE');
    if (i % 2) add('C', m, 18, -pick(60, 140), 'CB IKEA');
  }
  const S = { people, accounts: {}, tx: [], rules: {}, budgets: { foyer: { fastfood: 70 } }, pots: [], claimed: {}, challenges: {}, payers: {}, annualHide: {}, loans: [],
    levers: { cat: {}, merchant: {} }, histBal: null, done: {}, snooze: {}, assets: [], quickAcc: {}, reconciled: [], checkins: { foyer: {} }, noSpend: {}, rit: { foyer: { ics: end } }, cv: 3 };
  const meta = { A: ['Compte de ' + people[0].name, 'p1', 1240.5], B: ['Compte de ' + people[1].name, 'p2', 980.2], C: ['Compte commun', 'commun', 1615.8], LA: ['Livret A', 'commun', 6320] };
  for (const id of Object.keys(R)) {
    importParsed(S, [{ account: 'DEMO-' + id, rows: R[id], savings: id === 'LA' }]);
    Object.assign(S.accounts['DEMO-' + id], { name: meta[id][0], owner: meta[id][1], balance: { amount: meta[id][2], date: end } });
  }
  recompute(S);
  S.pots.push({ id: 'demo', owner: 'foyer', name: 'Voyage au Japon', emoji: '🗾', target: 4000, moves: months.slice(0, 6).map(m => ({ date: m + '-06', amount: 260, note: 'ajout' })) });
  for (let k = 1; k <= 6; k++) S.checkins.foyer[addDay(todayStr, -k)] = 1;
  S.lastBackup = S.lastSync = new Date(todayStr + 'T09:00:00Z').toISOString();
  return S;
}

if (typeof module !== 'undefined') module.exports = {
  streak, demoState, goodPin, vaultKey, vaultSeal, vaultOpen, zip, unzip, safeKey, matchAccount, csvRecords, newSalt, VAULT_ITER, ritualsIcs, googleCalLinks, RITUALS, paceCompare, sanitizeState, insights, dailyBalances, isFee, syncEncode, syncDecode, sealBackup, openBackup, newCode, fmtCode, validCode,
  CATS, cat, norm, merchantKey, ruleKey, legacyKey, cardParts, cleanLabel, classify, householdTransfers, tripSpending, categorize, parseNumber, parseDate, parseCSV, parseOFX,
  parsePDF, learnable, addPending, autoRecurring, reconcilePending, isJournal, parseJournal, forecast, linkRefunds, parseTreso, isTreso, activeTx, LEVERS, leverOf, merchantLever, savingsPlan, balanceOf, balanceAt, mergeStates, jointSplit, annualCharges, inAcc, fullMonth, lastFull, recurring, upcoming, engagementResults, habitBy, pairTransfers, recompute, importParsed, monthStats, avgBy, dayGrid, shiftMonth,
};
