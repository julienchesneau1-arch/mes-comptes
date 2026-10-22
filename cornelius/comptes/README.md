# Module Cornelius « comptes »

Cornelius dit et affiche, **à la personne reconnue seule devant le miroir**, où elle en est ce mois-ci : le reste une fois les dépenses et l'épargne comptées, le rythme par rapport à d'habitude, ses budgets et ses objectifs d'épargne.

## Pourquoi un résumé collé

Mes Comptes n'a pas de serveur : les données restent sur le téléphone et la page interdit toute connexion sortante. Rien ne change à cela. Le téléphone produit un **résumé chiffré** que vous collez dans Cornelius ; le module le déchiffre sans aucun appel réseau.

Le résumé ne contient que des totaux du mois en cours pour un profil :

| Contient | Ne contient jamais |
| --- | --- |
| reste, revenus, dépenses, épargne du mois | une opération, un libellé, un marchand |
| dépenses au jour J et d'habitude | un compte, un numéro, un IBAN |
| budgets du profil : limite et dépensé (8 au plus) | un solde, un patrimoine |
| 5 plus grosses familles de dépenses | les données de l'autre profil |
| objectifs du profil : cible et mis de côté (5 au plus) | |

Il est chiffré avec le **code du foyer** de Mes Comptes (AES-256-GCM, clé PBKDF2-SHA256 de 210 000 tours, comme les liens de synchro et les sauvegardes). Le déchiffrement et la validation sont ceux de `core.js` lui-même (`openSummary`, testé par `node test.js`).

## Réglages

1. Dans Mes Comptes, sur **votre** profil : **Réglages › Sauvegarde & synchro › 🪞 Résumé pour Cornelius**. Le texte (`cornelius:mcr1.…`) est partagé ou copié.
2. Dans Cornelius : **Modules → Mes comptes**, saisir le code du foyer de Mes Comptes (une fois), puis **Ajouter une source** avec **vous comme propriétaire** et coller le résumé.
3. Refaire l'étape 1 et remplacer le résumé après chaque import de relevés (le rituel du mois).

## Protections

- **Source du foyer refusée** : une source dont le propriétaire est le foyer échoue en « Réglage incomplet », même avec un résumé valide (testé). Les chiffres d'une personne ne peuvent donc jamais s'afficher sur l'écran partagé au nom de la maison.
- **Jamais pour une autre personne** : le cœur de Cornelius ne lit la source que pour son propriétaire, reconnu seul (testé avec une autre personne et sans personne).
- **Pas d'affichage permanent** : volontairement absent pour des chiffres personnels.
- Autre code → « Identifiants refusés » ; résumé abîmé ou incomplet → refusé ; texte qui n'est pas un résumé → « Réglage incomplet ». Jamais de chiffres inventés.
- Résumé d'un autre mois, ou de plus de 7 jours : dit tel quel (« Résumé d'octobre, pas du mois en cours », « date de 31 jours »).

## Limites

- Les chiffres sont ceux du jour où le résumé a été fait, pas d'aujourd'hui : Cornelius le dit.
- Le résumé collé et le code du foyer sont gardés dans la base locale de Cornelius ; quiconque lit cette base peut les déchiffrer. Protégez l'ordinateur de Cornelius.
- Le code du foyer de Mes Comptes est partagé par les deux profils ; le cloisonnement entre personnes est assuré par Cornelius (propriétaire de la source), pas par le chiffrement.

## Tests

```sh
cd <Cornelius> && CORNELIUS_MODULES_DIR=<mes-comptes>/cornelius npm run test:modules
cd <mes-comptes> && node test.js
```
