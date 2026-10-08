// Saisie rapide : « 600 g de poulet », « 2 oignons », « sel » → ligne d'ingrédient structurée, sans IA.
// Ce qui n'est pas reconnu avec certitude reste visible « à vérifier » : rien n'est deviné en silence.
import { parseQ, qStr } from './rational.js';
import { matchUnit, UNIT } from './units.js';
import { nameKey, norm, capitalize } from './text.js';
export const FORMS = ['cru', 'cuit', 'surgelé', 'en conserve'];
const FORM_RE = [
    [/\s+(crus?|crues?)$/i, 'cru'], [/\s+(cuits?|cuites?)$/i, 'cuit'],
    [/\s+(surgel[ée]e?s?)$/i, 'surgelé'], [/\s+(en (?:conserve|bo[iî]te))$/i, 'en conserve'],
];
const QTY_TOKEN = /^(\d{1,6}(?:[.,]\d{1,4})?|\d{1,6}\/\d{1,6}|\d{0,6}[½¼¾⅓⅔⅛])$/;
const DE = /^(?:de|d['’]|du|des)$/i; // apostrophe droite ou typographique (« 2 gousses d’ail »)
export function parseIngredient(raw) {
    let text = raw.replace(/^[\s\-–—•*·▪●○◦✓☐□]+/, '').replace(/\s+/g, ' ').trim();
    let note = '';
    text = text.replace(/\s*\(([^)]{0,60})\)\s*/g, (_, inner) => { note = note ? `${note} ; ${inner}` : inner; return ' '; }).trim();
    text = text.replace(/(\d)([a-zA-Zµ])/g, '$1 $2').replace(/(\d)\s*x\s+/i, '$1 ');
    const empty = (why) => ({ line: { name: capitalize(text), qty: null, unit: null, form: null, note }, review: why });
    if (!text)
        return empty('ligne vide');
    let words = text.split(' ');
    let qty = null, unit = null, used = 0;
    // Quantité en tête : « 1 1/2 », « 600 », « ½ ».
    if (words.length >= 2 && /^\d{1,6}$/.test(words[0] ?? '') && /^\d{1,6}\/\d{1,6}$/.test(words[1] ?? '')) {
        qty = parseQ(`${words[0]} ${words[1]}`);
        used = 2;
    }
    else if (QTY_TOKEN.test(words[0] ?? '')) {
        qty = parseQ(words[0] ?? '');
        used = 1;
    }
    if (qty) {
        const m = matchUnit(words.slice(used));
        if (m) {
            unit = m.unit.id;
            used += m.used;
        }
        words = words.slice(used);
        if (words.length && DE.test(words[0] ?? ''))
            words = words.slice(1);
        else if (words.length && /^d['’]/i.test(words[0] ?? ''))
            words[0] = (words[0] ?? '').slice(2);
        unit ??= 'piece';
    }
    else {
        // Quantité en fin : « poulet 600 g », « poulet : 600g ».
        const tail = /^(.*?)[\s:,–-]+(\d{1,6}(?:[.,]\d{1,4})?|\d{1,6}\/\d{1,6})\s*(.*)$/.exec(text);
        if (tail && tail[1]) {
            const rest = (tail[3] ?? '').split(' ').filter(Boolean);
            const m = matchUnit(rest);
            if ((m && m.used === rest.length) || rest.length === 0) {
                qty = parseQ(tail[2] ?? '');
                unit = m ? m.unit.id : 'piece';
                words = tail[1].split(' ');
            }
        }
    }
    let name = words.join(' ').replace(/^[:,\s]+|[:,\s]+$/g, '');
    let form = null;
    for (const [re, f] of FORM_RE)
        if (re.test(name)) {
            form = f;
            name = name.replace(re, '');
            break;
        }
    if (!name)
        return { line: { name: capitalize(text), qty: null, unit: null, form: null, note }, review: 'nom introuvable' };
    if (qty && qty.n <= 0)
        return { line: { name: capitalize(name), qty: null, unit: null, form, note }, review: 'quantité nulle' };
    return {
        line: { name: capitalize(name), qty: qty ? qStr(qty) : null, unit: qty ? unit : null, form, note },
        review: null,
    };
}
// Affichage court d'une ligne de recette : « 600 g · Poulet ».
export function lineLabel(l) {
    const u = l.unit ? UNIT[l.unit] : undefined;
    const qtxt = l.qty ? l.qty.replace(/^(\d+)\/(\d+)$/, (_, a, b) => (Number(a) / Number(b)).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')) : '';
    const unitTxt = u && u.id !== 'piece' ? ` ${Number(qtxt.replace(',', '.')) > 1 ? u.many : u.one}` : '';
    return `${qtxt ? `${qtxt}${unitTxt} · ` : ''}${l.name}${l.form ? ` (${l.form})` : ''}`;
}
export const AISLES = [
    { id: 'fruits-legumes', label: 'Fruits & légumes', icon: '🥕' },
    { id: 'boulangerie', label: 'Pain', icon: '🥖' },
    { id: 'boucherie', label: 'Viande & poisson', icon: '🐟' },
    { id: 'frais', label: 'Charcuterie & traiteur', icon: '🥓' },
    { id: 'cremerie', label: 'Crèmerie & œufs', icon: '🧀' },
    { id: 'epicerie', label: 'Épicerie salée', icon: '🥫' },
    { id: 'sucre', label: 'Épicerie sucrée & petit-déj', icon: '🍯' },
    { id: 'surgeles', label: 'Surgelés', icon: '🧊' },
    { id: 'boissons', label: 'Boissons', icon: '🧃' },
    { id: 'maison', label: 'Maison & hygiène', icon: '🧴' },
    { id: 'autres', label: 'Autres', icon: '🛒' },
];
export const AISLE = Object.fromEntries(AISLES.map(a => [a.id, a]));
const DICT = {
    'fruits-legumes': `tomate|tomate cerise|oignon|oignon rouge|oignon nouveau|echalote|ail|carotte|courgette|aubergine|poivron|concombre|salade|laitue|roquette|mache|
    epinard|pousse d'epinard|chou|chou-fleur|chou fleur|brocoli|chou de bruxelle|chou rouge|poireau|celeri|celeri-rave|celeri branche|fenouil|radis|betterave|navet|panais|
    patate douce|pomme de terre|champignon|champignon de paris|avocat|citron|citron vert|orange|pomme|poire|banane|fraise|framboise|myrtille|raisin|kiwi|mangue|ananas|peche|
    abricot|melon|pasteque|clementine|mandarine|pamplemousse|cerise|prune|figue|grenade|persil|coriandre|basilic|ciboulette|menthe|thym|romarin|laurier|aneth|estragon|
    gingembre|piment|haricot vert|potiron|courge|butternut|potimarron|artichaut|asperge|endive|blette|cresson|herbe fraiche|citronnelle|salade verte|petit pois|feve|
    patate|echalion|sucrine|frisee|batavia|legume`,
    boucherie: `poulet|blanc de poulet|filet de poulet|cuisse de poulet|pilon de poulet|escalope|escalope de dinde|dinde|boeuf|boeuf hache|steak|steak hache|viande hachee|
    viande|porc|cote de porc|echine|filet mignon|roti|roti de porc|roti de boeuf|veau|blanquette|agneau|gigot|epaule d'agneau|canard|magret|confit de canard|saucisse|
    merguez|chipolata|saucisse de toulouse|saumon|pave de saumon|cabillaud|colin|lieu|merlu|dorade|bar|truite|crevette|moule|poisson|calamar|noix de saint-jacque|
    saint-jacque|lapin|aiguillette|poulet roti|bavette|entrecote|joue de boeuf|paleron|jarret|osso buco|steak de thon|filet de poisson|gambas|langoustine`,
    frais: `jambon|jambon blanc|jambon cru|lardon|bacon|chorizo|saucisson|rillette|pate feuilletee|pate brisee|pate sablee|pate a pizza|gnocchi|ravioli|tortellini|
    pate fraiche|houmous|tofu|knacki|saumon fume|surimi|blanc de dinde|coppa|pancetta|terrine|tarama|quiche|pate a crepe|pate filo|feuille de brick|tzatziki|guacamole`,
    cremerie: `lait|lait entier|lait demi-ecreme|beurre|beurre doux|beurre demi-sel|oeuf|creme|creme fraiche|creme liquide|creme epaisse|yaourt|fromage blanc|petit suisse|
    fromage|fromage rape|emmental|gruyere|comte|parmesan|mozzarella|feta|chevre|buche de chevre|roquefort|bleu|camembert|brie|raclette|reblochon|cheddar|ricotta|
    mascarpone|burrata|skyr|creme dessert|mozzarella di bufala|pecorino|tomme|morbier|boursin|kiri`,
    epicerie: `pate|spaghetti|penne|tagliatelle|fusilli|coquillette|farfalle|linguine|macaroni|lasagne|feuille de lasagne|riz|riz basmati|riz rond|risotto|semoule|couscous|
    quinoa|boulgour|lentille|lentille corail|pois chiche|haricot rouge|haricot blanc|flageolet|huile|huile d'olive|huile de tournesol|vinaigre|vinaigre balsamique|
    moutarde|mayonnaise|ketchup|sauce soja|sauce tomate|coulis de tomate|concentre de tomate|tomate concassee|tomate pelee|passata|pulpe de tomate|pesto|bouillon|
    cube de bouillon|bouillon de volaille|fond de veau|sel|poivre|epice|curry|paprika|cumin|curcuma|muscade|herbe de provence|piment d'espelette|ras el hanout|
    lait de coco|creme de coco|olive|cornichon|capre|thon|sardine|maquereau|mais|chapelure|chips|cracker|biscuit aperitif|nouille|vermicelle|galette de riz|tortilla|
    wrap|taco|sauce|sauce barbecue|tabasco|harissa|noix de cajou|cacahuete|pignon|graine|sesame|vinaigrette|bouillon de legume|ail semoule|origan|cinq epice|
    nuoc mam|sauce huitre|mirin|pate de curry|pain de mie grille|biscotte|pain naan|soupe`,
    sucre: `sucre|sucre glace|sucre roux|cassonade|sucre vanille|farine|levure|levure chimique|levure boulangere|maizena|fecule|chocolat|chocolat noir|chocolat au lait|
    cacao|pepite de chocolat|miel|confiture|pate a tartiner|cereale|flocon d'avoine|muesli|granola|biscuit|gateau|compote|cafe|the|tisane|sirop|vanille|gousse de vanille|
    extrait de vanille|amande|amande en poudre|poudre d'amande|noisette|noix|raisin sec|fruit sec|datte|pruneau|lait concentre|creme de marron|madeleine|cannelle|
    sucre de canne|sirop d'erable|caramel|bonbon|pain d'epice`,
    surgeles: `glace|sorbet|frite|poelee|nugget|poisson pane|pizza surgelee|legume surgele|epinard surgele|petit pois surgele|crevette surgelee|fruit rouge surgele`,
    boulangerie: `pain|baguette|pain de mie|brioche|croissant|pain burger|pain hamburger|pain pita|pain complet|pain au chocolat|viennoiserie|pain de campagne|ficelle|bun`,
    boissons: `eau|eau gazeuse|eau petillante|jus|jus d'orange|jus de pomme|soda|coca|biere|vin|vin blanc|vin rouge|cidre|limonade|sirop de grenadine|lait d'amande|
    lait d'avoine|boisson vegetale|cafe moulu`,
    maison: `papier toilette|essuie-tout|sopalin|liquide vaisselle|lessive|eponge|sac poubelle|film alimentaire|papier aluminium|papier cuisson|savon|shampoing|dentifrice|
    gel douche|mouchoir|coton|deodorant|tablette lave-vaisselle|pastille lave-vaisselle|produit menager|javel|adoucissant|sel lave-vaisselle|rince-eclat|couche|lingette`,
};
// Mots-clés normalisés comme les noms (singulier), du plus long au plus court : « lait de coco » l'emporte sur « lait ».
const KEYWORDS = Object.entries(DICT)
    .flatMap(([aisle, list]) => list.split('|').map(k => k.trim()).filter(Boolean).map(k => ({ words: nameKey(k).split(' '), aisle })))
    .sort((a, b) => b.words.length - a.words.length || b.words.join(' ').length - a.words.join(' ').length);
// Rayon proposé pour un ingrédient : le choix du foyer d'abord, puis le dictionnaire, sinon « Autres ».
export function aisleOf(name, form, overrides = {}) {
    const key = nameKey(name);
    const own = overrides[key];
    if (own && AISLE[own])
        return own;
    if (form === 'surgelé')
        return 'surgeles';
    const words = key.split(' ');
    for (const k of KEYWORDS) {
        for (let i = 0; i + k.words.length <= words.length; i++) {
            if (k.words.every((w, j) => words[i + j] === w))
                return k.aisle;
        }
    }
    return 'autres';
}
export const ingredientKey = (name, form) => `${nameKey(name)}${form ? `|${norm(form)}` : ''}`;
