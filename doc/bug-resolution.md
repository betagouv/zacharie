# Résolution de bug (admin)

Page `/app/admin/bug-resolution` : un admin décrit un dysfonctionnement (texte et/ou captures d'écran d'un ticket Notion). Albert (Albert API, DINUM) enquête dans le code et la base de production, puis rend un rapport : résumé, chronologie, cause racine, preuves, plan d'action, niveau de confiance.

**Albert est en lecture seule.** Il ne peut ni pousser de code, ni modifier la base. Le plan d'action est une proposition que les développeurs valident et exécutent eux-mêmes.

## Fonctionnement

- `POST /admin/bug-resolution` crée une ligne `BugInvestigation` et lance l'enquête dans le process de l'API (sans attendre). Le front interroge `GET /admin/bug-resolution/:id` toutes les 3 s et affiche les étapes au fil de l'eau.
- Boucle d'agent : `api-express/src/service/bug-investigator/`. 40 étapes et 15 minutes au maximum, puis Albert doit rendre son rapport avec ce qu'il a trouvé.
- Une enquête sans nouvelle depuis 20 minutes (serveur redémarré) passe en `ERREUR`.
- Les routes sont derrière la stratégie `admin` : ProConnect obligatoire (voir `proconnect-admin.md`).

Outils d'Albert, tous en lecture :

| Outil          | Source                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| `query_db`     | base de production via le rôle `zacharie_albert_readonly` (voir ci-dessous) |
| `search_code`  | recherche de code GitHub sur `betagouv/zacharie` (branche principale)       |
| `read_file`    | GitHub, au commit déployé (`COMMIT_ID` de Clever Cloud, sinon `main`)       |
| `list_dir`     | GitHub, au commit déployé                                                   |
| `list_commits` | GitHub, 20 derniers commits au commit déployé                               |

Le schéma Prisma est inclus dans le prompt système.

## Sécurité de la base

La vraie garantie est le rôle PostgreSQL : il n'a que `SELECT`, et pas sur les secrets. Le code ajoute des filets (une seule requête `SELECT`/`WITH`, transaction `READ ONLY`, `statement_timeout` de 10 s, 200 lignes maximum), mais ne doit pas être la seule protection.

Tables non lisibles : `Password`, `ApiKey`, `ApiKeyApprovalByUserOrEntity`.
Colonnes non lisibles : `User.web_push_tokens`, `User.native_push_tokens`, `NotificationLog.web_push_token`.

Script à exécuter une fois en production par un développeur (avec l'utilisateur propriétaire des tables) :

```sql
CREATE ROLE zacharie_albert_readonly LOGIN PASSWORD '<mot-de-passe-fort>';
ALTER ROLE zacharie_albert_readonly SET default_transaction_read_only = on;
ALTER ROLE zacharie_albert_readonly SET statement_timeout = '10s';

GRANT CONNECT ON DATABASE "<nom_de_la_base>" TO zacharie_albert_readonly;
GRANT USAGE ON SCHEMA public TO zacharie_albert_readonly;

DO $$
DECLARE
  t text;
  cols text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    IF t IN ('Password', 'ApiKey', 'ApiKeyApprovalByUserOrEntity') THEN
      CONTINUE;
    ELSIF t IN ('User', 'NotificationLog') THEN
      -- droits colonne par colonne, sans les tokens push
      SELECT string_agg(quote_ident(column_name), ', ') INTO cols
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t
        AND column_name NOT IN ('web_push_tokens', 'native_push_tokens', 'web_push_token');
      EXECUTE format('GRANT SELECT (%s) ON public.%I TO zacharie_albert_readonly', cols, t);
    ELSE
      EXECUTE format('GRANT SELECT ON public.%I TO zacharie_albert_readonly', t);
    END IF;
  END LOOP;
END $$;
```

Les tables créées plus tard ne sont **pas** lisibles automatiquement, ni les nouvelles colonnes de `User` et `NotificationLog`. Albert reçoit alors une erreur « permission denied » et le signale dans son rapport. Pour les ouvrir, relancer le bloc `DO` (il est idempotent). Si la nouvelle table contient un secret, l'ajouter d'abord aux exclusions.

Si l'add-on PostgreSQL de Clever Cloud refuse `CREATE ROLE`, demander au support Clever Cloud de créer ce rôle.

## Variables d'environnement (API)

| Variable                       | Rôle                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `ALBERT_API_KEY`               | clé Albert API (créée dans le Playground, connexion ProConnect)                                                    |
| `ALBERT_MODEL`                 | défaut `google/gemma-4-31B-it` (lit les images et appelle des outils)                                              |
| `ALBERT_API_URL`               | défaut `https://albert.api.etalab.gouv.fr/v1`                                                                      |
| `ALBERT_READONLY_DATABASE_URL` | URL PostgreSQL avec le rôle `zacharie_albert_readonly`                                                             |
| `GITHUB_TOKEN`                 | token GitHub en lecture seule (fine-grained, « Public repositories ») : la recherche de code GitHub exige un token |

`COMMIT_ID` est fourni automatiquement par Clever Cloud.

Les modèles disponibles pour la clé : `curl -s https://albert.api.etalab.gouv.fr/v1/models -H "Authorization: Bearer $ALBERT_API_KEY"`. Utiliser le champ `id`, pas les alias (ils changent sans préavis).

Quotas en mode expérimentation : environ 10 requêtes par minute par modèle. Une enquête dure quelques minutes. Pour plus, demander le mode « production limitée » à `albert.api@numerique.gouv.fr`.

## Données personnelles

- Albert API est hébergé en France sur un cloud SecNumCloud, ne conserve pas les conversations et n'envoie rien sur Internet.
- Les résultats de requêtes envoyés à Albert peuvent contenir des données personnelles (noms, emails, téléphones). Les secrets (mots de passe, clés API, tokens push) ne sont jamais lisibles.
- Les rapports et les étapes enregistrés dans `BugInvestigation` contiennent ces données. Pas de purge automatique pour l'instant.
- À valider avec le DPO : inscription au registre des traitements, durée de conservation des enquêtes.
