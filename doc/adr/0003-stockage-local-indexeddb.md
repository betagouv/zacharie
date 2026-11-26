# 0003. Stockage local Zustand découpé dans IndexedDB

## Contexte

Le store local peut contenir plus de 100 000 enregistrements. Le stocker comme une seule chaîne JSON obligeait à tout réécrire à chaque modification. iOS WKWebView ferme parfois la connexion IndexedDB. Un changement de forme du store ne doit pas faire perdre une saisie hors ligne. L'audit complet est dans [audit-local-first-2026-10.md](../audit-local-first-2026-10.md).

## Décision

- `app-local-first-react-router/src/zustand/idb-sliced-storage.ts` : chaque clé de premier niveau de l'état est une entrée IndexedDB, en objets natifs (structured clone). Une tranche qui est une map par id (`RECORD_KEYS`) est stockée enregistrement par enregistrement (`zs:carcasses/<id>`) ; les autres sous une clé (`zs:lastUpdateFromServer`). Pas de seconde copie de la liste des carcasses (`zs:carcassesRegistry` est nettoyée).
- Seuls les tranches et enregistrements dont la référence change sont écrits, dans une seule transaction avec la méta : données et curseur sont écrits ensemble, tout ou rien. En cas d'échec, les références précédentes sont restaurées pour réécrire au prochain coup. Une seule écriture à la fois ; pendant une écriture, seul le dernier état demandé est gardé.
- Les écritures sont bloquées jusqu'à la fin du premier `getItem` (un `setState` précoce comme `refreshUser` écraserait IndexedDB avec un état vide). Si cette lecture échoue, les écritures restent bloquées toute la session.
- Boucles plutôt que `push(...spread)` : limite d'arguments au-delà de 100 000 éléments.
- Même base et même table que le store par défaut d'idb-keyval. Les clés hors préfixe `zs:` appartiennent à d'autres usages.
- iOS : sur « The database connection is closing », on jette le store idb-keyval pour rouvrir une connexion (même logique dans `src/services/indexed-db.ts`, `setCacheItem` / `getCacheItem`). Une transaction annulée à la mise en arrière-plan (rejet avec null) est réessayée une fois.
- `PERSISTED_KEYS` (`src/zustand/store.ts`) exclut `dataIsSynced` (recalculé à l'hydratation) et `syncRejections` (valable pour la session).
- `migrate` : un changement de `version` remet tout le stockage à zéro, sauf les éléments `is_synced = false`, quelle que soit l'ancienne version, et pose `lastUpdateFromServer = 0` (rechargement complet qui garde ces éléments). C'est une exception volontaire à la règle « pas de rétrocompatibilité » : sans elle, zustand jetterait les saisies non synchronisées. Version 11 : passage au stockage par enregistrement, les tranches entières de la v10 ne sont plus lues.
- Mutations : `updateAllCarcasseIntermediaire` et les mises à jour de lot font un seul `setState` (appeler `updateCarcasse` en boucle recopiait la map entière, O(n²) et un rendu par carcasse, ce qui figeait l'app à la prise en charge). `carcassesIntermediaireById` : une ligne par couple carcasse / intermédiaire. `carcasseModificationRequestsByCarcasseId` : historique complet des demandes par carcasse, source unique pour la synchro et l'UI.
- Une ligne reçue identique à la copie locale garde la référence locale, pour ne pas être réécrite.

## Conséquences

- Les éléments gardés par `migrate` sont renvoyés tels quels à `/sync` : un bump de version qui change la forme d'un élément exige un correctif côté serveur ou base.
- Ajouter une tranche persistée : `State`, `initialState()`, `PERSISTED_KEYS`, `partialize` et la synchro (voir CLAUDE.md).
- Le test e2e 107 vérifie que les valeurs sont vides après déconnexion, pas que la base est vide (voir [0009](0009-deconnexion-et-navigation-webview.md)).
