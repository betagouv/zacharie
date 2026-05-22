import { clearCache } from '@app/services/indexed-db';
import { setNativeAuthToken } from '@app/services/api';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { abortLoadCarcasses } from './load-carcasses';
import { abortLoadMyRelations } from './load-my-relations';
import { abortSyncData } from './sync-data';

interface DisconnectOptions {
  // Free-form tag for logs/aborts: 'logout', '401', 'connect-as', etc.
  reason: string;
  // Optional banner message shown on /app/connexion after redirection.
  communication?: string;
  // Optional path the user was on before being kicked out; /app/connexion
  // uses it to bounce them back after re-login.
  redirectTo?: string;
  // Admin "connect-as" flow: clean state without sending the user to
  // /app/connexion (the caller navigates to the impersonated user's home).
  skipNavigate?: boolean;
}

let disconnecting = false;

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
  if (disconnecting) return;
  disconnecting = true;
  try {
    // 1. Cancel in-flight server reads BEFORE resetting state, so their
    // .then() handlers can't write stale data back into the reset store.
    abortSyncData(options.reason);
    abortLoadCarcasses(options.reason);
    abortLoadMyRelations(options.reason);

    // 2. Wipe in-memory state. pushState navigation does NOT clear the JS
    // heap, so we must do this explicitly (see comment block above).
    setNativeAuthToken(null);
    useUser.setState({ user: null });
    useUser.persist.clearStorage();
    useZustandStore.getState().reset();

    // 3. Wipe persisted state (IndexedDB + localStorage).
    await clearCache(options.reason);

    // 4. Give pending writes a beat to flush before we navigate.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (options.skipNavigate) return;
    // Already on /app/connexion: cleanup was the goal, no navigation needed.
    if (window.location.pathname.startsWith('/app/connexion')) return;

    const params = new URLSearchParams();
    if (options.communication) params.set('communication', options.communication);
    if (options.redirectTo) params.set('redirect', options.redirectTo);
    const search = params.toString();
    const target = '/app/connexion' + (search ? '?' + search : '');

    // pushState + popstate, NOT window.location.href — see comment block above.
    window.history.pushState(null, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } finally {
    disconnecting = false;
  }
}
