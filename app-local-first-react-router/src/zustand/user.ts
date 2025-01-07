import { type User } from '@prisma/client';
import type { UserConnexionResponse } from '@api/src/types/responses';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

interface State {
  user: User | null;
  needSyncProchainBraceletAUtiliser: boolean;
}

interface Action {
  incProchainBraceletAUtiliser: () => void;
}

const useUser = create<State & Action>()(
  devtools(
    persist(
      (set): State & Action => ({
        user: null,
        needSyncProchainBraceletAUtiliser: false,
        incProchainBraceletAUtiliser: () => {
          const user = useUser.getState().user;
          if (!user) return;
          const nextDernierBraceletUtilise = (user.prochain_bracelet_a_utiliser || 1)! + 1;
          set({
            user: {
              ...user,
              prochain_bracelet_a_utiliser: nextDernierBraceletUtilise,
            },
            needSyncProchainBraceletAUtiliser: true,
          });
          syncProchainBraceletAUtiliser();
        },
      }),
      {
        name: 'zacharie-zustand-user-store',
        version: 1,
        storage: createJSONStorage(() => window.localStorage),
      },
    ),
  ),
);

export default useUser;

export async function syncProchainBraceletAUtiliser() {
  const user = useUser.getState().user;
  const needSyncProchainBraceletAUtiliser = useUser.getState().needSyncProchainBraceletAUtiliser;
  if (!user || !needSyncProchainBraceletAUtiliser) return;
  return fetch(`${import.meta.env.VITE_API_URL}/user/${user.id}`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({
      prochain_bracelet_a_utiliser: user.prochain_bracelet_a_utiliser,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => res as UserConnexionResponse)
    .then((res) => {
      if (res.ok) {
        useUser.setState((state) => ({
          ...state,
          user: res.data.user,
          needSyncProchainBraceletAUtiliser: false,
        }));
      }
    });
}
