import { create } from 'zustand';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { stopPersistWrites } from '@app/zustand/idb-sliced-storage';

// Un seul onglet actif à la fois : chaque onglet garde tout le store en mémoire et réécrit
// IndexedDB, donc deux onglets actifs s'écraseraient mutuellement leurs données.
// L'onglet actif détient le verrou Web Locks pendant toute sa vie. Un onglet sans verrou
// n'hydrate pas le store, n'écrit rien et n'affiche que l'écran de blocage.
const LOCK_NAME = 'zacharie-active-tab';
const TAKEOVER_FLAG = 'zacharie-active-tab-takeover';

type ActiveTabStatus = 'pending' | 'active' | 'blocked';

export const useActiveTab = create<{ status: ActiveTabStatus }>(() => ({ status: 'pending' }));

async function becomeActive() {
  // relecture du stockage : un autre onglet a pu le modifier depuis le chargement de la page
  await useUser.persist.rehydrate();
  await useZustandStore.persist.rehydrate();
  useActiveTab.setState({ status: 'active' });
}

export function startSingleActiveTab() {
  // navigateurs anciens (Safari < 15.4) : pas de règle d'onglet unique
  if (!navigator.locks || typeof BroadcastChannel === 'undefined') {
    becomeActive();
    return;
  }
  const takeover = sessionStorage.getItem(TAKEOVER_FLAG) === '1';
  sessionStorage.removeItem(TAKEOVER_FLAG);

  const channel = new BroadcastChannel(LOCK_NAME);
  channel.onmessage = async (event) => {
    if (event.data !== 'takeover') return;
    if (useActiveTab.getState().status === 'blocked') return;
    // on finit d'écrire dans IndexedDB puis on recharge : le verrou est libéré au déchargement
    // de la page, et la page rechargée trouve le verrou pris par l'autre onglet
    useActiveTab.setState({ status: 'blocked' });
    await stopPersistWrites();
    window.location.reload();
  };
  if (takeover) channel.postMessage('takeover');

  // Sans reprise, on attend le verrou 2 secondes au plus : au rechargement d'un onglet, l'ancienne
  // page peut le libérer un peu après le démarrage de la nouvelle.
  const controller = new AbortController();
  if (!takeover) setTimeout(() => controller.abort(), 2000);
  navigator.locks
    .request(LOCK_NAME, { signal: controller.signal }, async () => {
      await becomeActive();
      // le verrou est gardé jusqu'à la fermeture ou au rechargement de l'onglet
      await new Promise(() => {});
    })
    .catch(() => {
      if (useActiveTab.getState().status === 'pending') useActiveTab.setState({ status: 'blocked' });
    });
}

export function takeOverActiveTab() {
  // la page rechargée demande à l'onglet actif de céder sa place, puis attend le verrou
  sessionStorage.setItem(TAKEOVER_FLAG, '1');
  window.location.reload();
}
