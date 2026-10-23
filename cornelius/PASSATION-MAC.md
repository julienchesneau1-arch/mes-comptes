# Passation : installer et valider Cornelius sur le Mac

Consignes pour une session Claude qui tourne **sur le Mac** (application Claude, onglet Code, ou `claude remote-control` dans un terminal). Une session cloud ne peut pas atteindre le Mac : c'est cette session locale qui fait le travail, avec la personne à côté.

## Règles impératives

1. **Aucun secret dans la conversation.** Ne jamais afficher, lire à voix haute ni recopier : le contenu de `~/cornelius-lab/cornelius/.env`, `~/cornelius-lab/mot-de-passe-admin.txt`, une clé OpenAI, un code du foyer, un jeton. Pas de `cat` sur ces fichiers. La personne les saisit elle-même dans l'administration de Cornelius, jamais dans le chat. Le bilan `verifier-macos.sh` est fait pour être montré : il n'affiche aucun secret.
2. **Pas de `sudo`**, pas de Homebrew, rien hors de `~/cornelius-lab` (sauf l'agent de session `~/Library/LaunchAgents/fr.cornelius.lab.plist`, et seulement avec accord).
3. **Demander avant** : ouvrir le réseau local (`CORNELIUS_LAN=1`), installer Tailscale (droits administrateur, fait par la personne), installer l'agent de démarrage automatique.
4. **Jamais** : ouvrir un port sur la box, toucher au serveur distant (VPS), à Traefik, à Docker ou aux autres projets ; modifier le code de Cornelius à la main (les correctifs sont dans `cornelius/correctifs/`) ; faire un commit ou un push sans demande explicite.
5. Ne rien inventer : un point non vérifié est écrit « non vérifié ».

## Étapes

1. **Installation** : demander à la personne de coller dans l'app **Terminal** la commande de `cornelius/README.md`, section « Installer » (`curl … installer-mac.sh … && bash ~/installer-cornelius.sh`). Elle télécharge le dépôt, installe, branche les modules, démarre et affiche le bilan ; lancée depuis Terminal, l'accès caméra et micro va à Terminal. En cas d'échec : `tail -40 ~/cornelius-lab/logs/installation.log` (sans secret), corriger seulement dans `~/cornelius-lab`, relancer la même commande ; une archive refusée (« différente de la version auditée ») se signale, elle ne se contourne pas.
2. *(fait par l'installation)*
3. *(fait par l'installation)*
4. **Redémarrage** (après un arrêt) : la personne lance elle-même `bash ~/cornelius-lab/start.sh` dans l'app **Terminal** ; lancé depuis une autre application, l'accès caméra et micro irait à celle-ci.
5. **Bilan** : `bash ~/cornelius-lab/mes-comptes/cornelius/verifier-macos.sh --tests`. Corriger chaque KO qui dépend de l'installation. Restent normalement : clé OpenAI absente.
6. **Réglages par la personne** (guider, ne pas regarder) : le mot de passe est dans son presse-papiers (copié par l'installation ou `start.sh`) ; elle ouvre `http://127.0.0.1:3000/admin#start`, puis :
   - **Mise en route** : clé OpenAI ;
   - **Modules → Foyer** : code du foyer, source du foyer, « Afficher en permanence » ;
   - **Modules → Mes comptes** (facultatif) : code de Mes Comptes, source avec elle-même pour propriétaire, résumé collé depuis Mes Comptes ;
   - **Quand il écoute** : ouverture par « Cornelius », tout le monde, « Reconnaître la personne pendant la conversation » décoché (tablette au nom du foyer).
   Puis relancer le bilan : la page Écrire doit être « prête ».
7. **Essais avec la personne** :
   - miroir `http://127.0.0.1:3000/` : « Activer la voix », dire « Cornelius, qu'est-ce qu'on mange ce soir ? » ; noter la réponse et le délai ;
   - page `http://127.0.0.1:3000/telephone` : même question par écrit, puis « quelles sont les courses ? » ;
   - couper le Wi-Fi 10 s pendant une question écrite : la page doit dire l'échec, jamais « c'est fait » ;
   - mode privé (Quand il écoute → Bloquer OpenAI) : la page Écrire doit afficher « Mode privé », puis le retirer.
8. **Mesures** : pendant une conversation, `bash ~/cornelius-lab/mesure.sh 60` (5 minutes), puis résumer `~/cornelius-lab/mesures.csv` : mémoire maximale du serveur et de la perception, processeur moyen, échange (swap) utilisé.
9. **Tablette et téléphones à la maison** (avec accord) : remplacer seulement la ligne `CORNELIUS_LAN=0` par `CORNELIUS_LAN=1` (`sed -i '' 's/^CORNELIUS_LAN=0$/CORNELIUS_LAN=1/' ~/cornelius-lab/cornelius/.env`), `stop.sh`, puis la personne relance `start.sh` dans Terminal. Donner l'adresse (`ipconfig getifaddr en0`) ; l'empreinte du certificat est dans l'administration, carte « Accès depuis le réseau local ». Suivre `cornelius/README.md`, sections « La tablette familiale » et « Les téléphones de la maison ».
10. **Hors de la maison** (facultatif, avec accord) : la personne installe Tailscale sur le Mac et les téléphones ; ajouter `CORNELIUS_VPN=1` au `.env` ; redémarrer ; donner l'adresse `100.x.y.z` (`ifconfig | grep 'inet 100\.'`). Suivre le README, « Hors de la maison ». Si `tailscale cert` est utilisé, relever où les fichiers `.crt`/`.key` ont été écrits.
11. **Démarrage automatique** (facultatif, avec accord) : README, « Après un redémarrage ». Attention : lancée par l'agent de session, la perception n'a peut-être pas l'accès caméra donné à Terminal ; vérifier après un redémarrage avec le bilan.

## Rapport à rendre

À la fin, un texte sans aucun secret, que la personne colle dans la conversation cloud :

1. la sortie complète du dernier `verifier-macos.sh --tests` ;
2. le résumé des mesures (étape 8) ;
3. le tableau des critères, chacun « vérifié », « échec » (avec ce qui a été vu) ou « non vérifié » :

| Critère | Comment le vérifier |
| --- | --- |
| 1. Utilisable au doigt | Tablette : boutons atteints sans viser |
| 2. Lisible en plein écran | Tablette en paysage, depuis l'icône, lue à 3 m |
| 3. Pas de fausse réussite | Étape 7 (Wi-Fi coupé, mode privé) |
| 4. Données privées non exposées | Tablette : jamais de souvenirs ni de comptes personnels |
| 5. Micro | « Cornelius » entendu depuis la tablette, écran allumé |
| 6. Relance simple | Après redémarrage du Mac et de la tablette |
| 7. Fonctions sensibles protégées | Administration refusée sans mot de passe depuis la tablette |

4. les problèmes rencontrés et ce qui a été fait, en une ligne chacun.
