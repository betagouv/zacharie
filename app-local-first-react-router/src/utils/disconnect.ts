import { flushSync } from 'react-dom';
import { clearCache } from '@app/services/indexed-db';
import { setNativeAuthToken } from '@app/services/api';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { setLocalTeardownInProgress } from '@app/zustand/idb-sliced-storage';
import { abortLoadCarcasses } from './load-carcasses';
import { abortLoadMyRelations } from './load-my-relations';
import { abortSyncData } from './sync-data';
import { broadcastToOtherTabs } from './tabs-broadcast';

interface DisconnectOptions {
  reason: string;
  communication?: string;
  redirectTo?: string;
}

let disconnecting = false;

export async function clearLocalAppState(reason: string) {
  setLocalTeardownInProgress(true);
  broadcastToOtherTabs({ type: 'local-state-clearing' });
  try {
    abortSyncData(reason);
    abortLoadCarcasses(reason);
    abortLoadMyRelations(reason);
    await clearCache(reason);

    if (!import.meta.env.VITE_TEST_PLAYWRIGHT) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } finally {
    setLocalTeardownInProgress(false);
    broadcastToOtherTabs({ type: 'local-state-cleared' });
  }
}

export async function disconnect(options: DisconnectOptions) {
  if (disconnecting) {
    console.log('disconnect already in progress');
    return;
  }
  disconnecting = true;
  try {
    setNativeAuthToken(null);

    await clearLocalAppState(options.reason);

    flushSync(() => {
      if (!window.location.pathname.startsWith('/app/connexion')) {
        const params = new URLSearchParams();
        if (options.communication) params.set('communication', options.communication);
        if (options.redirectTo) params.set('redirect', options.redirectTo);
        const search = params.toString();
        const target = '/app/connexion' + (search ? '?' + search : '');
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
