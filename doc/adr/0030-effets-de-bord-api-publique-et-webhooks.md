# 0030. Effets de bord, API publique v1 et webhooks

## Contexte

Après chaque écriture de carcasse, le serveur déclenche notifications, certificats, deals Brevo et webhooks. Des tiers lisent les données par l'API v1 et reçoivent des webhooks. La propriété varie d'une carcasse à l'autre.

## Décision

**Effets de bord** (`api-express/src/utils/carcasse-side-effects.ts`, `runCarcasseSideEffects`, `runSideEffect`) :

- Chaque side-effect est isolé : l'échec de l'un n'empêche pas les suivants. Si `notifySviAssignment` échoue (résultat `undefined`), on s'arrête, pour ne pas envoyer à tort une notification de prochain détenteur.
- Les carcasses sont persistées avant les side-effects : plusieurs carcasses d'un lot peuvent voir « toutes terminales ». D'où l'idempotence par `!fei.svi_closed_at` et `notificationLog` (voir [0024](0024-inspection-svi-cloture-et-certificats.md)).
- Renvoi à l'expéditeur détecté (`notifyRenvoiExpediteur`) quand `next_owner` est vidé et `current_owner` inchangé, distinct d'une prise en charge.
- Clôture intermédiaire (`intermediaire_closed_at` null → date) : webhook `CARCASSE_CLOTUREE` à l'examinateur et au premier détenteur (`webhookExaminateurAndPremierDetenteur`).
- Les effets de bord des demandes de modification tournent après toutes les écritures du `/sync`.

**API v1** (`controllers/v1/*`, `utils/api.ts`) :

- La carcasse est la ressource autonome ; la fiche ne sert qu'aux noms de l'examinateur et du premier détenteur (`mapCarcasseForApi`, `mapFeiForApi`). On part des carcasses accessibles par la clé, on remonte aux fiches triées par examen le plus récent ; une fiche est lisible si une de ses carcasses est dans le périmètre.
- Carcasses renvoyées : celles du périmètre plus les refusées / manquantes des mêmes groupes de dispatch, jamais celles parties chez un autre destinataire.
- Deux Swagger maintenus à la main : `/docs/cle-dediee` et `/docs/tierces-parties`. `swagger-validation.test.ts` compare les mappers champ à champ. `/nouvelle-fiche` est un lien vers l'app, pas une route d'API.
- Clé API : jamais `private_key`, `public_key` ni `access_token` renvoyés (`apiKeySafeSelect`). Le webhook d'approbation relit la clé complète en base (`controllers/api-key-approval.ts`).
- Les refus attendus (4xx) ne remontent pas à Sentry.
- Sans utilisateur, la recherche d'approbations est abandonnée (un filtre `user_id: null` matcherait tout).

**Webhooks sortants** : `WebhookEvent` liste les événements réellement émis par `sendWebhook` et reste aligné avec l'enum des deux Swagger ; payload de même forme que les réponses v1. Seulement en `https://`, sauf dev et test (bac à sable en `http://localhost`).

**Lien de création de fiche** (`routes/nouvelle-fiche.tsx`) : une application tierce ouvre un lien pré-rempli sans secret ; le slug identifie la clé API du partenaire, un slug inconnu est ignoré. Le lien ne connecte plus l'utilisateur. On attend la réhydratation du store ; les paramètres `carcasse` sont lus avec `getAll` ; une carcasse invalide n'empêche pas les autres ; navigation finale en `replace`. Le bac à sable (api-playground, contexte `bac-a-sable`) n'est jamais exposé en production.

**Webhooks entrants** (`controllers/webhooks.ts`) : secret comparé à durée constante (`memeSecret`). Brevo s'authentifie par Bearer ; un mauvais token est remonté à Sentry. Création côté Brevo : `POST https://api.brevo.com/v3/webhooks` avec `url: https://api.zacharie.beta.gouv.fr/webhooks/brevo`, `events: ["contactUpdated", "contactDeleted"]` (camelCase), `type: marketing`, `channel: email`, `auth: { type: "bearer", token: <BREVO_BEARER> }`. Sentry : signature HMAC sha256 vérifiée, mauvaise signature = 200 sans effet.

## Conséquences

- Toute modification de ce fichier touche chaque écriture de carcasse (voir CLAUDE.md, fichiers à fort impact).
- Ajouter un événement webhook : enum `WebhookEvent` et les deux Swagger.
