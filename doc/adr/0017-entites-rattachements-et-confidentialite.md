# 0017. Entités, rattachements et confidentialité

## Contexte

Zacharie fonctionne sur invitation. Une entité (ETG, SVI, association, commerce…) a des membres et des partenaires. Un commerce ne veut pas que ses concurrents sachent qu'il est livré via Zacharie. Les fédérations sont décrites dans [federations.md](../federations.md).

## Décision

**Qui crée quoi** (`ListAndSelectEntities.tsx`, `RelationEntityUser.tsx`, `RolesCheckboxes.tsx`) : une entité circuit court n'est créée que par un chasseur qui lui transmet des carcasses ; ETG / SVI / collecteur seulement par un admin Zacharie ; un nouvel utilisateur n'est ajouté que par un admin de l'entité ; un utilisateur qui s'inscrit seul est chasseur ; le rôle FEDERATION n'est attribué que par l'équipe.

**Rattachement** (`api-express/src/controllers/user-entity.ts`) :

- Une entité garde toujours un admin (`getLastAdminSituation`). Les admins Zacharie rattachés (support, tests) ne comptent pas et n'apparaissent pas parmi les membres.
- On ne demande pas à rejoindre une fédération. Le premier utilisateur d'une entité en devient admin (rattachement direct, ou chasseur qui rejoint une association sans membre) ; l'équipe est prévenue pour vérifier.
- Le dernier membre qui quitte une association la supprime (soft delete) ; les autres entités sont gérées par l'équipe.
- Une relation `REQUESTED` par un non-chasseur lève une erreur pour Sentry, après création, volontairement.
- Chaque écriture de relation incrémente `User.carcasses_reload_version` (voir [0005](0005-pull-delta-et-perimetre-de-lecture.md)).
- Un chasseur est rattaché à 5 associations au maximum, demandes en attente comprises (`MAX_ASSOCIATIONS_DE_CHASSE`, `utils/associations-de-chasse-limit.ts`, même valeur côté app `src/utils/max-associations-de-chasse.ts`).

**Confidentialité** (`controllers/entite.ts`, `controllers/user.ts`) :

- Entités à relation validée : relations complètes avec données des membres. Relation en attente : seule la relation de l'appelant, sans données de tiers. `GET /entite/working-for` : la liste globale n'inclut aucune relation ; un non-admin qui se rattache obtient `REQUESTED` (statut envoyé ignoré) ; jamais `UserRelatedWithEntity`.
- Partenaires circuit court : seuls ceux de l'utilisateur (toute relation `CAN_TRANSMIT` active compte), jamais les autres relations du partenaire. CCG et associations confidentiels ; ETG et SVI visibles (les SVI via les ETG). Entités de test (`for_testing`) visibles des seuls admins Zacharie. Les fédérations sont exclues des entités pour lesquelles on agit.
- Ce qu'un chasseur voit d'un premier détenteur cherché par email (`userPartenaireSelect`) : ni téléphone ni adresse, qui arrivent avec les fiches. Côté app, on garde ceux reçus avec les fiches (`merge-user-partenaire.ts`).
- Les CCG : `numero_ddecpp` unique, un CCG existant est rattaché au lieu d'être recréé.
- Réglages ETG (`/etg/:entityId/parametres`) : valables pour toute l'entreprise, modifiables par tout salarié. `getEtgInteractedUserIds` borne la liste des utilisateurs consultables par un ETG.
- L'accord de partage de données donné au nom d'une entité n'est modifiable que par un admin de l'entité.
- La catégorie d'une entité n'est pas affichée aux chasseurs (`get-entity-display.ts`).

## Conséquences

- Ne jamais réintroduire de liste de tous les partenaires.
- Tests : `entite-partenaires.test.ts`, `entite-working-for.test.ts`, e2e `132-working-for-pii-leak-requested-relation`.
