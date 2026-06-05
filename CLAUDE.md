# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

Zacharie is a French government application (beta.gouv.fr) for tracing game meat (venaison) from hunting to consumption. It follows a **local-first architecture** enabling offline operation with asynchronous sync.

Stack:

- **Backend**: Express + Prisma + PostgreSQL (Node.js >= 20, TypeScript)
- **Frontend**: React 19 + React Router 7 + Vite + DSFR + Tailwind, IndexedDB via Zustand (local-first)
- **Mobile**: Expo (WebView wrapper)
- **E2E**: Playwright

Key domains:

- **FEI (Fiche d'Examen Initial)**: Inspection documents tracking game carcasses
- **Carcasses**: Individual game animals with sanitary data and traceability
- **User roles**: CHASSEUR, COLLECTEUR_PRO, ETG, SVI, COMMERCE_DE_DETAIL, etc.
- **Entities**: Organizations (slaughterhouses, retail, veterinary services)
- **Circuit court**: Commerce de détail / boucher receives carcasses directly from PD. No CTA in Zacharie — passive view only (fiches + carcasses). No SVI inspection needed.

## Hard Rules (non-negotiable)

- **One role per user.** A user shall not have multiple roles. Frontend forbids it; backend must validate and reject.
- **Never write backward-compatibility or data-retroactivity code.** When the data model changes (schema, enums, field names, formats), update the code to work with the new model only. No runtime transformations, fallbacks, or migration logic in app code to handle old formats. Old data is migrated at the DB level (Prisma migrations, SQL scripts), never patched at read-time.
- **Never roll your own logout sequence.** Call `disconnect(...)` (full logout) or `clearLocalAppState(reason)` (session swap). See @app-local-first-react-router/CLAUDE.md.
- **Never navigate via `window.location.href`** in the frontend — it ejects the user from the Expo WebView into Safari. Use `pushState` + `popstate`.

## Anti-Patterns (never do)

- No `if (oldField) { newField = oldField }`, no `value ?? legacyValue`, no `// backward compat` shims. Write code for the current schema only.
- No hand-rolled `useUser.setState({ user: null })` + `clearCache()` + `navigate(...)` logout.
- No `window.location.href = ...` navigation.
- No `waitForTimeout` / wall-clock waits in E2E — assert on outcomes.

## Preferences

- French for user-facing content, English for code.
- Prettier (config in each package.json): `singleQuote: true, trailingComma: "es5", semi: true, printWidth: 110, tabWidth: 2`.
- Prefer separate API routes for distinct data sections.
- Default to the simplest option in first iterations; no conditional UX unless explicitly requested.

## Success Criteria

Good implementations:

- work offline-first — changes apply locally, then sync without data loss
- leave no stale Zustand/local state leaking across sessions (breaks delta sync)
- enforce role/auth constraints on the backend, not just the frontend
- migrate data at the DB level rather than patching at read-time
- keep E2E specs flake-free (seed-driven, outcome-asserted)

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give a list of unresolved questions to answer, if any.

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

Scoped instructions (read when working in these areas):

- Backend (email inventory upkeep) → @api-express/CLAUDE.md
- Frontend (local-first sync, disconnect flow) → @app-local-first-react-router/CLAUDE.md
- E2E tests (Playwright conventions) → @e2e/CLAUDE.md

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

Frontend & E2E commands: see the scoped CLAUDE.md files above.

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

Two API types:

1. **Internal API** (used by app): JWT auth, full CRUD on user data
2. **Public API v1** (`/v1/`): API key auth for third parties, read-only access

### Database

- **Prisma** schema at `api-express/prisma/schema.prisma`
- Create migrations: `npm run prisma-create-migration <name>` (in api-express/)
- Schema is copied to frontend via `scripts/copy-schema-to-app-side.js`

### Frontend

Local-first sync and the disconnect/logout flow are deep topics — see @app-local-first-react-router/CLAUDE.md.

## Conventions

- Node.js >= 20 required; TypeScript throughout.
- Pre-commit hook runs `prettier --write` on staged files via lint-staged (husky). Typecheck is NOT enforced at commit time — run `npm run typecheck` manually or rely on CI.

## Environment Variables

API requires:

- `POSTGRESQL_ADDON_URI`: PostgreSQL connection string

E2E env vars: see @e2e/CLAUDE.md.
