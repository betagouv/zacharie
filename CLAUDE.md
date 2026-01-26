# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zacharie is a French government application (beta.gouv.fr) for tracing game meat (venaison) from hunting to consumption. It follows a **local-first architecture** enabling offline operation with asynchronous sync.

Key domains:
- **FEI (Fiche d'Examen Initial)**: Inspection documents tracking game carcasses
- **Carcasses**: Individual game animals with sanitary data and traceability
- **User roles**: CHASSEUR, COLLECTEUR_PRO, ETG, SVI, COMMERCE_DE_DETAIL, etc.
- **Entities**: Organizations (slaughterhouses, retail, veterinary services)

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

## Key Conventions

- Node.js >= 20 required
- TypeScript throughout
- Prettier config: semicolons, 110-120 char width, single quotes in backend
- Language: French for user-facing content, English for code
- Pre-commit hooks run `format` and `typecheck`

## Environment Variables

API requires:
- `POSTGRESQL_ADDON_URI`: PostgreSQL connection string

E2E tests require:
- `PGBASEURL`: PostgreSQL base URL for test DB setup
- `PGDATABASE`: Test database name (default: `zacharietest`)
