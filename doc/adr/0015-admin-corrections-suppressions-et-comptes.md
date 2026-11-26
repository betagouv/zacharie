# 0015. Admin : corrections de fiche, suppressions et comptes

## Contexte

L'équipe Zacharie corrige des fiches que l'examinateur ne peut plus modifier, supprime des fiches de test et gère comptes et entités. Ces écritures contournent `/sync` mais doivent redescendre aux clients et respecter les documents officiels.

## Décision

**Corrections d'une fiche** (`api-express/src/utils/admin-fei-corrections.ts`, `controllers/admin/fei.ts`) :

- Possibles tant que la fiche n'est pas clôturée (clôture intermédiaire ou SVI, certificat SVI émis) : ces documents officiels ne seraient plus en phase (`getAdminFeiCorrectionsBlocage`, exposé dans `corrections.blocage`).
- Les champs recopiés sur les carcasses (date, premier détenteur) le sont sur toutes les carcasses, supprimées comprises, comme `syncCarcasseDates` ; l'état de transmission ne concerne que les carcasses encore sur la fiche. `nextVersion` fait redescendre la correction.
- Premier détenteur : l'examinateur, un autre chasseur par email ou une association de l'examinateur (`getAssociationsDeChasse`) ; une association dont il n'est plus membre ne peut pas être reprise. Fiche pas encore transmise par le premier détenteur : il devient aussi détenteur suivant ou actuel ; déjà transmise : il reste `prev_owner`. Si la fiche attend son premier détenteur, le nouveau et l'ancien sont prévenus (`notifyNouveauPremierDetenteur`).
- Ajout d'une carcasse oubliée : seulement avant toute prise en charge (`ajoutCarcasseBlocage`), sinon il manquerait la ligne `CarcasseIntermediaire` ; elle reprend l'état de transmission d'une autre carcasse, sans notification. Le serveur ne valide que le type (la liste du petit gibier vit côté client).

**Soft delete** (`controllers/admin/{fei,carcasse,entity,user,search}.ts`) :

- Les listes admin et la recherche ⌘K incluent les éléments supprimés (badge) ; une entité supprimée s'ouvre pour être restaurée.
- Entité : jamais de hard delete (FK Fei/Carcasse → Entity en `onDelete: Cascade`). Elle disparaît des pickers (`deleted_at: null`) ; la copie locale peut encore la proposer, le sync refuse (voir [0007](0007-droits-d-ecriture-du-sync.md)).
- Utilisateur : ne peut plus se connecter ni agir ; restauration = `deleted_at` à null.
- Fiche : couvre ses carcasses et lignes d'intermédiaire. Carcasse : couvre ses lignes d'intermédiaire, refusé sur fiche clôturée. `nextVersion` + bump d'`updated_at` propagent la suppression. Les stats excluent déjà `deleted_at`.

**Comptes et entités** :

- `User` n'a pas de `version_user_id` : seul le journal admin trace l'auteur. Pas de notice « CFEI changé » pour une saisie de l'équipe. Mail « compte activé » dédupliqué. Lien d'invitation copié à la main (`/user/:user_id/invitation-link`), valable 7 jours.
- Entités (`controllers/admin/entity.ts`) : le consommateur final n'est pas une entité (406) ; un destinataire suit la même création que côté chasseur, sans relation `CAN_TRANSMIT` ; code trichine `@unique` recalculé sur P2002 (`withReferenceRetry`).
- Rattachements (`controllers/admin/user-entity.ts`) : validés d'office, le premier membre devient admin. La relation ETG → SVI est portée par `etg_linked_to_svi_id` (affichée désactivée, pas proposée). Le rôle ADMIN se gère par la case « Administrateur ». Un utilisateur n'est membre que d'une seule fédération (contrainte portée par le frontend).
- Import des premiers détenteurs (`controllers/admin/premiers-detenteurs.ts`) : association identifiée par raison sociale + code postal + commune (insensible à la casse), existence revérifiée à l'import.
- Références KPI (`controllers/admin/stats-ref.ts`) : suppression définitive, valeurs supprimées écrites dans le journal (le DELETE n'a pas de body).
- Vue trichine (`controllers/admin/trichine.ts`) : une route par section, lignes plates, listes bornées (limite ≥ 1, car une valeur négative inverse Prisma) ; `ftp_parent_id` signale une FTP de confirmation.

## Conséquences

- Toute nouvelle correction admin doit poser `nextVersion` et respecter le blocage sur fiche clôturée.
- Ces routes sont journalisées (voir [0016](0016-admin-historique-journal-et-listes.md)).
