# CLAUDE.md — Frontend (app-local-first-react-router)

Scoped rules for the React frontend. Loaded in addition to the root `CLAUDE.md`.

## Commands

```bash
npm run dev              # Start Vite dev server on port 3234
npm run vitest           # Run vitest tests
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking
npm run build            # Production build
```

## Architecture

- **React 19** with **React Router 7**
- **Local-first** with IndexedDB storage via Zustand stores (`src/zustand/`)
- **DSFR** (French government design system) via `@codegouvfr/react-dsfr`
- **Tailwind CSS** for styling
- Service worker for offline support (`src/service-worker.ts`)
- Routes defined in `src/App.tsx`, components in `src/routes/`

Key files:

- `src/zustand/store.ts` — State & sync logic
- `src/utils/load-feis.ts` — Data loading with local/remote merge
- `src/utils/disconnect.ts` — Session teardown (see below)

## Hard rule: never roll your own logout

If you find yourself writing `useUser.setState({ user: null })` + `clearCache()` + `navigate('/app/connexion')`, stop and call `disconnect(...)`. For session swaps where you want clean local data but keep an active session, use `clearLocalAppState(reason)`.

**Never** navigate via `window.location.href = ...`. It ejects the user from the Expo WebView into Safari. Use `pushState` + `popstate` (which is what `disconnect` does).

## Disconnect / logout flow

All session teardown lives in `src/utils/disconnect.ts`, which exports two helpers:

- **`disconnect({ reason, communication?, redirectTo? })`** — full logout. Wipes the auth token, aborts in-flight loaders, calls `clearLocalAppState`, then atomically (same React batch) pushes `/app/connexion` AND clears `useUser` + persist storage + resets Zustand. Used by the manual logout button (RootDisplay) and the 401 auto-disconnect (api.ts).
- **`clearLocalAppState(reason)`** — async I/O cleanup only: abort loaders + `clearCache()` + 1500ms wait. Does NOT touch `useUser`, the auth token, or Zustand. Used by both `disconnect` and the admin "connect-as" flow (ConnexionButton) — connect-as is a session _swap_, not a logout, so it wants clean local data without clearing the new session.

**Why all the explicit teardown?** We navigate via `window.history.pushState` + a manual `popstate`, NOT via `window.location.href = ...`. Inside the Expo WebView (`expo/ExpoApp.tsx`), assigning to `window.location.href` ejects the user from the WebView and opens the URL in Safari (or the OS default browser), which we never want. The downside of `pushState` is that it does NOT reload the page or clear the JS heap, so any in-memory store state survives navigation. `disconnect` compensates by explicitly resetting Zustand, clearing the user, and aborting loaders. Without those steps, stale state (e.g. `lastUpdateFromServer`) leaks into the next session and breaks delta sync — see e2e test 117.

**Why the atomic final block in `disconnect`?** Setting `user = null` makes role layouts (chasseur, svi, etg, ...) reactively render a `<Navigate to="/app/connexion?redirect=<current-path>"/>`. Conversely, navigating to `/app/connexion` while `user` is still set makes the Connexion page bounce back to `/app/[role]`. So the helper dispatches `pushState` + `popstate` AND `useUser.setState({ user: null })` in the same synchronous tick — React 18 batches them, the role layout unmounts before observing `user=null`, and Connexion mounts with `user` already null.

## Local-First Sync (`src/zustand/store.ts`)

The frontend stores data in IndexedDB via Zustand. Changes apply locally first (`is_synced = false`), then sync to server via PQueue:

- **Queue**: `concurrency: 1`, 30ms throttle to prevent race conditions
- **Order**: FEIs → Carcasses → CarcassesIntermediaires → Logs (each waits for dependencies)
- **Conflict resolution**: Compares `updated_at`, keeps newest
- **AbortController per record**: Cancels in-flight requests if same record changes again

Key helpers in `@app/utils/get-carcasse-intermediaire-id.ts` for composite IDs (CarcasseIntermediaire uses `fei_numero + zacharie_carcasse_id + intermediaire_id`).
