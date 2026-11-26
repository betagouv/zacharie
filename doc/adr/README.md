# Décisions d'architecture (ADR)

Un ADR (_Architecture Decision Record_) consigne une décision technique importante et non évidente : le contexte, la décision, et ses conséquences. Le code de Zacharie ne contient pas de commentaires (règle `local/no-comments`, voir [0001](0001-pas-de-commentaires-dans-le-code.md)) : le « pourquoi » vit ici.

## Format

Un fichier par sujet, `NNNN-sujet-en-kebab-case.md` :

```md
# NNNN. Titre

## Contexte

Le problème, les contraintes (métier, réglementaires, techniques).

## Décision

Ce que fait le code, et où (`chemin/du/fichier.ts`, `nomDuSymbole`).

## Conséquences

Ce qu'il ne faut pas casser, ce qu'il faut savoir avant de modifier.
```

On cite le code par chemin et nom de symbole, pas par numéro de ligne.

Les contournements à corriger ne sont pas des décisions : ils vont dans [excuses-a-traiter.md](excuses-a-traiter.md).

## Index

- [0001. Pas de commentaires dans le code](0001-pas-de-commentaires-dans-le-code.md)
- [0002. La propriété et la transmission sont portées par chaque carcasse](0002-propriete-portee-par-la-carcasse.md) : les champs de transmission vivent sur la carcasse, pas sur la fiche (dispatch, isolation des branches)
- [0003. Stockage local Zustand découpé dans IndexedDB](0003-stockage-local-indexeddb.md) : une entrée IndexedDB par enregistrement, écritures différentielles, `migrate` qui garde les saisies non synchronisées
- [0004. Synchronisation : le push `POST /sync`](0004-synchronisation-push-sync.md) : `POST /sync` en un lot ordonné, refus définitifs contre erreurs transitoires, retrait du store local
- [0005. Pull delta `GET /carcasse` et périmètre de lecture](0005-pull-delta-et-perimetre-de-lecture.md) : périmètre de lecture partagé lecture / écriture, pagination par branche indexée, refusées hors périmètre, rechargement complet
- [0006. Verrou optimiste des fiches, carcasses et lignes d'intermédiaire](0006-verrou-optimiste-des-versions.md) : le client renvoie la version reçue, le serveur refuse l'écriture périmée d'un autre utilisateur
- [0007. Droits d'écriture du `/sync`](0007-droits-d-ecriture-du-sync.md) : `SyncScope`, deny by default, chaque groupe de champs appartient à un rôle
- [0008. Frontière de prise en charge et propagation fiche → carcasses](0008-frontiere-de-prise-en-charge.md) : « destinataire attribué » contre « pris en charge en aval », ce que `updateFei` ne doit plus repousser
- [0009. Déconnexion, changement de session et navigation dans la WebView](0009-deconnexion-et-navigation-webview.md) : `disconnect()` seule fin de session, `pushState` + `flushSync`, pas de `window.location.href`
- [0010. Onglets multiples et détection du mode hors ligne](0010-onglets-multiples-et-hors-ligne.md) : pas de données entre onglets, un seul onglet hors ligne (Web Locks), retour en ligne sans événement `online`
- [0011. Service worker, serveur de l'app web et mises à jour](0011-service-worker-et-mises-a-jour.md) : cache des seuls fichiers statiques, 404 sur un ancien asset, signal de nouvelle version web et mobile
- [0012. App mobile Expo (WebView)](0012-app-mobile-expo.md) : liens universels, mises à jour au prochain lancement, JWT en Bearer, jeton push natif
- [0013. Authentification, sessions et comptes](0013-authentification-sessions-et-comptes.md) : cookie `__Host-` et SameSite par environnement, blocage de connexion, limites de débit, invitation
- [0014. ProConnect pour les admins](0014-proconnect-pour-les-admins.md) : OIDC factice en e2e, `proconnect_at` valable 12 h, 401 contre 403 `PROCONNECT_REQUIRED`
- [0015. Admin : corrections de fiche, suppressions et comptes](0015-admin-corrections-suppressions-et-comptes.md) : corrections seulement avant clôture, soft delete sans hard delete d'entité, `nextVersion` partout
- [0016. Admin : historique, journal d'audit et listes](0016-admin-historique-journal-et-listes.md) : lecture des tables `History` par `LEAD()`, journal de chaque écriture `/admin`, filtres dans l'URL
- [0017. Entités, rattachements et confidentialité](0017-entites-rattachements-et-confidentialite.md) : qui crée quoi, un admin par entité, partenaires et membres jamais exposés à des tiers
- [0018. Pré-enregistrement des destinataires et classification par Albert](0018-destinataires-pre-enregistrement-et-classification.md) : pré-enregistrement par le chasseur, type déduit par Albert, anti-doublons sans révéler l'existant
- [0019. Circuit court : fin de chaîne passive](0019-circuit-court-fin-de-chaine.md) : le commerce de détail ne prend jamais en charge, lecture seule, lot clôturé dès l'envoi
- [0020. Premier détenteur, associations et ventes / dons](0020-premier-detenteur-et-ventes-dons.md) : désignation directe, association premier détenteur, ventes / dons par soustraction
- [0021. Examen initial, certification et référentiel des anomalies](0021-examen-initial-et-anomalies.md) : référentiel généré depuis le CSV, gravité ≥ 2, certification à la coche, suspicions sanitaires
- [0022. Intermédiaires (ETG, collecteur) : prise en charge, renvoi et verrou](0022-intermediaires-prise-en-charge-renvoi-et-verrou.md) : intermédiaire de référence, renvoi à l'expéditeur, seul le SVI verrouille la fiche
- [0023. Demandes de modification indicatives](0023-demandes-de-modification-indicatives.md) : modification appliquée tout de suite, avis de l'examinateur a posteriori, gel après inspection SVI
- [0024. Inspection SVI, clôture et certificats](0024-inspection-svi-cloture-et-certificats.md) : clôture par carcasse, auto-acceptation à J+10 et garde des 48 h, certificats par décision
- [0025. Trichine : principes, références et alias](0025-trichine-principes-references-et-alias.md) : feature flag, pas de local-first, références `E/P/F`, point de non-retour de la FTP, alias et gel
- [0026. Trichine : prélèvement, pools et FTP (émetteur)](0026-trichine-prelevement-pools-et-ftp.md) : prélèvement en lot tout ou rien, limites réglementaires des pools, cycle de vie de la FTP
- [0027. Trichine : laboratoires et résultats](0027-trichine-laboratoires-et-resultats.md) : projection stricte, source unique des règles de résultat, confirmation LNR, import LIMS
- [0028. Trichine : documents, PDF de FTP et stockage Cellar](0028-trichine-documents-pdf-et-stockage.md) : clé de stockage calculée par le serveur, PDF figé à l'envoi, code-barres Code 128
- [0029. Notifications : email, push web et push natif](0029-notifications-et-emails.md) : canaux indépendants, dédup par `NotificationLog`, registre des templates Brevo, push Expo
- [0030. Effets de bord, API publique v1 et webhooks](0030-effets-de-bord-api-publique-et-webhooks.md) : side-effects isolés et idempotents, la carcasse ressource de l'API v1, webhooks entrants et sortants
- [0031. Statistiques, tableaux de bord et saisons de chasse](0031-statistiques-et-saisons.md) : comptage en animaux, deux définitions de la saison, périmètre des fédérations, score BPH
- [0032. Exports, imports de fichiers et données embarquées](0032-exports-imports-et-donnees-embarquees.md) : limites Excel, imports RESYTAL et premiers détenteurs, référentiels embarqués au format abrégé
- [0033. Recherche locale, routes et liens persistants](0033-recherche-locale-routes-et-liens.md) : recherche entièrement locale, tolérance aux fautes, routes figées pour les anciens liens, un `<title>` par page
- [0034. Interface DSFR : contournements et performances de rendu](0034-interface-dsfr-et-performances-de-rendu.md) : piège à focus et modales DSFR, `LazyModal`, index partagés pour les listes de 300 carcasses
- [0035. Observabilité : Sentry, Matomo et données personnelles](0035-observabilite-sentry-matomo-donnees-personnelles.md) : masquage avant Sentry, payloads refusés rejouables, catalogue Matomo sans donnée personnelle
- [0036. Serveur Express : configuration et sécurité HTTP](0036-serveur-express-configuration-et-securite-http.md) : `VITE_SECRET` obligatoire, routes de test seulement en `NODE_ENV=test`, CORS, CSP, compression
- [0037. Crons : verrou, data health, clôture automatique et relances](0037-crons.md) : verrou `CronJob`, data health en lecture seule, clôture automatique à 8h, relance d'inscription
- [0038. Assistant de résolution de bug (Albert)](0038-assistant-de-resolution-de-bug-albert.md) : streaming Albert, contrôle du premier rapport, outils en lecture seule
- [0039. Tests : e2e, seed et vitest sur base réelle](0039-tests-e2e-vitest-et-seed.md) : triggers rejoués sur la base e2e, états du seed, fixture anti-incohérence, tests SQL sur vraie base
- [0040. Scripts ponctuels d'api-express](0040-scripts.md) : usage et précautions des backfills, imports et seeds trichine
