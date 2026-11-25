# 0004. Synchronisation : le push `POST /sync`

## Contexte

Le client applique ses modifications localement (`is_synced = false`) puis les envoie en lot. Un lot peut porter plusieurs centaines de carcasses. Certaines écritures sont refusées (autorisation, version périmée), d'autres échouent pour une raison technique : les deux cas doivent être traités différemment, sinon le client boucle ou perd le travail de l'utilisateur.

## Décision

**Serveur** (`api-express/src/controllers/sync.ts`) :

- Une requête traite tout, dans l'ordre FEIs → Carcasses → CarcassesIntermediaires → CarcasseModificationRequests → Logs. Accepte les payloads partiels.
- Le périmètre d'écriture (`createSyncScope`) est résolu une fois et mis à jour au fil de la requête (voir [0007](0007-droits-d-ecriture-du-sync.md)). Une seule requête résout les entités supprimées désignées par le lot.
- Fiches et carcasses existantes sont préchargées en une requête et passées à chaque `syncCarcasse` ; `scope.prefetch` fait de même pour le périmètre. Les carcasses sont traitées en parallèle par paquets de `CARCASSE_SYNC_CONCURRENCY` (10) pour ne pas saturer le pool Prisma. La relation `CAN_TRANSMIT` vers un même destinataire est créée une fois par entité.
- Logs : immuables, id généré côté client, un seul `createMany` (`skipDuplicates`). `Log` n'a pas de FK. Un log n'est accepté qu'au nom de l'utilisateur authentifié.
- Les effets de bord tournent après toutes les écritures (voir [0030](0030-effets-de-bord-api-publique-et-webhooks.md)). Les carcasses touchées par une demande de modification sont relues et remplacent la sortie de `carcasseResults`.
- La réponse contient, par section, la clé de store du client : `fei.numero`, `carcasse.zacharie_carcasse_id`, triplet `(fei_numero, zacharie_carcasse_id, intermediaire_id)`. `is_synced = true` dans la réponse efface le flag local.
- **Refus** (`SyncRejectedError`, `api-express/src/utils/sync-errors.ts`) : définitif, renvoyé par item dans `data.rejected` (`SyncRejection`, `api-express/src/types/responses.ts`), sans la ligne serveur (ce serait divulguer la fiche d'un tiers). Toute autre erreur est transitoire : capturée, hors de `rejected`, le client réessaie. « Fiche non trouvée » / « Carcasse introuvable » sont transitoires (le parent du même lot vient d'échouer).
- Les refus sont remontés en un seul évènement Sentry par requête, au message fixe, avec les payloads (données personnelles masquées, voir [0035](0035-observabilite-sentry-matomo-donnees-personnelles.md)) plafonnés à `MAX_REJECTED_BODIES` (20, Sentry tronque un extra vers 16 Ko), et les en-têtes `appversion` / `platform`. C'est le seul endroit où la saisie refusée reste récupérable.
- **Retrait du store local** (`removeFromLocalStoreReasons`, `shouldRemoveFromLocalStore`) : une écriture acceptée peut sortir une carcasse déjà en base du périmètre de son auteur (renvoi à l'expéditeur). On demande au client de la retirer, avec ses lignes d'intermédiaire, et sa fiche s'il n'a plus accès à aucune de ses carcasses.
- Une erreur dans la cascade de suppression est capturée, la réponse reste 200.

**Client** (`app-local-first-react-router/src/utils/sync-data.ts`) :

- `syncRejections` garde les items refusés avec la raison et le `updated_at` (ms) de la version refusée, par clé `kind:id`. Cette version n'est plus renvoyée ; une nouvelle modification locale l'est. Portée : la session (non persisté, vidé par `abortSyncData` et par `clearLocalAppState`).
- Sur refus, la donnée locale n'est pas touchée : elle sera remplacée quand la ligne serveur reviendra dans un delta (`mergeItems` est server-wins). Les items à retirer ne sont pas montrés comme refus.
- Les logs confirmés par le serveur sont retirés du store.
- Un push échoué ne déclenche pas de pull (il écraserait les éditions locales).
- Les écrans chasseur ne synchronisent pas à chaque modification : la synchro part au retour sur l'onglet (`tabs-broadcast.ts`). Hors ligne, `syncData` court-circuite.

## Conséquences

- Une erreur technique classée à tort en refus détruit le travail de l'utilisateur : ne lever `SyncRejectedError` que pour une écriture qui n'a aucune chance de passer.
- Changer l'ordre des sections casse les dépendances carcasse → fiche.
- Voir aussi [0006](0006-verrou-optimiste-des-versions.md) (versions) et [audit-local-first-2026-10.md](../audit-local-first-2026-10.md).
