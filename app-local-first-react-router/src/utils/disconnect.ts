import { flushSync } from 'react-dom';
import { clearCache } from '@app/services/indexed-db';
import { setNativeAuthToken } from '@app/services/api';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { abortLoadCarcasses } from './load-carcasses';
import { abortLoadMyRelations } from './load-my-relations';
import { abortSyncData } from './sync-data';

interface DisconnectOptions {
  // Free-form tag for logs/aborts: 'logout', '401', etc.
  reason: string;
  // Optional banner message shown on /app/connexion after redirection.
  communication?: string;
  // Optional path the user was on before being kicked out; /app/connexion
  // uses it to bounce them back after re-login.
  redirectTo?: string;
}

let disconnecting = false;

/**
 * Cancel in-flight loaders and wipe persisted state (IndexedDB +
 * localStorage). Does NOT touch React state (`useUser`,
 * `useZustandStore`, auth token) — callers handle those themselves.
 *
 * Shared by `disconnect()` (full logout) and the admin "connect-as" flow
 * in ConnexionButton.tsx (session swap that wants clean local state but
 * keeps the freshly-established new session). Single source of truth so
 * cache cleaning stays consistent — divergent inline cleanups caused
 * subtle bugs in the past.
 *
 * NOTE: callers that follow this with `useZustandStore.reset()` will
 * trigger the persist middleware to write the reset state (one entry
 * per persisted slice) back to IndexedDB after clearCache has wiped it.
 * That's intentional — the entries hold initialState values (empty
 * objects/arrays), not the previous session's data, so no leak. e2e
 * test 107 asserts that the VALUES are empty, not that the count is 0.
 */
export async function clearLocalAppState(reason: string) {
  abortSyncData(reason);
  abortLoadCarcasses(reason);
  abortLoadMyRelations(reason);
  await clearCache(reason);

  // Give pending writes a beat to flush before any caller state mutation.
  if (!import.meta.env.VITE_TEST_PLAYWRIGHT) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

/**
 * Single source of truth for tearing down a user session and sending them
 * back to /app/connexion.
 *
 * Used by:
 *   - the manual logout button (RootDisplay.tsx)
 *   - the 401 auto-disconnect (api.ts)
 *   - the admin "connect-as" flow (ConnexionButton.tsx), with skipNavigate
 *
 * --- IMPORTANT — navigation strategy ---
 *
 * We navigate via `history.pushState` + a manual `popstate` event, NOT via
 * `window.location.href = ...`. Inside the Expo WebView (see
 * expo/ExpoApp.tsx), assigning to `window.location.href` causes the OS to
 * open the URL in Safari (or the default external browser) instead of
 * staying inside the WebView. pushState keeps us inside the WebView.
 *
 * The trade-off: pushState does NOT reload the page or clear the JS heap.
 * `window.location.href` used to give us a fresh heap for free; pushState
 * does not. That is why this helper MUST explicitly:
 *   - reset the Zustand store
 *   - clear `useUser` + its persist storage
 *   - clear IndexedDB / localStorage
 *   - abort in-flight loaders so they can't write to the freshly-reset store
 *
 * Without those steps, in-memory state from the previous session leaks
 * into the next login. Concretely: `lastUpdateFromServer` doesn't reset,
 * breaking delta sync (see e2e test 117 — dispatch-2-etg-isolation-negative).
 */
export async function disconnect(options: DisconnectOptions) {
  if (disconnecting) {
    console.log('disconnect already in progress');
    return;
  }
  disconnecting = true;
  try {
    // 1. Wipe the native JWT (no React subscribers, safe to do up-front).
    setNativeAuthToken(null);

    // 2. Async I/O cleanup. `useUser` is still populated in memory, so
    // role layouts won't yet fire their own <Navigate to="/app/connexion
    // ?redirect=..."/> — that's important (see atomic block below).
    await clearLocalAppState(options.reason);

    // 3. Atomic final step: navigate AND clear user state in a single
    // React commit so role layouts never observe `user=null` while
    // their route still matches, and Connexion never mounts while
    // `user` is still set.
    //
    // Why flushSync (and not plain sync ordering): both Zustand and
    // React Router subscribe via `useSyncExternalStore`, which bypasses
    // React 18's auto-batching to prevent tearing. Without flushSync,
    // the popstate update and the `useUser.setState` produce two
    // separate sync renders, with Connexion's useEffect firing in
    // between holding a stale `user` closure — it then calls
    // `handleRedirect(staleUser)` and navigates back to the role page.
    // The role layout, now re-mounted with the freshly-null user, fires
    // its own `<Navigate to="/app/connexion?redirect=<role-path>"/>`,
    // clobbering our intended URL. flushSync forces React to commit all
    // updates inside the callback together, so the only render that
    // happens sees `location=/app/connexion` AND `user=null`.
    //
    // The `reset()` below triggers persist middleware to write
    // initialState slices back to IndexedDB AFTER clearCache has wiped
    // it — that's fine, those writes contain only initialState (empty
    // values, no session data). e2e test 107 asserts values, not count.
    flushSync(() => {
      if (!window.location.pathname.startsWith('/app/connexion')) {
        const params = new URLSearchParams();
        if (options.communication) params.set('communication', options.communication);
        if (options.redirectTo) params.set('redirect', options.redirectTo);
        const search = params.toString();
        const target = '/app/connexion' + (search ? '?' + search : '');
        // pushState + popstate, NOT window.location.href — see header comment.
        window.history.pushState(null, '', target);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      useUser.setState({ user: null });
      useZustandStore.getState().reset();
    });
    useUser.persist.clearStorage();
  } finally {
    disconnecting = false;
  }
}
