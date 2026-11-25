# 0005. Pull delta `GET /carcasse` et périmètre de lecture

## Contexte

Le client tire les données de son périmètre par delta (`updated_at` > curseur). Le périmètre se lit sur les carcasses (voir [0002](0002-propriete-portee-par-la-carcasse.md)). Un OR multi-colonnes sur des centaines de milliers de lignes ne peut pas être servi par un index. Le delta ne voit jamais ce qui sort du périmètre. Le rechargement complet est documenté dans [rechargement-complet.md](../rechargement-complet.md).

## Décision

**Définition du périmètre** (`api-express/src/utils/carcasse-access.ts`) :

- `getCarcasseAccessWhere` renvoie le WHERE Prisma selon le rôle (null si rôle non supporté). Il est partagé par `GET /carcasse`, `GET /carcasse/refusees/:fei_numero` et les écritures de `/sync`. `getUserCarcasseEntityIds` (`utils/user-entities.ts`) sert à la lecture et au contrôle d'écriture des `CarcasseIntermediaire`.
- SVI et chasseur ont leur propre périmètre, prioritaire ; ETG, collecteur, etc. passent par `CarcasseIntermediaire`. Le droit de voir ne vient jamais des champs de propriété de la FEI.
- Une association désignée premier détenteur ne voit la fiche qu'une fois celle-ci sortie de l'examinateur initial (`current_owner_role <> EXAMINATEUR_INITIAL`).
- `intermediaire_user_id` fait charger la fiche par un collègue de l'ETG qui n'est ni propriétaire ni destinataire (pour voir qui a pris en charge).
- `getCarcasseScopeBranches` exprime le même périmètre en SQL brut, une branche par condition du OR (null : rôle non supporté ; `[]` : aucun accès). En SQL, `<>` exclut les NULL comme `{ not: ... }` de Prisma.
- `getCarcasseAccessWhereForEntity` : une clé API dédiée à une entité voit toute carcasse où l'entité apparaît dans une colonne de propriété.

**Pagination** (`findScopeCarcassesPage`, `api-express/src/controllers/carcasse.ts`) :

- Curseur `(updated_at ms, id)` de la dernière carcasse reçue, ordre décroissant, page suivante strictement après (`e2e/load/README.md`).
- Chaque branche est une requête à part, servie par son index (colonne, `updated_at desc`), limitée à une page, puis fusionnée. Pour les branches par entité, `CarcasseIntermediaire.carcasse_updated_at` (copie posée par trigger, jamais écrite par le code) réunit entité et date dans un index. DISTINCT avant LIMIT : une carcasse peut passer plusieurs fois par la même entité.
- `hasMore` se lit sur la page d'ids, pas sur la relecture par id (une suppression entre les deux ferait croire à la dernière page).
- `updated_at` est un timestamp sans fuseau stocké en UTC.

**Contenu de la réponse** :

- Utilisateurs renvoyés : seulement ceux contrôlés par le serveur (pas les `*_owner_user_id` venus du client), plus l'utilisateur intermédiaire.
- Demandes de modification chargées par carcasse ; chaque mutation d'une demande bumpe l'`updated_at` de sa carcasse.
- Une fiche sans carcasse n'entre pas dans le périmètre, mais ses rattachés directs (créateur, examinateur initial) la reçoivent en première page.
- `withDeleted=false` exclut les lignes supprimées ; avec `true`, une suppression (qui bumpe `updated_at`) est propagée.
- Un chasseur formé (CFEI) non activé charge ses fiches en préparation.

**Carcasses refusées hors périmètre** : une carcasse refusée ou manquante en amont « sort du circuit » (ses owners ne suivent plus, son `updated_at` ne bouge plus) et n'est jamais renvoyée par le delta aux détenteurs suivants ni au SVI. `GET /carcasse/refusees/:fei_numero` les fournit à l'ouverture d'une fiche (`loadCarcassesRefusees`, `app-local-first-react-router/src/utils/load-carcasses-refusees.ts`, sans toucher `lastUpdateFromServer`). Autorisation : au moins une carcasse de la fiche dans le périmètre normal, sinon 403. On ne renvoie que les refusées / manquantes des groupes de dispatch de l'utilisateur, jamais les carcasses parties chez un autre destinataire (elles pollueraient recherche et transmissions).

**Rechargement complet** : réponse `fullReload: true` sans filtre `updated_at` si le curseur est antérieur à `FORCE_FULL_RELOAD_AFTER` (`api-express/src/utils/force-full-reload.ts`) ou si `reloadVersion` est inférieur à `User.carcasses_reload_version`. Chaque écriture de relation `EntityAndUserRelations` appelle `requestCarcassesReload` (`utils/carcasses-reload.ts`), car l'entrée dans une entité n'amène jamais les carcasses existantes par delta.

**Client** (`app-local-first-react-router/src/utils/load-carcasses.ts`) :

- L'heure serveur est lue avant la pagination. Marge `DELTA_MARGIN_MS` (5 min, `src/utils/delta-margin.ts`) : une ligne écrite dans une transaction lente porte un `updated_at` antérieur à son COMMIT et serait sautée sans marge. Une ligne revenue seulement grâce à la marge ne remplace pas une modification locale non envoyée.
- Sur rechargement complet, on ne garde que les modifications locales non synchronisées ; un pull delta immédiat récupère une carcasse modifiée pendant la boucle.
- Les rôles sans périmètre carcasses ne lancent pas le pull. Garde contre une déconnexion pendant le fetch.
- Contrôle d'intégrité au plus toutes les 6 h : `GET /carcasse/count` (même périmètre, non supprimées) comparé aux carcasses synchronisées du store, hors refusées hors périmètre listées par le serveur. Écart : Sentry et rechargement complet.
- Entités des fiches : on ne comble que les trous (relation NONE) ; `loadMyRelations` fait foi pour les relations propres. `loadData` charge les relations avant les fiches.

## Conséquences

- `getCarcasseAccessWhere` et `getCarcasseScopeBranches` doivent rester identiques : `carcasse-scope.db.test.ts` le vérifie sur une vraie base, page par page, pour chaque rôle.
- Après une correction de données en base, avancer `FORCE_FULL_RELOAD_AFTER`.
- Toute nouvelle vue transverse (recherche, transmissions) doit exclure les carcasses de `/refusees`.
