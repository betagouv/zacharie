import useUser from '@app/zustand/user';
import { setLocalTeardownInProgress } from '@app/zustand/idb-sliced-storage';
import { abortSyncData, syncData } from './sync-data';
import { abortLoadCarcasses } from './load-carcasses';
import { abortLoadMyRelations } from './load-my-relations';

// Messages entre les onglets d'un même navigateur. Aucune donnée ne passe par ici : chaque onglet
// remplit son store avec loadCarcasses, et recharge ses données quand on revient dessus.
// Dans l'app mobile il n'y a qu'une WebView, donc personne ne reçoit ces messages.
type TabsMessage =
  // un onglet va vider IndexedDB et localStorage (déconnexion, connect-as, création de compte…)
  | { type: 'local-state-clearing' }
  | { type: 'local-state-cleared' }
  // un onglet a ouvert une session
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

// Recharger relit le stockage : l'onglet repart sur la session de l'autre onglet, ou sur la page
// de connexion si elle a été fermée. Le rechargement ne concerne que le web (plusieurs onglets).
function onMessage(event: MessageEvent<TabsMessage>) {
  const message = event.data;
  if (message.type === 'local-state-clearing') {
    // on n'écrit plus rien : sinon l'ancienne session réapparaîtrait après le nettoyage
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

// `focus` et `visibilitychange` arrivent souvent ensemble : un seul chargement suffit.
const RELOAD_ON_RETURN_THROTTLE_MS = 1000;
let lastReloadOnReturn = 0;

function reloadDataOnReturn() {
  if (document.visibilityState !== 'visible') return;
  if (!useUser.getState().user) return;
  if (Date.now() - lastReloadOnReturn < RELOAD_ON_RETURN_THROTTLE_MS) return;
  lastReloadOnReturn = Date.now();
  // envoie les saisies locales puis appelle loadCarcasses : on récupère ce que les autres onglets
  // ont synchronisé entre-temps
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
