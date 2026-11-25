# 0014. ProConnect pour les admins

## Contexte

Les routes `/admin` exigent une double authentification ProConnect récente. Le parcours, les limites et les variables sont dans [proconnect-admin.md](../proconnect-admin.md).

## Décision

- `api-express/src/config.ts` : en e2e, l'API embarque toujours le fournisseur OIDC factice (`src/mock-proconnect.ts`), même si `PROCONNECT_ISSUER` traîne dans l'environnement ; en dev, seulement si `PROCONNECT_ISSUER` est absent. `PROCONNECT_ADMIN_DISABLED=true` ouvre `/admin` sans OIDC, en dev seulement. `API_URL` sert de base au `redirect_uri`.
- Le mock laisse saisir l'email renvoyé (cas « email différent ») et est monté avant helmet (page HTML sans CSP). openid-client refuse le http : requêtes non sécurisées autorisées pour le mock seulement.
- `controllers/proconnect.ts` : cookie temporaire signé (10 min) entre `/start` et `/callback` pour `state`, `nonce` et PKCE ; `sanitizeRedirect` n'accepte que les routes internes ; `/callback` réémet la session avec `proconnect_at`. C'est l'égalité avec l'email du compte admin qui autorise.
- `service/proconnect.ts` : scopes `openid email given_name usual_name` ; discovery mise en cache, retentée après échec ; l'email n'est pas dans l'`id_token`, on appelle `userinfo` (JSON ou JWT signé).
- `PROCONNECT_MAX_AGE` = 12 h, aligné sur la session ProConnect. `PROCONNECT_REQUIRED` (403) = session valide sans ProConnect récent ; le callback custom de `controllers/admin/index.ts` renvoie 401 pour « pas admin / session invalide » (le front déconnecte).
- `/session` vérifie que la session admin est complète. Le layout admin (`routes/admin/layout.tsx`) la vérifie avant d'afficher, et ne ré-encapsule pas `/app/proconnect` dans un second `redirect` (même règle dans `src/services/api.ts`).
- « Se connecter en tant que » n'emporte pas le ProConnect de l'admin.

## Conséquences

- Aucune route admin hors `api-express/src/controllers/admin/` (règle de CLAUDE.md).
- Le rate limit de `/user/proconnect` est posé route par route dans `controllers/proconnect.ts`.
