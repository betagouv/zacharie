import { create } from 'zustand';
import useZustandStore from '@app/zustand/store';

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
