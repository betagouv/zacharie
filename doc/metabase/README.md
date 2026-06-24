# Metabase — premières "questions" produit Zacharie

Ce dossier contient des requêtes SQL prêtes à coller dans Metabase (connecté en **lecture
seule** sur la base Postgres de prod, fourni par beta.gouv). Chaque fichier `.sql` correspond
à **une question** Metabase. On ne touche pas au code de l'app : ce sont uniquement des
requêtes + leur documentation.

## Comment importer une requête dans Metabase

1. Dans Metabase : **+ Nouveau → Question → Éditeur SQL natif** (Native query).
2. Sélectionner la base de données Zacharie (prod, lecture seule).
3. Coller le contenu d'un fichier `.sql` de ce dossier.
4. Brancher les **variables** (voir ci-dessous), puis **Enregistrer** la question.
5. Choisir la **visualisation** conseillée en tête de chaque fichier (ligne / barres / funnel /
   table / big number).
6. **Épingler** la question dans le dashboard cible (créer les 3 dashboards listés plus bas).

### Variables de filtre (date & département)

Toutes les requêtes utilisent la syntaxe Metabase des **clauses optionnelles** `[[ ... ]]` :
le bloc n'est inclus que si la variable est renseignée, donc **la requête tourne même sans
filtre**.

- `{{from}}` et `{{to}}` : variables de **type `Date`** (Date unique). Elles encadrent un
  champ horodaté précisé en tête de chaque fichier (souvent `created_at`, parfois
  `svi_carcasse_status_set_at`, `latest_intermediaire_signed_at`, `Log.created_at`...).
  Pattern utilisé :

  ```sql
  WHERE deleted_at IS NULL
    [[ AND created_at >= {{from}} ]]
    [[ AND created_at <= {{to}} ]]
  ```

  > Le sujet parlait de `BETWEEN {{from}} AND {{to}}`. On a préféré deux clauses `>=` / `<=`
  > séparées et **optionnelles** : ça évite l'erreur quand une seule borne est saisie et
  > permet d'exécuter la question sans filtre. On peut bien sûr revenir à un **Field Filter**
  > unique (`{{plage}}` mappé sur la colonne date) si on préfère le widget de plage Metabase.

- `{{departement}}` : variable de **type `Texte`**, comparée aux **2 premiers caractères** du
  code commune/postal (`'01'`, `'34'`, ...). Présente sur les questions où le découpage
  géographique a du sens (funnel, FEI/semaine, répartition users/entités).

- `{{role}}` (question _Fréquence des actions métier_) : **type `Texte`**, ex. `SVI`,
  `CHASSEUR`, `ETG`. Comparée à `Log.user_role`.

Pour chaque variable, Metabase la crée automatiquement à la 1ʳᵉ détection de `{{...}}` ;
il suffit de régler son **type** dans le panneau latéral et de la laisser **non obligatoire**.

## Dashboards & questions proposés

### Dashboard « Tunnel FEI »

| Question                                          | Fichier                      | Viz             |
| ------------------------------------------------- | ---------------------------- | --------------- |
| Funnel FEI (créée → … → clôturée)                 | `funnel-fei.sql`             | Funnel / barres |
| FEI créées par semaine (par dept & rôle créateur) | `fei-creees-par-semaine.sql` | Ligne           |
| Délais médians entre étapes (heures)              | `delais-medians-etapes.sql`  | Barres / table  |

### Dashboard « Activation & rétention »

| Question                                         | Fichier                         | Viz             |
| ------------------------------------------------ | ------------------------------- | --------------- |
| Activation par cohorte d'inscription             | `activation-cohortes.sql`       | Barres / funnel |
| Utilisateurs actifs hebdo (WAU) par rôle         | `wau-par-role.sql`              | Ligne           |
| Répartition users & entités par rôle/type & dept | `repartition-users-entites.sql` | Table / barres  |

### Dashboard « Usage & métier »

| Question                                        | Fichier                                    | Viz                     |
| ----------------------------------------------- | ------------------------------------------ | ----------------------- |
| Fréquence des actions métier par semaine & rôle | `frequence-actions-metier.sql`             | Ligne / barres empilées |
| Issues SVI (statut & motif de saisie)           | `issues-svi.sql`                           | Barres / table          |
| Taux de refus / manquantes intermédiaires       | `taux-refus-manquantes-intermediaires.sql` | Barres + big number     |

## Hypothèses, choix et limites

### Le modèle de données a bougé — ownership sur la Carcasse, plus la FEI

Depuis des refactos récentes (cf. commits autour de #484/#489), **les étapes de transmission,
SVI et intermédiaire vivent sur `Carcasse`, pas sur `Fei`**. Les champs `Fei.svi_*`,
`Fei.fei_current_owner_*`, `Fei.premier_detenteur_depot_*` etc. sont marqués `@deprecated`
(dual-write de rétrocompat). **Les requêtes utilisent les champs `Carcasse` comme source de
vérité** :

- `Carcasse.svi_assigned_at`, `svi_ipm1_signed_at`, `svi_ipm2_signed_at`,
  `svi_carcasse_status_set_at`, `svi_closed_at`, `svi_automatic_closed_at`.
- `CarcasseIntermediaire.prise_en_charge_at`, `decision_at`, `intermediaire_role`.
- `Carcasse.intermediaire_carcasse_refus_motif`, `intermediaire_carcasse_manquante`,
  `latest_intermediaire_signed_at`.

`svi_assigned_to_fei_at` a été **supprimé** (#484) : aucune requête ne s'y réfère.

### Étapes sans timestamp dédié → dérivées du `Log`

Il **n'existe pas** de colonne « transmise au 1er détenteur ». Pour le **délai** de cette
transmission (`delais-medians-etapes.sql`), on prend `MIN(Log.created_at)` sur l'action
`'current-owner-confirm-premier-detenteur'`. C'est une **approximation** : elle suppose que
le passage de relais est journalisé par cette action (vrai aujourd'hui dans le code). Dans le
**funnel** (`funnel-fei.sql`), l'étape « 1er détenteur » est mesurée sur l'**identité**
(`premier_detenteur_user_id`/`entity_id` renseigné), pas sur un horodatage.

### WAU : `Log` plutôt que `last_seen_at`

`User.last_seen_at` ne stocke **qu'une seule date** (dernier passage) : impossible d'en tirer
une **série temporelle historique**. On calcule donc le WAU depuis `Log` (1 ligne horodatée
par action) = nb d'utilisateurs distincts ayant ≥ 1 action métier dans la semaine. Une
variante « instantané 7 jours » basée sur `last_seen_at` est fournie en commentaire dans
`wau-par-role.sql` (utile en Big Number, jamais en courbe).

### Filtrage des données de test

Convention reprise de `materialized-views/carcasses-svi-stats.sql` :

- FEI/Carcasses : `created_by_user_id NOT LIKE '%GLOP%'`.
- Entités : `for_testing = false`.
- Utilisateurs : `isZacharieAdmin = false` et `email NOT LIKE '%@example.org'` (comptes de
  démo/e2e). Les comptes `COLLECTEUR_PRO` peuvent ne pas avoir d'email → on utilise
  `COALESCE(email, '')` pour ne pas les exclure par erreur.

### Rôle d'un utilisateur : `role` vs `roles[]`

La migration `roles[]` → `role` est en cours (cf. `User.role // TODO: migrate from roles`).
Les requêtes prennent `COALESCE(u.role, u.roles[1])` pour rester robustes pendant la
transition. **Règle métier : un utilisateur n'a qu'un seul rôle.**

### Département : 2 premiers caractères

On découpe par `SUBSTRING(commune_mise_a_mort FROM 1 FOR 2)` (FEI) ou `code_postal` (users/
entités), comme `materialized-views/france-stats.sql`. **Limites connues** : la Corse
(`2A`/`2B`) et les DOM (codes à 3 chiffres `971`...) ne sont pas correctement isolés par un
simple `LEFT(.., 2)`. À affiner si le pilotage géographique devient important.

### Réutilisation des vues matérialisées

- `issues-svi.sql` et `taux-refus-manquantes-intermediaires.sql` **reproduisent la logique**
  de `carcasse_svi_stats` / `carcasse_intermediaire_refus_stats` en version **date-filtrable**
  (les vues matérialisées sont pré-agrégées et figées, donc insensibles à `{{from}}/{{to}}`).
  Pour un instantané sans filtre, on peut interroger directement les vues
  (`SELECT * FROM carcasse_svi_stats;`).
- `repartition-users-entites.sql` **n'utilise pas** `department_statistics` : cette vue est
  dérivée des FEI (ne compte que les acteurs apparaissant sur une fiche). Pour une vraie
  répartition des comptes **enregistrés**, on requête `User`/`Entity` en direct.

### Nouvelles vues matérialisées éventuelles

Aucune requête de ce dossier n'en exige pour démarrer. Si le `Log` grossit et que
`wau-par-role.sql` / `frequence-actions-metier.sql` deviennent lents, on pourra proposer une
vue d'agrégat hebdo `log_weekly_activity (semaine, role, action, nb, nb_users)`. Le cas
échéant elle sera déposée **ici, dans `doc/metabase/`** (pas dans `materialized-views/`) et
**non exécutée** — c'est l'utilisateur qui décidera de la déployer.

## Données personnelles

Toutes les requêtes **agrègent** (COUNT/SUM/médiane) et ne renvoient ni nom, ni email, ni
identifiant individuel. Garder cette règle si on ajoute des questions : pas de ligne
ré-identifiante dans un dashboard partagé.
