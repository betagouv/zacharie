# Trichine — Suivi d'implémentation

> Suivi des phases de `trichine.md` §13. Mis à jour au fil des PRs.
> Dernière maj : 2026-06-05

## État des phases

| Phase                                     | Statut                                  | Notes                                                                                         |
| ----------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| **P1 — Modèle**                           | ✅ Fait                                 | Schéma + migration + champs Carcasse (branche `feat--trichine`)                               |
| **P2 — Permissions**                      | ⏳ Bloqué                               | Dépend de `feat--add-permission-carcasse` (PR #381, encore wip)                               |
| **P3 — Backend core**                     | ✅ Fait                                 | Voir détail ci-dessous                                                                        |
| P4 — Génération PDF FTP                   | ⬜ À faire                              | Attente modèle visuel DGAL + décision moteur PDF (react-pdf existant vs Puppeteer spec §12.1) |
| **P5 — Frontend 1er détenteur**           | ✅ Fait                                 | Sans téléchargement PDF (attend P4) — voir détail ci-dessous                                  |
| **P6 — Frontend LVD**                     | ✅ Fait                                 | Sans upload PDF/photos (attend infra stockage P4)                                             |
| **P7 — Frontend LNR**                     | ✅ Fait                                 | Mêmes écrans que LVD, résultats de confirmation + parasite                                    |
| **P8 — Frontend SVI agréé**               | ✅ Fait                                 | Blocage backend acceptation + cronjob auto-clôture : à gater au lancement                     |
| P9 — Frontend destinataires circuit court | ⬜ À faire                              | Dépend P3                                                                                     |
| P10 — Email conso final cuisson           | ⬜ À faire                              | Dépend P3                                                                                     |
| P11 — Workflow analyses 2e intention      | 🔶 Backend P3 + renoncement frontend P5 | Reste le frontend création pool fille / petite-fille                                          |
| P12 — Seed LVD + invitation utilisateurs  | ⬜ À faire                              | Import annuaire DGAL + UI admin                                                               |
| P13 — Tests & E2E                         | ⬜ À faire                              | Circuit court + agréé + LVD/LNR complets                                                      |

## P3 — Backend core (fait le 2026-06-05)

### Livré

- `api-express/src/utils/trichine.ts` — constantes des champs String (§4.10), génération références `E/P/F-{YY}-{séquence}` (retry P2002), `logTrichineStatutChange` (audit), `notifyTrichineUsers` (TrichineNotification + push/email), `getCarcassesStakeholderUsers`, `userBelongsToEntity`, `validatePoolComposition` (règles §9)
- `api-express/src/utils/trichine-status.ts` — `recompute{Carcasse,Echantillon,Pool,FTP}Trichine` + fonctions pures testables ; règle pool mère, remontée de hiérarchie, cache résultat sur échantillons, alimentation auto de l'historique
- `api-express/src/controllers/trichine.ts` — émetteur (PD/SVI) : échantillon, pool, FTP, envoyer, renoncer-2e-intention, vue carcasse, notifications (+ marquage lu)
- `api-express/src/controllers/laboratoire.ts` — LVD/LNR : liste/détail FTP (projection stricte §10.2), réception, résultat (FTP auto vers LNR si DOUTEUX + type ré-attribué CONFIRMATION), refus, documents, photos
- `POST /carcasse/:id/retirer-de-fei` (PD only, motif obligatoire, résultat défavorable requis)
- 41 tests unitaires (fonctions pures + recompute) — `trichine-status.test.ts`

### Durcissements post-revue (2026-06-05)

- 🔴 `recomputePoolAndLinkedFTPs` : toutes les FTP référençant un pool sont recomputées à la saisie d'un résultat/refus — la FTP d'origine (émetteur→LVD) se clôture désormais après le résultat LNR ; la FTP auto LVD→LNR est recomputée à sa création
- 🟠 `entity_id` clients vérifiés via `userBelongsToEntity` (`preleve_par_entity_id`, `cree_par_entity_id`, `expediteur_entity_id`)
- 🟠 Scoping SVI : `sviHasAccessToCarcasse` — un SVI ne prélève/consulte que les carcasses assignées à son service (`svi_entity_id`)

### Décisions prises en P3 (à valider métier)

1. Question ouverte §11.6 : FTP passe **automatiquement** à `TRAITEE` quand reçue + tous les résultats saisis
2. Priorités `trichine_action_requise` sur DOUTEUX : fille au labo → `ANALYSE_EN_COURS_LVD` ; pas de fille → `PRELEVEMENT_COMPLEMENTAIRE` ; filles terminées → `CONFIRMATION_EN_COURS_LNR` ; résultat LNR final → `AUCUNE`
3. Seul le LNR peut écraser un résultat `DOUTEUX` ; tout autre résultat est définitif
4. Refus en masse : pas d'endpoint bulk, le frontend boucle sur `/laboratoire/pool/:id/refuser`
5. Upload fichiers : les endpoints documents acceptent une `fichier_url` (clé Cellar) — pipeline d'upload S3 en P4

## P5 — Frontend 1er détenteur (fait le 2026-06-05)

### Livré (branche `feat--trichine-p5`)

- `src/services/trichine.ts` — appels API typés (échantillons, pools, FTP, laboratoires, retrait, notifications)
- `src/utils/trichine.ts` — libellés FR, sévérités de badges, statut utilisateur (À faire / En cours / Clôturé §4.11), règles UI pool
- `src/components/TrichineSection.tsx` — section « Recherche de trichine » sur la carte carcasse sanglier : statuts + action requise, création d'échantillon (modal), retrait de la FEI (modal motif obligatoire), renoncement 2e intention (modal), chronologie (historique)
- Pages `/app/chasseur/trichine` : onglets Échantillons / Pools / FTP, création pool (validation 19 carcasses / 100 g), création FTP (annuaire LVD + mode transport), détail FTP avec envoi au laboratoire
- Navigation : item « Trichine » dans le menu chasseur
- Backend ajouté au passage : `GET /trichine/laboratoires` (annuaire des LVD, hors LNR)

### Notes P5

- Pas de local-first pour la trichine : appels serveur directs (les résultats viennent des labos, le flux exige d'être en ligne)
- Téléchargement / impression PDF FTP absent → arrive avec P4
- Création pool fille / petite-fille (2e intention) absente → P11 ; le renoncement est lui livré
- Préférences profil (site de prélèvement, LVD préféré, §6.1) non faites — à ajouter si demande utilisateur

## P6 + P7 — Frontend LVD / LNR (fait le 2026-06-05)

### Livré (branche `feat--trichine-p5`)

- Espace `/app/laboratoire/*` : layout dédié (guard rôle `LABORATOIRE`), navigation, redirection post-connexion
- `/app/laboratoire/ftp` : liste des FTP reçues avec filtres À traiter / En cours / Clôturées (§6.3)
- `/app/laboratoire/ftp/:id` : émetteur + contact, confirmation de réception (date), composition par pool (échantillons + projection carcasse : bracelet, espèce, date et commune de mise à mort), saisie résultat par pool, refus de pool (modal raison)
- LVD vs LNR géré par `GET /laboratoire/me` (nouvel endpoint) : le LVD saisit NEGATIF/DOUTEUX, le LNR les résultats de confirmation (NON_NEGATIF avec parasite obligatoire / PRESENCE_PARASITE_NON_IDENTIFIE / POSITIF) ; le LNR peut écraser un DOUTEUX
- DOUTEUX : avertissement « FTP auto vers le LNR » avant saisie + toast après
- `/app/laboratoire/profil` : « Mon laboratoire » lecture seule (coordonnées + badge LNR)
- `src/services/laboratoire.ts` — appels API typés

### Feature flag (2026-06-05)

Tout le périmètre trichine **côté chasseur** est derrière `TRICHINE_FEATURE_ENABLED`
(`app-local-first-react-router/src/utils/trichine.ts`) : actif en dev, **désactivé en production**
tant que `VITE_FEATURE_TRICHINE=true` n'est pas posé au build. Gate appliqué sur : la section
trichine de la carte carcasse, l'item de menu « Trichine » et les routes `/app/chasseur/trichine/*`.
L'espace `/app/laboratoire/*` n'est volontairement PAS gaté (rôle `LABORATOIRE` requis, aucun
laboratoire actif en production). Les endpoints backend restent déployés (authentifiés, invisibles).
**Lancement = poser `VITE_FEATURE_TRICHINE=true` dans l'env de build du frontend.**

### Notes P6/P7

- Upload PDF rapport COFRAC et photographies de larves : UI absente — dépend de l'infra de stockage (P4) ; les endpoints backend existent (`fichier_url`)
- Saisie des résultats volontairement bloquée tant que la réception n'est pas confirmée (le backend, lui, l'autorise — cf reste à faire P3)
- Gestion des utilisateurs du laboratoire → P12 (invitation par admin)
- Refus en masse de tous les pools d'une FTP : non fait (refus pool par pool)

## P8 — Frontend SVI agréé (fait le 2026-06-05)

### Livré (branche `feat--trichine-p5`)

- Pages trichine **partagées** : déplacées vers `src/routes/trichine/` (tableau, nouveau pool, nouvelle FTP, détail FTP), liens basePath-aware (`useTrichineBasePath`), montées sous `/app/chasseur/trichine/*` ET `/app/svi/trichine/*` (feature flag)
- `TrichineSection` généralisée (`viewRole: 'chasseur' | 'svi'`) : côté SVI, prélèvement autorisé mais pas de retrait de FEI ni de renoncement (décision via IPM) ; insérée dans l'inspection carcasse SVI (flag + sanglier)
- `useTrichineResultat` : résumé des résultats trichine d'une carcasse pour conditionner l'IPM
- **IPM1** : décision « Acceptée » désactivée (avec alerte explicative) pour un sanglier sans résultat trichine négatif — flag uniquement
- **IPM2** : alerte de suggestion selon résultat LNR (POSITIF → saisie totale ; NON_NEGATIF → saisie totale ou traitement assainissant ; parasite non identifié → cas par cas)
- Item « Trichine » dans la nav SVI (flag)

### Redesign listes (2026-06-05)

Les listes échantillons / pools / FTP (`/trichine`, chasseur + SVI) et la liste FTP labo sont passées
de cartes-badges à des **tables** (`TableFilterable`, le composant des registres carcasses) : colonnes
nommées, tri par colonne, recherche (insensible casse/accents), filtre statut. Fallback cartes
étiquetées sur mobile. Helpers purs `filterTrichineRows` / `sortTrichineRows` testés.
`GET /trichine/echantillons` renvoie désormais la référence du pool de chaque échantillon.

### Notes P8 / reste à gater au lancement

- ⚠️ **Le blocage d'acceptation est frontend only** : la validation backend (« SVI tente d'accepter un sanglier sans résultat NEGATIF → bloqué », §9) n'existe pas encore — à implémenter derrière un flag serveur au lancement
- ⚠️ **Auto-clôture 10 jours intacte** (cronjob + `svi-fei.tsx`) : un sanglier sans analyse sera toujours auto-accepté à J+10 — la désactivation pour les sangliers (spec §6.2) est à gater au lancement
- Le mix de 1ers détenteurs dans un pool SVI est déjà permis côté backend (P3)

### Reste à faire (suivi revue P3)

- [ ] Tests de routes (supertest) : guards 401/403, scoping labo inter-entités, LVD ne peut pas saisir POSITIF, non-PD ne peut pas retirer-de-fei
- [ ] Test du flux DOUTEUX → FTP auto LNR (le plus complexe, non couvert)
- [ ] Trancher : le LNR peut-il « refuser » un pool DOUTEUX ? (écrase le doute par ANALYSE_IMPOSSIBLE, trace uniquement dans l'historique)
- [ ] Exiger (ou pas) la réception de la FTP avant saisie de résultat
- [ ] Masquer `fei_numero` (contenu dans `zacharie_carcasse_id`) dans la projection labo
- [ ] Scope équipe : `GET /trichine/pools|ftps` filtrent par user — les collègues d'une même entité SVI ne voient pas les pools/FTP de l'équipe (à élargir en P8)
- [ ] Intégrer `getCarcasseAccess`/`getFeiAccess` (rôles LVD/LNR) quand P2 (#381) sera mergé
