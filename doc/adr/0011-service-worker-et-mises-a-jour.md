# 0011. Service worker, serveur de l'app web et mises à jour

## Contexte

L'app doit démarrer hors ligne, mais un déploiement doit atteindre les utilisateurs au prochain chargement. Un onglet ouvert avant un déploiement référence des fichiers qui n'existent plus.

## Décision

- `app-local-first-react-router/src/service-worker.ts` : le cache (`CACHE_NAME`) ne contient que les fichiers statiques de l'app (même origine), jamais de réponses de l'API ; les requêtes vers l'API (autre origine) et les non-GET vont au réseau. La liste des assets (`self.__WB_MANIFEST`) est injectée au build (`injectManifest`). `skipWaiting` + `clients.claim`.
- `src/sw/register.ts` : un chunk introuvable (`vite:preloadError`) signifie que les fichiers du bundle ont été remplacés. Un changement de contrôleur alors que la page en avait déjà un signifie qu'une nouvelle version est installée (le premier contrôleur n'est pas une mise à jour). Dans l'app mobile ce signal est ignoré : c'est l'app native qui prévient au retour au premier plan.
- `src/sw/new-version-prompt.tsx` : sur le web, toast « Recharger » (`reload()` sur place, sans quitter la WebView) ; dans l'app mobile, le toast demande de rouvrir l'application (recharger redonnerait la même version).
- `server-app.js` : assets empreints par Vite mis en cache pour toujours ; un fichier d'un ancien build reçoit 404, pas `index.html` (sinon le service worker cacherait du HTML sous l'URL d'un JS). `index.html`, le service worker et `spa-manifest.json` ne sont jamais mis en cache. `index.html` est lu une fois au démarrage. En-têtes de sécurité (Mozilla Observatory, `x-powered-by` désactivé) ; CSP adaptée aux review apps (API sur une URL cleverapps.io propre à la PR) et `blob:` pour l'aperçu PDF ; Universal Links et App Links servis ici.
- `vite.config.ts` : plugin Sentry actif seulement sur le build Clever (`SENTRY_AUTH_TOKEN`) ; sourcemaps `'hidden'` (envoyées à Sentry, pas servies). Elles doublent la RAM du build (2,4 Go contre 1,2 Go) : `CC_BUILD_FLAVOR` au moins M.

## Conséquences

- Ne jamais mettre en cache une réponse de l'API dans le service worker (fuite entre sessions, données périmées).
- Toute erreur ici casse l'app pour tous les utilisateurs jusqu'à un rechargement forcé (voir CLAUDE.md).
