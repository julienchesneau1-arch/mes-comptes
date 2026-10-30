# Mes Comptes

Suivi de budget perso : on dépose ses relevés, l'app range les dépenses par famille, suit les limites et aide à mettre de côté.

**Toutes les banques** : la banque se choisit dans une liste (24 banques et « Une autre banque ») et l'app dit quoi télécharger. Formats lus : OFX et QIF (standards, toutes banques), CSV (colonnes reconnues d'office pour Banque Populaire, Caisse d'Épargne, Crédit Agricole, LCL, Société Générale, BNP Paribas, Crédit Mutuel, CIC, La Banque Postale, BoursoBank, Fortuneo, Revolut, N26 ; pour une autre banque, on montre une fois où sont la date, le libellé et le montant, et ce choix est retenu), relevés PDF (Banque Populaire, Caisse d'Épargne).

- **100 % local** : les données restent sur l'appareil (localStorage). Aucun serveur, aucune IA, aucune connexion bancaire. La page interdit toute connexion sortante (CSP `connect-src 'self'`).
- **Zéro dépendance externe** : JavaScript sans framework ; pdf.js (Apache 2.0) est embarqué dans `vendor/`.
- **Installation iPhone** : ouvrir le site dans Safari → Partager → « Sur l'écran d'accueil ».
- **Profils** : Foyer · chacun des deux · Commun (prénoms choisis au premier lancement). Chaque compte a un titulaire ; les virements entre vous sont neutres dans le Foyer et comptent comme « versé à l'autre » dans un profil.
- **Livrets** : autant que voulu (case « épargne »), soldes lus dans les relevés PDF/OFX ou saisis à la main.
- **Synchro téléphone ↔ ordinateur** : Réglages → Exporter / Importer une sauvegarde.
- **Tableur de suivi** (export CSV d'un tableau « postes × mois ») : importé comme historique, remplacé mois par mois par les vrais relevés ; ses annotations X / NEGO / PEUT DIMINUER / PEUT SE PASSER deviennent les leviers du plan d'épargne.
- **Où va l'argent** (accueil, juste sous le grand chiffre) : un grand camembert des dépenses du mois en 7 pôles (Logement & charges, Courses & restos, Transports, Loisirs & vacances, Shopping & maison, Santé & famille, Autres). Toucher une part ouvre ses familles, puis une famille ses opérations ; ▲▼ par rapport à d'habitude (dépenses variables). Couleurs fixes par pôle, sans rouge, vérifiées pour les daltoniens, emoji sur chaque part. Dans Tendances, les mêmes pôles mois par mois sur 12 mois.
- **Enveloppe « vie courante »** (budget flexible) : un seul montant par mois et par profil pour toutes les dépenses variables (les charges fixes n'y entrent pas), proposé d'après l'habitude. Jauge au-dessus du camembert : repère du jour, reste, ≈ € par jour jusqu'à la fin du mois ; dépassée, elle met la météo « à surveiller ».
- **Solde prévu jour par jour** (Comptes › À venir) : une courbe en marches par compte, un pas par prélèvement fixe ou rentrée habituelle, zéro toujours visible, point le plus bas nommé ; toucher un point donne le détail du jour.
- **Filtre par pôle** (Opérations) : un pôle entier ou une de ses familles ; une opération répartie ne compte que pour ses parts concernées ; total dépensé / reçu.
- **Recherche dans tout l'historique** (Opérations) : un mot ou un montant (« 54 » trouve 54,20 €) ; dans le mois affiché, puis « Chercher dans tout l'historique » : regroupé par mois, total et moyenne par mois.
- **Chez ce marchand** (fiche d'une opération) : 12 mois en barres, nombre de passages, total, moyenne des mois où l'on y est passé, « Toutes ses opérations ».
- **Face ID / empreinte** (Réglages › Sécurité, optionnel) : une clé d'accès du téléphone (extension PRF) rend, après la biométrie seulement, la clé qui chiffre le code d'entrée gardé sur le téléphone. Aucun serveur ; le code reste accepté ; code changé ou oublié → biométrie désactivée. iPhone : iOS 18 ou plus récent ; Android : Chrome à jour.
- **Testé sur téléphone à chaque publication** : `e2e/parcours.mjs` (exemple, vrai parcours code → import → rechargement → déverrouillage, biométrie simulée) sur iPhone 13 (WebKit) et Pixel 7 (Chromium), dans la CI GitHub (gratuite pour un dépôt public). En local : `node e2e/parcours.mjs` (Playwright installé).
- **Grille « top 1 % » commune avec Foyer** (`TOP1.md`) : accessibilité WCAG 2.2 AA (axe, 0 violation, clair et sombre), hors ligne, rechargement, rien qui dépasse, aucune erreur, contrôlés en CI sur iPhone et Android ; montants et dates mis en forme une fois (changement d'onglet ~1,7× plus rapide, affichage identique).
- **Rapide avec un gros historique** : chaque calcul n'est fait qu'une fois par affichage (accueil ~2× plus rapide, Tendances ~6× sur 6 000 opérations).
- **Accueil allégé** : le rendez-vous du mois tient en une ligne par étape ; quand il est affiché, « À faire » se replie en une ligne, sauf urgence (découvert, relevé manquant, sauvegarde…).
- **Plan d'épargne** : ce que chaque levier libère par mois (−15 % / ~20 % / 100 %), relié aux objectifs et aux défis.
- **Contrôle des relevés** : ancien solde + opérations lues = nouveau solde, sinon un écart est signalé.
- **À faire** (accueil), deux cas de plus, réglés d'un toucher :
  - *prévu échu* : un prélèvement ou une saisie prévu, daté de plus de 2 jours, absent alors que le relevé couvre déjà 4 jours après sa date → « payé autrement », « toujours attendu » ou « il n'aura pas lieu » ;
  - *dépense commune payée en perso* : courses ou logement de plus de 20 € sur un compte perso, quand il existe un compte commun → « dépense commune ? », puis « le compte commun doit … à … » jusqu'au « virement fait ».
  Les soldes et les statistiques par compte ne changent pas : seule la décision est gardée, et synchronisée.
- **Tester ses vrais relevés en local** : les déposer dans `releves/` (jamais publié) puis `node verifier-releves.mjs` (`--brut` pour voir le texte lu dans un PDF).

Tests de la logique : `node test.js`

## Foyer (dans `foyer/`)

Deuxième app du foyer, même philosophie (données sur vos téléphones, synchro chiffrée de bout en bout : automatique via un relais qui ne voit que des blocs illisibles, ou par lien) : les repas de la semaine, les courses calculées, les restes et les boîtes du midi. Voir [foyer/README.md](foyer/README.md). Publiée à côté de Mes Comptes, dans `…/mes-comptes/foyer/` ; stockage et caches séparés.

