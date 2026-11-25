import useUser from '@app/zustand/user';
import { setLocalTeardownInProgress } from '@app/zustand/idb-sliced-storage';
import { abortSyncData, syncData } from './sync-data';
import { abortLoadCarcasses } from './load-carcasses';
import { abortLoadMyRelations } from './load-my-relations';

type TabsMessage =
  | { type: 'local-state-clearing' }
  | { type: 'local-state-cleared' }
  | { type: 'user-changed'; userId: string };

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('zacharie-tabs') : null;

export function broadcastToOtherTabs(message: TabsMessage) {
  channel?.postMessage(message);
}

function stopWritingAndLoading() {
  setLocalTeardownInProgress(true);
  abortSyncData('other-tab');
  abortLoadCarcasses('other-tab');
  abortLoadMyRelations('other-tab');
}

function onMessage(event: MessageEvent<TabsMessage>) {
  const message = event.data;
  if (message.type === 'local-state-clearing') {
    stopWritingAndLoading();
    return;
  }
  if (message.type === 'local-state-cleared') {
    window.location.reload();
    return;
  }
  if (message.type === 'user-changed') {
    if (useUser.getState().user?.id === message.userId) return;
    stopWritingAndLoading();
    window.location.reload();
  }
}

const RELOAD_ON_RETURN_THROTTLE_MS = 1000;
let lastReloadOnReturn = 0;

function reloadDataOnReturn() {
  if (document.visibilityState !== 'visible') return;
  if (!useUser.getState().user) return;
  if (Date.now() - lastReloadOnReturn < RELOAD_ON_RETURN_THROTTLE_MS) return;
  lastReloadOnReturn = Date.now();
  syncData('tab-visible');
}

export function startTabsBroadcast() {
  if (channel) channel.onmessage = onMessage;
  useUser.subscribe((state, prevState) => {
    const userId = state.user?.id;
    if (userId && userId !== prevState.user?.id) broadcastToOtherTabs({ type: 'user-changed', userId });
  });
  window.addEventListener('focus', reloadDataOnReturn);
  document.addEventListener('visibilitychange', reloadDataOnReturn);
}
