# ProConnect pour les admins Zacharie

Les comptes `isZacharieAdmin` doivent, en plus de leur mot de passe, s'identifier avec ProConnect
pour accéder aux routes `/admin` de l'API (et donc à l'interface `/app/admin`).

## Parcours

1. L'admin se connecte normalement (`POST /user/login`) et arrive sur son espace habituel
   (`/app/chasseur`, ...). Rien ne change pour lui tant qu'il n'ouvre pas `/app/admin`.
2. Sur `/app/admin`, le front appelle `GET /admin/session` ; sur `PROCONNECT_REQUIRED` il l'envoie
   sur `/app/proconnect`, qui affiche un bouton ProConnect pointant vers
   `GET /user/proconnect/start?redirect=/app/admin/...`.
3. L'API pose un cookie `zacharie_proconnect` (state, nonce, PKCE, 10 min) et redirige vers ProConnect.
4. `GET /user/proconnect/callback` échange le code, appelle `userinfo`, puis vérifie que l'email
   ProConnect est **égal** à l'email du compte Zacharie. ProConnect authentifie, Zacharie autorise.
5. La session est réémise avec `proconnect_at` dans le JWT. La stratégie passport `admin` refuse
   (403 `PROCONNECT_REQUIRED`) tout JWT sans `proconnect_at` de moins de 12 h, durée de la session ProConnect.

Le front admin (`routes/admin/layout.tsx`) appelle `GET /admin/session` avant d'afficher quoi que ce soit
et renvoie vers `/app/proconnect` sur `PROCONNECT_REQUIRED`. Le login, lui, ne passe jamais par ProConnect.

`POST /admin/user/connect-as` est derrière la même garde : l'usurpation exige un admin ProConnecté, et la
session usurpée n'hérite pas de `proconnect_at`.

## Limites

- Pas de ProConnect dans l'application mobile (WebView sur `127.0.0.1:3000`, pas de redirection OIDC
  possible). Un admin s'y connecte avec une session sans droits admin.
- Un changement de mot de passe réémet un JWT sans `proconnect_at` : il faut refaire ProConnect.

## Variables d'environnement (API)

| Variable                   | Valeur                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| `PROCONNECT_ISSUER`        | Intégration : `https://fca.integ01.dev-agentconnect.fr/api/v2`      |
|                            | Production : `https://auth.agentconnect.gouv.fr/api/v2`             |
| `PROCONNECT_CLIENT_ID`     | fourni par l'Espace Partenaires                                     |
| `PROCONNECT_CLIENT_SECRET` | fourni par l'Espace Partenaires                                     |
| `VITE_API_URL`             | base du `redirect_uri` : `${VITE_API_URL}/user/proconnect/callback` |

En test (`NODE_ENV=test`, e2e) l'API embarque toujours un ProConnect factice sur `/mock-proconnect`
(`src/mock-proconnect.ts`) ; en dev, seulement si `PROCONNECT_ISSUER` n'est pas défini. Sa page
`/authorize` laisse saisir l'email renvoyé,
ce qui sert aux tests e2e (`e2e/tests/transverse/136-admin-proconnect.spec.ts`, compte `admin@example.fr`).

Vérifier les URLs d'issuer sur <https://partenaires.proconnect.gouv.fr/docs/fournisseur-service/implementation_technique>
(la discovery est `${PROCONNECT_ISSUER}/.well-known/openid-configuration`).

## Inscription auprès de ProConnect

Espace Partenaires : <https://partenaires.proconnect.gouv.fr/>

1. Créer une application de test ("Vos applications"). Déclarer les `redirect_uris` :
   - `https://api.zacharie.incubateur.net/user/proconnect/callback` (staging)
   - `https://api.zacharie.beta.gouv.fr/user/proconnect/callback` (production)
     Le `redirect_uri` doit être identique au caractère près (pas de `/` final).
2. Choisir `client_secret_post`, signature `RS256`, réponse `userinfo` en JSON ou JWT (les deux sont gérées).
3. Scopes utilisés : `openid email given_name usual_name`.
4. Passer la contractualisation DataPass puis demander les identifiants de production via le formulaire.
5. Chaque admin crée son compte ProConnect Identité avec son email `@beta.gouv.fr` et le SIRET de la DINUM.
   L'email ProConnect doit être exactement l'email du compte Zacharie.

Support : `support.partenaires@mail.proconnect.gouv.fr`.
