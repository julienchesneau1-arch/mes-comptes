# Cornelius à la maison : modules Mes Comptes et Foyer, tablette familiale, téléphones

Ce dossier contient deux modules externes pour [Cornelius](https://github.com/lfpoulain/Cornelius) (contrat des modules `apiVersion: 1`, Cornelius 0.2.0 ou plus récent), cinq [correctifs](correctifs/README.md) de Cornelius (caméra macOS, téléphones hors de la maison, plein écran, lisibilité, conversation écrite), le script d'installation du labo macOS et la configuration d'une tablette partagée et des téléphones de la maison.

| Module | Propriétaire de la source | Ce qu'il apporte | Fiche |
| --- | --- | --- | --- |
| `foyer` | le foyer | repas de ce soir et demain midi, tâches de la veille, courses ; affichage permanent | [foyer/README.md](foyer/README.md) |
| `comptes` | une personne, obligatoirement | reste du mois, budgets, objectifs d'épargne | [comptes/README.md](comptes/README.md) |

Les deux réutilisent le code des applications (`foyer/src/core`, `core.js`) : rien n'est recalculé à part, et une évolution de l'app est suivie automatiquement.

## Installer (labo macOS Intel)

Tout s'installe dans `~/cornelius-lab`, sans Homebrew ni droits administrateur (seuls les outils de ligne de commande d'Apple, s'ils manquent, demandent le mot de passe du Mac). Dans le Terminal :

```sh
xcode-select --install   # une fois, si macOS le propose ; sinon passer
git clone -b claude/tender-cori-m8232m https://github.com/julienchesneau1-arch/mes-comptes.git ~/cornelius-lab/mes-comptes
bash ~/cornelius-lab/mes-comptes/cornelius/labo-macos.sh
echo "CORNELIUS_MODULES_DIR=$HOME/cornelius-lab/mes-comptes/cornelius" >> ~/cornelius-lab/cornelius/.env
bash ~/cornelius-lab/start.sh
```

Le script vérifie le Mac (Intel, macOS 13.5 ou plus, 6 Go libres), télécharge Node 24.2.0 et uv avec vérification d'empreinte, récupère la version auditée de Cornelius, applique les correctifs, installe la perception (onnxruntime 1.23.2, dernière version publiée pour Mac Intel) et ses modèles, puis crée un `.env` local avec un mot de passe administrateur aléatoire (`~/cornelius-lab/mot-de-passe-admin.txt`). Relancé, il ne refait que ce qui manque.

Mise à jour : `bash ~/cornelius-lab/stop.sh && git -C ~/cornelius-lab/mes-comptes pull && bash ~/cornelius-lab/mes-comptes/cornelius/labo-macos.sh && bash ~/cornelius-lab/start.sh`. Le `-b claude/tender-cori-m8232m` disparaîtra une fois ces fichiers sur `main`. Un dépôt privé demande d'être connecté à GitHub sur le Mac. Les modules apparaissent dans **Administration → Modules** ; un module refusé y est signalé « Module non chargé » avec la raison.

Bilan en lecture seule, sans aucun secret, à coller tel quel dans une conversation : `bash ~/cornelius-lab/mes-comptes/cornelius/verifier-macos.sh --tests` (installation, réglages non secrets, processus, page Écrire, journaux, réseau, mémoire, tests des modules).

Pour qu'une session Claude **sur le Mac** fasse l'installation et la validation avec vous : [PASSATION-MAC.md](PASSATION-MAC.md).

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
3. Ajouter la page à l'écran d'accueil (iPad : Partager → « Sur l'écran d'accueil » ; Android : ⋮ → « Ajouter à l'écran d'accueil ») : l'icône ouvre le miroir **en plein écran**, sans barre du navigateur (correctif 0003).
4. Toucher **Activer la voix** et accepter le micro.
5. Mode kiosque : iPad, **Réglages → Accessibilité → Accès guidé** (triple clic pour entrer et sortir) ; Android, **épinglage d'écran**. Écran : verrouillage automatique **Jamais**, tablette branchée.
6. Facultatif : ouvrir aussi `…:3443/telephone` et l'ajouter à l'écran d'accueil : une seconde icône **Écrire**, pour taper une question quand la voix ne convient pas.

Un seul miroir est actif à la fois : ouvrir celui de la tablette ferme celui de l'ordinateur (« Miroir ouvert dans un autre onglet »). La page **Écrire** n'est pas un miroir : elle ne ferme rien.

## Les téléphones de la maison

Le téléphone n'affiche pas le miroir : il ouvre la page **Écrire** (`/telephone`), une conversation écrite au nom du foyer (correctif 0005). Mêmes réponses et mêmes modules que la voix sur la tablette : repas et courses du Foyer, heure, météo, transports, appareils de la maison autorisés, recherche web si elle est activée. Jamais de souvenirs, d'agent ni de comptes personnels : ils restent devant le miroir, une fois la personne reconnue seule.

Ce qui est garanti (tests automatiques) :

- **Pas de fausse réussite** : si OpenAI ou un outil tombe en panne, la page dit « Cornelius n'a pas pu terminer sa réponse » et liste ce qui a déjà été lancé, avec son état réel (« non confirmé », « échec »…). Délai dépassé : « Une commande a peut-être été lancée : vérifiez avant de redemander. » La question revient dans le champ, elle n'est jamais renvoyée seule.
- **Mode privé** et **clé absente** : dits clairement, champ désactivé, rien n'est envoyé.
- **Accès** : mêmes règles que le miroir (appareil autorisé une fois par le mot de passe administrateur) ; adresses publiques refusées ; 20 messages par minute au plus.
- **Rien n'est gardé** : ni sur le téléphone (la conversation disparaît en fermant la page), ni dans le journal de Cornelius (seuls l'état, la durée et le nombre d'outils y sont écrits).

### À la maison (Wi-Fi)

1. Réseau local ouvert sur l'ordinateur (`CORNELIUS_LAN=1`, voir la tablette).
2. Sur le téléphone : `https://<adresse de l'ordinateur>:3443/telephone`, vérifier l'empreinte du certificat, **Autoriser cet appareil** avec le mot de passe administrateur (une fois).
3. Ajouter à l'écran d'accueil : icône **Écrire**, ouverte sans barre du navigateur.

### Hors de la maison (Tailscale)

Cornelius reste **invisible depuis Internet** : aucun port ouvert sur la box. Les téléphones passent par un réseau privé chiffré, [Tailscale](https://tailscale.com) (gratuit pour un usage personnel).

1. Installer Tailscale sur l'ordinateur de Cornelius et sur chaque téléphone, avec le même compte. L'installation sur le Mac demande les droits administrateur (extension réseau) : c'est la seule.
2. Dans `~/cornelius-lab/cornelius/.env` : `CORNELIUS_LAN=1` et `CORNELIUS_VPN=1`, puis redémarrer. Cornelius admet alors aussi les adresses Tailscale (100.64.0.0/10), et rien d'autre.
3. Sur le téléphone, Tailscale activé : `https://<adresse Tailscale de l'ordinateur, 100.x.y.z>:3443/telephone`, puis comme à la maison. **Utiliser cette adresse partout** : Tailscale fonctionne aussi à la maison, et l'autorisation de l'appareil est liée à l'adresse ouverte.
4. Facultatif, pour supprimer l'avertissement de certificat : dans la console Tailscale, activer **MagicDNS** et **HTTPS Certificates** ; sur le Mac, `tailscale cert <machine>.<tailnet>.ts.net` ; puis dans `.env` : `CORNELIUS_ALLOWED_HOSTS=<machine>.<tailnet>.ts.net`, `CORNELIUS_TLS_CERT=<chemin du .crt>`, `CORNELIUS_TLS_KEY=<chemin du .key>`, et ouvrir `https://<machine>.<tailnet>.ts.net:3443/telephone`. Ce certificat expire au bout de 90 jours : relancer `tailscale cert` avant. L'emplacement des fichiers produits par l'application Tailscale pour macOS est [DONNÉE_MANQUANTE : à constater sur le Mac].

### Mode privé

**Administration → Quand il écoute → Conversation → Bloquer OpenAI** : plus aucune voix ni aucun texte n'est envoyé à OpenAI, extraction de souvenirs et page **Écrire** comprises (elle affiche « Mode privé ») ; le blocage survit à un redémarrage. La tablette continue d'afficher l'heure et les informations permanentes. « Privé » veut dire **sans IA dans le cloud** : les modules continuent d'interroger leur source (relais Foyer, chiffré de bout en bout et illisible pour le serveur ; Météo-Concept pour la météo). Pour un écran sans aucune connexion, désactiver aussi l'affichage permanent de ces sources.

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
| Plein écran | Corrigé (0003) : l'icône ouvre le miroir sans barre. Sur iPad, la barre d'état reste visible par-dessus | Accès guidé conseillé quand même, pour empêcher de quitter la page |
| Lisibilité | Corrigé en **paysage** (0004) : textes 40 % plus grands, titre de 19 à 27 px environ. En **portrait**, inchangé : tout agrandissement masquait des détails de la carte | Tablette **en paysage** sur son support |
| Texte au clavier | Pas de champ sur le miroir (le miroir reste sans commande) ; la page **Écrire** (0005) sert au clavier, sur la tablette comme sur les téléphones | Deux icônes sur la tablette : miroir (voix) et Écrire |
| Page Écrire | Au nom du foyer seulement ; pas de voix, pas d'image, pas d'historique gardé | Questions personnelles : devant le miroir |
| Hors de la maison | Seulement par Tailscale ; sans Tailscale actif, le téléphone n'atteint pas Cornelius (« injoignable ») | Voulu : rien n'est exposé sur Internet |
| Caméra | Celle de l'ordinateur, pas celle de la tablette | « Le regard » et « la présence » n'ouvrent pas la conversation depuis la tablette : utiliser « Cornelius » |

### Critères d'acceptation

| Critère | Comment c'est assuré | Vérifié |
| --- | --- | --- |
| 1. Utilisable au doigt | Bouton principal de 48 à 50 px (≥ 44), mesuré aux formats iPad et Android 10″ | Mesuré en laboratoire ; à confirmer sur la tablette |
| 2. Lisible en plein écran | Plein écran depuis l'icône (0003) ; textes +40 % en paysage sans perte de détail (0004) | Tests navigateur (1024×768 à 1280×800) ; lisibilité à distance à juger sur la tablette |
| 3. Pas de fausse réussite en cas de panne | Foyer : relais en panne → échec, puis dernier relevé annoncé comme tel ; code étranger → « introuvable », jamais « rien de prévu ». Comptes : refus explicites. Cornelius : « commande acceptée » ≠ « confirmée », tâche Hermes incertaine jamais répétée. Écrire : panne → échec dit et liste de ce qui a été lancé | Tests automatiques (17 pour les modules, 17 pour Écrire) |
| 4. Données privées non exposées | Tablette et page Écrire au nom du foyer ; source Comptes du foyer refusée ; source personnelle lue seulement pour sa propriétaire ; aucun port ouvert sur Internet (Tailscale) | Tests automatiques + réglage « Quand il écoute » à appliquer |
| 5. Micro dans les conditions prises en charge | Écran allumé, page au premier plan, certificat accepté | À vérifier sur la tablette |
| 6. Relance simple | Agent de session macOS ; icône + « Activer la voix » sur la tablette ; icône Écrire sur les téléphones | À vérifier |
| 7. Fonctions sensibles protégées | Mot de passe administrateur, appareil autorisé, commandes et accords Hermes validés dans l'administration, liste blanche Home Assistant, module Comptes personnel | Existant dans Cornelius ; module testé |

### Lots réalisés (correctifs de Cornelius)

| Lot | Correctif | Vérifié en laboratoire | Reste à vérifier sur le matériel |
| --- | --- | --- | --- |
| T1 Plein écran | 0003 | Manifeste, icônes et balises servis (test navigateur) | Icône sur l'iPad ou la tablette Android |
| T2 Lisibilité | 0004 | Paysage +40 %, portrait inchangé, aucun détail perdu (test navigateur) | Lecture à 3 m |
| T3 Écrire | 0005 | 12 tests unitaires (dont l'annulation sur un vrai socket) + 5 tests navigateur | Réponse réelle d'OpenAI (aucune clé dans le laboratoire) |
| Téléphones dehors | 0002 | 2 tests unitaires (adresses 100.64/10 admises seulement avec `CORNELIUS_VPN=1`) | Connexion Tailscale réelle |
