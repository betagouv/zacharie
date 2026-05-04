# E2E Tests — Status & Lessons Learned

Updated 2026-04-30. ~131 specs across 9 folders (after split of 32 → 3 + 33 → 2; deletions of 14 + 90).

## Results: ~127 pass, 4 skip, 0 fail

4 hard skips remain (down from 25 then 7). All four are skipped for documented reasons that
require a code change *outside the test* — not test-quality issues:

- **106** — infrastructure limitation (Vite dev mode breaks SW caching)
- **121** — 🔒 backend security finding (missing ownership check on GET /carcasse-intermediaire)
- **124** — ⚠️ backend data-model limitation (`svi_assigned_at` is fei-level, not per-branch)
- **128** — 🔒 backend security finding (missing ownership check on POST /carcasse/:id)

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

### A. Examinateur (`tests/examinateur/`) — 23 pass, 0 skip, 1 deleted

| #   | Test                                   | Status  | Notes                                                                |
| --- | -------------------------------------- | ------- | -------------------------------------------------------------------- |
| 01  | creation-fiche-grand-gibier-mono       | pass    | 1 daim, full flow, transmet                                          |
| 02  | fiche_circuit-long_simple_examinateur  | pass    | (existing) 4 daims, transmet                                         |
| 03  | creation-fiche-petit-gibier-lot        | pass    | Pigeons x10                                                          |
| 04  | creation-fiche-mixte                   | pass    | 3 daims + 10 pigeons                                                 |
| 05  | creation-fiche-anomalies               | pass    | Anomalies via referentiel tree modal                                 |
| 06  | brouillon-persistance                  | pass    | Draft fiche appears in list                                          |
| 07  | edition-carcasse-depuis-detail         | pass    | Edit anomalies on carcasse detail page                               |
| 08  | examinateur-pd-self-handoff            | pass    | (was skip) Self-handoff flow transitions inline; no extra wait needed |
| 09  | onboarding-complet                     | pass    | (was skip) DSFR radio: click label not input + fill required CFEI    |
| 10  | onboarding-incomplet-acces-restreint   | pass    | ChasseurDeactivated for incomplete profile                           |
| 11  | onboarding-partiel-formation-manquante | pass    | est_forme_a_l_examen_initial null → deactivated                      |
| 12  | profil-examinateur                     | pass    | Coordonnees persist after reload                                     |
| 13  | ccg-creation-profil                    | pass    | Uses pre-seeded CCG-01                                               |
| 14  | ccg-edition                            | DELETED | Edit pencil only on pre-registered CCGs (none seeded); body was stub |
| 15  | fiche-svi-cloturee-vue-chasseur        | pass    | SVI_CLOSED seed                                                      |
| 16  | fiche-circuit-court-livree             | pass    | (was skip) New seed `COMMERCE_DE_DETAIL_DELIVERED`                   |
| 17  | fiche-refusee-par-etg                  | pass    | (was skip) Seed fixed: ETG_REFUSED is terminal-at-ETG, not bounced-to-PD |
| 18  | date-future-refusee                    | pass    | Edge case                                                            |
| 19  | heure-evisceration-invalide            | pass    | Edge case                                                            |
| 20  | retirer-carcasse                       | pass    | Trash icon + window.confirm                                          |
| 21  | zero-carcasse-transmettre-disabled     | pass    | Transmettre disabled                                                 |
| 22  | double-clic-transmettre                | pass    | dblclick → 1 fiche                                                   |
| 23  | deconnexion-pendant-formulaire         | pass    | Store cleaned                                                        |

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
| 53    | notifications                        | pass     | EMAIL checkbox toggle (defensive soft-skip removed; now hard-fails on missing checkbox) |
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

### H. Chains (`tests/chains/`) — 6 pass, 0 skip

| #   | Test                       | Status | Notes                                                         |
| --- | -------------------------- | ------ | ------------------------------------------------------------- |
| 111 | chain-circuit-long         | pass   | PD → ETG → SVI                                                |
| 112 | chain-circuit-court-direct | pass   | PD → Commerce de détail                                       |
| 113 | chain-avec-collecteur      | pass   | PD → Collecteur → ETG                                         |
| 114 | chain-dispatch-hybride     | pass   | PD → ETG + Collecteur                                         |
| 115 | chain-refus-total-etg      | pass   | ETG refuses all                                               |
| 116 | chain-refus-partiel-svi    | pass   | (was skip) MISE_EN_CONSIGNE save needs pieces+lésions filled  |

### I. Dispatch isolation (`tests/dispatch-isolation/`) — 10 pass, 3 skip

| #   | Test                               | Status   | Notes                                                       |
| --- | ---------------------------------- | -------- | ----------------------------------------------------------- |
| —   | fiche_dispatch_multi_destinataires | pass     | (existing) 2 ETG dispatch                                   |
| 117 | dispatch-2-etg-isolation-negative  | pass     | ETG 1 cannot see ETG 2                                      |
| 118 | dispatch-etg-plus-collecteur       | pass     | Cross-type isolation                                        |
| 119 | dispatch-3-destinataires           | pass     | 3-way split                                                 |
| 120 | vue-agregee-etg-carcasses          | pass     | Aggregate filters by branch                                 |
| 121 | carcasse-intermediaire-api-leak    | **skip** | 🔒 SECURITY FINDING — GET /carcasse-intermediaire missing ownership check |
| 122 | refus-etg1-ne-propage-pas          | pass     | ETG 1 refus invisible to ETG 2                              |
| 123 | transmission-svi-n-expose-pas-etg2 | pass     | (was skip) ETG 1 → SVI 1, SVI 1 only sees ETG 1's branch   |
| 124 | deux-chaines-svi-paralleles        | **skip** | ⚠️ BACKEND LIMITATION — multi-branch SVI not in data model |
| 125 | fiche-pd-2-groupes                 | pass     | PD sees 2 groups                                            |
| 126 | decisions-svi-divergentes          | pass     | Different decisions per branch                              |
| 127 | url-directe-carcasse-autre-branche | pass     | No data leak via URL                                        |
| 128 | modification-api-cross-branche     | **skip** | 🔒 SECURITY FINDING — POST /carcasse missing ownership check |

---

## Skipped tests — categorized (4 total)

All four skips are blocked on a code change *outside the test itself* (backend ownership checks,
backend data-model rework, or the e2e infrastructure). The test bodies are written and ready —
once the upstream change lands, removing `test.skip` turns each into a regression guard.

### 🔒 Backend security findings — missing ownership checks (2)

Both endpoints only call `passport.authenticate('user', ...)` (JWT validity) and then operate on
the requested resource without checking that the user has any relationship to it. Any
authenticated user can read/modify any carcasse on any fiche by knowing the IDs.

- **121 (carcasse-intermediaire-api-leak)** — `GET /carcasse-intermediaire/:fei_numero/:intermediaire_id/:zacharie_carcasse_id`
  (`api-express/src/controllers/carcasse-intermediaire.ts:165-228`) returns **200** with another
  ETG's CarcasseIntermediaire data. Expected: 403/404. Test reaches the leak check (uses
  POST /fei/refresh to discover ETG 2's intermediaire_id, then GETs as ETG 1) and asserts the
  expected status — currently fails with 200.
- **128 (modification-api-cross-branche)** — `POST /carcasse/:fei_numero/:zacharie_carcasse_id`
  (`api-express/src/controllers/carcasse.ts:509-551`, calling `saveCarcasse` line 43+) returns
  **200** when an ETG modifies another ETG's carcasse. Expected: 403/404. Test executes the full
  dispatch + cross-branch POST and asserts 403/404 — currently fails with 200.

**Fix shape**: in both handlers, before mutating/reading, verify that the user is one of:
the carcasse's `created_by_user_id` / `examinateur_initial_user_id` / `premier_detenteur_user_id` /
`current_owner_user_id`, OR works for an entity (`CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY`) matching
`current_owner_entity_id`, OR is on a `CarcasseIntermediaire` for this carcasse. Otherwise 403.

### ⚠️ Backend data-model limitation (1)

- **124 (deux-chaines-svi-paralleles)** — the model does not support multi-branch parallel SVI
  assignment. `svi_assigned_at` and `svi_entity_id` are **fei-level fields** (one per Fei record),
  not per-branch / per-CarcasseIntermediaire. Once ETG 1 transmits to SVI 1, `fei.svi_assigned_at`
  gets set, which excludes the fei from `feisToTake` / `feisOngoing` for ETG 2 (filter at
  `api-express/src/controllers/fei.ts:941, 977`). Even if ETG 2 took charge first, their
  subsequent SVI 2 transmission would overwrite `fei.svi_entity_id` (SVI 1 → SVI 2), breaking
  SVI 1's view of the fei. Single-branch SVI isolation is verified by test **123** (passing).

**Fix shape**: track SVI assignment per-branch — either move `svi_assigned_at` / `svi_entity_id`
onto `CarcasseIntermediaire` (or per-branch fei-state), or add a parallel "branch" record that
holds the SVI assignment for one slice of carcasses on the fei.

### Infrastructure limitation (1)

- **106 (service-worker-cache-offline-reload)** — body fully implemented, but the e2e webServer
  runs `npm run dev-test` (Vite dev mode). In dev:
  - `__WB_MANIFEST` is empty (no precache list — only filled at build time)
  - HMR-hashed JS URLs change per request, defeating the SW's runtime cache
  - Reload offline → `net::ERR_INTERNET_DISCONNECTED` because the SW didn't intercept the bundle

**Fix shape**: switch the e2e webServer command from `npm run dev-test` to a production preview
(`npm run build` + `vite preview`) in `playwright.config.ts:71-86`, so `__WB_MANIFEST` is
populated and asset URLs are stable.

---

## Coverage gaps — no test exists yet

Distinct from skipped tests (those have bodies waiting on upstream fixes). These are **missing
specs** identified during a 2026-04-30 gap-analysis pass. Organized by role. Most need a new
spec only; a few also need a backend fix (called out per-gap).

SVI gaps deferred to a later pass.

### Examinateur initial — gaps

#### EI-Gap 1 — Modify-during-transit (EI or PD)

No test covers the **intermediate** state: a fiche has been transmitted to the next actor
(ETG / collecteur / CDD) but is not yet at a terminal state (SVI clôturée / livrée / refusée).
Existing read-only / lecture-seule tests (`examinateur/15`, `16`, `17`; `premier-detenteur/34`,
`35`) all assert **terminal** states.

**What to test**: after PD transmits to ETG, EI revisits the fiche → assert which fields are
locked vs. still editable. Same for PD revisiting after the ETG took charge but before SVI.

**Why it matters**: bugs here would let an upstream actor mutate carcasse data after a downstream
actor has already inspected/signed it — a traceability hole.

#### EI-Gap 2 — CCG creation without numéro d'identification

`3b-mes-ccgs.tsx` has two distinct branches:

- **With `numero_ddecpp`**: small `InputCCG` form, just the identifier. Covered by test `13`
  (profile) and `30` (inline during transmission).
- **Without `numero_ddecpp`** (`newCCGExpanded = true`): full pre-registration form (nom,
  SIRET, adresse, code postal, ville, alert about declaring with DDPP/DDETSPP). **Not covered
  by any spec.**

**What to test**: chasseur picks "Oui mais la chambre froide n'a pas de numéro d'identification",
fills the full form, submits → assert the CCG is created with `ccg_status: 'Pré-enregistré dans
Zacharie'` and the "À DÉCLARER" badge renders.

#### EI-Gap 3 — Entity visibility isolation for COMMERCE_DE_DETAIL

ETG and COLLECTEUR_PRO are publicly visible in dispatch pickers. **COMMERCE_DE_DETAIL is
user-scoped**: only visible to users who have a `CAN_TRANSMIT_CARCASSES_TO_ENTITY` relationship
with that CDD. Test `29` exercises the happy path (PD dispatches to a CDD they own); no test
asserts the negative case.

**What to test**: seed two PDs each owning their own CDD. Connect as PD-A → assert PD-B's CDD
is NOT in the prochain-détenteur picker. Same assertion via API (the entity list endpoint
should not leak it).

**Why it matters**: a leak here would expose private business relationships across users.

#### EI-Gap 4 — Cross-EI fiche isolation

`dispatch-isolation/` covers ETG-to-ETG and SVI-to-SVI cross-branch leaks well (tests 117–127).
**No equivalent for the examinateur layer**: nothing asserts that EI@orgA cannot see a fiche
created by EI@orgB.

**What to test**: seed two examinateurs. EI-A creates a fiche. Connect as EI-B → assert the
fiche is absent from the list AND a direct `/app/chasseur/fei/{id}` URL returns 404 (not 500,
not the fiche).

#### EI-Gap 5 — Test 39 has no real assertion

`premier-detenteur/39-changement-prochain-detenteur` carries a `// TODO: verify expected
behavior (reset ou conservé ?)` comment. The test changes prochain détenteur from ETG 1 →
ETG 2 after picking stockage CCG, then only asserts "ETG 2 visible" — it does NOT verify what
happens to the stockage selection (reset to default? carried over?). Effectively unverified.

**What to test**: decide the spec'd behavior (ask product), then assert it. If stockage should
reset on detenteur change → assert the radio is back to default. If preserved → assert it's
still "Carcasses déposées dans un Centre".

### Premier détenteur — gaps

#### PD-Gap 1 — Auto-activation at end of onboarding (no `numero_cfei`)

**Spec'd behavior** (clarified 2026-04-30): a CHASSEUR without `numero_cfei` is a pure PD.
Activation at the end of onboarding is automatic — no admin step required. (A CHASSEUR with
`numero_cfei` is an EI and goes through a separate path; see `examinateur/09-onboarding-complet`.)

**Coverage**: PD activation is exercised implicitly by every spec that connects as
`premier-detenteur@example.fr`, but **no test asserts the auto-activation contract** —
i.e. "fresh onboarded chasseur with no CFEI lands in the active app, not on the deactivated
screen, without any admin action".

**What to test**: complete the PD onboarding flow as a fresh user (no CFEI), assert the
landing page is `/app/chasseur` (not `ChasseurDeactivated`), assert a "Nouvelle fiche" CTA
is present.

#### PD-Gap 2 — PD sees fiche transmitted to my association (vs. directly to me)

`32a-profil-informations-de-chasse` confirms the seeded `CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY`
relation with "Association de chasseurs" exists. **No test exercises the consequence**: a
fiche transmitted to that association must appear in this PD's list.

**What to test**: seed a fiche assigned to `Association de chasseurs` (`fei_next_owner_entity_id`).
Connect as PD-A who has CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY on that association → assert
the fiche is in the list and openable. As PD-B without the relation → assert it is NOT.

#### PD-Gap 3 — Create new association from profil (existing PD path)

`transverse/creation-comptes.spec.ts:195-202` exercises "Créer une nouvelle association" but
only **during account creation**. The same UI in `chasseur-associations-de-chasse.tsx` is
also reachable from `/app/chasseur/profil` for an existing PD via the "Me rattacher à une
autre entité" → "Créer une nouvelle association" button — **untested from the profil entry
point**.

**What to test**: existing PD navigates to profil → associations → creates a brand-new
association → assert the relation is created with `status = ADMIN`, the entity appears in
the user's list with the ADMIN-only "users view" enabled.

#### PD-Gap 4 — PD as ADMIN invites users to association

A PD who creates an association becomes its ADMIN and can invite other users (the
`enableUsersView={relation.status === EntityRelationStatus.ADMIN}` branch in
`chasseur-associations-de-chasse.tsx:184`). **No test covers the invitation flow.**

**What to test**: PD-A is ADMIN of association X → invites PD-B → PD-B sees X in their
profil → PD-B can pick X as PD-on-behalf when transmitting.

#### PD-Gap 5 — CFEI flip deactivates a PD

**Spec'd behavior**: an activated PD who later fills `numero_cfei` becomes an EI candidate
and is deactivated until completing the EI-specific onboarding step (formation, etc.). They
cannot create new fiches and cannot see existing fiches.

**Coverage**: none. `examinateur/11-onboarding-partiel-formation-manquante` covers the
inverse case (CFEI present + formation missing → deactivated) but not the **flip from
activated PD to deactivated EI candidate**.

**What to test**: connect as activated PD → POST `numero_cfei` to `/api/action/user/...` →
reload → assert ChasseurDeactivated screen, assert no fiche access (list empty + direct URL
returns 404 / redirect).

#### PD-Gap 6 — Deactivated user data leak (any role) ⚠️ KNOWN BROKEN

**Spec'd behavior**: a deactivated user (any role) must see no data — no fiches, no
carcasses, nothing. **Currently broken**: a previously-activated user who downloaded data
into the local-first store (IndexedDB) can still see that downloaded data after
deactivation, because `ChasseurDeactivated` (or equivalent) is the layout-level gate but
the local store isn't purged on deactivation.

**Test status**: any spec written for this would need `test.skip` with a comment pointing
at the missing local-store purge on deactivation, until the bug is fixed.

**Fix shape**: on deactivation (server side returns user with `activated_at: null`),
clear the local-first IndexedDB stores (`fei`, `carcasse`, `carcasse-intermediaire`, `log`)
in the layout that detects the deactivation, and route to the deactivated screen. Then the
test asserts that downloaded fiches disappear from the list after a deactivation event.

### ETG / Collecteur — gaps

ETG and Collecteur share most behavior, except: **Collecteur cannot transmit to SVI** (only
ETG can). Both can sous-traiter.

#### ETG-Gap 1 — Sous-traitance (any actor delegates to a third party)

**Spec'd behavior**: both ETG and Collecteur can sous-traiter the prise-en-charge to anyone.
**No test covers this path.**

**What to test**: ETG receives fiche → assigns sous-traitant → sous-traitant connects, sees
the fiche, performs the prise-en-charge, transmits onward. Same for Collecteur.

#### ETG-Gap 2 — "Transporte et réceptionne" branch

**Spec'd behavior**: when previous détenteur (PD) selected "Le transport est réalisé par un
collecteur professionnel", and the ETG clicks "Je prends en charge les carcasses", the ETG
gets a combined transport + réception flow (vs. the standard reception-only flow when PD
transported themselves).

**Coverage**: existing 44–47 cover the standard reception path; **no test asserts the
combined transport+réception variant.**

**What to test**: PD seed with `transporteur_type = COLLECTEUR_PROFESSIONNEL` → connect as
ETG → assert "Je transporte et réceptionne" CTA (text differs from "Prendre en charge"),
complete the combined flow, transmit.

#### ETG-Gap 3 — Zero accepted carcasses → Transmettre blocked

**Spec'd behavior**: if every carcasse is refusée or manquante (none accepted), ETG /
Collecteur cannot transmit. (Distinct from `etg/57-transmission-sans-prochain-detenteur`
which blocks on missing destinataire, and `etg/60-refus-sans-motif` which blocks the
individual refus save without a motif.)

**What to test**: seed an ETG-stage fiche with all 4 carcasses set to REFUS_ETG_COLLECTEUR
(or MANQUANTE) → connect as ETG → assert Transmettre is disabled OR yields a validation
error referencing "aucune carcasse acceptée".

#### ETG-Gap 4 — `check_manuel` UI dual-branch

**Spec'd behavior** (per `etg-carcasse.tsx:75,113,279`):
- Default fast path: ETG clicks "Prendre en charge" → all carcasses default to "Acceptée"
  but **the "Acceptée" badge is NOT shown** (implicit acceptance).
- Manual-check path (`check_manuel = true`): each carcasse explicitly shows "Acceptée par
  [ETG name]".

**Coverage**: `etg/fiche_circuit-long_simple_etg.spec.ts:124,128` snapshots
"Acceptée par ETG 1" — i.e. only the `check_manuel = true` branch. **No test covers the
default fast-path** where the badge must be absent.

**What to test**: ETG takes charge without manually toggling each carcasse → assert the
"Acceptée par X" text is NOT present on the carcasse rows. Same for Collecteur
(`collecteur-carcasse.tsx:72,109,222`).

#### ETG-Gap 5 — Modify carcasse status after SVI transmission

**Spec'd behavior**: after transmitting to SVI, ETG / Collecteur can still mutate any
carcasse's status (Acceptée ↔ Manquante ↔ Refusée ↔ etc.). Distinct from
`etg/55-post-inspection-svi` (which covers viewing the SVI decision) and
`etg/56-fiche-cloturee-lecture-seule` (which covers post-clôture read-only).

**What to test**: seed a fiche transmitted to SVI but **not yet clôturée** → connect as
ETG → flip a carcasse from Acceptée to Manquante → save → reload → assert the change
persisted and the SVI side reflects the new status. Same for Collecteur.

#### ETG-Gap 6 — "Enregistrer" disabled until date change on prise-en-charge

**Spec'd behavior** (per `etg/fiche_circuit-long_simple_etg.spec.ts:547` comment):
"Prise en charge des carcasses acceptées" is set by default when ETG clicks "Prendre en
charge". The "Enregistrer" button is **disabled by default** because nothing has changed.
Only when the date is modified does Enregistrer become enabled.

**Coverage**: only mentioned in a code comment in the existing spec; **not asserted**.

**What to test**: ETG clicks "Prendre en charge" → assert `Enregistrer` is disabled →
modify the prise-en-charge date → assert `Enregistrer` becomes enabled → click → assert
save success. Same for Collecteur.

### SVI — gaps

Deferred to a later pass.

---

## Out-of-scope clarifications from the gap-analysis pass

- **Date shortcuts**: the app exposes exactly **one** shortcut button — "Définir comme étant
  la date du jour et maintenant" — exercised in 7+ specs. There are no hier / avant-hier
  shortcuts to test.
- **EI selecting a different PD via CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY** (`08`): now passing
  (was previously skipped). Self-handoff path is verified end-to-end.
- **PD activation does not require admin approval**: a CHASSEUR without `numero_cfei` is
  auto-activated at end of onboarding (vs. EI which requires the CFEI + formation gates).
- **Collecteur ≠ ETG only on SVI**: collecteur cannot transmit to SVI (covered by
  `collecteur/71-pas-de-transmission-svi-directe`). All other reception / refus / transport /
  sous-traitance behavior is shared.

### Fixed bugs that were blocking tests

- **Bug 1 (FIXED, prior)**: Cross-role URL access returned Erreur 500 → now 404.
- **Bug 2 (FIXED, prior)**: `/etg/carcasses` aggregate view didn't filter by dispatch branch.
- **Bug 3 (NOT A BUG, prior)**: Collecteur "Transmettre la fiche" was a test issue.
- **Bug 4 (FIXED this pass)**: ETG_REFUSED seed had typo `intermediaire_carcasse_signed_at`
  (field doesn't exist on Carcasse) — caused Prisma createMany to throw.
- **Bug 5 (FIXED this pass)**: ETG_REFUSED seed had wrong owner state (`fei_current_owner_role =
  PREMIER_DETENTEUR` while carcasses had `svi_carcasse_status = REFUS_ETG_COLLECTEUR`). Real
  semantics: when ETG refuses ALL carcasses, the fiche **stays at the ETG** with
  `intermediaire_closed_at` set — it does NOT bounce back to the PD. This inconsistent state was
  causing Erreur 500 on `/app/chasseur/fei/{id}`.
- **Bug 6 (FIXED this pass)**: Test 116 was failing the consigne assertion because the
  MISE_EN_CONSIGNE save needs **pieces inspectées + lésions** filled in addition to durée — the
  save was silently rejected by the form's `missingFields` validation, and the global dialog
  handler auto-accepted the error popup, hiding the failure. See test 76 for the validation rule.

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
