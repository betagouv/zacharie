# Fédérations de chasseurs (FDC / FRC / FNC)

Guide pour les admins Zacharie : fonctionnement des fédérations et gestion de leurs membres.

## Principe

- Les fédérations sont des **entités**, pas des rôles utilisateur.
- Toutes les fédérations sont **pré-créées** :
  - une **FDC par département** (108), ex. « FDC Allier (03) » ;
  - une **FRC par région** (25), ex. « FRC Auvergne-Rhône-Alpes » ;
  - la **FNC**.
- Dans l'admin, page **Entités**, les filtres **FDC / FRC / FNC** permettent de les retrouver.
- Un utilisateur appartient à **une seule fédération**, avec le statut **Admin** ou **Membre**.
- **Un chasseur ne peut pas demander à rejoindre une fédération** : c'est l'équipe Zacharie ou un admin de la fédération qui rattache ses membres.

## Deux profils de membres

1. **Chasseur membre d'une fédération** : il garde tout son usage chasseur (fiches, etc.) et a en plus :
   - l'onglet **« Tableau de bord Fédération »**, à côté de son tableau de bord personnel ;
   - le menu **Paramètres → Ma fédération**.
2. **Utilisateur « Fédération »** (rôle `FEDERATION`, sans être chasseur), ex. un directeur de FDC qui ne fait pas de fiches :
   - un espace dédié `/app/federation` : Tableau de bord, Paramètres (Ma fédération, Coordonnées, Mot de passe), Contact ;
   - à la première connexion, il renseigne seulement ses **coordonnées**.

Un chasseur qui n'est pas membre ne voit rien de tout cela.

## Ce que montre le tableau de bord

- **FDC** : son département.
- **FRC** : les départements de sa région, avec le détail par département.
- **FNC** : national, avec le détail de tous les départements et un filtre.
- Le détail par département liste **tous** les départements du périmètre, même sans carcasse.
- Période : la **saison en cours** (1er juillet → 30 juin). Statistiques anonymes, agrégées par département de prélèvement.
- ⚠️ Les fiches qui impliquent un **compte admin Zacharie** (créateur, examinateur ou premier détenteur) sont **exclues** des statistiques (fiches de test et tutoriels). Un admin Zacharie ne voit donc pas ses propres fiches dans ce tableau de bord.

## Rattacher une personne qui a déjà un compte (ex. un chasseur)

Deux chemins :

- **Par l'utilisateur** : Admin → Utilisateurs → fiche de la personne → onglet **« Fédération »** → **Ajouter** sur la bonne fédération.
- **Par la fédération** : Admin → Entités → filtre FDC / FRC / FNC → fiche de la fédération → onglet **« Utilisateurs ayant accès au tableau de bord de la fédération »** → **Ajouter** (la liste propose les chasseurs et les utilisateurs « Fédération »).

Quand un admin Zacharie ajoute une personne :

- la **première personne** rattachée à une fédération devient automatiquement **Admin** ;
- les suivantes deviennent **Membre** ;
- pas d'étape « En attente ».

La liste déroulante change le statut (Admin ↔ Membre). La corbeille retire la personne de la fédération.

## Créer un compte pour une personne qui n'est pas chasseur

1. Admin → Utilisateurs → **Ajouter un utilisateur** → rôle **« Fédération des Chasseurs (FDC / FRC / FNC) »**.
2. La rattacher à sa fédération (section précédente).
3. Sur sa fiche (onglet Identité) : **« Envoyer un lien de réinitialisation du mot de passe »**, pour qu'elle choisisse son mot de passe. ⚠️ La création depuis l'admin **n'envoie pas d'email automatique**.

**Plus simple :** rattacher seulement l'admin de la fédération, puis le laisser inviter ses collègues (section suivante) : l'invitation envoie l'email automatiquement.

## Ce que peut faire un admin de fédération (sans l'équipe Zacharie)

Dans **Paramètres → Ma fédération** :

- **Inviter un collègue par email** :
  - email inconnu de Zacharie → un compte « Fédération » est créé et la personne reçoit un email pour choisir son mot de passe ;
  - email déjà connu (ex. un chasseur) → la personne est ajoutée comme **Membre**.
- **Gérer les membres** : passer une personne en Admin ou en Membre, ou la retirer.

Un **Membre** voit le tableau de bord et le nom de sa fédération, mais ne peut ni inviter ni gérer les membres.

## Déroulé conseillé pour chaque FDC (visio)

1. La FDC indique qui est **l'admin** et, si besoin, les autres membres.
2. L'admin Zacharie rattache l'admin de la fédération :
   - déjà chasseur → depuis sa fiche utilisateur ;
   - sinon → créer d'abord un compte « Fédération », puis envoyer le lien de mot de passe.
3. L'admin de la fédération invite ensuite lui-même ses collègues depuis **Paramètres → Ma fédération**.

## Bon à savoir

- Un **admin Zacharie** rattaché à une entité (support, tests) **n'apparaît pas** dans la liste des membres vue par les utilisateurs, pour ne pas les perturber. Il reste visible dans les pages admin.
- Après un changement de statut, la personne voit l'onglet ou le menu à son prochain chargement de l'application (en ligne).
- Il n'y a pas d'écran pour modifier les départements couverts par une fédération : chaque fédération reçoit sa liste à la création.
