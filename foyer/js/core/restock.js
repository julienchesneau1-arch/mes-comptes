// Produits du quotidien (dentifrice, papier toilette, café, sucre, huile…) : ils ne suivent pas les repas mais le temps qui passe.
// Foyer estime quand chacun devrait manquer et ne l'ajoute aux courses qu'à ce moment-là : la catégorie apparaît de temps en
// temps, jamais toutes les semaines. Estimation de départ : une hypothèse écrite (contenance et usage courants), rapportée au
// nombre de personnes du foyer. Elle se corrige d'elle-même : dès qu'un achat est noté (coche dans la liste, facture lue),
// l'écart réel entre deux achats prend le relais. Déterministe, sans réseau : mêmes événements, mêmes dates sur les deux téléphones.
import { addDays, daysBetween } from './dates.js';
import { nameKey, norm } from './text.js';
import { aisleOf } from './ingredients.js';
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
    // Petit-déjeuner et placard : rien d'office (café ou thé, tartines ou céréales : chaque foyer coche les siens). Hors quantités
    // des recettes : ce que le foyer consomme en plus (petit-déjeuner, assaisonnement, cuisine du quotidien).
    { id: 'cafe', name: 'Café', group: 'petitdej', pack: '1 paquet', share: 'partage', days: 18, on: false, aisle: 'sucre', size: '250 g', keys: ['cafe', 'cafe moulu'],
        why: 'paquet de 250 g : ≈ 7 g par tasse, 2 tasses par jour', match: /^(?:cafe|capsules?|dosettes?)\b/, not: /filtre/ },
    { id: 'the', name: 'Thé', group: 'petitdej', pack: '1 boîte', share: 'partage', days: 12, on: false, aisle: 'sucre', keys: ['the'],
        why: 'boîte de 25 sachets : 2 tasses par jour', match: /^the\b/ },
    { id: 'tisane', name: 'Tisane', group: 'petitdej', pack: '1 boîte', share: 'partage', days: 20, on: false, aisle: 'sucre', keys: ['tisane'],
        why: 'boîte de 20 sachets : 1 tasse par jour', match: /^(?:tisane|infusion)/ },
    { id: 'chocolat', name: 'Chocolat en poudre', group: 'petitdej', pack: '1 boîte', share: 'partage', days: 20, on: false, aisle: 'sucre', keys: ['chocolat en poudre', 'cacao'],
        why: 'boîte d\'≈ 400 g : ≈ 20 g par bol, un bol par jour', match: /^(?:chocolat en poudre|poudre chocolat|cacao)/ },
    { id: 'sucre', name: 'Sucre', group: 'petitdej', pack: '1 kg', share: 'partage', days: 100, on: false, aisle: 'sucre', size: '1 kg', keys: ['sucre', 'sucre en poudre', 'sucre semoule'],
        why: '≈ 10 g par jour (deux morceaux ou cuillères)', match: /^sucre\b/, not: /^sucre (?:glace|vanill)/ },
    { id: 'lait', name: 'Lait', group: 'petitdej', pack: '6 briques d\'1 L', share: 'partage', days: 24, on: false, aisle: 'cremerie', size: '6 l', keys: ['lait', 'lait demi-ecreme', 'lait entier', 'lait ecreme'],
        why: '≈ 25 cl par jour (café au lait, céréales)', match: /^lait\b/, not: /^lait (?:de coco|d'amande|d'avoine|de soja|vegetal|concentre|de croissance)/ },
    { id: 'cereales', name: 'Céréales', group: 'petitdej', pack: '1 paquet', share: 'partage', days: 12, on: false, aisle: 'sucre', keys: ['cereale', 'muesli', 'granola'],
        why: 'paquet de 500 g : ≈ 40 g par bol', match: /^(?:cereales?|muesli|granola|corn flakes|petales)/ },
    { id: 'avoine', name: 'Flocons d\'avoine', group: 'petitdej', pack: '1 paquet', share: 'partage', days: 12, on: false, aisle: 'sucre', keys: ['flocon d\'avoine'],
        why: 'paquet de 500 g : ≈ 40 g par bol', match: /^flocons? d'avoine/ },
    { id: 'confiture', name: 'Confiture', group: 'petitdej', pack: '1 pot', share: 'partage', days: 25, on: false, aisle: 'sucre', keys: ['confiture'],
        why: 'pot d\'≈ 370 g : ≈ 15 g par jour', match: /^confiture/ },
    { id: 'miel', name: 'Miel', group: 'petitdej', pack: '1 pot', share: 'partage', days: 50, on: false, aisle: 'sucre', keys: ['miel'],
        why: 'pot de 500 g : ≈ 10 g par jour', match: /^miel\b/ },
    { id: 'tartiner', name: 'Pâte à tartiner', group: 'petitdej', pack: '1 pot', share: 'partage', days: 27, on: false, aisle: 'sucre', keys: ['pate a tartiner'],
        why: 'pot d\'≈ 400 g : ≈ 15 g par jour', match: /^pate a tartiner/ },
    { id: 'beurre', name: 'Beurre', group: 'petitdej', pack: '1 plaquette de 250 g', share: 'partage', days: 25, on: false, aisle: 'cremerie', size: '250 g', keys: ['beurre', 'beurre doux', 'beurre demi-sel'],
        why: '≈ 10 g par jour sur les tartines', match: /^beurre\b/, not: /^beurre de cacahuete/ },
    { id: 'paindemie', name: 'Pain de mie', group: 'petitdej', pack: '1 paquet', share: 'partage', days: 10, on: false, aisle: 'boulangerie', keys: ['pain de mie'],
        why: 'paquet d\'≈ 20 tranches : 2 par jour', match: /^pain de mie/ },
    { id: 'biscottes', name: 'Biscottes', group: 'petitdej', pack: '1 paquet', share: 'partage', days: 10, on: false, aisle: 'epicerie', keys: ['biscotte'],
        why: 'paquet d\'≈ 30 : 3 par jour', match: /^biscottes?/ },
    { id: 'jusorange', name: 'Jus d\'orange', group: 'petitdej', pack: '1 L', share: 'partage', days: 5, on: false, aisle: 'boissons', size: '1 l', keys: ['jus d\'orange'],
        why: 'un verre de 20 cl par jour', match: /^(?:pur )?jus d'orange/ },
    { id: 'yaourts', name: 'Yaourts', group: 'desserts', pack: '1 pack de 8', share: 'partage', days: 8, on: false, aisle: 'cremerie', size: '8', keys: ['yaourt', 'yaourt nature'],
        why: 'un par jour', match: /^yaourts?\b/ },
    { id: 'oeufs', name: 'Œufs', group: 'petitdej', pack: '1 boîte de 6', share: 'partage', days: 12, on: false, aisle: 'cremerie', size: '6', keys: ['oeuf'],
        why: 'un œuf tous les 2 jours, hors recettes', match: /^oeufs?\b/ },
    { id: 'huile', name: 'Huile', group: 'placard', pack: '1 bouteille d\'1 L', share: 'partage', days: 66, on: false, aisle: 'epicerie', size: '1 l',
        keys: ['huile', 'huile d\'olive', 'huile de tournesol', 'huile de colza', 'huile vegetale'],
        why: '≈ une cuillère à soupe (15 ml) par jour pour la cuisine', match: /^huile\b/ },
    { id: 'vinaigre', name: 'Vinaigre', group: 'placard', pack: '1 bouteille', share: 'partage', days: 100, on: false, aisle: 'epicerie', keys: ['vinaigre', 'vinaigre balsamique', 'vinaigre de vin'],
        why: 'bouteille de 50 cl : ≈ 5 ml par jour', match: /^vinaigre/ },
    { id: 'sel', name: 'Sel', group: 'placard', pack: '1 paquet', share: 'partage', days: 160, on: false, aisle: 'epicerie', keys: ['sel', 'sel fin', 'gros sel', 'fleur de sel'],
        why: 'paquet de 500 g : ≈ 3 g par jour pour la cuisine', match: /^(?:sel|gros sel|fleur de sel)\b/, not: /lave.?vaisselle|regenerant/ },
    { id: 'poivre', name: 'Poivre', group: 'placard', pack: '1 boîte', share: 'partage', days: 100, on: false, aisle: 'epicerie', keys: ['poivre', 'poivre noir', 'poivre moulu'],
        why: 'boîte d\'≈ 50 g : ≈ 0,5 g par jour', match: /^poivre\b/ },
    { id: 'moutarde', name: 'Moutarde', group: 'placard', pack: '1 pot', share: 'partage', days: 40, on: false, aisle: 'epicerie', keys: ['moutarde'],
        why: 'pot d\'≈ 200 g : ≈ 5 g par jour', match: /^moutarde/ },
    { id: 'mayonnaise', name: 'Mayonnaise', group: 'placard', pack: '1 pot', share: 'partage', days: 45, on: false, aisle: 'epicerie', keys: ['mayonnaise'],
        why: 'pot d\'≈ 235 g : ≈ 5 g par jour', match: /^mayonnaise/ },
    { id: 'ketchup', name: 'Ketchup', group: 'placard', pack: '1 flacon', share: 'partage', days: 100, on: false, aisle: 'epicerie', keys: ['ketchup'],
        why: 'flacon d\'≈ 500 g : ≈ 5 g par jour', match: /^ketchup/ },
    { id: 'farine', name: 'Farine', group: 'placard', pack: '1 kg', share: 'partage', days: 100, on: false, aisle: 'sucre', size: '1 kg', keys: ['farine', 'farine de ble'],
        why: '≈ 10 g par jour hors recettes chiffrées (sauces, pâtisserie)', match: /^farine\b/ },
    // Desserts du quotidien (pas de recettes : choix de Julien), fruits à croquer, boissons, goûter : rien d'office non plus.
    { id: 'compotes', name: 'Compotes', group: 'desserts', pack: '1 pack de 8', share: 'partage', days: 16, on: false, aisle: 'sucre', keys: ['compote'], size: '8',
        why: '≈ une tous les 2 jours', match: /^compotes?\b/ },
    { id: 'cremedessert', name: 'Crèmes dessert', group: 'desserts', pack: '1 pack de 4', share: 'partage', days: 14, on: false, aisle: 'cremerie', keys: ['creme dessert'], size: '4',
        why: '≈ 2 par semaine', match: /^cremes? desserts?/ },
    { id: 'fromageblanc', name: 'Fromage blanc ou petits-suisses', group: 'desserts', pack: '1 pack', share: 'partage', days: 14, on: false, aisle: 'cremerie',
        keys: ['fromage blanc', 'petit suisse'], why: 'pack de 6 : ≈ 3 par semaine', match: /^(?:fromage blanc|petits?.?suisses?)/ },
    { id: 'glaces', name: 'Glaces', group: 'desserts', pack: '1 bac ou 1 boîte', share: 'partage', days: 21, on: false, aisle: 'surgeles', keys: ['glace', 'sorbet'],
        why: '≈ 2 portions par semaine', match: /^(?:glaces?|cremes? glacees?|sorbets?|cones?|batonnets?)\b/ },
    { id: 'pommes', name: 'Pommes', group: 'fruits', pack: '1 kg (≈ 6)', share: 'partage', days: 14, on: false, aisle: 'fruits-legumes', keys: ['pomme'], size: '1 kg',
        why: '≈ 3 par semaine', match: /^pommes?\b/, not: /^pommes? de terre/ },
    { id: 'bananes', name: 'Bananes', group: 'fruits', pack: '1 kg (≈ 5)', share: 'partage', days: 12, on: false, aisle: 'fruits-legumes', keys: ['banane'], size: '1 kg',
        why: '≈ 3 par semaine', match: /^bananes?\b/ },
    { id: 'agrumes', name: 'Oranges ou clémentines', group: 'fruits', pack: '1 kg', share: 'partage', days: 12, on: false, aisle: 'fruits-legumes',
        keys: ['orange', 'clementine', 'mandarine'], size: '1 kg', why: '≈ 4 par semaine', match: /^(?:oranges?|clementines?|mandarines?)\b/ },
    { id: 'poires', name: 'Poires', group: 'fruits', pack: '1 kg (≈ 6)', share: 'partage', days: 14, on: false, aisle: 'fruits-legumes', keys: ['poire'], size: '1 kg',
        why: '≈ 3 par semaine', match: /^poires?\b/ },
    { id: 'fruitsaison', name: 'Fruits de saison', group: 'fruits', pack: '1 barquette ou 1 kg', share: 'partage', days: 7, on: false, aisle: 'fruits-legumes',
        keys: ['fraise', 'peche', 'nectarine', 'abricot', 'raisin', 'cerise', 'melon', 'kiwi', 'prune'],
        why: 'fraises, pêches, raisin, kiwis… selon la saison : ≈ 4 fruits par semaine', match: /^(?:fraises?|peches?|nectarines?|abricots?|raisins?|cerises?|melons?|kiwis?|prunes?)\b/, not: /\bsecs?\b/ },
    { id: 'eau', name: 'Eau en bouteille', group: 'boissons', pack: '1 pack de 6 × 1,5 L', share: 'partage', days: 6, on: false, aisle: 'boissons', size: '9 l',
        why: 'si on ne boit que de l\'eau en bouteille : ≈ 1,5 L par jour', match: /^eau\b/, not: /^eau (?:de javel|gazeuse|petillante|de toilette|micellaire|de parfum)/ },
    { id: 'eaugazeuse', name: 'Eau gazeuse', group: 'boissons', pack: '1 pack de 6 × 1 L', share: 'partage', days: 12, on: false, aisle: 'boissons', size: '6 l',
        why: '≈ 50 cl par jour', match: /^eau (?:gazeuse|petillante)/ },
    { id: 'sodas', name: 'Sodas', group: 'boissons', pack: '1 pack de 6 canettes', share: 'partage', days: 12, on: false, aisle: 'boissons',
        why: '≈ une canette tous les 2 jours', match: /^(?:sodas?|colas?|coca|limonade|the glace|ice tea)\b/ },
    { id: 'sirop', name: 'Sirop', group: 'boissons', pack: '1 bouteille', share: 'partage', days: 20, on: false, aisle: 'boissons',
        why: 'bouteille de 75 cl : ≈ 4 cl par jour', match: /^sirops?\b/ },
    { id: 'vin', name: 'Vin', group: 'boissons', pack: '1 bouteille', share: 'partage', days: 21, on: false, aisle: 'boissons', keys: ['vin', 'vin blanc', 'vin rouge'], size: '75 cl',
        why: '≈ 2 verres par semaine', match: /^vins?\b/ },
    { id: 'biere', name: 'Bière', group: 'boissons', pack: '1 pack de 6', share: 'partage', days: 21, on: false, aisle: 'boissons', keys: ['biere'],
        why: '≈ 2 par semaine', match: /^bieres?\b/ },
    { id: 'biscuits', name: 'Biscuits', group: 'gouter', pack: '1 paquet', share: 'partage', days: 10, on: false, aisle: 'sucre', keys: ['biscuit'],
        why: 'paquet d\'≈ 200 g : ≈ 20 g par jour', match: /^(?:biscuits?|sables?|petits? beurres?|cookies?|galettes?)\b/, not: /aperitif/ },
    { id: 'gateaux', name: 'Madeleines et gâteaux', group: 'gouter', pack: '1 paquet', share: 'partage', days: 10, on: false, aisle: 'sucre',
        why: 'paquet d\'≈ 300 g : ≈ 30 g par jour', match: /^(?:madeleines?|gateaux?|brownies?|cakes?|quatre.quarts|financiers?)\b/ },
    { id: 'barres', name: 'Barres de céréales', group: 'gouter', pack: '1 boîte', share: 'partage', days: 12, on: false, aisle: 'sucre',
        why: 'boîte de 6 : une tous les 2 jours', match: /^barres?\b/ },
    { id: 'tablette', name: 'Chocolat (tablettes)', group: 'gouter', pack: '1 tablette', share: 'partage', days: 10, on: false, aisle: 'sucre',
        keys: ['chocolat', 'chocolat noir', 'chocolat au lait', 'chocolat patissier'], size: '100 g', why: 'tablette de 100 g : ≈ 2 carrés (10 g) par jour',
        match: /^(?:chocolat|tablettes?)\b/, not: /en poudre|poudre/ },
    { id: 'fruitssecs', name: 'Fruits secs et oléagineux', group: 'gouter', pack: '1 sachet', share: 'partage', days: 13, on: false, aisle: 'sucre',
        keys: ['amande', 'noix', 'noisette', 'noix de cajou', 'raisin sec'], why: 'sachet de 200 g : ≈ 15 g par jour',
        match: /^(?:amandes?|noix|noisettes?|cajou|pistaches?|fruits secs|raisins secs|melange)/ },
    { id: 'chips', name: 'Chips et biscuits apéritif', group: 'gouter', pack: '1 paquet', share: 'partage', days: 14, on: false, aisle: 'epicerie',
        why: '≈ 2 fois par semaine', match: /^(?:chips|crackers?|bretzels?|biscuits? aperitifs?|tortillas? chips)/ },
];
export const RESTOCK_DEF = Object.fromEntries(RESTOCK.map(d => [d.id, d]));
export const GROUP_LABEL = { hygiene: 'Hygiène', entretien: 'Cuisine et entretien', petitdej: 'Petit-déjeuner', placard: 'Placard',
    desserts: 'Desserts', fruits: 'Fruits à croquer', boissons: 'Boissons', gouter: 'Goûter et en-cas' };
export const GROUPS = ['petitdej', 'desserts', 'fruits', 'gouter', 'boissons', 'placard', 'hygiene', 'entretien'];
// Groupes alimentaires : rien d'office, au foyer de cocher ses habitudes.
export const FOOD = new Set(['petitdej', 'placard', 'desserts', 'fruits', 'boissons', 'gouter']);
// Rayon des courses : celui du produit ; produit ajouté par le foyer : deviné d'après son nom (comme un article ajouté à la main).
export const aisleFor = (s, id) => RESTOCK_DEF[id]?.aisle ?? (RESTOCK_DEF[id] ? 'maison' : aisleOf(s.restock[id]?.name ?? '', null, s.aisles));
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
            out.push({ id, name: nameOf(id, it), qty: packOf(id, n), aisle: aisleFor(s, id), due, last, rhythm: r, done, late: !done && due < today });
    }
    return out.sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due) || a.name.localeCompare(b.name, 'fr'));
}
// Une seule ligne quand une recette de la semaine demande aussi le produit (sucre, lait, beurre…) : le produit dû va avec la
// ligne de la recette encore à acheter, le produit acheté avec la ligne cochée (pour pouvoir l'annuler ensemble). Clé = ligne.
export function pairWithRecipes(rs, lines) {
    const out = new Map(), used = new Set();
    for (const r of rs) {
        const keys = new Set((RESTOCK_DEF[r.id]?.keys ?? []).map(k => nameKey(k)));
        const l = keys.size ? lines.find(x => x.done === r.done && !used.has(x.key) && keys.has(nameKey(x.name))) : undefined;
        if (l) {
            out.set(r.id, l.key);
            used.add(l.key);
        }
    }
    return out;
}
// Produits suivis reconnus sur une facture du drive (« Dentifrice 75ml », « PAPIER TOILETTE x12 », « Lait demi-écrémé ») : achat
// noté au jour de la facture. Libellés passés sans la marque (core/invoice.ts productName) : les aliments se lisent en tête du nom.
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
