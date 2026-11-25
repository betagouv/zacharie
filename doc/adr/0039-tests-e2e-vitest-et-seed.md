# 0039. Tests : e2e, seed et vitest sur base réelle

## Contexte

La suite Playwright est sans flake ; ses conventions sont dans `e2e/CLAUDE.md`. Le seed `api-express/scripts/populate-test-db.ts` est la source de vérité des comptes et états de départ. Certains tests vitest doivent exécuter du SQL brut sur une vraie base.

## Décision

**Base e2e** :

- Créée par `prisma db push`, qui ignore le SQL des migrations : `api-express/scripts/apply-history-triggers.ts` rejoue fonctions et triggers (historique, copie de `Carcasse.updated_at` sur `CarcasseIntermediaire`), dans l'ordre des migrations, une fois par process (`historyTriggersReady`, `controllers/e2e.ts`), au premier `POST /__e2e/reset`. Lancé depuis `api-express/`.
- `POST /__e2e/reset` (appelé par `resetDb()`, `e2e/scripts/reset-db.ts`) vide et reseed. `TRUNCATE` ne déclenche pas les triggers row-level : les tables `*History` restent vides. Les états `SeedRole` débordent `FeiOwnerRole` : comparés en string.
- Le bac à sable est vidé par `TRUNCATE` sans supprimer les tables (son serveur ne les crée qu'au démarrage).

**Seed** (`populate-test-db.ts`) :

- Un seul hash bcrypt par process (tous les comptes ont le même mot de passe). Lancé en CLI (`tsx ./scripts/populate-test-db.ts --role=ETG`) ; importé par l'API de test, il ne fait rien à l'import.
- Fixtures : la `Fei` ne porte que ses champs propres ; la propriété est dans des objets `ownership...` appliqués à chaque carcasse par `getCarcasses`. « À compléter » côté premier détenteur = `current_owner = PREMIER_DETENTEUR` sans `next_owner` ni `prev_owner`. ETG qui refuse tout : la fiche reste à l'ETG avec `intermediaire_closed_at`. Carcasse prise en charge : `intermediaire_carcasse_manquante = false`. `refus_intermediaire_id` au format prod `{user_id}_{fei_numero}_reception`.
- `OfficialCfei` contient Martin et Petit, pas Moreau (`CFEI-075-25-003`, cas « CFEI introuvable »). Fédérations pré-créées comme en prod.
- États notables : comptes « -bis » (deux agents d'une entité) ; comptes chasseur incomplets (onboarding, sans formation, en attente avec ou sans formation) ; `PREMIER_DETENTEUR_ASSOCIATION`, `PREMIER_DETENTEUR_SANS_DESTINATAIRE`, `ASSOCIATION_FICHE_EXISTANTE` ; `SVI` (commentaire `RECHERCHE-COMMENTAIRE-TEST`), `SVI_CONSIGNE`, `SVI_SANGLIERS`, `SVI_CLOSED` (IPM2 sans heure le jour de la prise en charge) ; `LABORATOIRE_FTP_RECUE` (FTP `F-26-SVI01-0001`, pools `P-26-SVI01-0001` et `-0002`) ; `ETG_TABLEAU_DE_BORD`, `ETG_FILTRES_RAPIDES`, `CHASSEUR_MULTI_STATUS`, `CHASSEUR_MANY_FICHES`, `CHASSEUR_5_ASSOCIATIONS` ; `FEDERATION_STATS` (fiches datées d'aujourd'hui car la saison compte ; fiche admin de même forme que celle de l'Allier, pour que les chiffres doublent si l'exclusion régresse ; taux de saisie GG de 33,3 % sur l'Allier), `FEDERATION_STATS_CIRCUIT_COURT` ; `API_BAC_A_SABLE`.

**Conventions e2e** (`e2e/playwright.config.ts`, `e2e/utils/test.ts`) :

- `retries: 0` : un test instable doit être vu et corrigé.
- Chaque spec importe `{ test, expect }` depuis `e2e/utils/test.ts` : la fixture `page` écoute la console et échoue au teardown si « Transmssion differs from one of the carcasses » apparaît (voir [0002](0002-propriete-portee-par-la-carcasse.md)).
- Spec 133 (300 carcasses hors ligne) : volumes réduits par défaut ; charge réelle avec `DAIM_COUNT=145 CHEV_COUNT=145 PIGEON_LOTS=10`. Budget de 3 s par carcasse + 180 s (pire cas CI mesuré ~1,8 s / carcasse). Pas de `slowMo` global ni de trace.

**Vitest sur base réelle** (`*.db.test.ts`) : migrations appliquées par `prisma migrate deploy` (les triggers en viennent). En CI, `VITEST_DB_URL` pointe sur la base du job `checks` ; en local, sautés sauf base jetable. Session en `Pacific/Auckland` pour vérifier les bornes de dates du SQL brut. `carcasse-scope.db.test.ts` utilise une seule connexion, pose `updated_at` en dernier en SQL (`@updatedAt` l'écraserait) et vérifie que `getCarcasseScopeBranches` = `getCarcasseAccessWhere`, page par page, sans doublon.

**Autres** : les tests de mapping utilisent `fakeSyncScope` ; les limiteurs de débit sont désactivés en `NODE_ENV=test` ; le test structurel Matomo vérifie que la liste des routes publiques couvre `App.tsx`.

## Conséquences

- Ajouter un état de seed : étendre `SeedRole` et `populate-test-db.ts`.
- Ne pas importer `test` depuis `@playwright/test` dans une spec.
