# 0036. Serveur Express : configuration et sécurité HTTP

## Contexte

L'API tourne derrière le reverse proxy Clever Cloud, en production, staging, review apps, dev et test. Elle sert le web, la WebView Expo et des tiers.

## Décision

**Configuration** (`api-express/src/config.ts`) :

- En production et staging, l'API refuse de démarrer sans `VITE_SECRET` (un secret par défaut permettrait de forger un JWT).
- `IS_REVIEW_APP` : staging d'une PR (`.github/workflows/review-app.yml`) sur `*.cleverapps.io`, app et API sur deux sites distincts.
- Staging et review apps tournent en `NODE_ENV=production`. Les routes e2e (`mountE2eRoutes`, `POST /__e2e/reset`) n'existent qu'en `NODE_ENV=test`.
- Ports e2e figés : API 3291, app 3290 (`e2e/playwright.config.ts`).
- Services optionnels : Cellar (trois variables posées par l'add-on, bucket choisi par nous), Albert (`SOURCE_COMMIT` lu depuis `COMMIT_ID` de Clever, pour lire le code réellement en production), Matomo (sans token, le cron ne tourne pas), `NATIVE_PUSH_DRY_RUN` (coupe-circuit du push natif, voir [0029](0029-notifications-et-emails.md)).

**Serveur** (`api-express/src/index.ts`) :

- `.env.test` chargé avant l'import de `config.ts` (on ne peut pas y lire `IS_TEST`).
- `trust proxy` : `req.ip` est l'IP du client (`X-Forwarded-For`).
- Compression gzip / brotli montée tôt (`GET /carcasse` peut peser ~13 Mo en JSON).
- CORS : `http://127.0.0.1:3000` (serveur local de la SPA dans la WebView). `X-API-VERSION` exposé pour que le client compare sa version.
- Corps JSON limité à 5 Mo (fichiers trichine en base64).
- CSP : `'unsafe-inline'` pour les styles (DSFR) ; `blob:` en `frame-src` pour l'aperçu PDF. `Permissions-Policy` coupe caméra, micro, géolocalisation, paiement. `/healthz`, `security.txt` et `/` sont montées après helmet (`/` est l'URL scannée par l'Observatory MDN et logue l'User-Agent des requêtes suspectes).
- Client : un corps non JSON (page de proxy, vide) devient une erreur ; un téléchargement refusé répond en JSON et son message est affiché (`src/services/api.ts`, `download-api-file.ts`).

**Divers** :

- Borne de jour en heure de Paris (`controllers/quiz-result.ts`) : minuit à Paris = 23:00 UTC la veille en hiver, 22:00 en été.

## Conséquences

- Ne jamais monter une route de test hors `NODE_ENV=test`.
- Les limites de débit sont décrites dans [0013](0013-authentification-sessions-et-comptes.md).
