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
 * Cancel in-flight loaders, reset the Zustand store, then wipe persisted
 * state (IndexedDB + localStorage) and wait 1500ms. Does NOT touch
 * `useUser` or the auth token — caller controls session state.
 *
 * Shared by `disconnect()` (full logout) and the admin "connect-as" flow
 * in ConnexionButton.tsx (session swap that wants clean local state but
 * keeps the freshly-established new session). Single source of truth so
 * cache cleaning stays consistent — divergent inline cleanups caused
 * subtle bugs in the past.
 *
 * Why `reset()` lives here (and BEFORE `clearCache`): Zustand's persist
 * middleware writes async to IndexedDB on every `setState`. If reset
 * runs AFTER clearCache, the write lands AFTER the wipe and 12 stale
 * slice keys leak into IDB (e2e test 107). Resetting first means
 * clearCache's iteration loop catches both the original session data
 * AND the persist write from reset.
 */
export async function clearLocalAppState(reason: string) {
  abortSyncData(reason);
  abortLoadCarcasses(reason);
  abortLoadMyRelations(reason);
  useZustandStore.getState().reset();
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

    // 2. Atomic state mutations: navigate AND clear user in the same
    // synchronous block so React 18 batches both into one render.
    //
    // Why atomic: setting `user = null` makes role layouts (chasseur,
    // svi, etg, etc.) re-render and return <Navigate to="/app/connexion
    // ?redirect=<current-path>"/>. If that runs before our own pushState,
    // we land on /app/connexion with a stale `redirect` back to the page
    // we just logged out from. Conversely, navigating to /app/connexion
    // while `user` is still set would make the Connexion page bounce us
    // back to /app/[role] via its useEffect.
    //
    // By dispatching pushState + popstate AND useUser.setState in the
    // same tick, React batches the updates: the single resulting render
    // sees both `location = /app/connexion` (so the role layout has
    // already unmounted and never observes user=null) AND `user = null`
    // (so Connexion's useEffect doesn't bounce).
    //
    // Why this runs BEFORE clearLocalAppState: setState triggers an
    // async persist write to IndexedDB. If clearCache ran first, that
    // write would land after the wipe (e2e test 107). Doing the
    // mutations first means clearCache (inside clearLocalAppState)
    // catches the persist writes alongside the original session data.
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
    useUser.persist.clearStorage();

    // 3. Reset Zustand + wipe persisted state + 1500ms settle.
    await clearLocalAppState(options.reason);
  } finally {
    disconnecting = false;
  }
}
