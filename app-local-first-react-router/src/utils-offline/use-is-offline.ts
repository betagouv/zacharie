import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';

let veryBadConnection = false;

const VERY_BAD_CONNECTION_RETRY_MS = 30_000;
let veryBadConnectionRetryInterval: ReturnType<typeof setInterval> | null = null;

function stopVeryBadConnectionRetry() {
  if (veryBadConnectionRetryInterval) {
    clearInterval(veryBadConnectionRetryInterval);
    veryBadConnectionRetryInterval = null;
  }
}

function handleOnline(event: Event) {
  if (event.type === 'good-connection') {
    veryBadConnection = false;
  }
  stopVeryBadConnectionRetry();
  if (useZustandStore.getState().isOnline) return;
  navigator.serviceWorker?.controller?.postMessage('SW_MESSAGE_BACK_TO_ONLINE');
  useZustandStore.setState({ isOnline: true });
  syncData('is-online');
}

function handleOffline(event: Event) {
  if (event.type === 'very-bad-connection') {
    veryBadConnection = true;
    if (!veryBadConnectionRetryInterval) {
      veryBadConnectionRetryInterval = setInterval(
        () => refreshUser('very-bad-connection-retry'),
        VERY_BAD_CONNECTION_RETRY_MS
      );
    }
  }
  useZustandStore.setState({ isOnline: false });
}

if (typeof window !== 'undefined') {
  useZustandStore.setState({ isOnline: veryBadConnection ? false : navigator.onLine });
  window.addEventListener('online', handleOnline);
  window.addEventListener('good-connection', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('very-bad-connection', handleOffline);
}

export function useIsOnline() {
  return useZustandStore((state) => state.isOnline);
}
