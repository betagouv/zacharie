# CLAUDE.md — E2E Tests (Playwright)

Scoped rules for `e2e/`. Loaded in addition to the root `CLAUDE.md`.

## Commands

```bash
# First time setup:
npm i && npm run test:init-db  # Initialize test database (needs PGBASEURL env var)

# Run tests via VSCode Playwright extension (recommended)
# Or manually:
npm run test:start-app-for-record  # Start app for recording tests
npm run test:start-api-for-record  # Start API for recording tests
npx playwright test               # Run all tests
npx playwright test <file>.spec.ts  # Run specific test file
```

Test accounts: `admin1@example.org` through `admin12@example.org`, password: `secret`

Required env vars:

- `PGBASEURL`: PostgreSQL base URL for test DB setup
- `PGDATABASE`: Test database name (default: `zacharietest`)

## Conventions

The current suite is flake-free; follow these or you break that.

- **Seed, don't setup.** `resetDb(role)` in `beforeAll`/`beforeEach`. Hardcode `feiId` from seed. Never build state via UI if a seed exists.
- **Wait on outcomes, not wall-clock time.** `await expect(locator).toBeVisible({ timeout })`. No `waitForTimeout`.
- **Assert explicit sync beacons** after handoffs: "Votre fiche a été transmise" (chasseur side) or "a été notifié" (intermediaires). Use `timeout: 10000` minimum.
- **Handoff UX is role-specific.** Chasseur sees a dedicated confirmation page; ETG/collecteur/CC see a toast/alert. Assert the right beacon per role — do NOT factor this into a generic helper.
- **`scrollIntoViewIfNeeded()` before every click** on long DSFR forms. Prevents click-loss from DSFR re-renders.
- **`.blur()` after `.fill()` on time/date inputs.** Forces the form state commit before the next action.
- **`slowMo: 100`** via `test.use({ launchOptions })` on DSFR-heavy specs. Paces the store → PQueue → backend chain.
- **Surgical `setTimeout` only with a `// why` comment** (e.g. DSFR modal re-render storm). Never as a generic fix.
- **Re-login after logout = `page.goto('/app/connexion')`**, never nav clicks. Resets local-first store cleanly. Use the `logout-and-connect` helper for multi-actor specs.
- **Multi-actor flows in one test** when verifying sync round-trip through the real backend.
- **`toMatchAriaSnapshot` for lists/summaries** with dynamic dates/numbers (regex-tolerant).
- **Mobile viewport for CHASSEUR specs** (`350x667`, `isMobile`, `hasTouch`). Desktop default for ETG/SVI/collecteur/circuit-court.
- **Role/accessible selectors first** (`getByRole`, `getByLabel`). CSS fallback only for DSFR widgets, e.g. `[class*='select-prochain-detenteur']`.
- **Role-based route access**: each role layout redirects to `/app/connexion` via `<Navigate>` if user doesn't have the matching role (see `chasseur-layout.tsx`). Assert redirection, not 404.
- **Seed starting states** (from `FeiOwnerRole` enum): `EXAMINATEUR_INITIAL`, `PREMIER_DETENTEUR`, `ETG`, `COLLECTEUR_PRO`, `SVI`, `COMMERCE_DE_DETAIL`. Extend `populate-test-db.ts` to add more.
- **Test DB is ephemeral**: `resetDb(role)` wipes and re-seeds; tests in the same file share state only via `beforeAll`. Use `beforeEach` when tests must be independent.
