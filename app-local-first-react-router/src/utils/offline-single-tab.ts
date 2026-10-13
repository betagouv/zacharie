import { create } from 'zustand';
import useZustandStore from '@app/zustand/store';

// Hors ligne, une saisie reste dans l'onglet qui l'a faite : le serveur ne peut pas la transmettre
// aux autres onglets, et un autre onglet qui écrirait dans IndexedDB l'écraserait. Hors ligne, seul
// le premier onglet utilisé fonctionne : il prend le verrou Web Locks et le garde jusqu'au retour
// en ligne. Un autre onglet utilisé hors ligne n'obtient pas le verrou et affiche l'écran de blocage.
// Sans Web Locks (Safari < 15.4), pas de règle.
const LOCK_NAME = 'zacharie-offline-tab';

export const useOfflineTabBlocked = create<{ blocked: boolean }>(() => ({ blocked: false }));

let lockStatus: 'none' | 'requesting' | 'held' = 'none';
let releaseLock: (() => void) | null = null;

function takeLockIfOffline() {
  if (useZustandStore.getState().isOnline) return;
  if (document.visibilityState !== 'visible') return;
  if (lockStatus !== 'none') return;
  lockStatus = 'requesting';
  navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
    if (!lock) {
      lockStatus = 'none';
      useOfflineTabBlocked.setState({ blocked: true });
      return;
    }
    lockStatus = 'held';
    useOfflineTabBlocked.setState({ blocked: false });
    return new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
  });
}

export function startOfflineSingleTab() {
  if (!navigator.locks) return;
  // le verrou est pris au premier usage de l'onglet hors ligne, pas au passage hors ligne :
  // tous les onglets ouverts passent hors ligne en même temps
  window.addEventListener('focus', takeLockIfOffline);
  document.addEventListener('visibilitychange', takeLockIfOffline);
  window.addEventListener('pointerdown', takeLockIfOffline, { capture: true });
  window.addEventListener('keydown', takeLockIfOffline, { capture: true });
  useZustandStore.subscribe((state, prevState) => {
    if (!state.isOnline || prevState.isOnline) return;
    releaseLock?.();
    releaseLock = null;
    lockStatus = 'none';
    useOfflineTabBlocked.setState({ blocked: false });
  });
}
