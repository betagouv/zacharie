# 0009. Déconnexion, changement de session et navigation dans la WebView

## Contexte

Dans la WebView Expo, affecter `window.location.href` ouvre l'URL dans Safari (ou le navigateur externe). On navigue donc par `history.pushState` + un `popstate` manuel. Contrepartie : pas de rechargement, le tas JS survit, et l'état de la session précédente fuit dans la suivante (cas réel : `lastUpdateFromServer` non remis à zéro casse la synchro delta, test e2e 117). La règle est rappelée dans `app-local-first-react-router/CLAUDE.md`.

## Décision

- `disconnect()` (`src/utils/disconnect.ts`) est la seule fin de session : bouton de déconnexion (`RootDisplay.tsx`), 401 automatique (`api.ts`). Options : `reason`, `communication` (bandeau sur `/app/connexion`), `redirectTo`.
- Ordre : (1) effacer le JWT natif ; (2) nettoyage I/O asynchrone, `useUser` encore rempli pour que les layouts de rôle ne déclenchent pas leur propre `<Navigate>` ; (3) étape finale atomique dans `flushSync` : naviguer et vider l'utilisateur. Zustand et React Router passent par `useSyncExternalStore`, qui contourne l'auto-batching ; sans `flushSync`, Connexion verrait une closure `user` périmée et renverrait vers la page du rôle, puis le layout écraserait l'URL.
- `clearLocalAppState(reason)` : annule les chargements, vide IndexedDB et localStorage, vide `syncRejections`. Ne touche pas `useUser`, Zustand ni le jeton. Partagé avec le connect-as admin (`ConnexionButton.tsx`), qui est un changement de session : on garde `useUser` rempli pour que `refreshUser()` relise `/user/me` avec la nouvelle session.
- Drapeau de teardown (`setLocalTeardownInProgress`, `src/zustand/idb-sliced-storage.ts`) : le persist ignore les écritures, `syncData` / `loadCarcasses` / `loadMyRelations` refusent de démarrer. Les appelants font `useZustandStore.reset()` dans la même chaîne de microtâches.
- Les autres onglets cessent d'écrire (`local-state-clearing`) puis se rechargent (`local-state-cleared`).
- Après `reset()`, le persist réécrit les tranches avec leurs valeurs initiales vides : voulu, pas de fuite. Le test e2e 107 vérifie les valeurs, pas le nombre d'entrées.
- `clearCache` (`src/services/indexed-db.ts`) ne supprime pas le JWT natif et résout toujours (false après 10 tentatives). Le cache du service worker est gardé (fichiers statiques seulement, pour démarrer hors ligne).
- Crash applicatif (ErrorBoundary de `main.tsx`) : ni vidage ni déconnexion, simple navigation vers `/app/connexion` par pushState.
- Ouvrir la création de compte ou d'invitation en étant connecté nettoie le stockage local et remet le store à zéro en même temps.
- `ScrollToTop` remet en haut sur PUSH / REPLACE et ne fait rien sur POP (restauration par `useSaveScroll` et le navigateur).
- `logoutAndConnect` (`e2e/utils/logout-and-connect.ts`) n'a volontairement pas de `page.goto` de secours, pour qu'une régression échoue.

## Conséquences

- Ne jamais écrire `useUser.setState({ user: null })` + `clearCache()` + `navigate(...)` à la main, ni `window.location.href = ...`.
- Tout nouvel état mémoire (store module, cache) doit être vidé par `clearLocalAppState` ou `reset()`, sinon il survit au changement de compte.
