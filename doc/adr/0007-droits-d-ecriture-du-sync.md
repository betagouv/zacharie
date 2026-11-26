# 0007. Droits d'écriture du `/sync`

## Contexte

Avant le lot 3 de l'audit, tout compte activé pouvait écraser la fiche, la carcasse ou l'intermédiaire d'un tiers en connaissant son identifiant. Le client renvoie toujours l'objet entier, champs des autres rôles compris. Le tableau « qui écrit quoi » est dans [droits-ecriture-sync.md](../droits-ecriture-sync.md) ; cet ADR garde le pourquoi.

## Décision

**Périmètre** (`SyncScope`, `api-express/src/utils/sync-scope.ts`) :

- Résolu une fois par requête. `carcasseAccessWhere` est le périmètre de lecture : l'écriture épouse exactement la lecture.
- `grant` accorde l'accès à une carcasse que l'appelant vient de créer (elle naît sans colonne de rattachement) ; sinon un échec ultérieur laisserait une ligne que personne ne peut reprendre.
- Seuls les accès accordés sont mémorisés : une carcasse peut entrer dans le périmètre au cours de la requête (créée, transmise, rattachée par une ligne d'intermédiaire).
- `outOfScope` relit la base sans cache pour repérer les carcasses que l'utilisateur vient de sortir de son périmètre (voir [0004](0004-synchronisation-push-sync.md)).
- `isFeiOwner` : colonnes qui nomment un utilisateur (créateur, examinateur initial, premier détenteur). La désignation d'une association n'en est pas une : `canWriteFei` l'ouvre par le décompte de ses carcasses, exactement quand la lecture s'ouvre. Une fiche est modifiable par un rattaché, ou par un détenteur aval tant qu'il détient au moins une carcasse.

**Fiche** (`syncFei`, `utils/sync-fei.ts`) : deny by default via `canWriteFei`. Un chasseur formé non activé peut créer et préparer, pas transmettre. Plus de suppression par le chasseur après une prise en charge en aval. Les colonnes de rattachement réécrites par un détenteur aval sont ignorées (il garderait l'accès et évincerait le premier détenteur). `canWriteApprobationExaminateur = isFeiOwner || isPremierDetenteur` : signature réglementaire, interdite à l'ETG, permise au membre de l'association désignée. Date, lieu et heures de l'examen n'appartiennent qu'à l'examinateur (recopiés sur toutes les carcasses par `syncCarcasseDates`). `examinateur_initial_user_id` est le créateur et ne change jamais : le corps est ignoré (il commande l'approbation des demandes de modification). Un slug de contexte inconnu est ignoré.

**Carcasse** (`syncCarcasse`, `utils/sync-carcasse.ts`) :

- On ne modifie que dans son périmètre et on ne crée que sur une fiche à laquelle on participe. Les droits par rôle se lisent sur la fiche de la carcasse, pas sur une autre fiche du corps. Créateur = auteur de la requête ; `created_at` client gardé pour le tri.
- Chaque groupe de champs appartient à un rôle ; pour un autre, la valeur du corps est ignorée (pas de rejet). Points notables : premier détenteur = copie de la fiche pour un détenteur aval ; stockage et transport effaçables par tous, remplis par le seul premier détenteur ; une carcasse manquante ajoutée par un intermédiaire reprend les choix du premier détenteur d'une carcasse de sa branche ; transmission et décision réservées au détenteur en cours (ou aux rattachés tant que la carcasse est chez les chasseurs) ; un refus ou un manque n'est levé que par l'entité qui l'a déclaré ; `svi_assigned_at` / `svi_entity_id` écrits par l'ETG ; les colonnes « auteur d'une action » prennent l'utilisateur courant.
- `svi_carcasse_status` : recalculé par le client quel que soit le rôle ; hors SVI, limité aux statuts calculables sans décision SVI (`canNonSviWriteStatus`, miroir de `updateCarcasseStatus`). Une décision SVI n'est réécrite que par le SVI.
- Compte non activé : désigner le premier détenteur est permis, transmettre au-delà est refusé par une erreur **transitoire** (le client repousse dès que l'admin active le compte).
- Pas de gel après inspection SVI : tout est tracé (logs, `version_user_id`), on préfère pouvoir corriger.
- Relation `CAN_TRANSMIT` : créée seulement si l'utilisateur vient de choisir le destinataire. Un échec est remonté à Sentry sans faire échouer le sync.
- Options de masse (`SyncCarcasseOpts`) : `existingFei`, `existingCarcasse` (`undefined` = à requêter, `null` = absente), `ensuredRelations`, `deletedEntityIds`.

**Ligne d'intermédiaire** (`syncCarcasseIntermediaire`) : contrôle `canWriteCarcasse` (sinon créer une ligne suffisait à obtenir la lecture). Identité décidée par le serveur et posée à la création seulement ; le rôle vient du client (un ETG enregistre le transport d'un collecteur).

**Autres gardes** :

- Entités supprimées (`api-express/src/utils/deleted-entities.ts`) : une fiche ou carcasse ne peut pas désigner une entité supprimée ; seules les valeurs qui changent sont vérifiées.
- Premier détenteur personne physique (`isAllowedPremierDetenteurUserId`) : soi-même ou un chasseur ajouté par email (relation `PREMIER_DETENTEUR`), jamais un id arbitraire, car ses coordonnées sont renvoyées à tous ceux qui voient la fiche.
- Les pouvoirs d'admin Zacharie passent par `/admin`, jamais par `/sync`.

## Conséquences

- Tout nouveau champ doit être rangé dans un groupe de rôle de `syncCarcasse` / `syncFei`, et ajouté au tableau de [droits-ecriture-sync.md](../droits-ecriture-sync.md).
- Les tests de mapping utilisent `fakeSyncScope` (permissif) ; l'autorisation a son propre test qui construit un vrai `SyncScope`.
