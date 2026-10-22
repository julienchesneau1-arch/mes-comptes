# Cornelius à la maison : modules Mes Comptes et Foyer, tablette familiale

Ce dossier contient deux modules externes pour [Cornelius](https://github.com/lfpoulain/Cornelius) (contrat des modules `apiVersion: 1`, Cornelius 0.2.0 ou plus récent) et la configuration d'une tablette partagée. Cornelius n'est pas modifié.

| Module | Propriétaire de la source | Ce qu'il apporte | Fiche |
| --- | --- | --- | --- |
| `foyer` | le foyer | repas de ce soir et demain midi, tâches de la veille, courses ; affichage permanent | [foyer/README.md](foyer/README.md) |
| `comptes` | une personne, obligatoirement | reste du mois, budgets, objectifs d'épargne | [comptes/README.md](comptes/README.md) |

Les deux réutilisent le code des applications (`foyer/src/core`, `core.js`) : rien n'est recalculé à part, et une évolution de l'app est suivie automatiquement.

## Installer les modules (labo macOS)

Après l'installation du labo (`~/cornelius-lab`) :

```sh
git clone https://github.com/julienchesneau1-arch/mes-comptes.git ~/cornelius-lab/mes-comptes
echo "CORNELIUS_MODULES_DIR=$HOME/cornelius-lab/mes-comptes/cornelius" >> ~/cornelius-lab/cornelius/.env
bash ~/cornelius-lab/stop.sh && bash ~/cornelius-lab/start.sh
```

Tant que ces modules ne sont pas sur `main`, ajoutez `-b claude/tender-cori-m8232m` au `git clone`. Un dépôt privé demande d'être connecté à GitHub sur le Mac. Les modules se chargent au démarrage seulement : redémarrez Cornelius après chaque `git pull`. Ils apparaissent dans **Administration → Modules** ; un module refusé y est signalé « Module non chargé » avec la raison.

Tests (depuis le dossier de Cornelius) :

```sh
CORNELIUS_MODULES_DIR=$HOME/cornelius-lab/mes-comptes/cornelius npm run test:modules
```

## La tablette familiale

### Principe

La tablette affiche **le miroir de Cornelius** par le réseau local, en HTTPS. Elle apporte son écran, son micro et son haut-parleur ; la caméra, la reconnaissance des visages et l'intelligence restent sur l'ordinateur de Cornelius. Aucune application à installer, aucun accès depuis Internet, aucun secret dans le navigateur de la tablette.

**Règle retenue : la tablette ne montre que le profil Foyer.** La caméra est celle de l'ordinateur, peut-être dans une autre pièce : si elle reconnaissait quelqu'un, ses souvenirs, son agent ou ses comptes pourraient s'afficher sur la tablette devant d'autres personnes. Les données personnelles restent donc réservées au miroir principal, devant lequel la personne est reconnue seule.

### Réglages, une fois

**Sur l'ordinateur de Cornelius**

1. Ouvrir le réseau local : dans `~/cornelius-lab/cornelius/.env`, remplacer `CORNELIUS_LAN=0` par `CORNELIUS_LAN=1`, puis redémarrer (`stop.sh`, `start.sh`). macOS demande d'autoriser les connexions entrantes de `node` : accepter. Cornelius répond alors sur `https://<adresse de l'ordinateur>:3443/`, aux appareils de la maison seulement (les adresses publiques sont refusées par Cornelius).
2. **Administration → Quand il écoute** : « Ce qui ouvre la conversation » = **« Cornelius »**, « Qui » = **tout le monde**, et **décocher** « Reconnaître la personne pendant la conversation ». La conversation se fait alors au nom du foyer : ni souvenirs, ni agent, ni comptes personnels.
3. **Modules → Foyer** : saisir le code du foyer, ajouter une source pour le **foyer**, cocher **Afficher en permanence**. Ajouter de même Heure et Météo si utile.
4. Noter l'empreinte SHA-256 du certificat, affichée dans la carte **Accès depuis le réseau local**.

**Sur la tablette**

1. Ouvrir `https://<adresse de l'ordinateur>:3443/`. Le navigateur avertit que le certificat n'est pas reconnu : comparer l'empreinte avec celle notée, puis continuer.
2. Se connecter **une fois** avec le mot de passe administrateur : la tablette devient un miroir autorisé. Se **déconnecter** ensuite de l'administration (la session dure de toute façon une heure) : la tablette garde l'accès au miroir, pas aux réglages.
3. Ajouter la page à l'écran d'accueil (iPad : Partager → « Sur l'écran d'accueil » ; Android : ⋮ → « Ajouter à l'écran d'accueil »).
4. Toucher **Activer la voix** et accepter le micro.
5. Mode kiosque : iPad, **Réglages → Accessibilité → Accès guidé** (triple clic pour entrer et sortir) ; Android, **épinglage d'écran**. Écran : verrouillage automatique **Jamais**, tablette branchée.

Un seul miroir est actif à la fois : ouvrir celui de la tablette ferme celui de l'ordinateur (« Miroir ouvert dans un autre onglet »).

### Mode privé

**Administration → Quand il écoute → Conversation → Bloquer OpenAI** : plus aucune voix ni aucun texte n'est envoyé à OpenAI, extraction de souvenirs comprise ; le blocage survit à un redémarrage. La tablette continue d'afficher l'heure et les informations permanentes. « Privé » veut dire **sans IA dans le cloud** : les modules continuent d'interroger leur source (relais Foyer, chiffré de bout en bout et illisible pour le serveur ; Météo-Concept pour la météo). Pour un écran sans aucune connexion, désactiver aussi l'affichage permanent de ces sources.

### Après un redémarrage

- **Ordinateur** : `bash ~/cornelius-lab/start.sh`. Pour le lancer à l'ouverture de session, sans droits administrateur :

  ```sh
  mkdir -p ~/Library/LaunchAgents
  cat > ~/Library/LaunchAgents/fr.cornelius.lab.plist <<PLIST
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0"><dict>
    <key>Label</key><string>fr.cornelius.lab</string>
    <key>ProgramArguments</key><array><string>/bin/bash</string><string>$HOME/cornelius-lab/start.sh</string></array>
    <key>RunAtLoad</key><true/>
  </dict></plist>
  PLIST
  launchctl load ~/Library/LaunchAgents/fr.cornelius.lab.plist
  ```

  Retrait : `launchctl unload ~/Library/LaunchAgents/fr.cornelius.lab.plist && rm ~/Library/LaunchAgents/fr.cornelius.lab.plist`.
- **Tablette** : toucher l'icône, puis **Activer la voix** (le navigateur exige ce geste après chaque redémarrage, pour le micro comme pour le son).

### Limites connues

| Sujet | Limite | Conséquence |
| --- | --- | --- |
| Micro en arrière-plan | Les navigateurs de tablette coupent le micro quand l'écran se verrouille ou que la page passe en arrière-plan | Le mot « Cornelius » n'est entendu que **écran allumé, page au premier plan** (Accès guidé, branchée). À vérifier sur votre modèle |
| Mot d'appel | En veille, le son du micro de la tablette part vers l'ordinateur de Cornelius (réseau local, chiffré) pour y guetter le mot ; il ne sort pas de la maison | Trafic réseau et batterie : tablette branchée |
| Certificat | Créé par Cornelius, non reconnu par la tablette | Avertissement à la première visite, et quand l'adresse de l'ordinateur change. Si le micro reste refusé malgré l'avertissement accepté, installer le certificat comme certificat de confiance sur la tablette, ou utiliser `CORNELIUS_TLS_CERT` avec un certificat reconnu |
| Plein écran | Sans manifeste d'application web, l'icône d'écran d'accueil s'ouvre avec la barre du navigateur | L'Accès guidé ou l'épinglage masque le reste ; le vrai plein écran demande une modification de Cornelius (lot T1 ci-dessous) |
| Lisibilité | Textes du miroir de 15 à 19 px (mesuré à 820×1180 et 1180×820) | Lisibles à 1 m, pas à 3 m (lot T2) |
| Texte au clavier | Le miroir n'a pas de champ de saisie | Voix seulement (lot T3) |
| Caméra | Celle de l'ordinateur, pas celle de la tablette | « Le regard » et « la présence » n'ouvrent pas la conversation depuis la tablette : utiliser « Cornelius » |

### Critères d'acceptation

| Critère | Comment c'est assuré | Vérifié |
| --- | --- | --- |
| 1. Utilisable au doigt | Bouton principal de 48 à 50 px (≥ 44), mesuré aux formats iPad et Android 10″ | Mesuré en laboratoire ; à confirmer sur la tablette |
| 2. Lisible en plein écran | Accès guidé ; textes actuels trop petits à distance | **Non atteint** : lot T2 |
| 3. Pas de fausse réussite en cas de panne | Foyer : relais en panne → échec, puis dernier relevé annoncé comme tel ; code étranger → « introuvable », jamais « rien de prévu ». Comptes : refus explicites. Cornelius : « commande acceptée » ≠ « confirmée », tâche Hermes incertaine jamais répétée | Tests automatiques (17 pour les modules) |
| 4. Données privées non exposées | Tablette au nom du foyer ; source Comptes du foyer refusée ; source personnelle lue seulement pour sa propriétaire | Tests automatiques + réglage « Quand il écoute » à appliquer |
| 5. Micro dans les conditions prises en charge | Écran allumé, page au premier plan, certificat accepté | À vérifier sur la tablette |
| 6. Relance simple | Agent de session macOS ; icône + « Activer la voix » sur la tablette | À vérifier |
| 7. Fonctions sensibles protégées | Mot de passe administrateur, appareil autorisé, commandes et accords Hermes validés dans l'administration, liste blanche Home Assistant, module Comptes personnel | Existant dans Cornelius ; module testé |

### Lots reportés (modifient Cornelius)

Décision : **voix d'abord**, aucune modification du cœur de Cornelius pour l'instant. Restent proposés, chacun avec ses tests :

- **T1** — manifeste d'application web et balises iPad (`web/index.html`) : vrai plein écran depuis l'icône. Aucune route d'API ajoutée.
- **T2** — taille des textes du miroir au format tablette (CSS) : critère 2.
- **T3** — conversation au clavier (miroir et session OpenAI) : panne d'OpenAI → message d'erreur affiché, jamais « c'est fait ».
