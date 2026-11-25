# 0013. Authentification, sessions et comptes

## Contexte

L'API sert un web same-site, une WebView native cross-site et des review apps sur un suffixe public. Les formulaires publics attirent les robots. Plusieurs utilisateurs partagent souvent la même IP (administration, entreprise).

## Décision

**Cookie et jeton** (`api-express/src/utils/cookie.ts`, `utils/session-token.ts`) :

- Hors dev / test, cookie host-only préfixé `__Host-` (Secure, `Path=/`, sans `Domain`) : les autres sous-domaines (Metabase…) ne le reçoivent jamais. En dev / test, pas de préfixe (Safari refuse un cookie `Secure` en http, même sur localhost). `SESSION_COOKIE_NAME` est calculé à l'import.
- SameSite : web local `Lax` ; WebView native (127.0.0.1:3000) `None; Secure` ; review apps (`pr-<n>-zacharie.cleverapps.io` / `pr-<n>-zacharie-api.cleverapps.io`, deux sites car `cleverapps.io` est un suffixe public) `None` ; staging et production same-site.
- Un jeton émis avant le dernier changement de mot de passe est refusé (`isTokenRevokedByPasswordChange`) ; `iat` en secondes, le jeton de la même seconde reste valide. Après changement, un nouveau jeton est émis pour la session courante.
- Le cookie d'état ProConnect devient host-only ; une ancienne copie sur tout le domaine ferait échouer la connexion admin (`middlewares/migrate-legacy-session-cookie.ts`).

**Blocage de connexion** (`utils/login-lockout.ts`) : `MAX_FAILED_ATTEMPTS` (5) échecs sur `LOCKOUT_DURATION_MINUTES` (15), comptés depuis le dernier déblocage admin, bloquent le compte 15 min à partir de la ligne `LOGIN_LOCKED`. `LOGIN_FAILED_ALREADY_LOCKED` est écrit mais pas compté (sinon quelques requêtes garderaient n'importe quel compte bloqué). L'admin voit toutes les tentatives (voir [0015](0015-admin-corrections-suppressions-et-comptes.md)).

**Limites de débit** (`api-express/src/middlewares/*rate-limit*.ts`) : authentification par email ou jeton, 10 / 15 min en production ; second limiteur par IP seule, large, un compteur par route (`authIpRateLimit`), seules les connexions échouées comptent sur `/user/login` ; `/admin` 300 / min ; recherche de premier détenteur 20 / h par utilisateur ; API v1 10 / s par clé brute ou IP ; contact 5 / h ; upload par utilisateur (monter après `passport.authenticate`). Désactivées ou relevées hors production.

**Comptes** (`api-express/src/controllers/user.ts`) :

- Champ honey pot sur les formulaires publics : rempli, la route répond 200 vide.
- `/forget-password` ne dit pas si l'email existe ; la recherche de premier détenteur (réservée à l'examinateur initial de la fiche) répond pareil pour un email inconnu et un non-chasseur.
- La création de compte vaut connexion. Depuis le 14 octobre 2025, ETG / SVI / COLLECTEUR_PRO ne s'inscrivent que sur invitation : `/signup` crée un CHASSEUR.
- Un compte avec mot de passe ne passe plus par l'invitation : son jeton est un jeton de réinitialisation. Un compte sans mot de passe ne reçoit pas de lien de réinitialisation (il écraserait le jeton d'invitation, valable 7 jours) mais un nouveau lien d'invitation (`inviteUser`).
- Invitation : un chasseur n'invite que dans sa fédération ; l'invité reçoit le rôle de l'invitant (un seul rôle par utilisateur), sauf en fédération (rôle FEDERATION). L'invitant ne reçoit que l'id et l'email.
- L'email ne change pas (identité ProConnect et traçabilité) : `POST /user/:user_id` accepte l'email inchangé et refuse un nouvel email.
- Un CFEI vide est stocké null (`normalizeNumeroCfei`, `utils/sanitize.ts`).
- Activation (`utils/user.ts`, `autoActivatePremierDetenteur`) : un chasseur avec CFEI, ou formé à l'examen initial, attend une validation manuelle ; un compte déjà auto-activé puis désactivé se réactive à la main. Côté app, `CompteEnAttenteValidation.tsx` distingue « examinateur » (prépare, ne transmet pas) et « chasseur » sans CFEI (ni création ni consultation).

## Conséquences

- Un utilisateur soft-deleted ne peut plus se connecter (`middlewares/passport.ts`, route `/login`).
- Les admins passent par `/login` puis ProConnect (voir [0014](0014-proconnect-pour-les-admins.md)).
