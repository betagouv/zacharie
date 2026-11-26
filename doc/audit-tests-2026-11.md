# Audit des tests — 2026-11

Chaque test (e2e Playwright et vitest) a été classé : **Utile** (protège un comportement réel), **Tautologique** (ne peut pas échouer, ou n'affirme rien d'utile), **Redondant** (même chemin et mêmes assertions qu'un autre test), **Fragile** (attente fixe, ordre entre tests, sélecteur positionnel). Seuls les tests non utiles sont listés, avec l'action proposée. Rien n'a encore été supprimé.

| Lot                                                                                            | Tests | Utiles | Tautologiques | Redondants | Fragiles |
| ---------------------------------------------------------------------------------------------- | ----: | -----: | ------------: | ---------: | -------: |
| e2e — lot A (transverse, examinateur, premier-detenteur, chains, bac-a-sable, load)            |   261 |    214 |            20 |         20 |        7 |
| e2e — lot B (etg, svi, collecteur, dispatch-isolation, circuit-court, laboratoire, federation) |   124 |     79 |            25 |         17 |        3 |
| vitest (api-express + app)                                                                     |  1415 |   1371 |            15 |         27 |        2 |

## Points saillants

- **Tests e2e qui passent quoi qu'il arrive** : URLs de fiche à un seul segment (`/app/<role>/fei/<numero>`) qui tombent sur la 404 (`etg/56`, `etg/58`, `collecteur/72`, `svi/88`) ; fiches absentes du seed avec toutes les assertions dans un `if` (`collecteur/69`, `collecteur/70`) ; routes inexistantes dont on n'affirme que l'URL (`circuit-court/93`, `circuit-court/94`, `svi/82`). Pour `etg/58` et `collecteur/72`, corriger l'URL plutôt que supprimer.
- **Règle « un rôle par utilisateur » sans vrai test e2e** : `transverse/108` poste sur le port du front et accepte tous les résultats. À réécrire contre l'API (`POST :3291/user/:id` → 4xx, puis `/user/me`).
- **Assertions vitest qui ne peuvent pas échouer** : `trichine-echantillons-bulk-route.test.ts` › « lot valide → références consécutives » (`split('-')[2]` lit le code établissement → `NaN`, et `toEqual(NaN, NaN)` passe) ; `sync-fei.test.ts` › « delete request on missing FEI » (l'admin est refusé avant la recherche de la fiche).
- **Tests désactivés** : `transverse/106` (`test.skip`), `examinateur/27` (`test.fixme`), un test de `circuit-court/98` (`test.skip`).

## Audit e2e — lot A (transverse, examinateur, premier-detenteur, chains, bac-a-sable, load)

Périmètre : 131 fichiers, **261 tests** (tests paramétrés comptés un par un : 105 ×5, 137-matomo ×21, 138 ×17, 153 ×2).
Commentaires ignorés, seul le code des tests est jugé.

| Catégorie     | Nb  |
| ------------- | --- |
| Utiles        | 214 |
| Tautologiques | 20  |
| Redondants    | 20  |
| Fragiles      | 7   |

### Tableau par fichier

| Fichier                                                                |   Tests |  Utiles | Tautologiques | Redondants | Fragiles |
| ---------------------------------------------------------------------- | ------: | ------: | ------------: | ---------: | -------: |
| transverse/104-offline-create-online-sync                              |       1 |       0 |             1 |          0 |        0 |
| transverse/105-role-based-route-access-matrix                          |       5 |       5 |             0 |          0 |        0 |
| transverse/106-service-worker-cache-offline-reload                     |       1 |       0 |             1 |          0 |        0 |
| transverse/107-logout-cleans-local-store                               |       1 |       1 |             0 |          0 |        0 |
| transverse/108-changement-de-role-interdit                             |       1 |       0 |             1 |          0 |        0 |
| transverse/109-session-expiree                                         |       1 |       1 |             0 |          0 |        0 |
| transverse/110-deep-link-fiche-inconnue                                |       1 |       0 |             1 |          0 |        0 |
| transverse/129-logout-redirects-and-clears-user                        |       1 |       0 |             0 |          0 |        1 |
| transverse/130-search-redirect-role-routes                             |      12 |      10 |             2 |          0 |        0 |
| transverse/131-fiches-list-sorting                                     |       1 |       1 |             0 |          0 |        0 |
| transverse/132-working-for-pii-leak-requested-relation                 |       1 |       1 |             0 |          0 |        0 |
| transverse/133-fiches-pagination                                       |       1 |       1 |             0 |          0 |        0 |
| transverse/134-compte-en-attente-validation-alert                      |       2 |       2 |             0 |          0 |        0 |
| transverse/135-changer-mot-de-passe                                    |       1 |       1 |             0 |          0 |        0 |
| transverse/136-admin-proconnect                                        |       4 |       4 |             0 |          0 |        0 |
| transverse/137-account-lockout                                         |       5 |       1 |             0 |          2 |        2 |
| transverse/137-matomo-custom-dimensions                                |      21 |      21 |             0 |          0 |        0 |
| transverse/138-titres-des-pages                                        |      17 |      17 |             0 |          0 |        0 |
| transverse/139-admin-creation-destinataire                             |       3 |       3 |             0 |          0 |        0 |
| transverse/140-changement-email-interdit                               |       1 |       1 |             0 |          0 |        0 |
| transverse/143-version-obsolete-ecrasee                                |       1 |       1 |             0 |          0 |        0 |
| transverse/144-modifications-refusees-et-etat-sync                     |       3 |       3 |             0 |          0 |        0 |
| transverse/147-registre-carcasses-hors-ligne-apres-rechargement        |       1 |       1 |             0 |          0 |        0 |
| transverse/148-nouvelle-version-proposee                               |       2 |       2 |             0 |          0 |        0 |
| transverse/149-detenteurs-initiaux-persistes-hors-ligne                |       1 |       1 |             0 |          0 |        0 |
| transverse/150-retour-en-ligne-apres-connexion-tres-lente              |       1 |       1 |             0 |          0 |        0 |
| transverse/151-changement-version-store-garde-non-synchronise          |       1 |       1 |             0 |          0 |        0 |
| transverse/152-service-worker-ne-cache-pas-l-api                       |       1 |       1 |             0 |          0 |        0 |
| transverse/153-creation-de-compte-connecte-garde-les-fiches            |       2 |       2 |             0 |          0 |        0 |
| transverse/154-liste-carcasses-a-jour-hors-ligne                       |       1 |       1 |             0 |          0 |        0 |
| transverse/154-plusieurs-onglets                                       |       3 |       3 |             0 |          0 |        0 |
| transverse/155-retour-en-ligne-apres-echec-user-me                     |       1 |       1 |             0 |          0 |        0 |
| transverse/158-admin-journal                                           |       1 |       1 |             0 |          0 |        0 |
| transverse/159-admin-historique                                        |       2 |       2 |             0 |          0 |        0 |
| transverse/161-admin-corrections-fiche                                 |       3 |       3 |             0 |          0 |        0 |
| transverse/163-admin-recherche-par-id                                  |       2 |       2 |             0 |          0 |        0 |
| transverse/164-admin-vues-filtres-url                                  |       2 |       2 |             0 |          0 |        0 |
| transverse/167-admin-import-premiers-detenteurs                        |       1 |       1 |             0 |          0 |        0 |
| transverse/169-admin-a-traiter                                         |       3 |       3 |             0 |          0 |        0 |
| transverse/171-admin-references-stats                                  |       1 |       1 |             0 |          0 |        0 |
| transverse/174-anciens-liens-et-liens-avec-ponctuation                 |       2 |       2 |             0 |          0 |        0 |
| transverse/176-admin-compte-bloque                                     |       1 |       1 |             0 |          0 |        0 |
| transverse/comptes-vides-desktop                                       |       5 |       4 |             1 |          0 |        0 |
| transverse/comptes-vides-mobile                                        |       5 |       2 |             0 |          3 |        0 |
| transverse/connexion                                                   |       4 |       3 |             0 |          1 |        0 |
| transverse/creation-comptes                                            |      10 |       8 |             0 |          2 |        0 |
| **Sous-total transverse**                                              | **141** | **123** |         **7** |      **8** |    **3** |
| examinateur/01-creation-fiche-grand-gibier-mono                        |       1 |       0 |             0 |          1 |        0 |
| examinateur/03-creation-fiche-petit-gibier-lot                         |       1 |       1 |             0 |          0 |        0 |
| examinateur/04-creation-fiche-mixte                                    |       1 |       1 |             0 |          0 |        0 |
| examinateur/05-creation-fiche-anomalies                                |       1 |       1 |             0 |          0 |        0 |
| examinateur/06-brouillon-persistance                                   |       1 |       1 |             0 |          0 |        0 |
| examinateur/07-edition-carcasse-depuis-detail                          |       1 |       1 |             0 |          0 |        0 |
| examinateur/08-examinateur-pd-self-handoff                             |       1 |       0 |             0 |          1 |        0 |
| examinateur/09-onboarding-complet                                      |       1 |       0 |             0 |          1 |        0 |
| examinateur/09-pd-via-association-other-member-destinataire            |       1 |       0 |             0 |          1 |        0 |
| examinateur/10-onboarding-incomplet-acces-restreint                    |       1 |       1 |             0 |          0 |        0 |
| examinateur/11-onboarding-partiel-formation-manquante                  |       1 |       1 |             0 |          0 |        0 |
| examinateur/12-profil-examinateur                                      |       1 |       1 |             0 |          0 |        0 |
| examinateur/13-ccg-creation-profil                                     |       1 |       0 |             0 |          1 |        0 |
| examinateur/15-fiche-svi-cloturee-vue-chasseur                         |       1 |       1 |             0 |          0 |        0 |
| examinateur/156-association-autre-membre-apres-certification           |       1 |       1 |             0 |          0 |        0 |
| examinateur/157-carcasse-ajoutee-apres-certification-premier-detenteur |       2 |       2 |             0 |          0 |        0 |
| examinateur/16-fiche-circuit-court-livree-vue-chasseur                 |       1 |       1 |             0 |          0 |        0 |
| examinateur/160-suppression-carcasse-apres-transmission                |       1 |       1 |             0 |          0 |        0 |
| examinateur/169-fiche-sans-carcasse-apres-reconnexion                  |       1 |       1 |             0 |          0 |        0 |
| examinateur/17-fiche-refusee-par-etg-vue-chasseur                      |       1 |       1 |             0 |          0 |        0 |
| examinateur/18-date-future-refusee                                     |       1 |       0 |             1 |          0 |        0 |
| examinateur/19-heure-eviscération-invalide                             |       1 |       0 |             1 |          0 |        0 |
| examinateur/20-retirer-carcasse                                        |       1 |       1 |             0 |          0 |        0 |
| examinateur/21-zero-carcasse-transmettre-disabled                      |       1 |       0 |             1 |          0 |        0 |
| examinateur/22-double-clic-transmettre                                 |       1 |       1 |             0 |          0 |        0 |
| examinateur/23-deconnexion-pendant-formulaire                          |       1 |       0 |             1 |          0 |        0 |
| examinateur/24-tableau-de-bord-bouton-creer-fiche                      |       1 |       1 |             0 |          0 |        0 |
| examinateur/25-modif-request-dashboard                                 |       2 |       1 |             1 |          0 |        0 |
| examinateur/26-examinateur-to-external-pd                              |       1 |       1 |             0 |          0 |        0 |
| examinateur/27-examinateur-as-self-pd                                  |       1 |       0 |             1 |          0 |        0 |
| examinateur/28-examinateur-to-association-step-advance                 |       1 |       1 |             0 |          0 |        0 |
| examinateur/30-anomalie-ajoutee-apres-confirmation                     |       1 |       1 |             0 |          0 |        0 |
| examinateur/30-premier-detenteur-association-affichage                 |       2 |       2 |             0 |          0 |        0 |
| examinateur/31-anomalie-hors-liste                                     |       3 |       3 |             0 |          0 |        0 |
| examinateur/32-ccg-question-chambre-froide                             |       2 |       2 |             0 |          0 |        0 |
| examinateur/33-proprietaire-initial-verrouille-apres-transmission      |       2 |       2 |             0 |          0 |        0 |
| examinateur/34-dernier-admin-association                               |       3 |       2 |             0 |          0 |        1 |
| examinateur/34-renvoi-puis-retour-a-l-association                      |       1 |       1 |             0 |          0 |        0 |
| examinateur/35-choix-commune-dans-la-liste                             |       1 |       1 |             0 |          0 |        0 |
| examinateur/36-date-validation-avant-mise-a-mort                       |       1 |       1 |             0 |          0 |        0 |
| examinateur/37-certification-anomalie-grave                            |       2 |       2 |             0 |          0 |        0 |
| examinateur/38-format-numero-cfei                                      |       1 |       1 |             0 |          0 |        0 |
| examinateur/fiche_circuit-long_simple_examinateur                      |       1 |       1 |             0 |          0 |        0 |
| **Sous-total examinateur**                                             |  **53** |  **41** |         **6** |      **5** |    **1** |
| premier-detenteur/142-tracabilite-inspection-svi-apres-prise-en-charge |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/161-entite-supprimee-non-proposee                    |       2 |       2 |             0 |          0 |        0 |
| premier-detenteur/168-lien-notification-demande-rattachement           |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/169-rejoindre-quitter-association-fiches             |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/170-limite-5-associations                            |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/173-retour-arriere-modale-ouverte                    |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/175-moi-meme-sans-destinataire-habituel              |       2 |       2 |             0 |          0 |        0 |
| premier-detenteur/175-repas-de-chasse-cloturer                         |       3 |       3 |             0 |          0 |        0 |
| premier-detenteur/28-dispatch-etg-collecteur                           |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/29-dispatch-commerce-de-detail                       |       1 |       0 |             0 |          1 |        0 |
| premier-detenteur/30-ccg-creation-inline                               |       1 |       0 |             0 |          1 |        0 |
| premier-detenteur/31-onboarding-incomplet-acces-restreint              |       1 |       0 |             0 |          1 |        0 |
| premier-detenteur/32-profil-informations-de-chasse                     |       2 |       0 |             2 |          0 |        0 |
| premier-detenteur/33-partage-de-mes-donnees                            |       2 |       1 |             1 |          0 |        0 |
| premier-detenteur/34-fiche-svi-cloturee-lecture-seule                  |       1 |       0 |             0 |          1 |        0 |
| premier-detenteur/35-fiche-circuit-court-livree                        |       1 |       0 |             0 |          1 |        0 |
| premier-detenteur/36-refus-carcasse-avant-transmission                 |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/37-suppression-carcasse                              |       1 |       0 |             0 |          1 |        0 |
| premier-detenteur/38-dispatch-groupe-vide                              |       2 |       2 |             0 |          0 |        0 |
| premier-detenteur/39-changement-prochain-detenteur                     |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/40-stockage-ccg-sans-ccg                             |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/41-transmission-hors-ligne                           |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/42-contact                                           |       1 |       0 |             1 |          0 |        0 |
| premier-detenteur/43-tableau-de-bord                                   |       2 |       1 |             1 |          0 |        0 |
| premier-detenteur/44-onboarding-associations-de-chasse                 |       4 |       4 |             0 |          0 |        0 |
| premier-detenteur/45-dispatch-divergent-recipients                     |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/46-etape-carcasses-soustraction                      |       6 |       6 |             0 |          0 |        0 |
| premier-detenteur/47-creation-destinataire-depuis-recherche            |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/48-carcasses-renvoyees-a-attribuer                   |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/49-ajout-destinataire-consommateur-final             |       2 |       2 |             0 |          0 |        0 |
| premier-detenteur/50-circuit-court-partiel-reste-a-attribuer           |       1 |       1 |             0 |          0 |        0 |
| premier-detenteur/51-destinataires-habituels                           |       2 |       2 |             0 |          0 |        0 |
| premier-detenteur/fiche_circuit-long_simple_premier-detenteur          |       3 |       3 |             0 |          0 |        0 |
| **Sous-total premier-detenteur**                                       |  **53** |  **42** |         **5** |      **6** |    **0** |
| chains/111-chain-circuit-long                                          |       1 |       0 |             0 |          0 |        1 |
| chains/112-chain-circuit-court-direct                                  |       1 |       1 |             0 |          0 |        0 |
| chains/113-chain-avec-collecteur                                       |       1 |       0 |             0 |          0 |        1 |
| chains/114-chain-dispatch-hybride                                      |       1 |       0 |             0 |          1 |        0 |
| chains/115-chain-refus-total-etg                                       |       1 |       0 |             1 |          0 |        0 |
| chains/116-chain-refus-partiel-svi                                     |       1 |       0 |             0 |          0 |        1 |
| chains/133-chain-300-carcasses-offline                                 |       1 |       1 |             0 |          0 |        0 |
| chains/166-trichine-circuit-agree-negatif                              |       1 |       1 |             0 |          0 |        0 |
| **Sous-total chains**                                                  |   **8** |   **3** |         **1** |      **1** |    **3** |
| bac-a-sable/161-bac-a-sable-api                                        |       5 |       5 |             0 |          0 |        0 |
| load/etg-volume                                                        |       1 |       0 |             1 |          0 |        0 |
| **Total**                                                              | **261** | **214** |        **20** |     **20** |    **7** |

### Tests non utiles

### Tautologiques (20)

- `transverse/104-offline-create-online-sync` › `Création hors-ligne puis sync auto au retour en ligne` — Tautologique — la fiche est relue depuis le store local après `goto('/app/chasseur')` : le lien s'affiche même si la sync n'a jamais lieu. — Supprimer (155 attend réellement le `POST /sync` contenant la fiche) ou renforcer : attendre la réponse `/sync` avec le numéro.
- `transverse/106-service-worker-cache-offline-reload` › `Service worker : reload offline charge depuis le runtime cache` — Tautologique — `test.skip` : ne tourne jamais (et utilise `networkidle`). — Supprimer, 152 couvre le SW.
- `transverse/108-changement-de-role-interdit` › `Tenter d'ajouter un second rôle via API doit être rejeté` — Tautologique — POST sur `localhost:3290/api/action/user/...` (port du front, route inexistante) ; les deux branches `if/else` passent quel que soit le résultat (`body={}` → `roles=[]`). — Réécrire : `POST localhost:3291/user/:id` avec `roles: ['CHASSEUR','ETG']`, attendre un 4xx puis vérifier via `/user/me` que `roles` n'a pas changé (règle dure du CLAUDE.md).
- `transverse/110-deep-link-fiche-inconnue` › `Deep link vers fiche inconnue affiche un message propre` — Tautologique — `body` visible + assertion conditionnelle (si on est sur l'accueil, rien n'est vérifié) avec une regex très large. — Renforcer : figer le comportement attendu (message exact ou redirection exacte) sans `if`.
- `transverse/130-search-redirect-role-routes` › `Auto-closing email URL /app/chasseur/fei/:numero resolves` — Tautologique — `goto(url)` puis `toHaveURL(url)` : vérifie la valeur qu'on vient de taper. — Supprimer, ou asserter le contenu de la fiche (titre/numéro).
- `transverse/130-search-redirect-role-routes` › `Admin notification URL /app/chasseur/profil/informations-de-chasse resolves` — Tautologique — même schéma `goto` → `toHaveURL` ; `open-entity=test-id` n'est pas vérifié. — Supprimer : `premier-detenteur/168` teste ce lien de notification pour de vrai.
- `transverse/comptes-vides-desktop` › `Connexion avec compte premier détenteur` — Tautologique — l'assertion clé vérifie l'absence de « Nouvelle fiche » dans `#content`, mais sur desktop le bouton s'appelle « Créer une fiche » : elle ne peut pas échouer. — Renforcer : `getByRole('button', { name: 'Créer une fiche' })` → `toHaveCount(0)`.
- `examinateur/18-date-future-refusee` › `Date de mise à mort future (J+1) refusée` — Tautologique — si le bouton J+1 n'existe pas (cas réel), on vérifie l'absence d'un bouton « demain » qui n'a jamais existé. — Renforcer : asserter les boutons de date proposés (aucun > aujourd'hui) ou saisir une date future dans l'input et attendre l'erreur.
- `examinateur/19-heure-eviscération-invalide` › `Heure d'éviscération < heure de mise à mort → erreur ou auto-correction` — Tautologique — accepte deux comportements, `isVisible()` sans attente juste après le `blur` (course), aucune règle figée. — Renforcer : choisir le comportement attendu et l'asserter avec `expect(...).toBeVisible()`.
- `examinateur/21-zero-carcasse-transmettre-disabled` › `0 carcasse → bouton Transmettre désactivé` — Tautologique — branche `else` : « Ajouter une carcasse » est toujours visible à cette étape. — Renforcer : supprimer le `if`, asserter que « Transmettre » est absent ou désactivé.
- `examinateur/23-deconnexion-pendant-formulaire` › `Déconnexion en plein formulaire — store local nettoyé → reconnexion formulaire vide` — Tautologique — `toHaveCount(0)` sur les liens `ZACH-` passe immédiatement, avant le chargement ; la fiche a été synchronisée en ligne et réapparaît (169 asserte exactement l'inverse). — Supprimer (107 et 169 couvrent la purge et la reprise).
- `examinateur/25-modif-request-dashboard` › `No pending demandes → no modal pop-up` — Tautologique — assertion négative instantanée juste après la connexion, avant tout chargement. — Renforcer : attendre un élément chargé (lien d'une fiche, fin de sync) avant `toHaveCount(0)`, ou supprimer.
- `examinateur/27-examinateur-as-self-pd` › `Examinateur picks themselves as PD — inline transition to dispatch view` — Tautologique — `test.fixme` : ne tourne jamais. — Supprimer ou réparer ; le parcours « moi-même » est déjà couvert par `premier-detenteur/175-repas-de-chasse-cloturer`.
- `premier-detenteur/32-profil-informations-de-chasse` › `32a - Profil associations de chasse : page se charge et association seedée visible` — Tautologique — relit la valeur du seed sur une page qu'on vient d'ouvrir. — Supprimer (168, 169, 34-dernier-admin affichent et manipulent cette carte).
- `premier-detenteur/32-profil-informations-de-chasse` › `32c - Profil CCGs : page se charge et CCG-01 visible` — Tautologique — la regex `/CCG-01|CCG Chasseurs|chambre froide/i` matche le titre de la page. — Supprimer (32-ccg-question-chambre-froide couvre la page CCG).
- `premier-detenteur/33-partage-de-mes-donnees` › `Partage de mes données — état vide : page se charge sans bloc d'autorisation` — Tautologique — titre de la page qu'on vient d'ouvrir + absences évaluées avant le chargement asynchrone. — Supprimer, ou attendre la fin du fetch avant les `toHaveCount(0)`.
- `premier-detenteur/42-contact` › `Page contact charge sans erreur` — Tautologique — `goto('/contact')` puis titre « Contact » visible. — Supprimer (138 vérifie déjà le titre de `/app/chasseur/contact`).
- `premier-detenteur/43-tableau-de-bord` › `Tableau de bord affiche MesChasses groupées` — Tautologique — regex `/Pas encore de carcasses|statistiques/i` satisfaite par l'état vide ; le regroupement n'est jamais vérifié. — Supprimer (le 2e test du fichier couvre l'état vide) ou seeder des chasses et asserter le groupement.
- `chains/115-chain-refus-total-etg` › `ETG refuse toutes les carcasses → chasseur voit refus` — Tautologique — côté chasseur, on vérifie seulement que la carte « Daim N° MM-001-001 » existe, pas le refus. — Renforcer : asserter le statut « refusée »/motif sur chaque carte (ou supprimer la fin et garder `examinateur/17`).
- `load/etg-volume` › `ETG avec ${TOTAL} carcasses` — Tautologique — script de mesure : aucun seuil, il ne peut échouer que sur le timeout de 2 h. — Garder hors suite (config dédiée) mais l'assumer comme outil de mesure, ou ajouter des budgets (`duree_s`, `tache_max_ms`).

### Redondants (20)

- `transverse/137-account-lockout` › `Le compte est verrouillé après 5 tentatives échouées avec un mauvais mot de passe` — Redondant — même parcours et mêmes assertions que le début de `176-admin-compte-bloque`. — Supprimer.
- `transverse/137-account-lockout` › `Le compte reste verrouillé même avec le bon mot de passe` — Redondant — couvert par `176` (bon mot de passe → « Trop de tentatives »). — Supprimer.
- `transverse/comptes-vides-mobile` › `Connexion avec compte collecteur pro` — Redondant — identique à la version desktop ; ce rôle est desktop (cf. e2e/CLAUDE.md). — Supprimer.
- `transverse/comptes-vides-mobile` › `Connexion avec compte établissement de traitement` — Redondant — idem desktop. — Supprimer.
- `transverse/comptes-vides-mobile` › `Connexion avec compte svi` — Redondant — idem desktop (seul « Filtres » diffère). — Supprimer ou fusionner l'assertion « Filtres » dans la version desktop.
- `transverse/connexion` › `Connexion avec succès` — Redondant — `comptes-vides-desktop` › `Connexion avec compte examinateur initial` fait la même connexion avec plus d'assertions. — Supprimer.
- `transverse/creation-comptes` › `Examinateur initial ajoute une association de chasse existante depuis son profil` — Redondant — mêmes étapes que la partie association de `Premier détenteur ajoute association et CCG depuis son profil`. — Supprimer.
- `transverse/creation-comptes` › `Examinateur initial ajoute une chambre froide (CCG) depuis son profil` — Redondant — même formulaire « Oui mais » que la partie CCG du test PD, et finit par un `click` sur le texte au lieu d'un `expect`. — Supprimer.
- `examinateur/01-creation-fiche-grand-gibier-mono` › `Création fiche grand gibier mono-carcasse — 1 daim` — Redondant — même parcours que `fiche_circuit-long_simple_examinateur` (qui vérifie plus : statut, commune, PD). — Supprimer, ou fusionner la vérification du singulier « 1 daim ».
- `examinateur/08-examinateur-pd-self-handoff` › `Examinateur == PD via CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY — self-handoff` — Redondant — `28-examinateur-to-association-step-advance` fait exactement le même parcours, plus le statut « En cours ». — Supprimer.
- `examinateur/09-onboarding-complet` › `Onboarding complet : coordonnées → formation → infos de chasse → /chasseur` — Redondant — `creation-comptes` › `Création de compte examinateur initial` couvre le même onboarding. — Fusionner : ajouter les `toHaveURL` d'étapes dans creation-comptes, supprimer celui-ci.
- `examinateur/09-pd-via-association-other-member-destinataire` › `Autre membre de l'Association voit le bloc Vente / don sur la fiche` — Redondant — seule assertion finale (« Destinataires » visible pour l'autre membre) = celle de `156` ; la répartition partielle n'est jamais vérifiée. — Supprimer, ou asserter que le Cerf reste à attribuer.
- `examinateur/13-ccg-creation-profil` › `CCG : création depuis profil → visible après reload` — Redondant — mêmes étapes et même assertion que `32-ccg-question-chambre-froide` › `la question disparaît...` (qui fait le reload annoncé ici). — Supprimer.
- `premier-detenteur/29-dispatch-commerce-de-detail` › `Dispatch vers commerce de détail — circuit court direct sans ETG` — Redondant — `chains/112` fait le même envoi et vérifie en plus la réception par le commerce. — Supprimer.
- `premier-detenteur/30-ccg-creation-inline` › `Création CCG inline depuis le formulaire de transmission` — Redondant — identique pas à pas à `fiche_circuit-long_simple_premier-detenteur` › `Stockage - Transporter les carcasses soi-même`. — Supprimer.
- `premier-detenteur/31-onboarding-incomplet-acces-restreint` › `PD sans coordonnées → ChasseurDeactivated affiché, pas d'accès aux fiches` — Redondant — même garde et mêmes assertions que `examinateur/10`. — Supprimer (ou paramétrer 10 sur les deux comptes).
- `premier-detenteur/34-fiche-svi-cloturee-lecture-seule` › `Fiche clôturée SVI — côté PD : lecture seule, décision visible` — Redondant — même seed, même fiche, mêmes assertions que `examinateur/15`. — Supprimer.
- `premier-detenteur/35-fiche-circuit-court-livree` › `Fiche circuit court livrée — côté PD : statut Clôturée` — Redondant — copie de `examinateur/16`. — Supprimer.
- `premier-detenteur/37-suppression-carcasse` › `Suppression carcasse non transmise — disparue après suppression` — Redondant — `36-refus-carcasse-avant-transmission` fait la même suppression et vérifie en plus le N-1 côté ETG. — Supprimer.
- `chains/114-chain-dispatch-hybride` › `Dispatch PD → ETG 1 + Collecteur Pro 1 puis chacun → SVI` — Redondant — s'arrête avant le SVI (titre trompeur) ; `premier-detenteur/28-dispatch-etg-collecteur` fait le même dispatch et vérifie les comptes de carcasses. — Supprimer, ou aller réellement jusqu'au SVI.

### Fragiles (7)

- `transverse/129-logout-redirects-and-clears-user` › `Déconnexion redirige vers /app/connexion et vide useUser` — Fragile — `waitForTimeout(5000)` ; le reste recouvre 107 (purge) et 109 (`localStorage` null). — Fusionner dans 107 et remplacer l'attente par une assertion `toHaveURL` sur l'écran de connexion après une action qui déclencherait un rebond.
- `transverse/137-account-lockout` › `Un autre compte reste accessible pendant le verrouillage` — Fragile — dépend de l'ordre (le verrouillage vient du 1er test, `beforeAll`) ; seul, c'est une simple connexion. — Fusionner dans `176` (se connecter avec un autre compte pendant le blocage).
- `transverse/137-account-lockout` › `L'email inexistant reste verrouillé aux tentatives suivantes` — Fragile — dépend du test précédent. — Fusionner avec `Un email inexistant est aussi verrouillé après 5 tentatives`.
- `examinateur/34-dernier-admin-association` › `Le dernier admin ne peut ni quitter l'association ni retirer ses droits tant qu'il reste des membres` — Fragile — repose sur des classes de style (`.bg-contrast-grey`) et les internes react-select (`.select-relation-status__*`) pour trouver les lignes. — Donner un rôle/label accessible aux lignes (`listitem` nommé par l'email) et l'utiliser.
- `chains/111-chain-circuit-long` › `Chain circuit long complet : PD → ETG → SVI` — Fragile — `setTimeout(500)` sans justification après « Prendre en charge ». — Remplacer par une attente sur le résultat (bouton « Prendre en charge » caché, comme dans 133).
- `chains/113-chain-avec-collecteur` › `Chain : PD → collecteur → ETG → SVI` — Fragile — même `setTimeout(500)` + regex lâche `/ETG 1.*notifié|fiche.*transmise/i`. — Idem 111 ; asserter « ETG 1 a été notifié ».
- `chains/116-chain-refus-partiel-svi` › `SVI rend des décisions divergentes → chasseur voit chaque décision` — Fragile — 1 attente de 500 ms + 6 de 1000 ms, `.check({ force: true })`, `nth(1)` / `option.first()`, et assertions finales lâches (`/accept/i`, `/consign/i` sur toute la page, côté SVI et non côté chasseur comme le titre l'annonce). — Remplacer les attentes par des assertions sur chaque carte (« Décision IPM1 : Acceptée / Mise en consigne », cf. 143) et vérifier côté chasseur.

### Remarques (tests classés Utiles mais à surveiller)

- `137-matomo-custom-dimensions` : 19 tests identiques sur des routes publiques ; peuvent être regroupés en une boucle dans un seul test sans perte de couverture.
- `examinateur/12-profil-examinateur` : `if (await saveBtn.count())` conditionnel ; le titre annonce « formation » qui n'est pas testée.
- `examinateur/15`, `16`, `17` : regex larges (`/accepté/i`, `/refusée|refusé|souillures/i`) ; à resserrer sur la carte concernée.
- `premier-detenteur/41-transmission-hors-ligne` : la 1re assertion (`/transmise|synchronisation|hors.?ligne/i`) passe dès le passage hors ligne ; la vraie vérification est côté ETG.
- `bac-a-sable/161` : `mode: 'serial'` assumé, les 5 tests dépendent de l'ordre (voulu).

## Audit e2e B — ETG, SVI, collecteur, dispatch-isolation, circuit court, laboratoire, fédération

Périmètre : 105 fichiers, 124 tests (`test(...)` + `test.skip`). Lecture du code de test uniquement (commentaires ignorés).

Vérifications faites dans le code applicatif pour trancher :

- Les routes de fiche intermédiaire sont `fei/:fei_numero/:premier_detenteur_prochain_detenteur_id_cache` (etg, collecteur, svi, circuit-court). Une URL `/app/<role>/fei/<numero>` **sans** 2e segment tombe sur la route `*` → 404 pour tout utilisateur, quels que soient ses droits.
- Le seed `SVI_CLOSED` ne crée que la fiche `…-205242` (intermédiaire : ETG 1 seulement). Ni `…-165242`, ni aucune fiche pour `collecteur-pro@`.
- Les routes circuit-court sont `onboarding/coordonnees|entreprise` et `profil/coordonnees|…` ; SVI : `profil/notifications`. `1-coordonnees`, `2-entreprise`, `mes-coordonnees`, `mes-notifications` n'existent pas.
- La modale carcasse ETG affiche en permanence le label « Motif de refus * ».

### Tableau récapitulatif

Totaux : **124 tests — 79 utiles, 25 tautologiques, 17 redondants, 3 fragiles.**

| Fichier                                                      |  Tests | Utiles | Tautologiques | Redondants | Fragiles |
| ------------------------------------------------------------ | -----: | -----: | ------------: | ---------: | -------: |
| **circuit-court/** (9 fichiers)                              | **10** |  **3** |         **4** |      **3** |    **0** |
| circuit-court/89-reception-directe-pd                        |      1 |      1 |             0 |          0 |        0 |
| circuit-court/91-liste-triable                               |      1 |      0 |             1 |          0 |        0 |
| circuit-court/92-onboarding-incomplet                        |      1 |      1 |             0 |          0 |        0 |
| circuit-court/93-onboarding-complet                          |      1 |      0 |             1 |          0 |        0 |
| circuit-court/94-profil                                      |      1 |      0 |             1 |          0 |        0 |
| circuit-court/95-fiche-recuperee-fin-de-chaine               |      1 |      0 |             0 |          1 |        0 |
| circuit-court/96-refus-carcasse                              |      1 |      0 |             0 |          1 |        0 |
| circuit-court/97-retransmission-interdite                    |      1 |      0 |             0 |          1 |        0 |
| circuit-court/98-readonly-enforcement                        |      2 |      1 |             1 |          0 |        0 |
| **collecteur/** (16 fichiers)                                | **16** | **10** |         **6** |      **0** |    **0** |
| collecteur/62-reception-fiche-depuis-pd                      |      1 |      0 |             1 |          0 |        0 |
| collecteur/63-transmission-a-etg                             |      1 |      1 |             0 |          0 |        0 |
| collecteur/64-vue-carcasses-agregee                          |      1 |      1 |             0 |          0 |        0 |
| collecteur/65-refus-carcasse-en-collecte                     |      1 |      1 |             0 |          0 |        0 |
| collecteur/66-onboarding-incomplet-acces-restreint           |      1 |      1 |             0 |          0 |        0 |
| collecteur/67-onboarding-complet                             |      1 |      0 |             1 |          0 |        0 |
| collecteur/68-profil                                         |      1 |      0 |             1 |          0 |        0 |
| collecteur/69-post-inspection-svi                            |      1 |      0 |             1 |          0 |        0 |
| collecteur/70-fiche-cloturee-lecture-seule                   |      1 |      0 |             1 |          0 |        0 |
| collecteur/71-pas-de-transmission-svi-directe                |      1 |      1 |             0 |          0 |        0 |
| collecteur/72-fiche-attribuee-autre-collecteur               |      1 |      0 |             1 |          0 |        0 |
| collecteur/73-hors-ligne-prise-en-charge                     |      1 |      1 |             0 |          0 |        0 |
| collecteur/74-refus-total-reste-editable                     |      1 |      1 |             0 |          0 |        0 |
| collecteur/163-collegue-voit-transmission                    |      1 |      1 |             0 |          0 |        0 |
| collecteur/171-collecteur-corrige-numero-marquage            |      1 |      1 |             0 |          0 |        0 |
| collecteur/177-collecteur-ajoute-carcasse-manquante          |      1 |      1 |             0 |          0 |        0 |
| **dispatch-isolation/** (14 fichiers)                        | **14** |  **7** |         **1** |      **5** |    **1** |
| dispatch-isolation/117-dispatch-2-etg-isolation-negative     |      1 |      1 |             0 |          0 |        0 |
| dispatch-isolation/118-dispatch-etg-plus-collecteur          |      1 |      0 |             0 |          1 |        0 |
| dispatch-isolation/119-dispatch-3-destinataires              |      1 |      1 |             0 |          0 |        0 |
| dispatch-isolation/120-vue-agregee-etg-carcasses             |      1 |      0 |             0 |          0 |        1 |
| dispatch-isolation/122-refus-etg1-ne-propage-pas             |      1 |      0 |             0 |          1 |        0 |
| dispatch-isolation/123-transmission-svi-n-expose-pas-etg2    |      1 |      0 |             0 |          1 |        0 |
| dispatch-isolation/124-deux-chaines-svi-paralleles           |      1 |      1 |             0 |          0 |        0 |
| dispatch-isolation/125-fiche-pd-2-groupes                    |      1 |      0 |             0 |          1 |        0 |
| dispatch-isolation/126-decisions-svi-divergentes-par-branche |      1 |      0 |             0 |          1 |        0 |
| dispatch-isolation/127-url-directe-carcasse-autre-branche    |      1 |      0 |             1 |          0 |        0 |
| dispatch-isolation/128-modification-api-cross-branche        |      1 |      1 |             0 |          0 |        0 |
| dispatch-isolation/129-dispatch-partial-refusal-isolation    |      1 |      1 |             0 |          0 |        0 |
| dispatch-isolation/130-etg-deux-transmissions-meme-examen    |      1 |      1 |             0 |          0 |        0 |
| dispatch-isolation/fiche_dispatch_multi_destinataires        |      1 |      1 |             0 |          0 |        0 |
| **etg/** (36 fichiers)                                       | **41** | **30** |         **8** |      **3** |    **0** |
| etg/45-reception-avec-stockage-ccg                           |      1 |      0 |             0 |          1 |        0 |
| etg/48-vue-carcasses-agregee                                 |      1 |      1 |             0 |          0 |        0 |
| etg/49-onboarding-incomplet-acces-restreint                  |      1 |      1 |             0 |          0 |        0 |
| etg/50-profil-entreprise                                     |      1 |      0 |             1 |          0 |        0 |
| etg/51-utilisateurs-entreprise                               |      1 |      0 |             1 |          0 |        0 |
| etg/52-roles-internes-transport-reception                    |      1 |      1 |             0 |          0 |        0 |
| etg/53-notifications                                         |      1 |      1 |             0 |          0 |        0 |
| etg/54-partage-de-mes-donnees                                |      2 |      2 |             0 |          0 |        0 |
| etg/55-post-inspection-svi-decision-visible                  |      1 |      0 |             1 |          0 |        0 |
| etg/56-fiche-cloturee-lecture-seule                          |      1 |      0 |             1 |          0 |        0 |
| etg/57-transmission-sans-prochain-detenteur                  |      1 |      0 |             0 |          1 |        0 |
| etg/58-acces-cross-etg-refuse                                |      1 |      0 |             1 |          0 |        0 |
| etg/59-double-prise-en-charge                                |      1 |      0 |             1 |          0 |        0 |
| etg/60-refus-sans-motif                                      |      1 |      0 |             1 |          0 |        0 |
| etg/61-transmission-hors-ligne                               |      1 |      1 |             0 |          0 |        0 |
| etg/62-modif-request-rename-approved                         |      1 |      1 |             0 |          0 |        0 |
| etg/63-modif-request-rename-rejected                         |      1 |      1 |             0 |          0 |        0 |
| etg/64-modif-request-new-carcasse                            |      1 |      1 |             0 |          0 |        0 |
| etg/65-modif-request-cancel                                  |      1 |      1 |             0 |          0 |        0 |
| etg/66-modif-request-new-carcasse-after-svi-transmit         |      1 |      1 |             0 |          0 |        0 |
| etg/67-modif-request-new-carcasse-before-svi-transmit        |      1 |      0 |             1 |          0 |        0 |
| etg/68-refus-total-reste-editable                            |      1 |      1 |             0 |          0 |        0 |
| etg/69-numero-bon-reception                                  |      1 |      1 |             0 |          0 |        0 |
| etg/70-parametres-numero-bon-reception                       |      1 |      1 |             0 |          0 |        0 |
| etg/71-renvoi-a-l-expediteur                                 |      1 |      1 |             0 |          0 |        0 |
| etg/72-transport-uniquement-transmission                     |      2 |      2 |             0 |          0 |        0 |
| etg/141-export-excel-animaux-acceptes                        |      1 |      1 |             0 |          0 |        0 |
| etg/156-filtres-rapides-fiches                               |      1 |      1 |             0 |          0 |        0 |
| etg/162-filtre-enregistre-inconnu                            |      1 |      1 |             0 |          0 |        0 |
| etg/164-collegue-voit-transmission-collecteur                |      1 |      1 |             0 |          0 |        0 |
| etg/165-ajout-carcasse-fiche-hors-ligne                      |      1 |      1 |             0 |          0 |        0 |
| etg/166-tableau-de-bord-petit-gibier-en-animaux              |      1 |      1 |             0 |          0 |        0 |
| etg/171-renvoi-autre-appareil                                |      1 |      1 |             0 |          0 |        0 |
| etg/172-qui-dans-l-etg-a-pris-en-charge                      |      1 |      1 |             0 |          0 |        0 |
| etg/fiche_circuit-long_simple_etg                            |      3 |      2 |             0 |          1 |        0 |
| etg/premier-detenteur-info                                   |      2 |      2 |             0 |          0 |        0 |
| **federation/** (5 fichiers)                                 |  **8** |  **5** |         **0** |      **2** |    **1** |
| federation/01-tableau-de-bord-national                       |      1 |      0 |             0 |          1 |        0 |
| federation/02-tableau-de-bord-departemental                  |      1 |      0 |             0 |          1 |        0 |
| federation/03-stats-chiffrees-hors-comptes-admin             |      3 |      3 |             0 |          0 |        0 |
| federation/04-invitation-federation                          |      2 |      1 |             0 |          0 |        1 |
| federation/05-stats-circuit-non-agree                        |      1 |      1 |             0 |          0 |        0 |
| **laboratoire/** (5 fichiers)                                |  **9** |  **8** |         **1** |      **0** |    **0** |
| laboratoire/159-import-resultats-trichine                    |      4 |      3 |             1 |          0 |        0 |
| laboratoire/160-ftp-confirmation-lnr                         |      2 |      2 |             0 |          0 |        0 |
| laboratoire/161-retrait-echantillon-pool                     |      1 |      1 |             0 |          0 |        0 |
| laboratoire/165-document-echantillon                         |      1 |      1 |             0 |          0 |        0 |
| laboratoire/166-pool-rapport-et-reference                    |      1 |      1 |             0 |          0 |        0 |
| **svi/** (20 fichiers)                                       | **26** | **16** |         **5** |      **4** |    **1** |
| svi/74-inspection-acceptee                                   |      1 |      0 |             0 |          1 |        0 |
| svi/75-inspection-refusee                                    |      1 |      0 |             0 |          1 |        0 |
| svi/76-inspection-consignee                                  |      1 |      1 |             0 |          0 |        0 |
| svi/77-traitement-assainissant                               |      1 |      0 |             0 |          0 |        1 |
| svi/78-cloture-automatique-j10                               |      1 |      0 |             1 |          0 |        0 |
| svi/79-modif-request-does-not-block-svi-inspection           |      1 |      1 |             0 |          0 |        0 |
| svi/79-vue-fiches                                            |      1 |      1 |             0 |          0 |        0 |
| svi/80-vue-carcasses                                         |      1 |      1 |             0 |          0 |        0 |
| svi/81-onboarding-incomplet                                  |      1 |      1 |             0 |          0 |        0 |
| svi/82-profil                                                |      1 |      0 |             1 |          0 |        0 |
| svi/83-fiche-cloturee-consultation                           |      1 |      1 |             0 |          0 |        0 |
| svi/84-revision-decision                                     |      1 |      0 |             1 |          0 |        0 |
| svi/85-refus-sans-motif                                      |      1 |      0 |             0 |          1 |        0 |
| svi/86-carcasse-manquante                                    |      1 |      0 |             1 |          0 |        0 |
| svi/87-fiche-sans-carcasse-a-inspecter                       |      1 |      1 |             0 |          0 |        0 |
| svi/88-svi-autre-departement                                 |      1 |      0 |             1 |          0 |        0 |
| svi/89-acceptee-carcasses-restent-visibles                   |      1 |      1 |             0 |          0 |        0 |
| svi/90-acceptation-un-clic                                   |      3 |      2 |             0 |          1 |        0 |
| svi/91-bilan-saison-export                                   |      1 |      1 |             0 |          0 |        0 |
| svi/141-certificats-perimetre-svi                            |      5 |      5 |             0 |          0 |        0 |

### Tests non utiles

### circuit-court/

- `circuit-court/91-liste-triable.spec.ts` › `91 - Liste /app/circuit-court triable par statut` — **Tautologique** — clique un bouton « Filtrer par statut » seulement s'il existe, puis re-vérifie le lien déjà vérifié avant. Aucun tri n'est testé. — **Supprimer** (ou réécrire avec 2 fiches de statuts différents et asserter l'ordre/le filtrage).
- `circuit-court/93-onboarding-complet.spec.ts` › `93 - Onboarding complet circuit-court …` — **Tautologique** — fait `goto` vers `onboarding/1-coordonnees` et `2-entreprise` (routes inexistantes : les vraies sont `coordonnees` / `entreprise`), remplit sous `if (isVisible)`, puis asserte l'URL qu'il vient de taper. — **Supprimer** (ou réécrire : remplir le vrai formulaire, cliquer « Continuer », asserter l'arrivée sur la liste).
- `circuit-court/94-profil.spec.ts` › `94 - Profil circuit court …` — **Tautologique** — après chaque `goto` asserte l'URL tapée ; la dernière route `profil/mes-coordonnees` n'existe pas (404) et le test passe quand même. Seules valeurs : nom d'entité et email seedés. — **Renforcer** : utiliser `profil/coordonnees` et asserter un champ du formulaire ; retirer les `toHaveURL` après `goto`.
- `circuit-court/95-fiche-recuperee-fin-de-chaine.spec.ts` › `95 - Fiche circuit court = fin de chaîne …` — **Redondant** — mêmes 2 assertions négatives que 97 et que `98 › UI : aucune affordance d'édition…`, qui en contient 3 de plus. — **Supprimer** (98 couvre).
- `circuit-court/96-refus-carcasse.spec.ts` › `96 - Refuser une carcasse côté circuit court …` — **Redondant** — clic conditionnel + `console.log` ; l'assertion « 0 bouton Refuser » est déjà dans 98 UI. — **Supprimer**.
- `circuit-court/97-retransmission-interdite.spec.ts` › `97 - Circuit court : re-transmission … interdite` — **Redondant** — copie exacte de 95 (mêmes 2 assertions, ordre inversé). — **Supprimer** (98 couvre).
- `circuit-court/98-readonly-enforcement.spec.ts` › `API : POST /sync depuis un CC ne doit pas modifier la carcasse` — **Tautologique** — `test.skip` : ne tourne jamais. De plus `status < 500` et l'absence d'un texte après reload ne prouvent rien (le commentaire n'est pas affiché côté CC). — **Réactiver** avec une relecture via `GET /carcasse` (comme `dispatch-isolation/128`) et l'assertion `rejected`, **ou supprimer**. Note : le test UI de ce fichier (Utile) gagnerait une assertion positive (heading « Fiche … » visible) avant les `toHaveCount(0)`.

### collecteur/

- `collecteur/62-reception-fiche-depuis-pd.spec.ts` › `Collecteur reçoit la fiche du PD et peut la prendre en charge` — **Tautologique** — l'assertion finale `.or(getByText(/Prise en charge|contrôle/i)).first()` matche le libellé du bouton « Je contrôle et transporte… » lui-même : elle passe même si le clic n'a aucun effet. — **Supprimer** (63, 73 et 163 couvrent la prise en charge) ou asserter un état post-prise en charge précis (« Sélection du prochain destinataire »).
- `collecteur/67-onboarding-complet.spec.ts` › `Parcours onboarding collecteur : coordonnees → entreprise` — **Tautologique** — remplit toutes les textbox avec « Test », clique sous `if`, puis asserte `/\/app\/collecteur/`, déjà vrai sur l'URL d'onboarding. — **Supprimer** ou réécrire avec des champs nommés et une assertion de sortie d'onboarding (`not.toHaveURL(/onboarding/)`).
- `collecteur/68-profil.spec.ts` › `Pages profil collecteur accessibles et persistées` — **Tautologique** — 4 `goto` suivis de `toHaveURL` sur la même URL ; une seule assertion de contenu (email seedé). Rien n'est « persisté ». — **Supprimer** ou renforcer (modifier un réglage, reload, asserter la valeur, comme `etg/53`).
- `collecteur/69-post-inspection-svi.spec.ts` › `Collecteur voit la décision SVI` — **Tautologique** — tout est sous `if (isVisible)` ; le seed `SVI_CLOSED` n'a aucune fiche pour le collecteur : **aucune assertion n'est exécutée**. — **Supprimer** (ou créer un seed avec collecteur dans la chaîne et asserter sans `if`).
- `collecteur/70-fiche-cloturee-lecture-seule.spec.ts` › `Collecteur ne peut plus agir sur une fiche clôturée` — **Tautologique** — même problème que 69 : branche `if` jamais prise, 0 assertion exécutée. — **Supprimer** (ou seed adapté + assertions inconditionnelles).
- `collecteur/72-fiche-attribuee-autre-collecteur.spec.ts` › `Collecteur ne peut pas accéder à une fiche non attribuée` — **Tautologique** — `goto /app/collecteur/fei/<numero>` sans 2e segment = route inexistante → 404 pour tout le monde ; la regex `/Erreur|introuvable|…/` passe donc toujours. — **Renforcer** : utiliser l'URL réelle `fei/<numero>/<id_dispatch>` et asserter le message d'accès refusé.

### dispatch-isolation/

- `dispatch-isolation/118-dispatch-etg-plus-collecteur.spec.ts` › `ETG et collecteur ne voient que leur branche` — **Redondant** — partie ETG 1 identique à 117 ; partie collecteur = seulement « Carcasses (2) », déjà couvert avec les bracelets par 130. — **Supprimer** (ou fusionner l'assertion collecteur dans 130).
- `dispatch-isolation/120-vue-agregee-etg-carcasses.spec.ts` › `/etg/carcasses ne montre que les carcasses dispatchées à cet ETG` — **Fragile** — assertion finale `getByText('2 carcasses').nth(0)` : positionnelle, et le texte peut venir d'un autre bloc (compteur, filtre). Ne prouve pas l'isolation. La partie PD duplique `fiche_dispatch_multi_destinataires`. — **Renforcer** : sur `/app/etg/carcasses`, asserter MM-001-003/004 visibles et MM-001-001/002 absents ; retirer la partie PD.
- `dispatch-isolation/122-refus-etg1-ne-propage-pas.spec.ts` › `Refus ETG 1 n'affecte pas la visibilité côté ETG 2` — **Redondant** — ETG 1 prend en charge **sans rien refuser** ; la partie ETG 2 est identique à 117. Le vrai cas « refus ETG 1 » est testé par 129. — **Supprimer**.
- `dispatch-isolation/123-transmission-svi-n-expose-pas-etg2.spec.ts` › `SVI destinataire d'ETG 1 ne voit que les 2 carcasses d'ETG 1` — **Redondant** — 124 rejoue exactement les mêmes étapes (PD → ETG 1 → SVI 1) et les mêmes 4 assertions, puis ajoute la branche SVI 2. — **Supprimer** (124 couvre).
- `dispatch-isolation/125-fiche-pd-2-groupes.spec.ts` › `PD voit la fiche avec les 2 groupes …` — **Redondant** — les 2 assertions post-transmission sont déjà dans `fiche_dispatch_multi_destinataires` et dans 126. — **Supprimer**.
- `dispatch-isolation/126-decisions-svi-divergentes-par-branche.spec.ts` › `Décisions SVI divergentes bien rattachées …` — **Redondant** — copie de 125 ; aucune décision SVI n'est prise ni vérifiée malgré le titre. — **Supprimer**, ou l'écrire vraiment (SVI 1 accepte, SVI 2 saisit, le PD voit chaque décision sur la bonne branche).
- `dispatch-isolation/127-url-directe-carcasse-autre-branche.spec.ts` › `ETG 1 ne peut pas accéder à la carcasse d'ETG 2 via URL directe` — **Tautologique** — uniquement des assertions négatives après `waitForLoadState('networkidle').catch(() => {})` : passe aussi si la page est blanche ou plante. — **Renforcer** : asserter le message d'erreur/404 attendu (contrôle positif), ou s'appuyer sur le contrôle API de 128.

### etg/

- `etg/45-reception-avec-stockage-ccg.spec.ts` › `Réception ETG avec stockage puis transmission SVI` — **Redondant** — la boucle d'acceptation est un no-op (`panel` inutilisé, clic sous `if`, `Escape`) ; aucun stockage CCG n'est choisi. Seule assertion : « SVI 1 a été notifié », déjà dans `fiche_circuit-long › Pas de stockage - J'envoie au SVI`, 61, 69. — **Supprimer** (ou écrire un vrai test de stockage CCG).
- `etg/50-profil-entreprise.spec.ts` › `ETG édite les informations entreprise et les voit persistées` — **Tautologique** — saisie et assertion toutes deux sous `if (isVisible)` : si le champ n'est pas trouvé, 0 assertion. — **Renforcer** : retirer les `if`, sélecteur `getByLabel` exact.
- `etg/51-utilisateurs-entreprise.spec.ts` › `ETG voit la liste des utilisateurs de son entreprise` — **Tautologique** — ouvre une modale, asserte qu'elle est visible, la ferme ; aucun utilisateur n'est vérifié. — **Renforcer** : asserter `etg-1@` et `etg-1-bis@` dans la modale.
- `etg/55-post-inspection-svi-decision-visible.spec.ts` › `ETG voit la décision SVI après clôture` — **Tautologique** — `getByText(/accept/i).first()` matche « Acceptée par ETG 1 » ou tout bouton « Accepter », indépendamment de la décision SVI. — **Renforcer** : asserter le libellé de décision SVI précis (« Décision IPM1 : Acceptée » ou équivalent ETG).
- `etg/56-fiche-cloturee-lecture-seule.spec.ts` › `ETG ne peut plus agir sur une fiche clôturée` — **Tautologique** — double défaut : la fiche `…-165242` n'existe pas dans le seed `SVI_CLOSED` (la fiche clôturée est `…-205242`), et l'URL sans 2e segment est une 404. Les `toHaveCount(0)` passent toujours. — **Supprimer** ou réécrire (fiche 205242 via clic sur le lien, assertion positive puis absence des boutons).
- `etg/57-transmission-sans-prochain-detenteur.spec.ts` › `Erreur 'Il manque le prochain détenteur' si aucun choisi` — **Redondant** — même étape et même assertion (« Il manque le prochain dé ») dans les 3 tests de `fiche_circuit-long_simple_etg` et dans 164. N'essaie même pas de transmettre. — **Supprimer** (ou renforcer : cliquer « Transmettre » et asserter qu'aucune notification n'apparaît).
- `etg/58-acces-cross-etg-refuse.spec.ts` › `ETG 2 ne peut pas accéder à la fiche de l'ETG 1` — **Tautologique** — même 404 de route que collecteur/72 : la regex d'erreur passe pour n'importe quel ETG, même l'ETG 1. Seule assertion utile : le lien absent de la liste. — **Renforcer** : URL complète `fei/<numero>/<id_dispatch>` + message d'accès refusé.
- `etg/59-double-prise-en-charge.spec.ts` › `Double clic Prendre en charge ne duplique pas` — **Tautologique** — un doublon se produirait côté données (2 `CarcasseIntermediaire`), pas comme 2 textes « Prise en charge par l'atelier » dans l'UI. — **Renforcer** : reload puis contrôler la traçabilité, ou interroger l'API (`GET /carcasse`) pour compter les intermédiaires.
- `etg/60-refus-sans-motif.spec.ts` › `Refus sans motif ne s'enregistre pas` — **Tautologique** — branches conditionnelles ; dans la branche « bouton actif », la regex `/motif|obligatoire|requis/i` matche le label permanent « Motif de refus * ». Passe toujours. — **Renforcer** : asserter que le bouton est désactivé ou que la carte n'affiche pas « Refusée par ETG 1 » après tentative.
- `etg/67-modif-request-new-carcasse-before-svi-transmit.spec.ts` › `Ajout carcasse manquante pré-transmission SVI …` — **Tautologique** — titre copié de 66 (faux) ; seule assertion : un bouton `not.toBeVisible()`, sans vérifier que la fiche est chargée. — **Renforcer** : asserter d'abord une carcasse visible, renommer selon la règle réelle (« pas d'ajout quand le SVI a la main »).
- `etg/fiche_circuit-long_simple_etg.spec.ts` › `Pas de stockage - Je transfère à un autre collecteur` — **Redondant** — ~60 lignes identiques au test 1 (inspection, refus, manquante, mêmes snapshots) ; la partie propre (transmission à Collecteur Pro 2 + « Attribution effectuée ») est déjà dans `etg/164`. — **Supprimer** ; pour le test 3 (transfert ETG 2, Utile car vérifie la vue ETG 2), partir d'un seed `ETG_TAKEN_CHARGE` plutôt que rejouer l'inspection, et supprimer le bloc commenté.

### federation/

- `federation/01-tableau-de-bord-national.spec.ts` › `FNC — tableau de bord national affiche toutes les sections` — **Redondant** — `03 › FNC — chiffres nationaux…` fait le même login et vérifie heading, saison, sections et filtre, avec les valeurs chiffrées. Seuls « Circuits de valorisation / grand / petit gibier » manquent dans 03. — **Fusionner** ces 3 assertions dans 03, puis supprimer 01.
- `federation/02-tableau-de-bord-departemental.spec.ts` › `FDC — tableau de bord départemental …` — **Redondant** — `03 › FDC — chiffres limités…` couvre heading FDC Allier + absence de « Détail par département » avec les chiffres. — **Fusionner** les headings de section dans 03, supprimer 02.
- `federation/04-invitation-federation.spec.ts` › `Chasseur non membre d'une fédération : aucune fédération affichée` — **Fragile** — repose sur l'id CSS `#federation-title` (`toHaveCount(0)`) : un renommage d'id fait passer le test à tort. — **Renforcer** : asserter un texte d'état vide visible (ex. « Vous n'êtes membre d'aucune fédération ») ou l'absence d'un heading par rôle.

### laboratoire/

- `laboratoire/159-import-resultats-trichine.spec.ts` › `La page de format décrit le fichier attendu` — **Tautologique** — vérifie le contenu statique d'une page de documentation après y avoir navigué. — **Supprimer** ou garder comme smoke très léger (seul le `href` du modèle CSV a un peu de valeur).

### svi/

- `svi/74-inspection-acceptee.spec.ts` › `74 - SVI inspection : carcasse acceptée (IPM1 ACCEPTE)` — **Redondant** — même saisie (fieldset « Décision IPM1 » → Acceptée → Enregistrer) que 89, qui asserte mieux (sync + reconnexion). L'assertion finale `/accepté/i .first()` est en plus trop large. — **Supprimer** (89 et 90 couvrent).
- `svi/75-inspection-refusee.spec.ts` › `75 - SVI inspection : carcasse refusée (saisie totale via IPM2)` — **Redondant** — étapes identiques au début de 77, qui va plus loin (choix IPM2 + options). La saisie totale n'est jamais enregistrée malgré le titre. — **Fusionner** dans 77 (ou aller au bout : sélectionner « Saisie totale », enregistrer, asserter la décision).
- `svi/77-traitement-assainissant.spec.ts` › `77 - SVI inspection : traitement assainissant (IPM2)` — **Fragile** — `.input-for-search-prefilled-data__input-container` `.first()` / `.nth(1)` + `getByRole('option').first()` (positionnels), `locator('label.fr-label:has-text(…)')` alors que `getByLabel('Traitement assainissant')` existe. — **Renforcer** : sélecteurs par label/nom d'option ; enregistrer IPM2 et asserter la décision.
- `svi/78-cloture-automatique-j10.spec.ts` › `78 - Clôture (seed SVI_CLOSED) visible côté SVI` — **Tautologique** — la regex `/Date de fin d'inspection|Clôturer la fiche/` passe que la fiche soit clôturée **ou non** ; la clôture J+10 n'est pas testée (c'est un cron). 83 couvre l'état clôturé. — **Supprimer** (clôture auto → vitest sur le cron).
- `svi/82-profil.spec.ts` › `82 - Profil SVI : entreprise, utilisateurs, notifications accessibles` — **Tautologique** — `toHaveURL` après chaque `goto` ; la dernière route `profil/mes-notifications` n'existe pas (404) et le test passe. — **Supprimer** ou renforcer comme `etg/53` (toggle + reload).
- `svi/84-revision-decision.spec.ts` › `84 - Révision d'une décision SVI : lecture seule sur fiche clôturée` — **Tautologique** — corps sous `if (count())`, bloc `if (saveBtn.count()) {}` vide ; seule assertion : « Inspection Post-Mortem » visible. Rien ne vérifie la lecture seule. — **Supprimer** ou asserter `getByRole('button', { name: 'Enregistrer' })` `toHaveCount(0)` sans `if`.
- `svi/85-refus-sans-motif.spec.ts` › `85 - SVI tente d'enregistrer IPM1 MISE_EN_CONSIGNE sans motif/lésions` — **Redondant** — même chemin et même message d'erreur que 76 (76 remplit en plus la durée). — **Fusionner** dans 76 (asserter « Il manque la durée » avant de la remplir), supprimer 85.
- `svi/86-carcasse-manquante.spec.ts` › `86 - Option 'Non, carcasse manquante' disponible dans IPM1` — **Tautologique** — après enregistrement, n'asserte que l'**absence** de messages d'erreur ; passe si rien n'est enregistré. — **Renforcer** : asserter la décision affichée (carte « manquante ») après retour sur la fiche ou reconnexion.
- `svi/88-svi-autre-departement.spec.ts` › `88 - SVI d'un autre département peut voir une fiche hors périmètre (by design)` — **Tautologique** — URL avec 2e segment bidon `no-transmission` : la 404 vient de l'id de dispatch inexistant, pas du périmètre ; le titre dit l'inverse de l'assertion. — **Supprimer** ou réécrire avec le vrai id de dispatch (le contrôle d'accès réel est déjà couvert par l'API dans `svi/141`).
- `svi/90-acceptation-un-clic.spec.ts` › `90 - SVI : accepter en un clic prend la responsabilité de la transmission` — **Redondant** — assertions identiques au test 1 du même fichier (décision persistée après reconnexion, autre carcasse encore « Accepter ») ; le chemin ETG → SVI est celui de 89. Rien ne vérifie la « prise de responsabilité ». — **Renforcer** (asserter le responsable SVI dans « Données de traçabilité ») **ou supprimer**.

### Les 5 suppressions les plus nettes

1. `collecteur/69-post-inspection-svi` — 0 assertion exécutée (seed sans fiche collecteur, tout sous `if`).
2. `collecteur/70-fiche-cloturee-lecture-seule` — même cause, 0 assertion exécutée.
3. `etg/56-fiche-cloturee-lecture-seule` — fiche absente du seed + route 404 : les `toHaveCount(0)` passent toujours.
4. `svi/84-revision-decision` — `if` + bloc vide, aucune vérification de lecture seule.
5. `circuit-court/93-onboarding-complet` — routes inexistantes, n'asserte que l'URL qu'il tape.

À traiter juste après : `etg/58` et `collecteur/72` (404 de route quel que soit l'utilisateur : garder l'intention, corriger l'URL), `dispatch-isolation/122` et `126` (titres non tenus, doublons de 117 / 125).

## Audit des tests vitest (api-express + app-local-first-react-router)

Classement : **Utile** / **Tautologique** / **Redondant** / **Fragile**. `history-tables.test.ts` et `swagger-validation.test.ts` jugés comme garde-fous structurels.

### Synthèse

| Fichier                                                                            | Nb tests | Utiles   | Tautologiques | Redondants | Fragiles |
| ---------------------------------------------------------------------------------- | -------- | -------- | ------------- | ---------- | -------- |
| `api-express/src/__tests__/admin-audit-log.test.ts`                                | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/admin-fei-corrections.test.ts`                          | 14       | 13       | 0             | 1          | 0        |
| `api-express/src/__tests__/admin-history.test.ts`                                  | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/admin-inbox.db.test.ts`                                 | 5        | 4        | 1             | 0          | 0        |
| `api-express/src/__tests__/admin-inbox.test.ts`                                    | 3        | 2        | 0             | 1          | 0        |
| `api-express/src/__tests__/admin-lockout.test.ts`                                  | 8        | 8        | 0             | 0          | 0        |
| `api-express/src/__tests__/admin-stats-ref.test.ts`                                | 11       | 11       | 0             | 0          | 0        |
| `api-express/src/__tests__/admin-trichine-route.test.ts`                           | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/admin-user-entity.test.ts`                              | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/admin-user-invitation.test.ts`                          | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/albert.test.ts`                                         | 2        | 2        | 0             | 0          | 0        |
| `api-express/src/__tests__/auth-ip-rate-limit.test.ts`                             | 4        | 3        | 1             | 0          | 0        |
| `api-express/src/__tests__/bilan-anomalies.test.ts`                                | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/brevo-chasseur-deal-name.test.ts`                       | 3        | 3        | 0             | 0          | 0        |
| `api-express/src/__tests__/bug-investigator.test.ts`                               | 13       | 13       | 0             | 0          | 0        |
| `api-express/src/__tests__/carcasse-count-route.test.ts`                           | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/carcasse-fiches-sans-carcasse.test.ts`                  | 3        | 3        | 0             | 0          | 0        |
| `api-express/src/__tests__/carcasse-full-reload.test.ts`                           | 7        | 7        | 0             | 0          | 0        |
| `api-express/src/__tests__/carcasse-refusees-route.test.ts`                        | 10       | 10       | 0             | 0          | 0        |
| `api-express/src/__tests__/carcasse-scope.db.test.ts`                              | 4        | 4        | 0             | 0          | 0        |
| `api-express/src/__tests__/carcasse-side-effects.test.ts`                          | 47       | 47       | 0             | 0          | 0        |
| `api-express/src/__tests__/carcasses-reload.test.ts`                               | 1        | 0        | 1             | 0          | 0        |
| `api-express/src/__tests__/cellar.test.ts`                                         | 2        | 2        | 0             | 0          | 0        |
| `api-express/src/__tests__/classify-destinataire.test.ts`                          | 4        | 4        | 0             | 0          | 0        |
| `api-express/src/__tests__/contact-route.test.ts`                                  | 4        | 4        | 0             | 0          | 0        |
| `api-express/src/__tests__/create-destinataire.test.ts`                            | 13       | 12       | 0             | 1          | 0        |
| `api-express/src/__tests__/cronjob-feis.test.ts`                                   | 11       | 11       | 0             | 0          | 0        |
| `api-express/src/__tests__/disease-suspicions.test.ts`                             | 14       | 14       | 0             | 0          | 0        |
| `api-express/src/__tests__/e2e-routes.test.ts`                                     | 4        | 3        | 0             | 0          | 1        |
| `api-express/src/__tests__/entite-ccg-numero-existant.test.ts`                     | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/entite-partenaires.test.ts`                             | 13       | 12       | 0             | 1          | 0        |
| `api-express/src/__tests__/entite-working-for.test.ts`                             | 7        | 7        | 0             | 0          | 0        |
| `api-express/src/__tests__/error-handler-sentry.test.ts`                           | 3        | 3        | 0             | 0          | 0        |
| `api-express/src/__tests__/expo-push.test.ts`                                      | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/federation-access.test.ts`                              | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/federation-valorisation.test.ts`                        | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/fei-side-effects.test.ts`                               | 8        | 7        | 0             | 1          | 0        |
| `api-express/src/__tests__/fei-url.test.ts`                                        | 5        | 4        | 0             | 1          | 0        |
| `api-express/src/__tests__/fiche-pdf-certification.test.ts`                        | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/history-tables.test.ts`                                 | 2        | 2        | 0             | 0          | 0        |
| `api-express/src/__tests__/laboratoire-depot-route.test.ts`                        | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/laboratoire-lnr-guard.test.ts`                          | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/laboratoire-results-alias.test.ts`                      | 7        | 7        | 0             | 0          | 0        |
| `api-express/src/__tests__/laboratoire-retrait-echantillon.test.ts`                | 13       | 13       | 0             | 0          | 0        |
| `api-express/src/__tests__/lims-parse.test.ts`                                     | 20       | 20       | 0             | 0          | 0        |
| `api-express/src/__tests__/login-lockout.db.test.ts`                               | 4        | 4        | 0             | 0          | 0        |
| `api-express/src/__tests__/matomo-stats.test.ts`                                   | 16       | 16       | 0             | 0          | 0        |
| `api-express/src/__tests__/notifications.test.ts`                                  | 18       | 17       | 0             | 1          | 0        |
| `api-express/src/__tests__/permissions-carcasse-ownership.test.ts`                 | 21       | 20       | 0             | 1          | 0        |
| `api-express/src/__tests__/permissions-sync-write.test.ts`                         | 34       | 34       | 0             | 0          | 0        |
| `api-express/src/__tests__/redact-personal-data.test.ts`                           | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/scrub-sensitive.test.ts`                                | 7        | 7        | 0             | 0          | 0        |
| `api-express/src/__tests__/send-webhook.test.ts`                                   | 2        | 2        | 0             | 0          | 0        |
| `api-express/src/__tests__/sentry-transaction-scrub.test.ts`                       | 1        | 1        | 0             | 0          | 0        |
| `api-express/src/__tests__/session-cookie.test.ts`                                 | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/session-password-change.test.ts`                        | 9        | 9        | 0             | 0          | 0        |
| `api-express/src/__tests__/soft-delete-cascade-e2e.test.ts`                        | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/sort-entities-by-type-and-id.test.ts`                   | 8        | 7        | 0             | 1          | 0        |
| `api-express/src/__tests__/stats-federation-formation.test.ts`                     | 2        | 2        | 0             | 0          | 0        |
| `api-express/src/__tests__/swagger-validation.test.ts`                             | 42       | 34       | 7             | 1          | 0        |
| `api-express/src/__tests__/sync-carcasse-intermediaire.test.ts`                    | 16       | 16       | 0             | 0          | 0        |
| `api-express/src/__tests__/sync-carcasse-modification-request.test.ts`             | 36       | 36       | 0             | 0          | 0        |
| `api-express/src/__tests__/sync-carcasse.test.ts`                                  | 54       | 54       | 0             | 0          | 0        |
| `api-express/src/__tests__/sync-deleted-entity.test.ts`                            | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/sync-fei.test.ts`                                       | 22       | 21       | 1             | 0          | 0        |
| `api-express/src/__tests__/sync-route-carcasse-primary.test.ts`                    | 9        | 6        | 0             | 3          | 0        |
| `api-express/src/__tests__/sync-route-roundtrip.test.ts`                           | 2        | 2        | 0             | 0          | 0        |
| `api-express/src/__tests__/sync-route.test.ts`                                     | 33       | 33       | 0             | 0          | 0        |
| `api-express/src/__tests__/sync-version.test.ts`                                   | 7        | 7        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-alias-route.test.ts`                           | 19       | 19       | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-document-upload.test.ts`                       | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-echantillon-document-route.test.ts`            | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-echantillons-bulk-route.test.ts`               | 13       | 12       | 1             | 0          | 0        |
| `api-express/src/__tests__/trichine-email.test.ts`                                 | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-feature-flag.test.ts`                          | 1        | 1        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-ftp-pdf.test.tsx`                              | 11       | 10       | 0             | 1          | 0        |
| `api-express/src/__tests__/trichine-ftp-photo-route.test.ts`                       | 4        | 4        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-pool-document-route.test.ts`                   | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-result-alias.test.ts`                          | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-result-envoi-lnr.test.ts`                      | 4        | 4        | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-status.test.ts`                                | 61       | 61       | 0             | 0          | 0        |
| `api-express/src/__tests__/trichine-svi-guards.test.ts`                            | 6        | 6        | 0             | 0          | 0        |
| `api-express/src/__tests__/user-email-change.test.ts`                              | 3        | 3        | 0             | 0          | 0        |
| `api-express/src/__tests__/user-entity.test.ts`                                    | 40       | 36       | 1             | 2          | 1        |
| `api-express/src/__tests__/user-invitation-token.test.ts`                          | 9        | 9        | 0             | 0          | 0        |
| `api-express/src/__tests__/user-invite.test.ts`                                    | 11       | 11       | 0             | 0          | 0        |
| `api-express/src/__tests__/user-numero-cfei.test.ts`                               | 4        | 4        | 0             | 0          | 0        |
| `api-express/src/__tests__/user-onboarding-finished.test.ts`                       | 4        | 4        | 0             | 0          | 0        |
| `api-express/src/__tests__/user-trouver-premier-detenteur.test.ts`                 | 5        | 5        | 0             | 0          | 0        |
| `api-express/src/__tests__/v1-fei-carcasses-perimetre.test.ts`                     | 4        | 4        | 0             | 0          | 0        |
| `app-local-first-react-router/__tests__/create-new-carcasse.test.ts`               | 5        | 5        | 0             | 0          | 0        |
| `app-local-first-react-router/__tests__/trichine-prelevabilite.test.ts`            | 9        | 9        | 0             | 0          | 0        |
| `app-local-first-react-router/__tests__/trichine-repartition.test.ts`              | 20       | 20       | 0             | 0          | 0        |
| `app-local-first-react-router/__tests__/trichine.test.ts`                          | 25       | 25       | 0             | 0          | 0        |
| `app-local-first-react-router/__tests__/update-carcasse-status.test.ts`            | 48       | 44       | 0             | 4          | 0        |
| `app-local-first-react-router/__tests__/update-fei-scoping.test.ts`                | 5        | 4        | 0             | 1          | 0        |
| `app-local-first-react-router/src/components/Modal.test.ts`                        | 6        | 5        | 1             | 0          | 0        |
| `app-local-first-react-router/src/routes/routes-have-a-title.test.ts`              | 2        | 2        | 0             | 0          | 0        |
| `app-local-first-react-router/src/services/api.test.ts`                            | 3        | 3        | 0             | 0          | 0        |
| `app-local-first-react-router/src/services/matomo.test.ts`                         | 10       | 10       | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils-offline/get-most-fresh-user.test.ts`       | 3        | 3        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils-offline/use-is-offline.test.ts`            | 5        | 5        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/anomalies-referentiel.test.ts`             | 4        | 4        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/carcasse-deja-envoyee.test.ts`             | 18       | 17       | 0             | 1          | 0        |
| `app-local-first-react-router/src/utils/dates-to-iso.test.ts`                      | 5        | 5        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/delta-margin.test.ts`                      | 7        | 7        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/etablissementsTraitementSaintaire.test.ts` | 8        | 7        | 0             | 1          | 0        |
| `app-local-first-react-router/src/utils/export-trichine.test.ts`                   | 2        | 2        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/get-carcasse-card-display.test.ts`         | 12       | 11       | 0             | 1          | 0        |
| `app-local-first-react-router/src/utils/get-carcasses-intermediaires.test.ts`      | 3        | 3        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/get-carcasses-transmission.test.ts`        | 13       | 13       | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/get-latest-svi-dates.test.ts`              | 4        | 4        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/get-transmissions-sorted.test.ts`          | 56       | 55       | 0             | 1          | 0        |
| `app-local-first-react-router/src/utils/has-unsynced-data.test.ts`                 | 7        | 7        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/is-carcasse-done.test.ts`                  | 29       | 28       | 0             | 1          | 0        |
| `app-local-first-react-router/src/utils/is-fei-excluded-by-quick-filters.test.ts`  | 8        | 8        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/load-carcasses.test.ts`                    | 14       | 14       | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/merge-fetched-items.test.ts`               | 6        | 6        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/merge-user-partenaire.test.ts`             | 2        | 2        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/numero-cfei.test.ts`                       | 4        | 4        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/page-not-found-path.test.ts`               | 4        | 4        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/parse-ccg-sheet.test.ts`                   | 4        | 4        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/parse-premiers-detenteurs-sheet.test.ts`   | 3        | 3        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/sanitize-redirect.test.ts`                 | 3        | 3        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/scrub-sensitive.test.ts`                   | 2        | 2        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/search-destinataire.test.ts`               | 12       | 12       | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/search-local.test.ts`                      | 7        | 7        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/search-ville.test.ts`                      | 19       | 19       | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/sync-data.test.ts`                         | 8        | 8        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/transmission-labels.test.ts`               | 49       | 47       | 1             | 1          | 0        |
| `app-local-first-react-router/src/utils/trichine-import-recap.test.ts`             | 4        | 4        | 0             | 0          | 0        |
| `app-local-first-react-router/src/utils/user-onboarded.client.test.ts`             | 4        | 4        | 0             | 0          | 0        |
| `app-local-first-react-router/src/zustand/idb-sliced-storage.test.ts`              | 17       | 17       | 0             | 0          | 0        |
| `app-local-first-react-router/src/zustand/store.test.ts`                           | 3        | 3        | 0             | 0          | 0        |
| **Total**                                                                          | **1415** | **1371** | **15**        | **27**     | **2**    |

### Tests non utiles

- `api-express/src/__tests__/carcasses-reload.test.ts` › `incrémente la version de rechargement de l’utilisateur` — Tautologique — `requestCarcassesReload` est un seul appel `prisma.user.update` : le test recopie cet appel mot pour mot, puis vérifie que la fonction renvoie la valeur du mock. — supprimer (l'effet utile, le rechargement forcé, est couvert côté lecture par `carcasse-full-reload.test.ts`).
- `api-express/src/__tests__/admin-inbox.db.test.ts` › `le fuseau de la session de test n’est pas UTC` — Tautologique — vérifie seulement le `ALTER DATABASE` posé par le `beforeAll` du même fichier, aucun code applicatif n'est exécuté. — supprimer, ou déplacer en `expect` de garde à la fin du `beforeAll` (comme le fait déjà `carcasse-scope.db.test.ts`).
- `api-express/src/__tests__/auth-ip-rate-limit.test.ts` › `chaque route a son propre compteur` — Tautologique — le test crée lui-même deux instances `createAuthIpRateLimit` distinctes : il vérifie que deux instances d'express-rate-limit ont deux stores, pas que les routes réelles appellent `authIpRateLimit()` une fois chacune. — supprimer, ou renforcer : monter le vrai routeur `user` et vérifier qu'une rafale sur `/user/signup` ne bloque pas `/user/login`.
- `api-express/src/__tests__/admin-inbox.test.ts` › `la requête des comptes bloqués lit les blocages de la fenêtre` — Redondant — inspecte le texte SQL du mock (`includes('u.deleted_at IS NULL')`, `toContain(15)` en dur) ; le comportement réel de cette requête est vérifié sur une vraie base par `admin-inbox.db.test.ts` › « un blocage de la fenêtre apparaît… » et « un compte supprimé n’apparaît pas… ». — supprimer (ou au minimum remplacer `15` par `LOCKOUT_DURATION_MINUTES`).
- `api-express/src/__tests__/admin-fei-corrections.test.ts` › `fiche déjà transmise par le premier détenteur : il est remplacé comme expéditeur` — Redondant — mêmes mocks et même requête que « une association de l'examinateur devient premier détenteur… » ; aucun état « déjà transmise » n'est mis en place, seule l'assertion `prev_owner_*` change. — fusionner avec « une association de l'examinateur devient premier détenteur, aussi comme détenteur actuel ou suivant » (ajouter l'assertion `prev_owner_role` et `notifyNextOwnerUser` non appelé).
- `api-express/src/__tests__/create-destinataire.test.ts` › `un seul rôle sur le représentant` — Redondant — le premier test (« crée l’entité, son représentant… ») vérifie déjà `roles: [UserRoles.COMMERCE_DE_DETAIL]` sur le même appel `user.create`, ce qui implique une longueur de 1 — supprimer (ou fusionner l’assertion `toHaveLength(1)` dans « crée l’entité, son représentant et la relation ADMIN »).
- `api-express/src/__tests__/e2e-routes.test.ts` › `pose les triggers d’historique une seule fois par process` — Fragile — dépendance à l’ordre : le flag « triggers déjà posés » est un état de module partagé ; si « reseed la base avec le rôle demandé » passe avant, `applyHistoryTriggers` vaut 0 et le test échoue — isoler avec `vi.resetModules()` + import dynamique du routeur dans le test, ou asserter seulement que le 2e appel n’incrémente pas le compteur.
- `api-express/src/__tests__/entite-partenaires.test.ts` › `collecteur pro existant → rattachement, aucun compte créé` — Redondant — même chemin que « un ETG saisi comme commerce de détail est retrouvé comme ETG » (entité existante trouvée par `findFirst` → rattachement sans création), avec des assertions plus faibles ; le `type` du body est ignoré par la route — supprimer, ou transformer les deux en `test.each([ETG, COLLECTEUR_PRO])`.
- `api-express/src/__tests__/fei-side-effects.test.ts` › `approbation date unchanged → no webhook` — Redondant — partage le même objet `Date` entre existing et saved ; le test suivant « approbation date unchanged but read as a new Date object » couvre le même cas en plus strict (deux objets distincts) — supprimer.
- `api-express/src/__tests__/fei-url.test.ts` › `préfixe toutes les URLs par /app/` — Redondant — les deux tests suivants comparent l’URL exacte pour les mêmes 4 rôles (CHASSEUR, SVI, ETG, COLLECTEUR_PRO), donc le préfixe est déjà vérifié — supprimer.
- `api-express/src/__tests__/notifications.test.ts` › `envoie le push ET l’email quand les deux canaux sont activés` — Redondant — même setup que « envoie le wording push, pas le contenu de l’email », qui vérifie les deux appels avec leurs arguments (strictement plus fort) — supprimer.
- `api-express/src/__tests__/permissions-carcasse-ownership.test.ts` › `default (withDeleted=false) excludes soft-deleted carcasses` — Redondant — `c.deleted_at IS NULL` avec `DEFAULT_QS` est déjà asserté dans « SVI user → svi_assigned_at… » (même requête, même utilisateur) et dans « after=<timestamp> with withDeleted=false » — supprimer.
- `api-express/src/__tests__/swagger-validation.test.ts` › `Entity Swagger JSON Structure › should have valid OpenAPI structure` — Tautologique — compare le JSON statique à une copie de ses propres constantes (`openapi`, `title`) et fait des `toBeDefined()` sur des clés que l'import JSON typé garantit déjà ; ne détecte aucune dérive doc ↔ code — supprimer.
- `api-express/src/__tests__/swagger-validation.test.ts` › `Third-party Swagger JSON Structure › should have valid OpenAPI structure` — Tautologique — même constat que le test jumeau côté clé dédiée — supprimer.
- `api-express/src/__tests__/swagger-validation.test.ts` › `entity swagger should have FeiResponse schema` — Tautologique — `toBeDefined()` sur des chemins de propriétés d'un JSON importé sans `as any` : `tsc` échoue déjà si la clé manque ; doublon de « entity swagger should document all response fields » — supprimer.
- `api-express/src/__tests__/swagger-validation.test.ts` › `third-party swagger should have FeiResponse, ApprovalRequestResponse, and AccessTokenResponse schemas` — Tautologique — idem (accès typé + `toBeDefined`), couvert par « third-party swagger should document all response fields » ; le nom cite AccessTokenResponse que le test ne vérifie pas — supprimer.
- `api-express/src/__tests__/swagger-validation.test.ts` › `both swaggers should have CarcasseResponse schema` — Tautologique — accès typé + `toBeDefined`, couvert par les tests « Documentation Completeness » — supprimer.
- `api-express/src/__tests__/swagger-validation.test.ts` › `both swaggers should have CarcassesResponse schema` — Tautologique — idem — supprimer.
- `api-express/src/__tests__/swagger-validation.test.ts` › `both swaggers should have ErrorResponse schema` — Tautologique — idem — supprimer.
- `api-express/src/__tests__/swagger-validation.test.ts` › `nouvelle-fiche endpoint › nouvelle-fiche endpoint should have correct parameters including carcasse format` — Redondant — copie ligne à ligne du test de même nom dans « API Endpoints Match Swagger Paths » — supprimer (garder un seul exemplaire).
- `api-express/src/__tests__/sort-entities-by-type-and-id.test.ts` › `indexes a single entity under its type and id` — Redondant — chemin entièrement couvert par « groups multiple entities across different types » (mêmes assertions `toEqual` par type, avec plus de cas) — fusionner avec « groups multiple entities across different types ».
- `api-express/src/__tests__/trichine-echantillons-bulk-route.test.ts` › `lot valide → références consécutives, une seule lecture de séquence` — Tautologique — la référence vaut `E-26-USER-SVI-0001` (code de repli = id utilisateur avec un tiret) : `split('-')[2]` donne `'USER'`, `Number()` donne `NaN`, et `toEqual([NaN, NaN, NaN])` passe toujours ; la consécutivité n'est pas vérifiée. Seul `findFirst` appelé 1 fois protège quelque chose — renforcer l'assertion : comparer aux références exactes (`E-YY-USER-SVI-0001..0003`) ou lire le dernier segment (`split('-').at(-1)`).
- `api-express/src/__tests__/sync-fei.test.ts` › `delete request on missing FEI → throws "Fei not found"` — Tautologique — `rejects.toThrow()` sans message, avec `platformAdmin` : la création est de toute façon refusée à un non-examinateur (« Seul un examinateur initial… »), donc le test passe même si le cas « fiche absente » régresse — renforcer l'assertion : `toThrow('Fei not found')` (ou le message réel) et/ou utiliser l'examinateur initial.
- `api-express/src/__tests__/sync-route-carcasse-primary.test.ts` › `empty body → 200 + canonical empty data envelope (no crash on missing keys)` — Redondant — même requête `{}` et même `toEqual` de l'enveloppe que `sync-route.test.ts` › « empty payload → 200 with empty arrays » (qui vérifie en plus l'absence d'appels) — supprimer.
- `api-express/src/__tests__/sync-route-carcasse-primary.test.ts` › `runs carcasse side effects when only carcasses are sent (no FEI side effects)` — Redondant — le chemin « carcasses seules → side effects » est couvert par « a single failing carcasse does not prevent the others… » (même fichier, `toHaveBeenCalledTimes(2)`) et par `sync-route.test.ts` › « runs carcasse side effects only for non-deleted results » ; le titre promet « no FEI side effects » mais ne l'asserte pas — supprimer (ou ajouter `expect(runFeiUpdateSideEffects).not.toHaveBeenCalled()` si on veut le garder).
- `api-express/src/__tests__/sync-route-carcasse-primary.test.ts` › `carcasses-only payload → response.feis is [], response.carcasses contains the saved rows` — Redondant — même payload (2 carcasses sans fiche) que « feis omitted entirely → carcasses still processed » ; seule l'assertion sur `prisma.fei.findMany` est nouvelle — fusionner avec « feis omitted entirely → carcasses still processed ».
- `api-express/src/__tests__/trichine-ftp-pdf.test.tsx` › `la référence du pool est encodée en Code 128` — Redondant — n'asserte que le préfixe `data:image/png;base64,` ; le test suivant « le code-barres embarque sa zone silencieuse… » appelle la même fonction et vérifie la largeur exacte en modules Code 128 (donc l'encodage) — supprimer.
- `api-express/src/__tests__/user-entity.test.ts` › `POST › authorization › regular user trying to manage another user → 403` — Fragile — ne pose aucun mock : il dépend du `prisma.entity.findUnique.mockResolvedValue(testEntity)` laissé par le test précédent (`vi.clearAllMocks` garde les implémentations). Lancé seul (`-t`), `getEntity` renvoie `undefined` → 400 et le test échoue. — renforcer : poser `prisma.entity.findUnique` et `entityAndUserRelations.findFirst` (null) dans le test, ou supprimer (couvert par « user cannot modify relations outside their entity »).
- `api-express/src/__tests__/user-entity.test.ts` › `DELETE › delete action › non-CAN_HANDLE deletion does not trigger Brevo` — Tautologique — `findFirst` renvoie `null` : la relation n'est jamais trouvée, la route ne lit jamais son type, Brevo ne peut pas être appelé. C'est le même chemin que « relation not found → still 200 ». — renforcer : faire renvoyer la relation `CAN_TRANSMIT_CARCASSES_TO_ENTITY` par `findFirst` et vérifier `delete` appelé + `unlinkBrevoCompanyToContact` non appelé.
- `api-express/src/__tests__/user-entity.test.ts` › `DELETE › delete action › unauthenticated DELETE → 401` — Redondant — copie exacte de « DELETE › authentication › unauthenticated → 401 » (même requête, même assertion). — supprimer.
- `api-express/src/__tests__/user-entity.test.ts` › `PUT › IDOR / cross-boundary › entity admin for entity-1 cannot modify entity-2 relations` — Redondant — rangé sous PUT mais envoie un POST ; aucun mock ne fait de l'utilisateur un admin d'entity-1 : c'est le même scénario que « POST › IDOR › user cannot modify relations outside their entity ». — supprimer, ou le réécrire en vrai PUT avec un admin d'entity-1.
- `app-local-first-react-router/__tests__/update-carcasse-status.test.ts` › `should prioritize SAISIE_TOTALE over SAISIE_PARTIELLE when both are present` — Redondant — `svi_ipm2_decision` est une seule valeur d'enum ; l'entrée est identique à « should return SAISIE_TOTALE when IPM2 decision includes SAISIE_TOTALE ». Le nom promet un cas « les deux » que le test ne construit pas. — supprimer.
- `app-local-first-react-router/__tests__/update-carcasse-status.test.ts` › `should handle empty arrays for svi_ipm2_traitement_assainissant` — Redondant — même chemin (tableau vide, décision null, `svi_assigned_at` null → SANS_DECISION) que « Default case › should return SANS_DECISION as default ». — fusionner avec « Default case ».
- `app-local-first-react-router/__tests__/update-carcasse-status.test.ts` › `should handle empty arrays for svi_ipm2_decision` — Redondant — entrée quasi identique au test précédent (décision `null`, pas un tableau vide comme le dit le nom) et à « Default case ». — supprimer.
- `app-local-first-react-router/__tests__/update-carcasse-status.test.ts` › `should return "Sans décision" for null status without status_set_at` — Redondant — passe `SANS_DECISION` et non `null` : copie exacte du test précédent « Sans décision for SANS_DECISION without status_set_at ». — supprimer, ou passer `svi_carcasse_status: null` pour couvrir vraiment le cas.
- `app-local-first-react-router/__tests__/update-fei-scoping.test.ts` › `l'ownership d'une carcasse prise en charge est laissé intact` — Redondant — `CHEZ_ETG` est exclue avant le mapping, et `mapFeiFieldsToCarcasse` ne touche aucun champ `*_owner_*`. Le 1er test (`CHEZ_ETG.is_synced` reste `true`) et le 5e (`CHEZ_ETG` garde son heure) prouvent déjà qu'elle n'est pas réécrite. — supprimer.
- `app-local-first-react-router/src/components/Modal.test.ts` › `garde les propriétés du composant DSFR` — Tautologique — relit `id`, `isOpenedByDefault` et `buttonProps` renvoyés par le mock DSFR. Si le spread disparaît, TypeScript casse déjà aux appels (`modal.id`, `modal.buttonProps`). — supprimer.
- `app-local-first-react-router/src/utils/carcasse-deja-envoyee.test.ts` › `rôle EXAMINATEUR_INITIAL avec une entité parasite : reste chez le chasseur` — Redondant — l'entrée (`next_owner_entity_id: null`, rôle EXAMINATEUR_INITIAL) est identique à celle de « carcasse tout juste créée » : l'« entité parasite » annoncée n'est jamais posée, le cas data-health n'est pas testé. — renforcer l'assertion : poser `next_owner_entity_id: 'ETG-1'` avec `current_owner_role: EXAMINATEUR_INITIAL` (sinon supprimer).
- `app-local-first-react-router/src/utils/etablissementsTraitementSaintaire.test.ts` › `retrouve le numéro d’agrément depuis le libellé affiché` — Redondant — couvert intégralement par « retrouve le numéro d’agrément pour chaque libellé de la liste » (qui inclut l'index 0). — supprimer.
- `app-local-first-react-router/src/utils/get-carcasse-card-display.test.ts` › `carcasse renvoyée par l'ETG (next_owner repassé à null) → "creation"` — Redondant — mêmes données d'entrée (PREMIER_DETENTEUR / next null) et même assertion que « carcasse encore chez le premier détenteur sans prochain détenteur → "creation" » ; ne reproduit pas le « retour à l'envoyeur » (pas de snapshot FEI périmé fourni). — fusionner avec « carcasse encore chez le premier détenteur… » (garder le commentaire de régression) ou passer un `latestIntermediaire`/contexte qui distingue réellement le cas.
- `app-local-first-react-router/src/utils/get-transmissions-sorted.test.ts` › `all but one missing → À compléter (the live one drives it)` — Redondant — même chemin que « one missing, the rest actionable → still À compléter » (une carcasse actionnable non terminée suffit), seul le nombre de manquantes change. — fusionner avec « one missing, the rest actionable ».
- `app-local-first-react-router/src/utils/is-carcasse-done.test.ts` › `isFeiDone › true when every carcasse was closed by an intermediaire` — Redondant — la 2e assertion de « true only when every carcasse is done » couvre déjà une carcasse clôturée par intermédiaire. — supprimer.
- `app-local-first-react-router/src/utils/transmission-labels.test.ts` › `getNextStepLabel › %s → Clôturée` (it.each, 6 cas) — Tautologique — recopie les `case` qui tombent dans le `default` du switch : supprimer ces `case` du code ne casserait pas le test. — remplacer par un seul cas « libellé inconnu → Clôturée » ou supprimer.
- `app-local-first-react-router/src/utils/transmission-labels.test.ts` › `ETG viewing a fiche sent to another ETG (current not ETG) → transport vers un autre établissement` — Redondant — même entrée et même attente que `getCurrentStepLabelForEtg › heading to an ETG that is not mine, current not ETG`, la délégation ETG est déjà testée par « delegates to the ETG label when in progress ». — supprimer.
