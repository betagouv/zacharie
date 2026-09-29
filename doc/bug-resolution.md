# Résolution de bug (admin)

Page `/app/admin/bug-resolution` : un admin décrit un dysfonctionnement (texte et/ou captures d'écran d'un ticket Notion). Albert (Albert API, DINUM) enquête dans le code et la base de production, puis rend un rapport : résumé, chronologie, cause racine, preuves, plan d'action, niveau de confiance. C'est un chat : l'admin peut ensuite répondre à Albert pour le corriger ou lui poser des questions.

**Albert est en lecture seule.** Il ne peut ni pousser de code, ni modifier la base. Le plan d'action est une proposition que les développeurs valident et exécutent eux-mêmes.

## Fonctionnement

- `POST /admin/bug-resolution` crée une conversation (`BugInvestigation`) avec le premier message et lance Albert dans le process de l'API (sans attendre). `POST /admin/bug-resolution/:id/message` ajoute un message à une conversation et relance Albert (refusé tant qu'Albert répond).
- `BugInvestigation.messages` contient tout l'historique au format de l'API Albert (messages, appels d'outils et leurs résultats), sans le prompt système, reconstruit à chaque tour. Albert garde donc tout ce qu'il a déjà trouvé.
- Le front interroge `GET /admin/bug-resolution/:id` toutes les 3 s tant qu'Albert répond, et affiche les appels d'outils au fil de l'eau.
- Boucle d'agent : `api-express/src/service/bug-investigator/`. 40 étapes et 15 minutes au maximum par message, puis Albert doit répondre avec ce qu'il a trouvé. Les résultats d'outils des tours précédents sont raccourcis à 1 500 caractères avant l'envoi, pour rester dans le contexte du modèle.
- Une conversation sans nouvelle depuis 20 minutes (serveur redémarré) passe en `ERREUR`. On peut alors renvoyer un message pour relancer Albert.
- Les routes sont derrière la stratégie `admin` : ProConnect obligatoire (voir `proconnect-admin.md`).

Outils d'Albert, tous en lecture :

| Outil          | Source                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `query_db`     | base de production via le rôle `zacharie_albert_readonly` (voir ci-dessous)                              |
| `fei_timeline` | base de production : chronologie compacte des actions (`Log`) d'une fiche, champs modifiés avant → après |
| `search_code`  | recherche de code GitHub sur `betagouv/zacharie` (branche principale)                                    |
| `read_file`    | GitHub, au commit déployé (`COMMIT_ID` de Clever Cloud, sinon `main`)                                    |
| `list_dir`     | GitHub, au commit déployé                                                                                |
| `list_commits` | GitHub, 20 derniers commits au commit déployé                                                            |

Le prompt système contient une méthode d'enquête (symptômes → chronologie → état actuel → code → hypothèse qui explique tous les symptômes), le guide métier `api-express/src/service/bug-investigator/metier.md` et le schéma Prisma. **Quand le métier change (nouveau rôle, nouvelle transition de propriété, nouvelle action journalisée), mettre à jour `metier.md`** : c'est ce qu'Albert sait du fonctionnement de Zacharie.

Le modèle d'enquête ne lit pas les images. Chaque nouvelle capture est transcrite une fois par le modèle de vision ; la transcription est gardée dans le message (`image_descriptions`) et visible dans le chat (« Ce qu'Albert a lu dans les captures »).

Un résultat d'outil de plus de 30 000 caractères est tronqué, avec un avertissement en tête qui demande à Albert de refaire une requête plus ciblée.

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
| `ALBERT_MODEL`                 | modèle d'enquête, défaut `deepseek-ai/DeepSeek-V4-Flash-0731` (raisonnement + outils, texte seul)                  |
| `ALBERT_VISION_MODEL`          | modèle qui transcrit les captures d'écran, défaut `google/gemma-4-31B-it`                                          |
| `ALBERT_API_URL`               | défaut `https://albert.api.etalab.gouv.fr/v1`                                                                      |
| `ALBERT_READONLY_DATABASE_URL` | URL PostgreSQL avec le rôle `zacharie_albert_readonly`                                                             |
| `GITHUB_TOKEN`                 | token GitHub en lecture seule (fine-grained, « Public repositories ») : la recherche de code GitHub exige un token |

`COMMIT_ID` est fourni automatiquement par Clever Cloud.

Les modèles disponibles pour la clé : `curl -s https://albert.api.etalab.gouv.fr/v1/models -H "Authorization: Bearer $ALBERT_API_KEY"`. Utiliser le champ `id`, pas les alias (ils changent sans préavis).

Quotas en mode expérimentation : environ 10 requêtes par minute par modèle. Une enquête dure quelques minutes. Pour plus, demander le mode « production limitée » à `albert.api@numerique.gouv.fr`.

## Données personnelles

- Albert API est hébergé en France sur un cloud SecNumCloud, ne conserve pas les conversations et n'envoie rien sur Internet.
- Les résultats de requêtes envoyés à Albert peuvent contenir des données personnelles (noms, emails, téléphones). Les secrets (mots de passe, clés API, tokens push) ne sont jamais lisibles.
- Les conversations enregistrées dans `BugInvestigation` (y compris les résultats de requêtes et les captures) contiennent ces données. Pas de purge automatique pour l'instant.
- À valider avec le DPO : inscription au registre des traitements, durée de conservation des enquêtes.
