# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

Zacharie is a French government application (beta.gouv.fr) for tracing game meat (venaison) from hunting to consumption. It follows a **local-first architecture** enabling offline operation with asynchronous sync.

| Dossier                            | Stack                                                         | Rôle                            |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------- |
| `api-express/`                     | Express + Prisma + PostgreSQL (Node.js >= 20, TS)             | API REST (port 3235)            |
| `app-local-first-react-router/`    | React 19 + React Router 7 + Vite + DSFR + Tailwind + Zustand  | Frontend local-first (port 3234)|
| `expo/`                            | Expo (WebView wrapper)                                        | App mobile iOS/Android          |
| `e2e/`                             | Playwright                                                    | Tests end-to-end                |
| `materialized-views/`              | SQL                                                           | Vues matérialisées PostgreSQL   |

Key domains:

- **FEI (Fiche d'Examen Initial)**: Inspection documents tracking game carcasses
- **Carcasses**: Individual game animals with sanitary data and traceability
- **User roles**: CHASSEUR, COLLECTEUR_PRO, ETG, SVI, COMMERCE_DE_DETAIL, etc.
- **Entities**: Organizations (slaughterhouses, retail, veterinary services)
- **Circuit court**: Commerce de détail / boucher receives carcasses directly from PD. No CTA in Zacharie — passive view only (fiches + carcasses). No SVI inspection needed.

## Work Rules

- **Beyond a single-file change**: present a short plan (files touched, data flow, design choices that need validation) and wait for the go before coding.
- **Simplest solution that works**: no new dependency without validation, no opportunistic refactor of surrounding code.
- **Verification**: run `npm run typecheck` in `api-express/` and `app-local-first-react-router/`. Run `npm run test` in `api-express/` (vitest) if the change touches backend logic. **Don't run e2e** (needs full DB + servers). Don't start dev servers or builds to verify. Signal which e2e specs are affected.
- `typecheck` uses `noEmit`: **no output + exit code 0 = success**. Don't re-run thinking the output was truncated.

| Service                         | Verification                          | Tests                                |
| ------------------------------- | ------------------------------------- | ------------------------------------ |
| `api-express/`                  | `npm run typecheck`                   | `npm run test` (vitest)              |
| `app-local-first-react-router/` | `npm run typecheck` · `npm run lint`  | `npm run vitest`                     |
| `e2e/`                          | —                                     | Don't run (needs DB + servers)       |
| `expo/`                         | —                                     | —                                    |

## Hard Rules (non-negotiable)

- **One role per user.** A user shall not have multiple roles. The frontend forbids it. **The backend does not enforce it yet** — the zod `roles` schema (`api-express/src/controllers/user.ts`) is a plain `z.array()` with no length cap. Any route you write or touch that persists `roles` must reject an array longer than 1.
- **Never write backward-compatibility or data-retroactivity code.** When the data model changes (schema, enums, field names, formats), update the code to work with the new model only. No runtime transformations, fallbacks, or migration logic in app code to handle old formats. Old data is migrated at the DB level (Prisma migrations, SQL scripts), never patched at read-time.
- **Never roll your own logout sequence.** Call `disconnect(...)` (full logout) or `clearLocalAppState(reason)` (session swap). See @app-local-first-react-router/CLAUDE.md.
- **Admin routes require ProConnect.** `/admin` is behind the `admin` passport strategy, which rejects a session without a recent `proconnect_at` (403 `PROCONNECT_REQUIRED`). Never add an admin-only route outside `api-express/src/controllers/admin/`. See `doc/proconnect-admin.md`.
- **Never navigate via `window.location.href`** in the frontend — it ejects the user from the Expo WebView into Safari. Use `pushState` + `popstate`.

## Anti-Patterns (never do)

- No `if (oldField) { newField = oldField }`, no `value ?? legacyValue`, no `// backward compat` shims. Write code for the current schema only.
- No hand-rolled `useUser.setState({ user: null })` + `clearCache()` + `navigate(...)` logout.
- No `window.location.href = ...` navigation.
- No `waitForTimeout` / wall-clock waits in E2E — assert on outcomes.

## ⚠️ High Blast-Radius Files

These files are critical paths where a small error can corrupt data or break sync for all users. Signal explicitly in the PR when touching them.

### Zustand store (`app-local-first-react-router/src/zustand/store.ts`)

Every local mutation flows through this file. `PERSISTED_KEYS` controls what survives page reload.

**Adding a new entity to sync** requires updating: `State` interface, `initialState()`, `PERSISTED_KEYS`, `partialize`, AND the sync flow. Missing one = silent data loss on reload.

`updateFei()` propagates fields to all carcasses via `mapFeiFieldsToCarcasse` — changing FEI fields can affect every carcasse on the fiche.

### FEI → Carcasse field propagation (dual-write)

Certain FEI fields are copied onto every carcasse. This happens in two places that **must stay in sync**:

- **Client**: `mapFeiFieldsToCarcasse()` in `app-local-first-react-router/src/utils/map-fei-fields-to-carcasse.ts`, typed by `CarcasseFieldsTakenFromFei` in `src/types/carcasse.ts`
- **Server**: `syncCarcasseDates()` in `api-express/src/utils/fei-side-effects.ts`

Adding a new ownership field to FEI that should appear on Carcasse requires: schema, `CarcasseFieldsTakenFromFei` type, `mapFeiFieldsToCarcasse`, potentially `syncCarcasseDates`, and the sync controller.

### Sync controller (`api-express/src/controllers/sync.ts`)

The single sync endpoint. Processes FEIs → Carcasses → Intermediaires → ModifRequests → Logs **in order** (carcasses depend on FEIs). Has authorization checks (`SyncRejectedError`). Changes here affect all offline sync.

### Carcasse side effects (`api-express/src/utils/carcasse-side-effects.ts`)

Runs after every carcasse save during sync. Triggers notifications, certificats, Brevo deals, webhooks. Any change here affects every carcasse write.

### Service worker (`app-local-first-react-router/src/service-worker.ts`)

Handles offline caching. Changes can break the app for all users until they force-refresh.

## ⚠️ Intentional Oddities — don't "fix" these

- **`user_entities_vivible_checkbox`** (schema): typo ("vivible" → "visible"). Renaming requires a migration. Leave it.
- **`roles` (array) vs `role` (singular)**: both exist in schema. `role` is marked `// TODO: migrate from roles, in another PR`. The migration has not happened yet. Don't merge them.
- **`is_synced` on every model**: exists in the DB but is only meaningful on the frontend (set `false` locally on mutation, `true` after sync). Comment says "typing purpose" — it's for the local-first sync pattern, not a real DB flag.
- **`fei_intermediaire_id` in Log model**: marked `// TO DELETE` but still present. Don't delete without checking dependencies.
- **`WORKING_FOR_ENTITY_RELATED_WITH` and `NONE` in `EntityRelationType`**: deduced client-side, not stored in DB. Comments explain this.

## Cron Jobs

`api-express/src/cronjobs/index.ts` registers 3 crons (disabled in dev/test):

- `initFeisCron` — FEI lifecycle (auto-close, reminders)
- `initRelanceInscriptionCron` — registration reminder emails
- `initDataHealthCron` — data health checks

Production only. Changes here affect automated processing for all fiches.

## Commits

Messages **in French**, describing the user/functional impact, not the technical details. Format `<type>: <description>` or `<type>(<scope>): <description>`. No uppercase after the prefix, no trailing period.

- Types: `feat:`, `fix:`, `chore:`, `chore(deps):`
- Scopes (optional): `(app)` for mobile, `(superadmin)`, `(deps)`

```bash
# ✅ describes the user impact
feat: possibilité de copier le lien de connexion (superadmin)
fix: tri par dernière connexion, réglages et filtres ETG transport/gestion

# ❌ too technical
fix: change color from green to purple in HelpIcon component
```

The message must answer **"what changes for the user?"**, not "what did I change in the code?"

## Pull Requests

- **Title**: same format as commits.
- **Description**: only if necessary, a short descriptive text. No bullet points, no auto-generated sections.
- **Test checklist**: only when the change needs non-obvious verifications (edge cases, specific configurations).

## Preferences

- French for user-facing content, English for code.
- Prettier (config in each package.json): `singleQuote: true, trailingComma: "es5", semi: true, printWidth: 110, tabWidth: 2`. The frontend adds `singleAttributePerLine: true` + the `prettier-plugin-tailwindcss` plugin (class sorting) — don't reformat frontend files with the bare root config.
- Prefer separate API routes for distinct data sections.
- Default to the simplest option in first iterations; no conditional UX unless explicitly requested.
- Comments are simple and describe the app's current behavior — only when the code isn't self-explanatory. Never narrate the change or the decision made during a session ("on change d'avis, finalement on fait X au lieu de Y"). Write `// on fait X car ...`, not the story of how we got there.

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
- Schema is copied to frontend via `api-express/scripts/copy-schema-to-app-side.js`

### Frontend

Local-first sync and the disconnect/logout flow are deep topics — see @app-local-first-react-router/CLAUDE.md.

## Conventions

- Node.js >= 20 required; TypeScript throughout.
- Pre-commit hook runs `prettier --write` per package via lint-staged + husky (`.lintstagedrc.mjs`). Prettier runs from within each package directory to match CI config resolution. Typecheck is NOT enforced at commit time — run `npm run typecheck` manually or rely on CI.

## CI

GitHub Actions (`.github/workflows/`):

- `format.yml`: Prettier check per package (`cd <pkg> && npx prettier --check .`)
- `tests.yml`: typecheck → build → vitest → Playwright (sharded 4-way)
- `shai-hulud-check.yml`: security scanning

## Environment Variables

API requires:

- `POSTGRESQL_ADDON_URI`: PostgreSQL connection string

Trichine (tous optionnels — non posés = fonctionnalité inactive, cf `doc/trichine-todo.md`) :

- `VITE_FEATURE_TRICHINE`: `true` active la feature (frontend **et** garde-fous sangliers du backend)
- `TRICHINE_RESULTATS_EMAIL`: adresse de dépôt des rapports COFRAC, imprimée sur la FTP
- `CELLAR_ADDON_HOST` / `CELLAR_ADDON_KEY_ID` / `CELLAR_ADDON_KEY_SECRET` / `CELLAR_ADDON_BUCKET`: object storage Cellar

E2E env vars: see @e2e/CLAUDE.md.
