# Audit local-first (octobre 2026)

Audit de la synchronisation hors ligne de l'application : stockage local, pull delta, push `/sync`,
service worker, onglets multiples, app mobile Expo. Il est parti des incidents connus de Mano (autre
application local-first : données locales perdues ou figées, curseur avancé sans données).

Chaque point a été vérifié dans le code, puis corrigé par une PR dédiée avec ses tests. Ce document
garde la trace des constats, des décisions et de ce qui reste ouvert. Les numéros (A1, B1…) sont
ceux de l'audit et sont repris dans les descriptions de PR.

## Architecture auditée

- **Stockage** : Zustand `persist` → `src/zustand/idb-sliced-storage.ts` → idb-keyval. Une clé
  IndexedDB par tranche (`zs:carcasses`, `zs:feis`, `zs:lastUpdateFromServer`…). Une tranche est
  réécrite en entier quand sa référence change.
- **Pull** : `src/utils/load-carcasses.ts` (`/now`, puis `GET /carcasse?after=<curseur>` par pages,
  `mergeItems`, puis un seul `setState` avec le curseur).
- **Push** : `src/utils/sync-data.ts` (`POST /sync` avec tous les éléments `is_synced = false`, puis
  `loadCarcasses()`).
- **Nettoyage de session** : `src/utils/disconnect.ts`, `src/services/indexed-db.ts` (`clearCache`).
- **Service worker** : `src/service-worker.ts` (handler fetch maison, pas de cache runtime Workbox).
- **App mobile** : `expo/utils/offline-spa.ts` télécharge au démarrage tous les fichiers listés dans
  `spa-manifest.json` et les sert en local sur `http://127.0.0.1:3000`. Une ancienne version du
  bundle web peut donc tourner plusieurs jours, jusqu'au prochain démarrage à froid.

## Constats et corrections

Statut au 6 octobre 2026. « Ouverte » = PR en revue.

### A. Curseur et delta

| #   | Constat                                                                                                                                                                                                                                                                                                                                                                                     | PR   | Statut  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| A1  | Le serveur ignore le `updated_at` du client (`@updatedAt` Prisma) : pas de problème d'horloge client.                                                                                                                                                                                                                                                                                       | —    | RAS     |
| A2  | Pagination `skip`/`take` triée par `updated_at desc` sans départage : lignes sautées ou doublées quand une carcasse sort du périmètre pendant le pull, ou quand plusieurs carcasses ont le même `updated_at`. Remplacée par une pagination par curseur `(updated_at, zacharie_carcasse_id)`. Un ancien bundle qui envoie `page` reçoit la page 0 puis une 400, au lieu de boucler sans fin. | #714 | Ouverte |
| A3  | Données et curseur écrits dans le même `setState` et la même transaction IndexedDB.                                                                                                                                                                                                                                                                                                         | —    | RAS     |
| A4  | Fiches, utilisateurs et entités viennent des carcasses de la page : rien n'est perdu quand une page est vide.                                                                                                                                                                                                                                                                               | —    | RAS     |
| A5  | `FORCE_FULL_RELOAD_AFTER` n'était documenté que par un commentaire. Procédure écrite dans `doc/rechargement-complet.md`.                                                                                                                                                                                                                                                                    | #704 | Mergée  |
| A6  | `version` du store sans `migrate` : au prochain changement de version, toutes les saisies non synchronisées étaient perdues. Un `migrate` garde les éléments non synchronisés et force un rechargement complet.                                                                                                                                                                             | #700 | Mergée  |
| A7  | `load-my-relations.ts` modifiait `users` sur place : la tranche n'était jamais persistée.                                                                                                                                                                                                                                                                                                   | #701 | Mergée  |
| A8  | Pendant la connexion en tant que, un chargement pouvait démarrer avec l'ancien curseur dans l'attente de 1500 ms.                                                                                                                                                                                                                                                                           | #711 | Ouverte |

### B. Fusion et conflits

| #   | Constat                                                                                                                                                                                                                                                 | PR   | Statut            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------- |
| B1  | `mergeItems` est server-wins : une modification locale pas encore envoyée peut être remplacée par la version serveur lors d'un pull.                                                                                                                    | #706 | Fermée sans merge |
| B2  | Après un `/sync` en échec, le pull tournait quand même et écrasait les modifications locales (avec B1).                                                                                                                                                 | #699 | Mergée            |
| B3  | `/sync` appliquait la carcasse sans regarder si elle avait changé de main : un chasseur resté hors ligne annulait la prise en charge de l'ETG. Le serveur n'accepte plus les colonnes de la chaîne de transmission que du détenteur courant ou désigné. | #713 | Ouverte           |
| B4  | Deux `/sync` du même utilisateur peuvent tourner en même temps (l'abort client n'arrête pas le serveur) : emails et webhooks en double. File par utilisateur dans le processus.                                                                         | #703 | Ouverte           |
| B5  | Une copie plus ancienne ne peut pas gagner sur un doublon entre pages.                                                                                                                                                                                  | —    | RAS               |

B1 : #699 règle le cas principal (pull après un push en échec). Le cas restant demande une écriture
qui échoue sans être un refus et, en même temps, une modification du même élément par un autre
acteur. On rouvre si Sentry montre des erreurs `/sync` sur des éléments qui ne sont pas des refus.
Attention si on reprend #706 : `is_synced` ne repasse à `true` que par la copie serveur du pull. Si
le pull garde la copie locale, il faut marquer synchronisés les éléments confirmés par `/sync`, sinon
l'élément reste « non synchronisé » pour toujours (première version de #706 : 44 specs e2e cassées).

### C. Stockage local

| #   | Constat                                                                                                                                                                                                                  | PR   | Statut     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---------- |
| C1  | `invitation.tsx` et `creation-de-compte.tsx` appelaient `clearCache()` sans `reset()` : après rechargement, curseur à jour et carcasses vides. Corrigé, plus un garde contre le double effet de StrictMode trouvé en CI. | #707 | Ouverte    |
| C2  | Si la lecture IndexedDB échoue, plus rien n'est enregistré pendant toute la session, sans message.                                                                                                                       | #708 | Ouverte    |
| C3  | Une tranche absente est remplacée par l'état initial (tranche vide avec un curseur valide si une écriture a échoué).                                                                                                     | —    | Non traité |
| C4  | Une écriture en échec (quota, connexion fermée) n'était ni signalée ni retentée.                                                                                                                                         | #708 | Ouverte    |
| C5  | `carcassesRegistry` était une seconde copie complète des carcasses, écrite à chaque chargement.                                                                                                                          | #709 | Ouverte    |
| C6  | `localStorage.clear()` effaçait le jeton de l'app mobile pendant la connexion en tant que.                                                                                                                               | #711 | Ouverte    |
| C7  | Le nettoyage de session pouvait rester bloqué après 10 essais, et des écritures pouvaient arriver pendant le nettoyage.                                                                                                  | #711 | Ouverte    |
| C8  | `dataIsSynced` était persisté et pas recalculé au démarrage.                                                                                                                                                             | #716 | Ouverte    |

### D. Onglets multiples

| #   | Constat                                                                                                                                                                                                   | PR   | Statut  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| D1  | Deux onglets réécrivent chacun des tranches complètes : le dernier qui écrit gagne, les saisies de l'autre sont perdues. Un seul onglet actif (Web Locks), écran de blocage avec « Utiliser cet onglet ». | #715 | Ouverte |
| D2  | Une déconnexion dans un onglet n'était pas vue par l'autre, qui réécrivait l'ancienne session. Couvert par D1.                                                                                            | #715 | Ouverte |
| D3  | L'app mobile n'a qu'une WebView : le problème ne concerne que le web (ETG, SVI, collecteur sur ordinateur) et la PWA.                                                                                     | —    | RAS     |

### E. Service worker et réseau

| #   | Constat                                                                                                                                                                                                                | PR                      | Statut  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| E1  | Le service worker mettait en cache les réponses de l'API : sur une coupure, une vieille réponse revenait comme si elle était fraîche.                                                                                  | #702                    | Mergée  |
| E2  | Aucune proposition de rechargement quand une nouvelle version est déployée. Sur l'app mobile, le message demande de fermer et rouvrir l'application.                                                                   | #717                    | Ouverte |
| E3  | `version-check.ts` était du code mort copié d'un autre produit : supprimé.                                                                                                                                             | #717                    | Ouverte |
| E4a | Après `very-bad-connection`, l'application restait « Hors ligne » jusqu'au rechargement.                                                                                                                               | #705                    | Mergée  |
| E4b | Un 401 effaçait les saisies non synchronisées avant la reconnexion. Elles sont gardées si le même compte se reconnecte.                                                                                                | #710 (empilée sur #711) | Ouverte |
| E5  | Le message de vidage du cache n'attendait rien et effaçait aussi l'app shell.                                                                                                                                          | #702                    | Mergée  |
| E6  | App mobile : un téléchargement interrompu laissait un mélange d'anciens et de nouveaux fichiers. Téléchargement dans un dossier temporaire, remplacement seulement si tout est arrivé. Demande un nouveau build natif. | #718                    | Ouverte |
| —   | `index.html`, `service-worker.js` et `spa-manifest.json` servis en `no-store`.                                                                                                                                         | #698                    | Mergée  |

### F. Observation

| #   | Constat                                                                                                                       | PR   | Statut  |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| F1  | Aucun contrôle d'intégrité : nouvelle route `GET /carcasse/count`, comparaison avec le local et alerte Sentry en cas d'écart. | #712 | Ouverte |
| F2  | Les éléments refusés par `/sync` restaient non synchronisés sans explication. Une alerte affiche le nombre et la raison.      | #716 | Ouverte |

### Défauts trouvés pendant l'écriture des tests

| Constat                                                                                                                                                                                                                                                                     | PR   | Statut  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| `refreshUser` émettait `good-connection` même quand `GET /user/me` échouait (`API.get` ne lève pas d'erreur) : le retour réel du réseau ne relançait pas la synchro.                                                                                                        | #719 | Ouverte |
| Une fiche sans carcasse restait `is_synced = false` après un `/sync` réussi : le client ne lit pas les fiches renvoyées par `/sync`, et `GET /carcasse` ne renvoie les fiches qu'à travers leurs carcasses.                                                                 | #720 | Ouverte |
| `computeTransmissions` prenait les intermédiaires de la première carcasse du store : quand c'était une carcasse refusée par le collecteur, la prise en charge ETG manquait. Invisible sur main car l'ordre des ex aequo y est aléatoire, révélé par l'ordre stable de #714. | #714 | Ouverte |

## Ordre de merge et conflits

- #711 avant #710 (#710 est empilée sur #711).
- #702 avant #719 (sans #702, le service worker peut renvoyer un `/user/me` en cache).
- #711 entre en conflit avec #707 et #708 (`disconnect.ts`, `idb-sliced-storage.ts`, pages de connexion).
- Plusieurs PR touchent `sync-data.ts` et `store.ts` (fichiers à fort impact) : les rebaser une par une.

## Tests

Chaque correction atteignable depuis le navigateur a une spec e2e (`e2e/tests/transverse/143` à
`156`). Chaque spec a été lancée en local avant d'être poussée, et celles qui protègent une
correction échouent sur le code de main.

Limites de l'environnement e2e à connaître :

- Les e2e tournent sur le serveur Vite de dev, en local comme en CI.
- Un vrai rechargement hors ligne ne marche pas avec le serveur Vite (la spec 106 est sautée). Les
  specs bloquent l'API ou forcent `navigator.onLine` à la place.
- En dev, le service worker a la portée `/src/` et ne contrôle pas les pages `/app/*`. Seule la
  spec 152 l'enregistre elle-même avec la portée `/`.
- Les specs partagent la base `zacharietest` et les ports 3290/3291 : en local, une seule à la fois.

## Points restants

- B1 : voir plus haut, à rouvrir selon Sentry.
- C3 : une tranche absente reste traitée comme vide.
- B3 : un `deleted_at` envoyé par un ancien détenteur supprime toujours la carcasse, et un second
  appareil du détenteur courant gagne toujours.
- B4 : la file par utilisateur ne marche que dans un seul processus. À revoir si l'API passe sur
  plusieurs instances.
- E6 et la partie mobile de E2 ne partent qu'avec un nouveau build natif (pas d'`expo-updates`).
