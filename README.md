# Mes Comptes

Suivi de budget perso : on dépose ses relevés (PDF, CSV ou OFX Banque Populaire), l'app range les dépenses par famille, suit les limites et aide à mettre de côté.

- **100 % local** : les données restent sur l'appareil (localStorage). Aucun serveur, aucune IA, aucune connexion bancaire. La page interdit toute connexion sortante (CSP `connect-src 'self'`).
- **Zéro dépendance externe** : JavaScript sans framework ; pdf.js (Apache 2.0) est embarqué dans `vendor/`.
- **Installation iPhone** : ouvrir le site dans Safari → Partager → « Sur l'écran d'accueil ».
- **Profils** : Foyer · chacun des deux · Commun (prénoms choisis au premier lancement). Chaque compte a un titulaire ; les virements entre vous sont neutres dans le Foyer et comptent comme « versé à l'autre » dans un profil.
- **Livrets** : autant que voulu (case « épargne »), soldes lus dans les relevés PDF/OFX ou saisis à la main.
- **Synchro téléphone ↔ ordinateur** : Réglages → Exporter / Importer une sauvegarde.
- **Tableur de suivi** (export CSV d'un tableau « postes × mois ») : importé comme historique, remplacé mois par mois par les vrais relevés ; ses annotations X / NEGO / PEUT DIMINUER / PEUT SE PASSER deviennent les leviers du plan d'épargne.
- **Plan d'épargne** : ce que chaque levier libère par mois (−15 % / ~20 % / 100 %), relié aux objectifs et aux défis.
- **Contrôle des relevés** : ancien solde + opérations lues = nouveau solde, sinon un écart est signalé.
- **Tester ses vrais relevés en local** : les déposer dans `releves/` (jamais publié) puis `node verifier-releves.mjs` (`--brut` pour voir le texte lu dans un PDF).

Tests de la logique : `node test.js`

## Foyer (dans `foyer/`)

Deuxième app du foyer, même philosophie (données sur vos téléphones, synchro chiffrée de bout en bout : automatique via un relais qui ne voit que des blocs illisibles, ou par lien) : les repas de la semaine, les courses calculées, les restes et les boîtes du midi. Voir [foyer/README.md](foyer/README.md). Publiée à côté de Mes Comptes, dans `…/mes-comptes/foyer/` ; stockage et caches séparés.

