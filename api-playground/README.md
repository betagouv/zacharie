# Bac à sable API Zacharie

Application tierce factice pour tester une clé API Zacharie : inscription,
liaison d'un compte Zacharie, lien de création de fiche pré-remplie, lecture des fiches.

**Dev et staging uniquement.** L'app refuse de démarrer si elle vise `zacharie.beta.gouv.fr`.

## Dev

1. `createdb zacharie-api-playground`
2. Dans Zacharie (`/app/admin`), créer une clé API tierce partie avec les scopes
   `FEI_READ_FOR_USER`, `CARCASSE_READ_FOR_USER`. Son slug (contexte de création) va dans `ZACHARIE_CONTEXTE`.
3. `cp .env.example .env`, puis `npm i && npm run dev` → http://localhost:3236
4. Créer un compte bac à sable, puis coller la clé privée à l'étape 0 (stockée en base, par compte).

La table `users` est créée (ou complétée) au premier appel.

## Staging

- `npm run build && npm start` (`node ./server-app.js`, port 8080), comme l'app Zacharie.
- Variables : `DATABASE_URL`, `ZACHARIE_API_URL`, `ZACHARIE_APP_URL`, `ZACHARIE_CONTEXTE`, `SESSION_SECRET`.
- Côté admin Zacharie staging, sur la clé API : URL de webhook `https://api-playground.zacharie.incubateur.net/api/webhook`.
