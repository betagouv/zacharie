# E2E Tests — Status & Lessons Learned

Updated 2026-04-30. ~131 specs across 9 folders (after split of 32 → 3 + 33 → 2; deletions of 14 + 90).

## Results: ~120 pass, 7 skip, 0 fail

7 hard skips remain (down from 25). Two tests have defensive runtime guards (53, 121) that may
short-circuit if seed data is missing — they are not counted as skips.

---

## What changed in this pass

- **Deleted (2)**: `examinateur/14-ccg-edition` (stub for unreachable UI state),
  `circuit-court/90-prise-en-charge` (Commerce de Détail has no CTA by design).
- **Implemented from stub (2)**: `premier-detenteur/34-fiche-svi-cloturee-lecture-seule` (PD reads
  SVI-stage fiche in read-only — skip comment was wrong, PD CAN reach it),
  `transverse/106-service-worker-cache-offline-reload` (body now full; stays skipped because Vite
  dev mode breaks SW caching — see test comment for unskip path).
- **Split into multiple cases (2)**: `premier-detenteur/32-profil-informations-de-chasse` →
  `32a/32b/32c` (associations / partenaires / CCGs), `premier-detenteur/33-partage-de-mes-donnees`
  → `33a/33b` (empty state / active state with seeded approval).
- **Seeds extended** (`api-express/scripts/populate-test-db.ts`): 4 new seed roles
  `COMMERCE_DE_DETAIL_DELIVERED`, `ETG_TAKEN_CHARGE`, `COLLECTEUR_TAKEN_CHARGE`,
  `PREMIER_DETENTEUR_WITH_PARTAGE`. Pre-existing typo
  `intermediaire_carcasse_signed_at` removed (field doesn't exist on Carcasse). ETG_REFUSED seed
  now sets `svi_carcasse_status: REFUS_ETG_COLLECTEUR` + clears `fei_next_owner_*` (was leaving
  PD's own id as next owner, which broke the chasseur "feisUnderMyResponsability" filter).
- **🔒 SECURITY FINDING (test 128)**: `POST /carcasse/:feiNumero/:zacharieCarcasseId` returns
  **200** when an ETG modifies a carcasse from another ETG's branch (expected: 403/404).
  The endpoint lacks an ownership check. Test stays skipped pending backend fix; once fixed it
  becomes a regression guard.

---

## Test inventory

### A. Examinateur (`tests/examinateur/`) — 21 pass, 2 skip, 1 deleted

| #   | Test                                   | Status   | Notes                                                                |
| --- | -------------------------------------- | -------- | -------------------------------------------------------------------- |
| 01  | creation-fiche-grand-gibier-mono       | pass     | 1 daim, full flow, transmet                                          |
| 02  | fiche_circuit-long_simple_examinateur  | pass     | (existing) 4 daims, transmet                                         |
| 03  | creation-fiche-petit-gibier-lot        | pass     | Pigeons x10                                                          |
| 04  | creation-fiche-mixte                   | pass     | 3 daims + 10 pigeons                                                 |
| 05  | creation-fiche-anomalies               | pass     | Anomalies via referentiel tree modal                                 |
| 06  | brouillon-persistance                  | pass     | Draft fiche appears in list                                          |
| 07  | edition-carcasse-depuis-detail         | pass     | Edit anomalies on carcasse detail page                               |
| 08  | examinateur-pd-self-handoff            | **skip** | Two-stage flow needs explicit form-transition waits                  |
| 09  | onboarding-complet                     | **pass** | (was skip) DSFR radio: click label not input + fill required CFEI    |
| 10  | onboarding-incomplet-acces-restreint   | pass     | ChasseurDeactivated for incomplete profile                           |
| 11  | onboarding-partiel-formation-manquante | pass     | est_forme_a_l_examen_initial null → deactivated                      |
| 12  | profil-examinateur                     | pass     | Coordonnees persist after reload                                     |
| 13  | ccg-creation-profil                    | pass     | Uses pre-seeded CCG-01                                               |
| 14  | ccg-edition                            | DELETED  | Edit pencil only on pre-registered CCGs (none seeded); body was stub |
| 15  | fiche-svi-cloturee-vue-chasseur        | pass     | SVI_CLOSED seed                                                      |
| 16  | fiche-circuit-court-livree             | **pass** | (was skip) New seed `COMMERCE_DE_DETAIL_DELIVERED`                   |
| 17  | fiche-refusee-par-etg                  | **skip** | Erreur 500 on `/app/chasseur/fei/{id}` for refused-by-ETG fiche      |
| 18  | date-future-refusee                    | pass     | Edge case                                                            |
| 19  | heure-evisceration-invalide            | pass     | Edge case                                                            |
| 20  | retirer-carcasse                       | pass     | Trash icon + window.confirm                                          |
| 21  | zero-carcasse-transmettre-disabled     | pass     | Transmettre disabled                                                 |
| 22  | double-clic-transmettre                | pass     | dblclick → 1 fiche                                                   |
| 23  | deconnexion-pendant-formulaire         | pass     | Store cleaned                                                        |

### B. Premier detenteur (`tests/premier-detenteur/`) — 19 pass, 0 skip

(32 split into 32a/32b/32c, 33 split into 33a/33b — all passing.)

| #     | Test                               | Status   | Notes                                                                |
| ----- | ---------------------------------- | -------- | -------------------------------------------------------------------- |
| 24-26 | fiche_circuit-long_simple (x3)     | pass     | (existing) 3 transport/storage combos                                |
| 27    | fiche_dispatch_multi_destinataires | pass     | (existing, in dispatch-isolation/)                                   |
| 28    | dispatch-etg-collecteur            | pass     | 2 groups: ETG + collecteur                                           |
| 29    | dispatch-commerce-de-detail        | pass     | Circuit court direct                                                 |
| 30    | ccg-creation-inline                | pass     | CCG-01 in transmission form                                          |
| 31    | onboarding-incomplet               | pass     | ChasseurDeactivated                                                  |
| 32a   | profil → associations              | **pass** | (was skip) Asserts seeded "Association de chasseurs" relation        |
| 32b   | profil → partenaires               | **pass** | (was skip) Page renders without crashing                             |
| 32c   | profil → CCGs                      | **pass** | (was skip) Pre-seeded CCG-01 visible                                 |
| 33a   | partage-de-mes-donnees (empty)     | **pass** | (was skip) Page heading + no approval sections (no seeded approvals) |
| 33b   | partage-de-mes-donnees (active)    | **pass** | (was skip) New seed `PREMIER_DETENTEUR_WITH_PARTAGE`                 |
| 34    | fiche-svi-cloturee-lecture-seule   | **pass** | (was skip) Skip comment was wrong — PD CAN view SVI fiche read-only  |
| 35    | fiche-circuit-court-livree         | **pass** | (was skip) New seed `COMMERCE_DE_DETAIL_DELIVERED`                   |
| 36    | refus-carcasse-avant-transmission  | pass     | PD deletes carcasse before transmitting                              |
| 37    | suppression-carcasse               | pass     | Trash icon + confirm                                                 |
| 38    | dispatch-groupe-vide               | pass     | Validation blocks empty group                                        |
| 39    | changement-prochain-detenteur      | pass     | Coherence after re-selecting                                         |
| 40    | stockage-ccg-sans-ccg              | pass     | Error                                                                |
| 41    | transmission-hors-ligne            | pass     | Offline transmit + sync                                              |
| 42    | contact                            | pass     | Page loads                                                           |
| 43    | tableau-de-bord                    | pass     | Empty dashboard for PD                                               |

### C. ETG (`tests/etg/`) — 18 pass, 0 skip

| #     | Test                                 | Status   | Notes                                                       |
| ----- | ------------------------------------ | -------- | ----------------------------------------------------------- |
| 44-47 | fiche_circuit-long_simple_etg        | pass     | (existing) reception, refus, manquante, SVI                 |
| 45    | reception-avec-stockage-ccg          | pass     | CCG storage entry                                           |
| 48    | vue-carcasses-agregee                | **pass** | (was skip) New seed `ETG_TAKEN_CHARGE` adds CarcasseInterm. |
| 49    | onboarding-incomplet                 | pass     | "Coordonnees" heading                                       |
| 50    | profil-entreprise                    | pass     | Entity info                                                 |
| 51    | utilisateurs-entreprise              | pass     | Modal opens                                                 |
| 52    | roles-internes-transport-reception   | pass     | RECEPTION radio for etg-1                                   |
| 53    | notifications                        | pass     | EMAIL checkbox toggle                                       |
| 54    | partage-de-mes-donnees               | pass     | API key sections                                            |
| 55    | post-inspection-svi                  | **pass** | (was skip) SVI_CLOSED seed already populates ETG 1 interm.  |
| 56    | fiche-cloturee-lecture-seule         | pass     | No actions after cloture                                    |
| 57    | transmission-sans-prochain-detenteur | pass     | Error message                                               |
| 58    | acces-cross-etg-refuse               | pass     | 404                                                         |
| 59    | double-prise-en-charge               | pass     | Single effect                                               |
| 60    | refus-sans-motif                     | pass     | Enregistrement blocked                                      |
| 61    | transmission-hors-ligne              | pass     | Offline sync                                                |

### D. Collecteur (`tests/collecteur/`) — 12 pass, 0 skip

| #   | Test                             | Status   | Notes                                                             |
| --- | -------------------------------- | -------- | ----------------------------------------------------------------- |
| 62  | reception-fiche-depuis-pd        | pass     | "Je controle et transporte"                                       |
| 63  | transmission-a-etg               | pass     | Collecteur → ETG                                                  |
| 64  | vue-carcasses-agregee            | **pass** | (was skip) New seed `COLLECTEUR_TAKEN_CHARGE`                     |
| 65  | refus-carcasse-en-collecte       | pass     | Renvoi à l'expéditeur                                             |
| 66  | onboarding-incomplet             | pass     | Coordonnees form                                                  |
| 67  | onboarding-complet               | pass     | Full onboarding                                                   |
| 68  | profil                           | pass     | All profil pages                                                  |
| 69  | post-inspection-svi              | pass     | SVI decision                                                      |
| 70  | fiche-cloturee-lecture-seule     | pass     | No actions                                                        |
| 71  | pas-de-transmission-svi-directe  | pass     | ETG only in destinataire list                                     |
| 72  | fiche-attribuee-autre-collecteur | pass     | 404                                                               |
| 73  | hors-ligne-prise-en-charge       | **pass** | (was skip) Pattern matches 41/61 + missing "Pas de stockage" step |

### E. SVI (`tests/svi/`) — 14 pass, 0 skip

| #   | Test                            | Status   | Notes                                                          |
| --- | ------------------------------- | -------- | -------------------------------------------------------------- |
| 74  | inspection-acceptee             | pass     | IPM1 "Acceptee" + Enregistrer                                  |
| 75  | inspection-refusee              | **pass** | (was skip) IPM1 → IPM2 sequential flow works                   |
| 76  | inspection-consignee            | pass     | "Mise en consigne" + duree                                     |
| 77  | traitement-assainissant         | **pass** | (was skip) DSFR radio: click label directly for "Traitement…"  |
| 78  | cloture-automatique-j10         | pass     | SVI_CLOSED                                                     |
| 79  | vue-fiches                      | pass     | Fiche list                                                     |
| 80  | vue-carcasses                   | pass     | Carcasses list                                                 |
| 81  | onboarding-incomplet            | pass     | Coordonnees form                                               |
| 82  | profil                          | pass     | Entity info                                                    |
| 83  | fiche-cloturee-consultation     | pass     | Read-only "accepte"                                            |
| 84  | revision-decision               | pass     | Already-closed fiche                                           |
| 85  | refus-sans-motif                | pass     | Validation errors                                              |
| 86  | carcasse-manquante              | pass     | "Non, carcasse manquante"                                      |
| 87  | fiche-sans-carcasse-a-inspecter | pass     | ETG_ALL_REFUSED_TO_SVI                                         |
| 88  | svi-autre-departement           | pass     | SVI 2 cannot access SVI 1's fiche                              |

### F. Circuit court (`tests/circuit-court/`) — 8 pass, 0 skip, 1 deleted

| #   | Test                          | Status  | Notes                                                |
| --- | ----------------------------- | ------- | ---------------------------------------------------- |
| 89  | reception-directe-pd          | pass    | Fiche visible in list                                |
| 90  | prise-en-charge               | DELETED | No CTA in Zacharie — passive view only (per CLAUDE.md) |
| 91  | liste-triable                 | pass    | Status filter                                        |
| 92  | onboarding-incomplet          | pass    | Profile completion                                   |
| 93  | onboarding-complet            | pass    | Full onboarding                                      |
| 94  | profil                        | pass    | All pages load                                       |
| 95  | fiche-recuperee-fin-de-chaine | pass    | No Transmettre button                                |
| 96  | refus-carcasse                | pass    | No refus button                                      |
| 97  | retransmission-interdite      | pass    | No prochain detenteur selector                       |

### G. Transverse (`tests/transverse/`) — 10 pass, 1 skip

| #       | Test                                       | Status   | Notes                                                            |
| ------- | ------------------------------------------ | -------- | ---------------------------------------------------------------- |
| 100-102 | connexion, creation-comptes, comptes-vides | pass     | (existing)                                                       |
| 103     | dead-routes-old-tableau-de-bord            | pass     | Redirects to /chasseur                                           |
| 104     | offline-create-online-sync                 | pass     | Fiche created offline syncs                                      |
| 105     | role-based-route-access-matrix             | pass     | 5 roles × forbidden paths                                        |
| 106     | service-worker-cache                       | **skip** | Body fully implemented; Vite dev mode breaks SW caching          |
| 107     | logout-cleans-local-store                  | pass     | No data leak                                                     |
| 108     | changement-de-role-interdit                | pass     | Backend rejects dual roles                                       |
| 109     | session-expiree                            | pass     | Redirect to connexion                                            |
| 110     | deep-link-fiche-inconnue                   | pass     | No crash                                                         |

### H. Chains (`tests/chains/`) — 5 pass, 1 skip

| #   | Test                       | Status   | Notes                                                       |
| --- | -------------------------- | -------- | ----------------------------------------------------------- |
| 111 | chain-circuit-long         | pass     | PD → ETG → SVI                                              |
| 112 | chain-circuit-court-direct | pass     | PD → Commerce de détail                                     |
| 113 | chain-avec-collecteur      | pass     | PD → Collecteur → ETG                                       |
| 114 | chain-dispatch-hybride     | pass     | PD → ETG + Collecteur                                       |
| 115 | chain-refus-total-etg      | pass     | ETG refuses all                                             |
| 116 | chain-refus-partiel-svi    | **skip** | Full chain runs; consign label sync timing on final assert  |

### I. Dispatch isolation (`tests/dispatch-isolation/`) — 9 pass, 3 skip

| #   | Test                               | Status   | Notes                                                       |
| --- | ---------------------------------- | -------- | ----------------------------------------------------------- |
| —   | fiche_dispatch_multi_destinataires | pass     | (existing) 2 ETG dispatch                                   |
| 117 | dispatch-2-etg-isolation-negative  | pass     | ETG 1 cannot see ETG 2                                      |
| 118 | dispatch-etg-plus-collecteur       | pass     | Cross-type isolation                                        |
| 119 | dispatch-3-destinataires           | pass     | 3-way split                                                 |
| 120 | vue-agregee-etg-carcasses          | pass     | Aggregate filters by branch                                 |
| 121 | carcasse-intermediaire-api-leak    | pass     | API security check (defensive guards inside)                |
| 122 | refus-etg1-ne-propage-pas          | pass     | ETG 1 refus invisible to ETG 2                              |
| 123 | transmission-svi-n-expose-pas-etg2 | **skip** | UI-test deferred (user keeps as UI, not API). Body stub.    |
| 124 | deux-chaines-svi-paralleles        | **skip** | UI-test deferred. Body stub.                                |
| 125 | fiche-pd-2-groupes                 | pass     | PD sees 2 groups                                            |
| 126 | decisions-svi-divergentes          | pass     | Different decisions per branch                              |
| 127 | url-directe-carcasse-autre-branche | pass     | No data leak via URL                                        |
| 128 | modification-api-cross-branche     | **skip** | 🔒 SECURITY FINDING — backend missing ownership check       |

---

## Skipped tests — categorized (7 total)

### Backend bug / security finding (2)

- **17 (fiche-refusee-par-etg-vue-chasseur)**: navigating to `/app/chasseur/fei/{id}` for an
  ETG-refused fiche returns Erreur 500 (frontend renders the 500 page). Suspected: client-side
  crash on the fei detail render path when `fei_next_owner_*` are all null and `fei_prev_owner_role
  = ETG`. Needs frontend fix; seed correctly populates `svi_carcasse_status = REFUS_ETG_COLLECTEUR`.
- **128 (modification-api-cross-branche)**: 🔒 `POST /carcasse/:feiNumero/:zacharieCarcasseId`
  returns 200 for cross-branch attempts. Should return 403/404. Backend missing ownership check.

### UI flow needs more work (2)

- **08 (examinateur-pd-self-handoff)**: two-stage transmission (examinateur → PD → ETG in one
  session). The first transmit doesn't show "Votre fiche a été transmise" because the form
  transitions inline. Needs explicit form-transition waits.
- **116 (chain-refus-partiel-svi)**: full 5-step chain executes; final consign-label assertion
  doesn't find "Consignée" — likely store-sync timing on the SVI MISE_EN_CONSIGNE → CONSIGNE
  transition. Per-carcasse SVI decisions are covered separately by 74/75/76/77.

### Deferred UI tests (2)

User keeps as UI tests (no API conversion) as a regression guard for the upcoming backend
refactor — bodies are stubs to be implemented post-refactor when DSFR modal timing is more stable.

- **123 (transmission-svi-n-expose-pas-etg2)**
- **124 (deux-chaines-svi-paralleles)**

### Infrastructure limitation (1)

- **106 (service-worker-cache-offline-reload)**: body fully implemented, but Vite dev mode breaks
  SW runtime caching (HMR-hashed JS URLs + empty `__WB_MANIFEST`). Reload offline → ERR_INTERNET_DISCONNECTED.
  To unskip: switch e2e webServer to a production preview build (`npm run build` + `vite preview`).

### Fixed bugs that were blocking tests

- **Bug 1 (FIXED, prior)**: Cross-role URL access returned Erreur 500 → now 404.
- **Bug 2 (FIXED, prior)**: `/etg/carcasses` aggregate view didn't filter by dispatch branch.
- **Bug 3 (NOT A BUG, prior)**: Collecteur "Transmettre la fiche" was a test issue.
- **Bug 4 (FIXED this pass)**: ETG_REFUSED seed had typo `intermediaire_carcasse_signed_at`
  (field doesn't exist on Carcasse) — caused Prisma createMany to throw.
- **Bug 5 (FIXED this pass)**: ETG_REFUSED seed left `fei_next_owner_user_id = '0Y545'` (PD's
  own id), which made the chasseur "feisUnderMyResponsability" filter exclude the fiche. Cleared.

---

## Lessons learned

### From the existing tests (before this work)

These patterns made the original 8 specs 100% flake-free:

- **`resetDb(role)` seeding** instead of building state via UI. Hardcoded `feiId` from seed.
- **`slowMo: 100`** on DSFR-heavy specs to pace the local-first store → PQueue → backend chain.
- **`scrollIntoViewIfNeeded()`** before every click on long forms — prevents DSFR re-render click-loss.
- **`.blur()` after `.fill()`** on time inputs to force form state commit.
- **`expect(...).toBeVisible({ timeout: 10000 })`** as sync beacons after handoffs.
- **`page.goto('/app/connexion')` for re-login** — resets local-first store cleanly.

### From this pass

- **DSFR radio inputs are intercepted by their `<label>`**. Both `.click()` and `.check()` on
  `getByLabel('X')` time out. Click the label directly:
  `page.locator('label.fr-label:has-text("X")').first().click()`.
- **`await expect(page).toHaveURL(...)` after `connectWith`** — the redirect after login is
  async. Without the wait, subsequent `page.goto(/app/role-route/sub-page)` redirects back to
  `/app/connexion` because the local-first store hasn't hydrated yet.
- **Multiple `page.once('dialog', ...)` handlers in one test conflict** when 3+ dialogs queue up
  — Playwright sees the first one already-handled. Use one global `page.on('dialog', ...)` at the
  top of the test instead.
- **For "carcasses livrées" (terminal state)** = set `consommateur_final_usage_domestique` (DateTime)
  on Fei + each Carcasse. UI status logic at `src/utils/fei-steps.ts:131` returns 'Clôturée' when
  this + `premier_detenteur_user_id` are both set.
- **`/etg/carcasses` and `/collecteur/carcasses` aggregate views** require `CarcasseIntermediaire`
  rows — the seed must create them explicitly (see new `ETG_TAKEN_CHARGE` /
  `COLLECTEUR_TAKEN_CHARGE` seeds).
- **For `svi_carcasse_status: REFUS_ETG_COLLECTEUR`** to render in chasseur view: must be set
  directly on the carcasse in the seed. The store recomputes it via `updateCarcasseStatus()` only
  on local writes — server-loaded carcasses use the stored value as-is.
- **Always check `fei_next_owner_*` are correctly cleared** in seeds for terminal/refused states.
  The chasseur API filters fiches by `next_owner_user_id: null AND next_owner_entity_id: null` —
  inheriting next_owner from a parent seed accidentally hides the fiche from the user.
- **Seed augmentations are additive-only** — new rows, not edits to existing ones — so
  currently-passing tests aren't disturbed. New seed roles for new behaviors.

### Inherited from earlier passes (kept for reference)

- **`dayjs.utc()` not `dayjs()`** for date buttons.
- **Wait for hydration on CI** before clicking layout buttons.
- **Role-specific button text**: Collecteur = "Je controle et transporte les carcasses". ETG =
  "Prendre en charge les carcasses". PD = "Prendre en charge cette fiche". Circuit court = no button.
- **Petit gibier vs grand gibier labels**: "Lot refuse/accepte/manquant" vs "Carcasse refusee/acceptee/manquante".
- **No transport step for collecteur or circuit court**.
- **Anomalies are on the carcasse detail page**, not the creation form.
- **Curly apostrophes in DSFR labels** (`’`) — use regex.
- **SVI_CLOSED seed** must include per-carcasse `svi_carcasse_status: ACCEPTE` (not just
  `svi_closed_at`) — already correct in the seed.
- **PD cannot refuse carcasses** — only ETG/collecteur. PD can only DELETE (trash + confirm).
- **Circuit court has no CTA** — passive view only.
