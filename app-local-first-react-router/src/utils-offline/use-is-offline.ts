import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';

// Un seul jeu d'écouteurs pour toute l'application : l'état vit dans le store et le hook ne fait
// que le lire. Un retour en ligne déclenche donc une seule synchro, quel que soit le nombre de
// composants affichés.
let veryBadConnection = false;

function handleOnline(event: Event) {
  if (event.type === 'good-connection') {
    veryBadConnection = false;
  }
  if (useZustandStore.getState().isOnline) return;
  navigator.serviceWorker?.controller?.postMessage('SW_MESSAGE_BACK_TO_ONLINE');
  useZustandStore.setState({ isOnline: true });
  syncData('is-online');
}

function handleOffline(event: Event) {
  if (event.type === 'very-bad-connection') {
    veryBadConnection = true;
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
