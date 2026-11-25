# Excuses à traiter

Contournements repérés lors de la suppression des commentaires (voir [0001](0001-pas-de-commentaires-dans-le-code.md)). Chaque section est à transformer en carte Notion, puis à retirer d'ici une fois corrigée.

## api-express — utils

### Trigger de rafraîchissement des vues matérialisées créé à la main en base

- Fichier : `api-express/src/utils/refreshMaterializedViews.ts` (fichier entier)
- Contournement actuel : la fonction `refresh_materialized_views_trigger()` (qui fait `REFRESH MATERIALIZED VIEW CONCURRENTLY` sur `carcasses_funnel_stats`, `fei_stats`, `carcasse_intermediaire_refus_stats`, `carcasse_svi_stats`) et les triggers `refresh_mat_views_fei` / `refresh_mat_views_carcasse` (`AFTER INSERT OR UPDATE OR DELETE ... FOR EACH STATEMENT` sur `Fei` et `Carcasse`) ont été exécutés directement en base, hors migration. L'ancienne fonction applicative `refreshMaterializedViews()` était restée en commentaire ; le fichier ne contient plus qu'un import `prisma` inutilisé.
- Correction attendue : versionner la fonction et les triggers dans une migration Prisma (ou dans `materialized-views/`), puis supprimer `refreshMaterializedViews.ts`.

### Carcasse nue orpheline si l'update de fin de sync échoue

- Fichier : `api-express/src/utils/sync-carcasse.ts` (`syncCarcasse`, appel à `scope.grant`)
- Contournement actuel : à la création, la ligne de carcasse n'a aucune colonne de rattachement ; elles ne sont écrites que par l'update en fin de fonction. Si cet update échoue, la ligne nue survit hors du périmètre de tout le monde : au prochain envoi elle passe par `canWriteCarcasse` (elle existe désormais) et se fait refuser définitivement. Cas connu, non traité.
- Correction attendue : créer la carcasse avec ses colonnes de rattachement dans la même écriture (ou dans une transaction avec l'update), pour qu'aucune ligne nue ne puisse survivre.

### Un même utilisateur sur deux appareils peut écraser sa propre écriture plus récente

- Fichier : `api-express/src/utils/sync-version.ts` (`isStaleWrite`)
- Contournement actuel : une version inférieure n'est considérée périmée que si l'écriture plus récente vient d'un autre utilisateur (pour tolérer les requêtes annulées côté client mais traitées par le serveur). Du coup, un même utilisateur sur deux appareils peut écraser sa propre écriture plus récente.
- Correction attendue : identifier l'appareil (ou la requête) à l'origine de la version, et non seulement l'utilisateur, pour détecter les écritures périmées entre appareils d'un même compte.

### Discriminant string-literal à cause de `strictNullChecks: false`

- Fichier : `api-express/src/utils/trichine-result.ts` (`ApplyPoolResultOutcome`)
- Contournement actuel : l'union discriminée utilise un discriminant chaîne au lieu d'un booléen, car le repo compile avec `strictNullChecks: false`, qui casse le narrowing des unions discriminées sur un booléen.
- Correction attendue : activer `strictNullChecks` dans `api-express`, puis simplifier les types qui contournent son absence.

### Brucellose du grand gibier sans déclencheur

- Fichier : `api-express/src/utils/disease-suspicions.ts` (`matchBrucellose`)
- Contournement actuel : la brucellose n'est détectée que sur le petit gibier à poils. Le référentiel ne décrit plus d'anomalie des articulations ni de l'appareil génital pour le grand gibier : les familles « Système reproducteur (testicules) » et « Système urinaire (reins) » du CSV sont vides.
- Correction attendue : renseigner ces familles dans le référentiel des anomalies, puis rebrancher la détection brucellose sur le grand gibier.

### Résultats trichine non notifiés aux détenteurs des carcasses

- Fichier : `api-express/src/utils/trichine-result.ts` (`applyPoolResult`, notification des résultats)
- Contournement actuel : un résultat n'est notifié qu'à l'émetteur de la FTP. Les détenteurs des carcasses voient le résultat sur la carcasse, mais ne reçoivent rien ; le volume d'envois reste à cadrer avec eux.
- Correction attendue : cadrer avec les détenteurs le volume de notifications acceptable, puis décider s'ils sont notifiés des résultats.

## api-express — contrôleurs, middlewares, crons, tiers

### Pagination par page conservée pour les anciens bundles

- Fichier : `api-express/src/controllers/carcasse.ts` (`GET /`, paramètre `page` de `zodQuerySchema`)
- Contournement actuel : le paramètre `page` n'est envoyé que par un bundle antérieur à la pagination par curseur. Un tel bundle recevrait la première page en boucle : on la lui sert seulement si elle tient en une page, on refuse toujours la suite (400 « Pagination par page abandonnée »), et on refuse aussi (« Mise à jour de l'application requise ») avant de charger fiches, intermédiaires et utilisateurs si le pull dépasse une page.
- Correction attendue : retirer le paramètre `page` et ces branches une fois tous les clients passés à la pagination par curseur (code de rétrocompatibilité interdit par CLAUDE.md).

### Type d'erreur non vérifié dans le gestionnaire d'erreurs

- Fichier : `api-express/src/middlewares/errors.ts` (`sendError`)
- Contournement actuel : le paramètre `err` est typé `CustomError` sans vérification (TODO « Check this error type »).
- Correction attendue : typer `err` en `unknown` et le réduire explicitement (status, message) avant usage.

### Migration de l'ancien cookie de session

- Fichier : `api-express/src/middlewares/migrate-legacy-session-cookie.ts` (`LEGACY_COOKIE_NAME`, `LEGACY_PROCONNECT_STATE_COOKIE`)
- Contournement actuel : l'ancien cookie `zacharie_express_jwt`, posé sur tout le domaine `.zacharie.beta.gouv.fr` (donc envoyé à chaque sous-domaine), est recopié dans le cookie host-only de l'API puis effacé, pour que l'utilisateur reste connecté et ne perde pas ses données locales non synchronisées. Le jeton garde sa propre expiration (`exp`, vérifiée par Passport). L'ancienne copie du cookie d'état ProConnect posée sur tout le domaine est aussi effacée.
- Correction attendue : supprimer ce middleware en mars 2027, quand les anciens cookies (90 jours) auront tous expiré.

### Garde contre un templateId Brevo null

- Fichier : `api-express/src/third-parties/brevo.ts` (`sendTemplateEmail`)
- Contournement actuel : les ids du registre `brevo-templates.ts` valent `null` tant que le template n'existe pas côté Brevo, et `strictNullChecks` est désactivé : le compilateur laisse passer ce `null`. Une garde à l'exécution capture l'erreur, sinon l'appel partirait sans template et Brevo répondrait 400.
- Correction attendue : activer `strictNullChecks` (ou typer le registre pour que `sendTemplateEmail` n'accepte que les clés migrées) et retirer la garde.

### Propriétaire de deal Brevo codé en dur

- Fichier : `api-express/src/third-parties/brevo.ts` (`updateBrevoChasseurDeal`)
- Contournement actuel : `deal_owner` reçoit un id de propriétaire fixe (`67d2cf69c9580538a20d4b95`) pour détourner le système de deals Brevo vers nos besoins.
- Correction attendue : sortir cet id dans la configuration (ou le registre Brevo) et documenter le modèle de pipeline attendu côté Brevo.

### Type d'erreur non vérifié dans capture

- Fichier : `api-express/src/third-parties/sentry.ts` (`capture`)
- Contournement actuel : quand l'erreur n'est pas une `Error`, elle est castée en `string` sans vérification (TODO « Check this error type ») puis envoyée par `Sentry.captureMessage`.
- Correction attendue : réduire explicitement le type (`typeof error === 'string'`, sinon sérialiser) avant l'envoi.

## api-express — tests et scripts

### Noms en cache non dérivés à l'auto-clôture SVI

- Fichier : `api-express/src/__tests__/cronjob-feis.test.ts` (test d'auto-clôture, assertion `current_owner_user_name_cache`)
- Contournement actuel : le cron d'auto-clôture laisse `current_owner_user_name_cache` à null (FIXME « noms non dérivables pour l'instant »), et le test épingle ce null.
- Correction attendue : dériver le nom du propriétaire courant à l'auto-clôture, puis mettre à jour l'assertion.

### Seed trichine labos temporaire

- Fichier : `api-express/scripts/seed-trichine-labos.ts`
- Contournement actuel : les entités LVD / LNR et leurs utilisateurs sont créés par un seed manuel.
- Correction attendue : livrer P12 (import de l'annuaire DGAL + création des laboratoires par l'admin), puis supprimer ce seed.

### Fixture SVI_CLOSED sans auteur de clôture

- Fichier : `api-express/scripts/populate-test-db.ts` (`ownershipClosedBySvi` / état `SVI_CLOSED`)
- Contournement actuel : `svi_closed_by_user_id` reste null car les utilisateurs SVI ont des ids dynamiques ; les tests vérifient seulement `svi_closed_at`.
- Correction attendue : poser `svi_closed_by_user_id` avec l'id du compte `svi@example.fr` lors du seed, comme le ferait une vraie clôture.

## App — cœur (store, sync, services, utils)

### Attente fixe de 1500 ms dans le nettoyage de session

- Fichier : `app-local-first-react-router/src/utils/disconnect.ts` (`clearLocalAppState`)
- Contournement actuel : après `clearCache`, on attend 1500 ms (sauf en Playwright) « pour laisser les écritures en cours se terminer » avant que l'appelant ne touche l'état.
- Correction attendue : attendre explicitement la fin des écritures en cours (file d'écriture de `idb-sliced-storage`, promesses des loaders annulés) au lieu d'un délai fixe.

### clearCache : attente de 200 ms et nouvelles tentatives en boucle

- Fichier : `app-local-first-react-router/src/services/indexed-db.ts` (`clearCache`, `deleteDB`)
- Contournement actuel : la base IndexedDB ne se supprime pas, on efface donc les clés une par une ; puis on attend 200 ms « pour être sûr que le cache est vidé », on vérifie, et on recommence jusqu'à 10 fois.
- Correction attendue : comprendre pourquoi `deleteDatabase` échoue (connexions ouvertes non fermées) et attendre la fin réelle des transactions plutôt qu'un délai et des tentatives répétées.

### Réouverture de la connexion IndexedDB sur « connection is closing »

- Fichier : `app-local-first-react-router/src/services/indexed-db.ts` (`setCacheItem`, `getCacheItem`)
- Contournement actuel : sur l'erreur « connection is closing » (iOS WKWebView), on recrée le store et on retente une fois l'écriture ou la lecture.
- Correction attendue : centraliser la gestion de la connexion IndexedDB (comme `idb-sliced-storage`) avec une réouverture systématique, au lieu de dupliquer ce rattrapage par appel.

### Délai de 100 ms après la création d'une fiche en e2e

- Fichier : `app-local-first-react-router/src/utils/create-new-fei.ts` (`createNewFei`)
- Contournement actuel : en Playwright, on attend 100 ms après `syncData` car une synchro trop rapide provoque une race côté backend et l'erreur Postgres « cache lookup failed for type ».
- Correction attendue : trouver la cause de l'erreur Postgres (requêtes concurrentes sur la même fiche) et la corriger côté API, puis supprimer le délai.

### setTimeout pour afficher l'état de chargement de l'export

- Fichier : `app-local-first-react-router/src/utils/export-carcasses.ts` (`onExportToXlsx`), `src/utils/export-transmissions.ts` (`onExportToXlsx`)
- Contournement actuel : `await new Promise((res) => setTimeout(res))` après `setIsExporting(true)`, uniquement pour laisser React afficher l'état de chargement avant le calcul synchrone et bloquant de l'export.
- Correction attendue : sortir la génération du classeur du thread principal (Web Worker) ou la découper, pour que l'état de chargement s'affiche sans astuce.

### Synchro non déclenchée après updateAllCarcasseIntermediaire

- Fichier : `app-local-first-react-router/src/zustand/store.ts` (`updateAllCarcasseIntermediaire`)
- Contournement actuel : la mutation ne lance pas `syncData` ; elle compte sur le fait que les appelants appellent toujours `updateFei` juste après, qui synchronise. Le FIXME demande de vérifier que c'est bien la dernière version du store qui est envoyée.
- Correction attendue : vérifier l'hypothèse et soit déclencher la synchro dans la mutation, soit garantir par l'API du store que l'appel à `updateFei` suit toujours.

### Filtre « Décision destinataire » manquant

- Fichier : `app-local-first-react-router/src/utils/filter-carcasse.ts` (liste des champs filtrables)
- Contournement actuel : un TODO signale qu'un filtre « Décision destinataire » n'est pas encore proposé.
- Correction attendue : ajouter ce filtre, ou décider qu'il n'est pas utile et l'oublier.

### Quiz retiré du menu de la page d'accueil

- Fichier : `app-local-first-react-router/src/utils/get-landing-page-navigation-menu.ts`
- Contournement actuel : l'entrée « Quiz » du menu est commentée en attendant que le quiz soit prêt.
- Correction attendue : décider de la remise en ligne du quiz et rajouter l'entrée de menu, ou supprimer la route.

### Motifs BPH et taux national dupliqués entre front et back

- Fichier : `app-local-first-react-router/src/utils/bph-motifs.ts` (motifs BPH, `NATIONAL_BPH_RATE_BIG_GAME`), `src/utils/trichine.ts` (contraintes de pools), `src/utils/max-associations-de-chasse.ts`
- Contournement actuel : les constantes sont recopiées à la main depuis api-express (`federation-stats.ts` BPH_PATTERNS, `controllers/stats.ts`, `utils/trichine.ts`, `associations-de-chasse-limit.ts`) avec un commentaire « doit rester aligné ».
- Correction attendue : partager ces constantes (module commun ou endpoint) ou ajouter un test qui compare les deux copies.

### File de requêtes hors ligne du service worker inutilisée

- Fichier : `app-local-first-react-router/src/service-worker.ts` (`processOfflineQueue`, `syncBackOnline`, gestion `push`)
- Contournement actuel : `queuePostRequest` et le traitement des notifications push (badge, affichage) étaient commentés ; `processOfflineQueue` tourne encore sur une file que plus rien ne remplit.
- Correction attendue : supprimer la file hors ligne du service worker (la synchro passe par le store) et décider du comportement des notifications push dans le service worker.

## App — composants

### Re-focus/blur forcé pour déclencher l'enregistrement du formulaire parent

- Fichier : `app-local-first-react-router/src/components/InputVille.tsx` (`InputVille`, au choix d'une commune) et `app-local-first-react-router/src/components/InputCodePostalEtVille.tsx` (choix d'une commune)
- Contournement actuel : le formulaire parent enregistre au `blur`. Après le choix d'une commune, le code redonne le focus au champ puis le retire, pour provoquer un nouveau `blur` qui soumet le formulaire (« this is a hack to submit the form on blur again »).
- Correction attendue : faire remonter la valeur choisie au parent par un callback explicite (`onChange`/`onSelect`) qui déclenche l'enregistrement, sans simuler d'événements de focus.

### `menuPosition="fixed"` de react-select appliqué sans être compris

- Fichier : `app-local-first-react-router/src/components/SelectCustom.tsx` (`SelectCustom`)
- Contournement actuel : `menuPosition="fixed"` (et l'option voisine) sont posés parce qu'ils « font apparaître le menu au-dessus de tout », d'après une réponse Stack Overflow (https://stackoverflow.com/a/64973481/978690), décrits comme « magiques ».
- Correction attendue : identifier le conteneur qui coupe le menu (overflow / z-index des modales DSFR) et choisir la solution en connaissance de cause (`menuPortalTarget`, z-index), puis la documenter.

### Style de la modale carcasse copié depuis la page détail examinateur

- Fichier : `app-local-first-react-router/src/components/CardCarcasse.tsx` (helpers et sous-composants du contenu de la modale)
- Contournement actuel : le style et les sous-composants sont recopiés depuis `routes/chasseur/examinateur-carcasse-detail.tsx` (« à factoriser dans un second temps »).
- Correction attendue : extraire des composants partagés et les utiliser dans les deux écrans.

### Date de décision d'une demande de modification approximée par `updated_at`

- Fichier : `app-local-first-react-router/src/components/CarcasseModificationRequest.tsx` (`HistoriqueDesModifications`)
- Contournement actuel : l'événement « décision » de la frise prend `updated_at` de la demande comme date, ce qui est approximatif (toute mise à jour la déplace) ; le tri le place près de l'événement de demande.
- Correction attendue : stocker une vraie date de décision (`decided_at` ou équivalent) sur la demande et l'afficher.

### `useLocalStorage` renvoie un nouveau tableau à chaque rendu

- Fichier : `app-local-first-react-router/src/components/ExportTransmissionsModal.tsx` (effet qui efface le message de succès quand les colonnes changent)
- Contournement actuel : l'effet dépend d'une signature primitive des colonnes (chaîne) au lieu du tableau, sinon il se déclencherait à chaque rendu et effacerait aussitôt l'état de succès.
- Correction attendue : faire renvoyer à `useLocalStorage` une référence stable tant que la valeur ne change pas, puis dépendre directement du tableau.

## App — routes

### L'IPM1 / l'IPM2 confirme l'enregistrement sans le vérifier

- Fichier : `app-local-first-react-router/src/routes/svi/svi-inspection-carcasse/ipm1.tsx` (soumission de l'IPM1) et `svi/svi-inspection-carcasse/ipm2.tsx` (soumission de l'IPM2)
- Contournement actuel : après `syncData(...)`, une `alert('IPM1 enregistrée')` / `alert('IPM2 enregistrée')` s'affiche sans attendre ni vérifier que la synchro a réussi (TODO « vérifier qu'elles sont réellement bien enregistrées »).
- Correction attendue : afficher la confirmation à partir de l'état de synchro réel des carcasses (`is_synced`), et signaler un échec.

### Délai de 150 ms pour distinguer deux intermédiaires créés ensemble

- Fichier : `app-local-first-react-router/src/routes/etg/etg-current-owner-confirm.tsx` (`handleETGReceptionWithTransport`)
- Contournement actuel : entre la création de l'intermédiaire transport (rôle COLLECTEUR_PRO) et celle de l'intermédiaire réception (rôle ETG), le code attend 150 ms pour que leurs `created_at` diffèrent et que l'ordre soit conservé.
- Correction attendue : poser explicitement des `created_at` distincts et ordonnés (ou un ordre explicite) au lieu d'attendre une horloge.

### Branche « employé ETG qui transporte vers son ETG » obsolète et cassée en multi-destinataires

- Fichier : `app-local-first-react-router/src/routes/etg/etg-current-owner-confirm.tsx` (`handlePriseEnCharge`, branche `etgEmployeeTransportingToETG`)
- Contournement actuel : la branche réécrit `next_owner_*` de la transmission ; elle est marquée « deprecated anyway and broken for multi-dispatch ».
- Correction attendue : supprimer ce chemin, ou le réécrire pour qu'il ne touche que les carcasses de l'ETG concerné.

### Historique du log de prise en charge incertain

- Fichier : `app-local-first-react-router/src/routes/etg/etg-current-owner-confirm.tsx` (`handlePriseEnCharge`, appel `addLog`)
- Contournement actuel : le log enregistre `createHistoryInput(currentTransmission, nextTransmission)` avec un FIXME « what history should we use here? ».
- Correction attendue : décider quel avant/après journaliser (transmission, carcasses ou intermédiaire) et l'aligner avec les autres logs.

### Pages de connexion : `useMostFreshUser()` évité pour une boucle infinie

- Fichier : `app-local-first-react-router/src/routes/connexion/index.tsx`, `connexion/creation-de-compte.tsx`, `connexion/invitation.tsx` (composants de page)
- Contournement actuel : ces pages lisent l'utilisateur directement dans le store `useUser` au lieu de `useMostFreshUser()`, parce que ce dernier provoque une boucle de rendus infinie.
- Correction attendue : trouver la cause de la boucle dans `useMostFreshUser()` et l'utiliser partout de la même façon.

### Motif de refus lu directement dans le DOM

- Fichier : `app-local-first-react-router/src/routes/collecteur/collecteur-carcasse.tsx` et `etg/etg-carcasse.tsx` (`submitCarcasseRefus`)
- Contournement actuel : avec une valeur libre dans `InputForSearchPrefilledData`, l'utilisateur ne valide pas toujours l'étiquette bleue ; le code relit alors la valeur via `document.getElementsByName('carcasse-refus')`.
- Correction attendue : que le composant de saisie remonte sa valeur courante (contrôlé) sans validation explicite, pour supprimer la lecture du DOM.

### Clé CCG inutilisée gardée pour le typage

- Fichier : `app-local-first-react-router/src/routes/chasseur/onboarding/3a-associations-de-chasse.tsx` et `chasseur/profil/chasseur-associations-de-chasse.tsx` (`empytEntitiesByTypeAndId`)
- Contournement actuel : l'objet vide contient une clé `[EntityTypes.CCG]` inutilisée, présente seulement pour satisfaire le type `EntitiesByTypeAndId` de l'API.
- Correction attendue : rendre le type de réponse partiel (ou le restreindre aux types réellement renvoyés) et supprimer la clé.

### Pagination réduite en mode Playwright dans le code de production

- Fichier : `app-local-first-react-router/src/routes/chasseur/chasseur-fiches.tsx` (`ITEMS_PER_PAGE`)
- Contournement actuel : `ITEMS_PER_PAGE` vaut 3 quand `VITE_TEST_PLAYWRIGHT === 'true'`, 100 sinon, pour pouvoir tester la pagination avec peu de fiches.
- Correction attendue : rendre la taille de page configurable (paramètre ou réglage) ou seeder assez de fiches, sans branche de test dans le code de production.

### Dépendances de hook volontairement incomplètes à l'import des résultats labo

- Fichier : `app-local-first-react-router/src/routes/laboratoire/laboratoire-results-import.tsx` (callback « tout sélectionner »)
- Contournement actuel : le `useCallback` lit `matchedIndexes` mais ne déclare que `[rows]` en dépendance, avec un `eslint-disable-line react-hooks/exhaustive-deps`, parce que `matchedIndexes` est dérivé de `rows`.
- Correction attendue : mémoïser `matchedIndexes` et le déclarer en dépendance, puis retirer la directive.

### Effets « une seule fois » pour contourner le double montage StrictMode

- Fichier : `app-local-first-react-router/src/routes/connexion/creation-de-compte.tsx`, `connexion/invitation.tsx` (effet de nettoyage au montage) et `nouvelle-fiche.tsx` (création de la fiche pré-remplie)
- Contournement actuel : un ref empêche l'effet de tourner deux fois en développement (StrictMode). Sans lui, deux nettoyages concurrents effacent l'utilisateur tout juste enregistré, ou le lien tiers crée deux fiches.
- Correction attendue : rendre ces effets idempotents (ou les déplacer dans un loader / une action) pour ne plus dépendre d'un garde-fou au montage.

### Tableau de bord ETG accessible seulement par URL

- Fichier : `app-local-first-react-router/src/routes/etg/etg-router.tsx` (route `tableau-de-bord`)
- Contournement actuel : la route existe mais n'a pas d'entrée dans le menu, tant que les chiffres ne sont pas validés.
- Correction attendue : valider les chiffres puis ajouter l'entrée de menu, ou retirer la route.

## e2e et Expo

### La déconnexion efface les modifications pas encore envoyées

- Fichier : `e2e/tests/chains/133-chain-300-carcasses-offline.spec.ts`, `e2e/tests/examinateur/156-association-autre-membre-apres-certification.spec.ts`, `e2e/tests/examinateur/169-fiche-sans-carcasse-apres-reconnexion.spec.ts`
- Contournement actuel : les tests attendent la réponse 200 du `POST /sync` avant de déconnecter l'utilisateur, car la déconnexion avorte l'envoi en vol et `clearLocalAppState` vide IndexedDB (la transmission n'arrive jamais au serveur).
- Correction attendue : la déconnexion doit attendre la fin de la file de synchro, ou avertir l'utilisateur qu'il a des modifications non envoyées.

### Se déconnecter depuis /envoyée renvoie l'utilisateur suivant vers /connexion

- Fichier : `e2e/tests/chains/133-chain-300-carcasses-offline.spec.ts`
- Contournement actuel : le test revient sur un tableau de bord propre avant de changer d'utilisateur, car la déconnexion depuis la page `/envoyée` contamine la redirection après connexion (chasseur → chasseur).
- Correction attendue : la redirection post-login ne doit pas reprendre un chemin de la session précédente.

### La modale DSFR des carcasses rate des clics pendant les re-rendus

- Fichier : `e2e/tests/collecteur/163-collegue-voit-transmission.spec.ts`, `e2e/tests/etg/164-collegue-voit-transmission-collecteur.spec.ts`, `e2e/tests/dispatch-isolation/129-dispatch-partial-refusal-isolation.spec.ts`, `e2e/tests/etg/141-export-excel-animaux-acceptes.spec.ts`, `e2e/tests/etg/60-refus-sans-motif.spec.ts`, `e2e/tests/transverse/154-liste-carcasses-a-jour-hors-ligne.spec.ts`, `e2e/tests/etg/fiche_circuit-long_simple_etg.spec.ts`, `e2e/tests/chains/133-chain-300-carcasses-offline.spec.ts`
- Contournement actuel : `setTimeout` / attentes ciblées avant d'ouvrir la modale d'une carcasse, car react-dsfr re-rend la modale en rafale après la prise en charge et le clic est perdu. La liste ne devient éditable qu'au re-rendu qui suit la prise en charge (avant, le clic ouvre la modale de consultation).
- Correction attendue : stabiliser le rendu de la modale (une seule instance montée, état éditable calculé avant l'affichage) pour que les tests n'aient plus besoin d'attendre.

### La fusion du delta arrive pendant le clic « Transmettre »

- Fichier : `e2e/tests/chains/133-chain-300-carcasses-offline.spec.ts`
- Contournement actuel : au retour en ligne, le test attend que le `POST /sync` puis le delta `GET /carcasse` soient retombés avant de transmettre ; sur CI lent, la fusion de la version serveur arrivait pendant le clic.
- Correction attendue : la fusion du delta ne doit pas écraser ou démonter le formulaire en cours d'action.

### L'alerte « a été notifié » de l'ETG est transitoire

- Fichier : `e2e/tests/chains/133-chain-300-carcasses-offline.spec.ts`
- Contournement actuel : après une transmission ETG → SVI hors ligne, le test attend `POST /sync` 200 au lieu de l'alerte, car la vue éditable se démonte dès `svi_assigned_at` et l'état « a été notifié » (`canEdit && is_synced`) disparaît.
- Correction attendue : garder une confirmation visible de la transmission après le passage de la fiche au SVI.

### Le bac à sable en arrière-plan ne s'affiche plus

- Fichier : `e2e/tests/bac-a-sable/161-bac-a-sable-api.spec.ts`
- Contournement actuel : le test attend la fin de la synchro de Zacharie dans le nouvel onglet avant de revenir sur le bac à sable, que le navigateur a suspendu.
- Correction attendue : faire rafraîchir le bac à sable à son retour au premier plan.

### Le sync ne filtre pas les champs par rôle (commerce de détail)

- Fichier : `e2e/tests/circuit-court/98-readonly-enforcement.spec.ts`
- Contournement actuel : le test de sonde API est `skip`. `sync-carcasse.ts` ne restreint pas les champs non SVI : un utilisateur commerce de détail peut envoyer au `/sync` une modification de `commentaire` ou des anomalies et la voir persistée.
- Correction attendue : ajouter un contrôle de rôle sur les champs écrits par `/sync`, puis retirer le `skip`.

### Une fiche hors périmètre renvoie « Erreur 500 »

- Fichier : `e2e/tests/collecteur/72-fiche-attribuee-autre-collecteur.spec.ts`, `e2e/tests/etg/58-acces-cross-etg-refuse.spec.ts`
- Contournement actuel : les tests acceptent la page « Erreur 500 » quand un utilisateur ouvre l'URL d'une fiche qui ne le concerne pas.
- Correction attendue : renvoyer une page 403 / 404 explicite.

### La vue agrégée /etg/carcasses ne filtre pas par branche

- Fichier : `e2e/tests/dispatch-isolation/117-dispatch-2-etg-isolation-negative.spec.ts`
- Contournement actuel : le test ne vérifie pas la vue agrégée (limitation connue : elle ne filtre pas par branche de dispatch) ; seul le spec 120 la couvre.
- Correction attendue : filtrer la vue agrégée par branche et ajouter l'assertion négative.

### Une carcasse d'une autre branche reste accessible par URL

- Fichier : `e2e/tests/dispatch-isolation/127-url-directe-carcasse-autre-branche.spec.ts`
- Contournement actuel : `FIXME` — le backend ne restreint pas l'accès à la carcasse d'une autre branche via l'URL directe.
- Correction attendue : refuser côté backend l'accès aux carcasses hors périmètre.

### Specs incomplets : sélecteurs et règles « à vérifier »

- Fichier : `e2e/tests/circuit-court/91-liste-triable.spec.ts`, `93-onboarding-complet.spec.ts`, `94-profil.spec.ts`, `96-refus-carcasse.spec.ts`, `97-retransmission-interdite.spec.ts`, `e2e/tests/collecteur/67-onboarding-complet.spec.ts`, `69-post-inspection-svi.spec.ts`, `e2e/tests/etg/45-reception-avec-stockage-ccg.spec.ts`, `50-profil-entreprise.spec.ts`, `60-refus-sans-motif.spec.ts`, `e2e/tests/examinateur/18-date-future-refusee.spec.ts`, `e2e/tests/svi/82-profil.spec.ts`, `84-revision-decision.spec.ts`
- Contournement actuel : `TODO: verify` sur des sélecteurs « best-effort », des sous-routes de profil, un message d'erreur, et des règles métier non confirmées (refus de carcasse en circuit court, workflow de révision SVI supposé en lecture seule, assertion API 403 sur une re-transmission). Le spec 69 collecteur peut passer en no-op si le seed `SVI_CLOSED` n'inclut pas le collecteur.
- Correction attendue : confirmer chaque règle métier, fixer les sélecteurs et rendre les assertions strictes.

### Mise en consigne sans pièces ni lésions : échec silencieux

- Fichier : `e2e/tests/chains/116-chain-refus-partiel-svi.spec.ts`, `e2e/tests/svi/76-inspection-consignee.spec.ts`
- Contournement actuel : le test remplit pièces et lésions, car sans elles l'enregistrement de l'IPM1 `MISE_EN_CONSIGNE` échoue sans rien dire.
- Correction attendue : afficher l'erreur de validation à l'enregistrement.

### La synchro de la consigne SVI est lente

- Fichier : `e2e/tests/chains/116-chain-refus-partiel-svi.spec.ts`
- Contournement actuel : timeout généreux sur le statut « Consignée » de la fiche, car la synchro de la consigne peut prendre plusieurs secondes.
- Correction attendue : comprendre ce délai (`store.updateCarcasse` → `updateCarcasseStatus`) et le réduire.

### Le toast des notifications s'affiche avant l'enregistrement

- Fichier : `e2e/tests/etg/53-notifications.spec.ts`
- Contournement actuel : le test attend la réponse du POST avant de recharger, car le toast s'affiche au clic, avant la fin de la requête.
- Correction attendue : afficher la confirmation après la réponse du serveur.

### Un rechargement coupe le chargement des entités

- Fichier : `e2e/tests/etg/54-partage-de-mes-donnees.spec.ts`
- Contournement actuel : le test navigue par le menu, car un `page.goto` rechargerait l'app et couperait le chargement des entités.
- Correction attendue : rendre le chargement des entités robuste à un rechargement.

### L'indicateur « En ligne » intercepte les clics

- Fichier : `e2e/tests/etg/64-modif-request-new-carcasse.spec.ts`
- Contournement actuel : le test fait défiler la case à cocher dans la vue, car l'indicateur DSFR « En ligne » (z-50, bas de l'écran) intercepte les clics sur les champs.
- Correction attendue : ne pas faire recouvrir les champs du formulaire par l'indicateur.

### Régression connue : l'ETG 2 ne voit pas les carcasses refusées en amont

- Fichier : `e2e/tests/etg/fiche_circuit-long_simple_etg.spec.ts`
- Contournement actuel : tout le parcours ETG 2 (panneau « carcasses déjà refusées » puis transmission au SVI) est commenté. Les intermédiaires sont lus par carcasse : quand l'ETG 1 refuse une partie et transmet le reste à l'ETG 2, les carcasses refusées ne portent pas l'intermédiaire ETG 2. Un snapshot d'aria est aussi commenté (`FIXME: work in local not in ci`), ainsi que des `setTimeout` « pour éviter un bug de cache-lookup Postgres ».
- Correction attendue : trancher le sujet (carte Notion), rétablir le parcours ETG 2 et le snapshot.

### Choisir soi-même comme premier détenteur ne déclenche plus `nextIsMe`

- Fichier : `e2e/tests/examinateur/27-examinateur-as-self-pd.spec.ts`
- Contournement actuel : le test est `.fixme`. L'unique appel `handleSubmitFromSelect(nextOwnerUser?.id)` est devenu `handleSubmitFromSelect()`, donc `nextIsMe` est toujours faux : se choisir soi-même passe par la branche « premier détenteur externe ».
- Correction attendue : rétablir l'argument à l'appel (et vider `next_owner_user_id` sur un auto-transfert), puis retirer `.fixme`. Comportement attendu : bascule en ligne vers la vue de dispatch, sans page « Votre fiche a été transmise ».

### Le rechargement hors ligne n'est pas testable en e2e

- Fichier : `e2e/tests/transverse/106-service-worker-cache-offline-reload.spec.ts`, `144-modifications-refusees-et-etat-sync.spec.ts`, `151-changement-version-store-garde-non-synchronise.spec.ts`, `152-service-worker-ne-cache-pas-l-api.spec.ts`, `147-registre-carcasses-hors-ligne-apres-rechargement.spec.ts`
- Contournement actuel : le spec 106 est `skip` ; les autres rendent l'API injoignable au lieu de couper le réseau. Le serveur web e2e tourne en Vite dev : `__WB_MANIFEST` est vide (pas de précache) et les URLs HMR empêchent le cache du service worker.
- Correction attendue : faire tourner l'app e2e sur un build de production (`vite preview`), puis retirer le `skip`.

### Le backend ne refuse pas plusieurs rôles

- Fichier : `e2e/tests/transverse/108-changement-de-role-interdit.spec.ts`
- Contournement actuel : `TODO` — le test accepte un refus (≥ 400) ou une normalisation silencieuse à un seul rôle.
- Correction attendue : refuser côté API un tableau `roles` de plus d'un élément et rendre l'assertion stricte.

### Attente en temps réel dans le test de déconnexion

- Fichier : `e2e/tests/transverse/129-logout-redirects-and-clears-user.spec.ts`
- Contournement actuel : `waitForTimeout` pour vérifier que l'URL ne rebondit pas vers `/app/[role]` après la déconnexion (contraire à la convention e2e).
- Correction attendue : trouver un signal observable de fin de déconnexion et l'attendre.

### Texte de recherche perdu pendant le changement de layout

- Fichier : `e2e/tests/transverse/130-search-redirect-role-routes.spec.ts`
- Contournement actuel : le test ressaisit la recherche tant que le résultat n'apparaît pas, car l'URL du rôle s'affiche avant que son layout monte et le texte saisi dans l'en-tête de la page de connexion est perdu.
- Correction attendue : ne pas afficher la barre de recherche avant que le layout du rôle soit monté.

### Vite dev épuise les ressources de Chromium

- Fichier : `e2e/tests/transverse/137-matomo-custom-dimensions.spec.ts`
- Contournement actuel : un test (une page neuve) par route, car chaque page charge ~490 modules en dev et enchaîner les rechargements finit en `net::ERR_INSUFFICIENT_RESOURCES`.
- Correction attendue : faire tourner les e2e sur un build de production.

### Redirection imbriquée vers ProConnect après le login

- Fichier : `e2e/tests/transverse/139-admin-creation-destinataire.spec.ts`, `167-admin-import-premiers-detenteurs.spec.ts`, `171-admin-references-stats.spec.ts`
- Contournement actuel : le test attend la page chasseur avant d'ouvrir `/admin`, sinon la navigation part pendant la redirection et ProConnect reçoit un `redirect` imbriqué.
- Correction attendue : normaliser le paramètre `redirect` pour qu'il ne puisse pas s'imbriquer.

### Une fiche sans carcasse reste « non synchronisée »

- Fichier : `e2e/tests/transverse/151-changement-version-store-garde-non-synchronise.spec.ts`
- Contournement actuel : le test ne vérifie pas l'indicateur « En ligne », car une fiche sans carcasse ne revient pas dans le delta de `GET /carcasse` et reste `is_synced = false` après une synchro réussie.
- Correction attendue : marquer la fiche synchronisée à la réponse du `/sync`, indépendamment du delta des carcasses.

### Dépendance d'ordre entre deux specs

- Fichier : `e2e/tests/transverse/connexion.spec.ts`
- Contournement actuel : le spec repart d'une base saine, car `135-changer-mot-de-passe` tourne juste avant et laisse `examinateur@example.fr` avec un autre mot de passe.
- Correction attendue : faire restaurer l'état par le spec 135 (ou isoler son compte) pour que les specs soient indépendants.

### Inspection de masse SVI absente du spec 300 carcasses

- Fichier : `e2e/tests/chains/133-chain-300-carcasses-offline.spec.ts`
- Contournement actuel : `TODO mass-inspect` — le SVI ne fait que recevoir la fiche.
- Correction attendue : quand l'inspection de masse SVI existera, prolonger le test pour inspecter et clôturer toutes les carcasses.
