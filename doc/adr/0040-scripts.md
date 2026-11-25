# 0040. Scripts ponctuels d'api-express

## Contexte

Le dossier `api-express/scripts/` contient des scripts lancés à la main (backfills, imports, seeds de démonstration). Leur usage et leurs précautions étaient dans leurs en-têtes.

## Décision

- **`20260818_backfill-brevo-contacts-commerce-de-detail.ts`** : crée les contacts Brevo manquants des utilisateurs `COMMERCE_DE_DETAIL` et resynchronise leurs attributs. Deux trous : les partenaires créés avant le 4 février 2026 (commit f1a7092d, `POST /entite/partenaire` n'appelait pas `createBrevoContact`), et les contacts créés depuis qui n'avaient que CREATED_BY / CREATION DATE / ROLE. Dry-run par défaut : `POSTGRESQL_ADDON_URI=... tsx ./scripts/20260818_backfill-brevo-contacts-commerce-de-detail.ts`. Envoi réel : `--apply` avec `NODE_ENV=production ENVIRONMENT=production BREVO_API=...` (sinon `DISABLED` est vrai dans `src/third-parties/brevo.ts`). Idempotent ; `createdBy: 'ADMIN'` évite une notice « Nouvelle ouverture de compte » par utilisateur.
- **`matomo-backfill.ts`** : import one-shot de l'historique Matomo dans `matomo_*_daily` ([matomo.md](../matomo.md)), un appel par mois, idempotent. `MATOMO_TOKEN=... MATOMO_SITE_ID=... POSTGRESQL_ADDON_URI=... npm run matomo-backfill -- --from 2025-01-01 --to 2026-10-20`.
- **`import-official-cfei.ts`** : `npx tsx scripts/import-official-cfei.ts path/to/cfei-list.csv`. Colonnes `numero_cfei` (requis, clé primaire), `nom`, `prenom`, `departement`. Lots de 100.
- **`fill-ccg-db.ts`** : CCG déclarés depuis un export Excel non public de l'administration ; CCG agréés depuis https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_VIAN_GIB_SAUV.txt. Le numéro DDecPP est extrait d'une cellule `|CCG:82-CCG-2|LIBRE:82-CCG-02|` → `82-CCG-2`.
- **`251203-clean-old-users.js`** : connexion par `POSTGRESQL_ADDON_URI` ou dans le fichier ; `EMAILS_TO_DELETE` à remplir à la main. S'appuie sur les cascades Prisma, liste les relations et demande confirmation.
- **`seed-trichine-labos.ts`** : un LVD, le LNR (ANSES) et un utilisateur LABORATOIRE chacun (`lvd@example.fr` / `lnr@example.fr`, `secret-secret`). Upsert sur des ids fixes lisibles.
- **`seed-trichine-labo-demo.ts`** : démo de l'import LIMS : LVD + LNR (nécessaire à la FTP auto sur DOUTEUX), `labo-demo@example.fr` rattaché à l'entité LVD (exigé par `guardLabo`), une FEI de 3 sangliers, 3 pools `P-26-EMTDM-000x`, une FTP ENVOYEE. Idempotent. Jamais contre une base partagée.
- **`seed-trichine-scenario-svi.ts`** : jeu du scénario manuel de test SVI (le script cite `doc/trichine-scenario-test-svi.md`, absent du dépôt) : quatre comptes et une fiche de 22 sangliers (répartition en 19 + 3). Email et push actifs. Préfixe `e2e-trichine`, idempotent. Jamais contre une base partagée.
- **`seed-trichine-jeu-de-test-labos.ts`** : passe par l'API HTTP comme l'app (aucune écriture directe en base). `API_URL=... SVI_PASSWORD=... [SVI_EMAIL=...] [MAX_CARCASSES=...] tsx ./scripts/seed-trichine-jeu-de-test-labos.ts [--dry-run]`. Les comptes labo doivent avoir une adresse réelle (PDF envoyé par email). Plan : un pool plein (19 carcasses, 95 g), des pools d'une carcasse, une fiche à dix pools. Si le prélèvement en lot est refusé, reprise carcasse par carcasse. Carcasses arrivées chez un ETG rattaché d'abord, puis sangliers réellement assignés. Seuls les LVD non-LNR sont adressables.
- **`populate-test-db.ts`** et **`apply-history-triggers.ts`** : voir [0039](0039-tests-e2e-vitest-et-seed.md).
- **`app-local-first-react-router/scripts/generate-anomalies-referentiel.mjs`** : voir [0021](0021-examen-initial-et-anomalies.md).

## Conséquences

- Les seeds de démonstration écrasent leurs propres données : ne jamais les lancer contre une base partagée.
