# 0010. Onglets multiples et détection du mode hors ligne

## Contexte

Plusieurs onglets partagent le même IndexedDB. Hors ligne, le serveur ne peut pas relayer une saisie d'un onglet à l'autre, et un onglet qui écrit écraserait la saisie d'un autre. Le navigateur ne signale pas toujours le retour du réseau.

## Décision

- `app-local-first-react-router/src/utils/tabs-broadcast.ts` : aucune donnée ne passe entre onglets ; chaque onglet remplit son store avec `loadCarcasses`. Au retour sur un onglet (`focus` et `visibilitychange`, dédoublonnés), on envoie les saisies locales puis on recharge. Dans l'app mobile, une seule WebView : personne ne reçoit ces messages. Quand un onglet annonce un vidage (déconnexion, connect-as, création de compte), les autres cessent d'écrire puis se rechargent.
- `src/utils/offline-single-tab.ts` : hors ligne, seul le premier onglet utilisé fonctionne. Il prend un verrou Web Locks au premier usage hors ligne (pas au passage hors ligne, car tous les onglets passent hors ligne ensemble) et le garde jusqu'au retour en ligne ; les autres affichent un écran de blocage. Sans Web Locks (Safari < 15.4), pas de règle.
- `src/utils-offline/use-is-offline.ts` : un seul jeu d'écouteurs pour l'app, état dans le store ; un retour en ligne déclenche une seule synchro. Après `very-bad-connection`, le navigateur n'émet pas `online` (`navigator.onLine` reste vrai) : on retente `/user/me` toutes les 30 s (`VERY_BAD_CONNECTION_RETRY_MS`), son succès émet `good-connection`.
- `getMostFreshUser` (`src/utils-offline/get-most-fresh-user.ts`) : hors ligne, le service worker renverrait un `/user/me` en cache et `prochain_bracelet_a_utiliser` serait obsolète. `API.get` renvoie `{ ok: false }` sans lever : seule une vraie réponse prouve le retour en ligne.

## Conséquences

- Un échec de `/user/me` pendant le passage hors ligne ne doit pas faire croire que l'app est en ligne.
- Tests e2e : `154-plusieurs-onglets`, série `transverse/14x`. Voir aussi [audit-local-first-2026-10.md](../audit-local-first-2026-10.md) (section D).
