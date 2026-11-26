# 0016. Admin : historique, journal d'audit et listes

## Contexte

Les tables `<Table>History` (triggers Postgres, voir CLAUDE.md) gardent chaque version précédente d'une ligne. L'équipe doit savoir qui a modifié quoi, et naviguer dans de longues listes filtrées et partageables.

## Décision

**Historique** (`api-express/src/utils/admin-history.ts`) :

- Une ligne d'historique est une version précédente, valable pendant `sys_period` ; la version courante reste dans la table. Un changement = une version comparée à la suivante (lue avec `LEAD()`), daté de la fin de sa période, attribué au `version_user_id` de la version suivante. Seules `Fei`, `Carcasse` et `CarcasseIntermediaire` connaissent l'auteur : le filtre par auteur ne s'applique qu'à elles.
- Chronologie d'une fiche coupée aux `TIMELINE_MAX_EVENTS` (1000) plus récents.
- `to_jsonb` écrit les `timestamp(3)` sans fuseau : relus comme UTC. `Log.history` (`{ before, after }`) arrive parfois en chaîne : gérer les deux formes.
- Front (`routes/admin/history*.tsx`) : toutes tables confondues, plus actions métier, notifications et actions admin ; un bloc par jour ; événements identiques (même minute, auteur, changements) réunis, pour qu'une modification recopiée sur chaque carcasse n'apparaisse qu'une fois ; lignes repliées au-delà d'un seuil ; champs d'un même détenteur sur une ligne « nom (rôle) » ; noms techniques rendus lisibles, sigles gardés.

**Journal d'audit** (`api-express/src/middlewares/admin-audit-log.ts`, lu par `controllers/admin/audit-log.ts`) : chaque écriture `/admin` est journalisée après la réponse, réussie ou non ; monté après l'authentification admin. Les POST sans écriture (aperçus d'import, `ROUTES_NON_JOURNALISEES`) sont exclus. Captures base64 et gros imports tronqués (`LONGUEUR_MAX_*`) ; seuls les champs changés ; cible déduite des paramètres (`CIBLE_PAR_PARAMETRE`). Route et paramètres lus au premier `res.status()` / `res.send()`, car une erreur passée à `next()` remet `req.params` à zéro. Libellés front dans `admin-action-labels.ts`.

**Filtres back** (`utils/admin-list-filters.ts`, `controllers/admin/{fei,carcasse}.ts`) :

- `parseEnumList` ne garde que les valeurs de l'enum. Colonne `DateTime` : bornes de journée calculées côté serveur ; colonne `@db.Date` : pas de `startOf` / `endOf` (le fuseau ferait sortir les bornes).
- Options de listes déroulantes limitées aux valeurs réellement présentes. Filtre par ETG via les intermédiaires et leur `intermediaire_role` (plus fiable que `Entity.type`), car `latest_intermediaire_entity_id` vaut le SVI une fois assigné.
- Chaque filtre est un bloc empilé dans un `AND` (ne pas écraser le `OR` de la recherche). Cocher « avec » et « sans carcasses » ne filtre rien.
- Détenteurs et destinataires lus sur les carcasses (`getFeisDestinataires`, `AdminFeiDestinataire`), carcasses supprimées ignorées sauf sur une fiche supprimée ; l'entité prime sur l'utilisateur. Décompte d'activité : carcasses et fiches non supprimées qui passent par l'acteur à n'importe quelle étape.
- Comptes bloqués (`controllers/admin/inbox.ts`) : même règle que `getLockoutState` ; borne calculée en UTC côté base, écrite en ligne (pas de CTE) pour utiliser l'index `created_at`.

**Filtres front** (`routes/admin/use-url-filters.ts`, `admin-views.tsx`) : état dans l'URL (lien partagé, rechargement). Listes séparées par virgules, `page` à partir de 1, retour à la page 1 au changement de filtre, écriture en `replace`, paramètre `keep` (le tri) préservé, tableau stable pour les dépendances d'effet, recherche texte poussée après une pause de frappe. Vue prédéfinie = jeu de filtres, reconnue par une clé normalisée hors `keep`. Sans statut coché, utilisateurs et entités supprimés sont cachés. Lignes de la liste utilisateurs mémoïsées.

## Conséquences

- Ajouter une colonne à une table historisée : l'ajouter, nullable, au modèle `History` (test `history-tables.test.ts`).
- Une copie qui casse `LEAD()` ou la lecture UTC fausse toute la page « Historique ».
