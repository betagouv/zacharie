# 0012. App mobile Expo (WebView)

## Contexte

L'app mobile est une WebView Expo qui sert la SPA depuis des fichiers téléchargés au lancement (`expo/utils/offline-spa.ts`, voir [audit-local-first-2026-10.md](../audit-local-first-2026-10.md)). Les cookies cross-site n'y sont pas fiables (WebKit ITP). Une même app gardée en mémoire peut tourner des semaines (iPad, Mac).

## Décision

- Liens (`expo/ExpoApp.tsx`, `getPathFromDeepLink`, `getPathFromNotificationResponse`) : un lien universel `https://zacharie.beta.gouv.fr/...` ou `zacharie://...` prime sur le dernier chemin mémorisé (`initial-path`). En scheme custom, le premier segment est le host. Une notification push porte un chemin `/app/...` dans `data.url` (`api-express/src/third-parties/expo-push.ts`). App déjà lancée : la SPA navigue par pushState + popstate.
- Le splash natif ne laisse place à `<Chargement />` qu'une fois la police Marianne disponible.
- Mises à jour : au retour au premier plan, on vérifie seulement si une nouvelle version existe (manifeste distant) ; elle est téléchargée au prochain lancement, car les fichiers servis ne doivent pas changer sous la WebView. Si la page s'est arrêtée (mémoire), on peut installer avant de recharger.
- Serveur statique local à host et port fixes (`http://127.0.0.1:3000`), pour que l'allowlist CORS de l'API inclue cette origine exacte. Il attend un chemin absolu, pas une URI `file://`.
- `expo/generate-google-service-json.js` n'utilise pas `dotenv` : un build EAS local copie le projet sans le `.env`.
- Authentification : l'API renvoie le JWT dans le corps, le client l'envoie en `Authorization: Bearer` (`src/services/api.ts`, `bearerExtractor` dans `api-express/src/middlewares/passport.ts`). La WebView est cross-site : cookie `SameSite=None; Secure` (voir [0013](0013-authentification-sessions-et-comptes.md)).
- Dev : localhost ne marche pas dans la WebView. Quand le navigateur est sur `http://localhost:3234`, l'API est appelée sur `http://localhost:3235` ; sur `http://x.x.x.x:3234`, sur `http://x.x.x.x:3235`.
- Jeton push (`src/utils/useNativePushToken.ts`) : la WebView injecte l'objet token sérialisé ; on ne stocke que la valeur `ExponentPushToken[…]`. `window.onNativePushToken` est un global unique : toutes les pages y installent la même implémentation. Accepter la permission système active PUSH dans `notifications` ; l'état affiché = appareil enregistré ET PUSH activé.
- Page 404 (`src/components/PageNotFound.tsx`) : un `initial-path` figé peut pointer vers une route supprimée (`/app/tableau-de-bord`, #391) ; on renvoie vers la vraie destination et on réécrit le chemin stocké.

## Conséquences

- Ne jamais naviguer par `window.location.href` (voir [0009](0009-deconnexion-et-navigation-webview.md)).
- Une ancienne version du bundle peut tourner plusieurs jours : le serveur doit rester tolérant (voir [0036](0036-serveur-express-configuration-et-securite-http.md), en-têtes `appversion` / `platform`).
