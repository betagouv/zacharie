# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zacharie is a French government application (beta.gouv.fr) for tracing game meat (venaison) from hunting to consumption. It follows a **local-first architecture** enabling offline operation with asynchronous sync.

Key domains:

- **FEI (Fiche d'Examen Initial)**: Inspection documents tracking game carcasses
- **Carcasses**: Individual game animals with sanitary data and traceability
- **User roles**: CHASSEUR, COLLECTEUR_PRO, ETG, SVI, COMMERCE_DE_DETAIL, etc.
  - **Rule**: A user shall not have multiple roles. Frontend forbids it; backend should validate and reject.
- **Entities**: Organizations (slaughterhouses, retail, veterinary services)

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Repository Structure

```
zacharie/
├── api-express/        # Express.js backend API (Node.js/TypeScript)
├── app-local-first-react-router/  # React frontend (Vite, React Router, DSFR)
├── expo/               # React Native wrapper (WebView-based mobile app)
├── e2e/                # Playwright end-to-end tests
├── materialized-views/ # Database materialized views
└── doc/                # Project documentation
```

## Development Commands

### API (api-express/)

```bash
npm run dev              # Start dev server on port 3235 (runs prisma setup first)
npm run dev-test         # Start test server on port 3291 with test DB
npm run test             # Run vitest tests
npm run test:watch       # Run vitest in watch mode
npm run typecheck        # TypeScript type checking
npm run format           # Prettier formatting
```

### Frontend (app-local-first-react-router/)

```bash
npm run dev              # Start Vite dev server on port 3234
npm run vitest           # Run vitest tests
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking
npm run build            # Production build
```

### E2E Tests (e2e/)

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

### Mobile (expo/)

```bash
npm run start            # Start Expo dev server
npm run prebuild         # Generate native projects
npm run ios              # Run on iOS simulator
npm run android          # Run on Android emulator
```

## Architecture

### Backend (api-express/)

- **Express** REST API with **Prisma** ORM on PostgreSQL
- Controllers in `src/controllers/` handle routes
- Public API v1 in `src/controllers/v1/` with API key authentication
- JWT authentication via Passport for internal routes
- Swagger docs at `/v1/docs/` (manually maintained, validated by `swagger-validation.test.ts`)

### Frontend (app-local-first-react-router/)

- **React 19** with **React Router 7**
- **Local-first** with IndexedDB storage via Zustand stores (`src/zustand/`)
- **DSFR** (French government design system) via `@codegouvfr/react-dsfr`
- **Tailwind CSS** for styling
- Service worker for offline support (`src/service-worker.ts`)
- Routes defined in `src/App.tsx`, components in `src/routes/`

### Database

- **Prisma** schema at `api-express/prisma/schema.prisma`
- Create migrations: `npm run prisma-create-migration <name>` (in api-express/)
- Schema is copied to frontend via `scripts/copy-schema-to-app-side.js`

### API Structure

Two API types:

1. **Internal API** (used by app): JWT auth, full CRUD on user data
2. **Public API v1** (`/v1/`): API key auth for third parties, read-only access

## Data Migration Rules

- **NEVER write backward-compatibility or data-retroactivity code.** When the data model changes (schema, enums, field names, formats), update the code to work with the new model only. Do NOT add runtime transformations, fallbacks, or migration logic in application code to handle old data formats. Old data must be migrated at the database level (Prisma migrations, SQL scripts), not patched at read-time in the app.
- Concretely: no `if (oldField) { newField = oldField }`, no `value ?? legacyValue`, no `// backward compat` shims. Just write code for the current schema.

## Key Conventions

- Node.js >= 20 required
- TypeScript throughout
- Prettier config in each package.json: { "singleQuote": true, "trailingComma": "es5", "semi": true, "printWidth": 110, "tabWidth": 2 }
- Language: French for user-facing content, English for code
- Pre-commit hooks run `format` and `typecheck`

## Environment Variables

API requires:

- `POSTGRESQL_ADDON_URI`: PostgreSQL connection string

E2E tests require:

- `PGBASEURL`: PostgreSQL base URL for test DB setup
- `PGDATABASE`: Test database name (default: `zacharietest`)

## Local-First Sync (`app-local-first-react-router/src/zustand/store.ts`)

The frontend stores data in IndexedDB via Zustand. Changes apply locally first (`is_synced = false`), then sync to server via PQueue:

- **Queue**: `concurrency: 1`, 30ms throttle to prevent race conditions
- **Order**: FEIs → Carcasses → CarcassesIntermediaires → Logs (each waits for dependencies)
- **Conflict resolution**: Compares `updated_at`, keeps newest
- **AbortController per record**: Cancels in-flight requests if same record changes again

Key helpers in `@app/utils/get-carcasse-intermediaire-id.ts` for composite IDs (CarcasseIntermediaire uses `fei_numero + zacharie_carcasse_id + intermediaire_id`).

## Key Files

- `api-express/prisma/schema.prisma` — Database models
- `app-local-first-react-router/src/zustand/store.ts` — State & sync logic
- `app-local-first-react-router/src/utils/load-feis.ts` — Data loading with local/remote merge

## Playwright E2E Conventions

Rules for writing Playwright tests in `e2e/`. The current suite is flake-free; follow these or you break that.

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
