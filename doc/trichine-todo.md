# Trichine — Suivi d'implémentation

> Suivi des phases de `trichine.md` §13. Mis à jour au fil des PRs.
> Dernière maj : 2026-06-05

## État des phases

| Phase                                     | Statut                | Notes                                                           |
| ----------------------------------------- | --------------------- | --------------------------------------------------------------- |
| **P1 — Modèle**                           | ✅ Fait               | Schéma + migration + champs Carcasse (branche `feat--trichine`) |
| **P2 — Permissions**                      | ⏳ Bloqué             | Dépend de `feat--add-permission-carcasse` (PR #381, encore wip) |
| **P3 — Backend core**                     | ✅ Fait               | Voir détail ci-dessous                                          |
| P4 — Génération PDF FTP                   | ⬜ À faire            | Attente modèle visuel DGAL                                      |
| P5 — Frontend 1er détenteur               | ⬜ À faire            | Dépend P3 + P4                                                  |
| P6 — Frontend LVD                         | ⬜ À faire            | Dépend P3                                                       |
| P7 — Frontend LNR                         | ⬜ À faire            | Dépend P6                                                       |
| P8 — Frontend SVI agréé                   | ⬜ À faire            | Dépend P3                                                       |
| P9 — Frontend destinataires circuit court | ⬜ À faire            | Dépend P3                                                       |
| P10 — Email conso final cuisson           | ⬜ À faire            | Dépend P3                                                       |
| P11 — Workflow analyses 2e intention      | 🔶 Backend fait en P3 | Reste le frontend (dépend P5 + P6)                              |
| P12 — Seed LVD + invitation utilisateurs  | ⬜ À faire            | Import annuaire DGAL + UI admin                                 |
| P13 — Tests & E2E                         | ⬜ À faire            | Circuit court + agréé + LVD/LNR complets                        |

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

### Reste à faire (suivi revue P3)

- [ ] Tests de routes (supertest) : guards 401/403, scoping labo inter-entités, LVD ne peut pas saisir POSITIF, non-PD ne peut pas retirer-de-fei
- [ ] Test du flux DOUTEUX → FTP auto LNR (le plus complexe, non couvert)
- [ ] Trancher : le LNR peut-il « refuser » un pool DOUTEUX ? (écrase le doute par ANALYSE_IMPOSSIBLE, trace uniquement dans l'historique)
- [ ] Exiger (ou pas) la réception de la FTP avant saisie de résultat
- [ ] Masquer `fei_numero` (contenu dans `zacharie_carcasse_id`) dans la projection labo
- [ ] Scope équipe : `GET /trichine/pools|ftps` filtrent par user — les collègues d'une même entité SVI ne voient pas les pools/FTP de l'équipe (à élargir en P8)
- [ ] Intégrer `getCarcasseAccess`/`getFeiAccess` (rôles LVD/LNR) quand P2 (#381) sera mergé
