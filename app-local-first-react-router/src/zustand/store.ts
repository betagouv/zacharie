import {
  type Fei,
  type EntityAndUserRelations,
  type ETGAndEntityRelations,
  type Carcasse,
  type FeiIntermediaire,
  type CarcasseIntermediaire,
} from '@prisma/client';
import type { UserForFei } from '~/src/types/user';
import type { EntityWithUserRelation } from '~/src/types/entity';
import type {
  FeiResponse,
  CarcasseResponse,
  FeiIntermediaireResponse,
  CarcasseIntermediaireResponse,
} from '~/src/types/responses';
import type { FeiDone, FeiWithIntermediaires } from '~/src/types/fei';
import { create } from 'zustand';
import {
  devtools,
  persist,
  createJSONStorage,
  // StateStorage
} from 'zustand/middleware';
import { capture } from '@app/services/sentry';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import dayjs from 'dayjs';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses-by-espece';
// import { get, set, del } from 'idb-keyval'; // can use anything: IndexedDB, Ionic Storage, etc.

// Custom storage object
// const storage: StateStorage = {
//   getItem: async (name: string): Promise<string | null> => {
//     // console.log(name, "has been retrieved");
//     return (await get(name)) || null;
//   },
//   setItem: async (name: string, value: string): Promise<void> => {
//     // console.log(name, "with value", value, "has been saved");
//     await set(name, value);
//   },
//   removeItem: async (name: string): Promise<void> => {
//     // console.log(name, "has been deleted");
//     await del(name);
//   },
// };

// interface PopulatedIntermediaire extends FeiIntermediaire {
//   user?: UserForFei;
//   entity?: Entity;
//   carcasses?: Array<Carcasse>;
// }

export interface State {
  isOnline: boolean;
  feisDone: Array<FeiDone>;
  feis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires>;
  users: Record<UserForFei['id'], UserForFei>;
  entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>;
  entitiesIdsWorkingDirectlyFor: Array<EntityWithUserRelation['id']>;
  entitiesIdsWorkingDirectlyAndIndirectlyFor: Array<EntityWithUserRelation['id']>;
  ccgsIds: Array<EntityWithUserRelation['id']>;
  collecteursProIds: Array<EntityWithUserRelation['id']>;
  etgsIds: Array<EntityWithUserRelation['id']>;
  svisIds: Array<EntityWithUserRelation['id']>;
  collecteursProsRelatedWithMyETGs: Array<ETGAndEntityRelations>;
  etgsRelatedWithMyEntities: Array<ETGAndEntityRelations>;
  detenteursInitiaux: Record<UserForFei['id'], UserForFei>;
  entityAndUserRelations: Record<EntityAndUserRelations['entity_id'], EntityAndUserRelations>;
  etgAndEntityRelations: Record<ETGAndEntityRelations['etg_id'], ETGAndEntityRelations>;
  entityAndETGRelations: Record<ETGAndEntityRelations['entity_id'], ETGAndEntityRelations>;
  carcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse>;
  carcassesIdsByFei: Record<Fei['numero'], Array<Carcasse['zacharie_carcasse_id']>>;
  feisIntermediaires: Record<FeiIntermediaire['id'], FeiIntermediaire>;
  feisIntermediairesIdsByFei: Record<Fei['numero'], Array<FeiIntermediaire['id']>>;
  carcassesIntermediaires: Record<
    CarcasseIntermediaire['fei_numero__bracelet__intermediaire_id'],
    CarcasseIntermediaire
  >;
  carcassesIntermediairesByIntermediaire: Record<
    FeiIntermediaire['id'],
    Array<CarcasseIntermediaire['fei_numero__bracelet__intermediaire_id']>
  >;
  // inetermediairesPopulated: Array<PopulatedIntermediaire>; // Note: fixed typo from 'inetermediaires'
  _hasHydrated: boolean;
}

interface Actions {
  createFei: (newFei: FeiWithIntermediaires) => void;
  updateFei: (fei_numero: FeiWithIntermediaires['numero'], fei: Partial<FeiWithIntermediaires>) => void;
  createCarcasse: (newCarcasse: Carcasse) => void;
  updateCarcasse: (
    zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
    carcasse: Partial<Carcasse>,
  ) => void;
  getFeiIntermediairesForFeiNumero: (fei_numero: Fei['numero']) => Array<FeiIntermediaire>;
  createFeiIntermediaire: (newFeiIntermediaire: FeiIntermediaire) => void;
  updateFeiIntermediaire: (
    feiIntermediaireId: FeiIntermediaire['id'],
    partialFeiIntermediaire: Partial<FeiIntermediaire>,
  ) => void;
  updateCarcasseIntermediaire: (
    fei_numero__bracelet__intermediaire_id: CarcasseIntermediaire['fei_numero__bracelet__intermediaire_id'],
    partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
  ) => void;
  setHasHydrated: (state: boolean) => void;
}

const useZustandStore = create<State & Actions>()(
  devtools(
    persist(
      (set, get): State & Actions => ({
        isOnline: true,
        feisDone: [],
        feis: {},
        users: {},
        entities: {},
        entitiesIdsWorkingDirectlyFor: [],
        entitiesIdsWorkingDirectlyAndIndirectlyFor: [],
        ccgsIds: [],
        collecteursProIds: [],
        etgsIds: [],
        svisIds: [],
        collecteursProsRelatedWithMyETGs: [],
        etgsRelatedWithMyEntities: [],
        detenteursInitiaux: {},
        entityAndUserRelations: {},
        etgAndEntityRelations: {},
        entityAndETGRelations: {},
        carcasses: {},
        carcassesIdsByFei: {},
        feisIntermediaires: {},
        feisIntermediairesIdsByFei: {},
        getFeiIntermediairesForFeiNumero: (fei_numero: Fei['numero']) => {
          const feiIntermediairesIds = get().feisIntermediairesIdsByFei[fei_numero] || [];
          if (!feiIntermediairesIds.length) {
            return [];
          }
          const uniqueIds = new Set(feiIntermediairesIds);
          return [...uniqueIds].map((id) => get().feisIntermediaires[id]);
        },
        carcassesIntermediaires: {},
        carcassesIntermediairesByIntermediaire: {},
        createFei: (newFei: FeiWithIntermediaires) => {
          newFei.is_synced = false;
          newFei.updated_at = dayjs().toDate();
          useZustandStore.setState((state) => ({
            ...state,
            feis: { ...state.feis, [newFei.numero]: newFei },
            carcassesIdsByFei: { ...state.carcassesIdsByFei, [newFei.numero]: [] },
            feisIntermediairesIdsByFei: { ...state.feisIntermediairesIdsByFei, [newFei.numero]: [] },
          }));
          syncData();
        },
        updateFei: (
          fei_numero: FeiWithIntermediaires['numero'],
          partialFei: Partial<FeiWithIntermediaires>,
        ) => {
          console.log('updateFei', fei_numero, partialFei);
          const state = useZustandStore.getState();
          const feis = state.feis;
          const carcassefeiCarcasses = (state.carcassesIdsByFei[fei_numero] || []).map(
            (id) => state.carcasses[id],
          );
          const countCarcassesByEspece = formatCountCarcasseByEspece(carcassefeiCarcasses);
          const nextFei: FeiWithIntermediaires = {
            ...feis[fei_numero],
            ...partialFei,
            resume_nombre_de_carcasses: countCarcassesByEspece.join('\n'),
            updated_at: dayjs().toDate(),
            is_synced: false,
          };
          useZustandStore.setState({
            feis: {
              ...feis,
              [fei_numero]: nextFei,
            },
          });
          syncData();
        },
        createCarcasse: (newCarcasse: Carcasse) => {
          newCarcasse.is_synced = false;
          newCarcasse.updated_at = dayjs().toDate();
          const nextCarcassesIdsByFei =
            useZustandStore.getState().carcassesIdsByFei[newCarcasse.fei_numero] || [];
          if (!nextCarcassesIdsByFei.includes(newCarcasse.zacharie_carcasse_id)) {
            nextCarcassesIdsByFei.push(newCarcasse.zacharie_carcasse_id);
          }
          useZustandStore.setState((state) => {
            return {
              ...state,
              carcasses: {
                ...state.carcasses,
                [newCarcasse.zacharie_carcasse_id]: newCarcasse,
              },
              carcassesIdsByFei: {
                ...state.carcassesIdsByFei,
                [newCarcasse.fei_numero]: nextCarcassesIdsByFei,
              },
            };
          });
          get().updateFei(newCarcasse.fei_numero, { updated_at: dayjs().toDate() });
          // syncData(); // no need to sync data here because it's done by syncing fei already
        },
        updateCarcasse: (
          zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
          partialCarcasse: Partial<Carcasse>,
        ) => {
          const carcasses = useZustandStore.getState().carcasses;
          const nextCarcasse = {
            ...carcasses[zacharie_carcasse_id],
            ...partialCarcasse,
            updated_at: dayjs().toDate(),
            is_synced: false,
          };
          useZustandStore.setState({
            carcasses: {
              ...carcasses,
              [zacharie_carcasse_id]: nextCarcasse,
            },
          });
          get().updateFei(nextCarcasse.fei_numero, { updated_at: dayjs().toDate() });
          // syncData(); // no need to sync data here because it's done by syncing fei already
        },
        createFeiIntermediaire: (newIntermediaire: FeiIntermediaire) => {
          newIntermediaire.is_synced = false;
          newIntermediaire.updated_at = dayjs().toDate();
          const feiCarcassesIds =
            useZustandStore.getState().carcassesIdsByFei[newIntermediaire.fei_numero] || [];
          useZustandStore.setState((state) => {
            return {
              ...state,
              feisIntermediaires: {
                ...state.feisIntermediaires,
                [newIntermediaire.id]: newIntermediaire,
              },
              feisIntermediairesIdsByFei: {
                ...state.feisIntermediairesIdsByFei,
                [newIntermediaire.fei_numero]: [
                  ...new Set([
                    newIntermediaire.id,
                    ...(state.feisIntermediairesIdsByFei[newIntermediaire.fei_numero] || []),
                  ]), // newest first
                ],
              },
            };
          });
          const carcasses = feiCarcassesIds.map((id) => useZustandStore.getState().carcasses[id]);
          const carcassesIntermediaires: Array<CarcasseIntermediaire> = carcasses
            .filter((c) => !c.intermediaire_carcasse_refus_intermediaire_id)
            .map((c) => ({
              fei_numero__bracelet__intermediaire_id: getCarcasseIntermediaireId(
                c.fei_numero,
                c.numero_bracelet,
                newIntermediaire.id,
              ),
              fei_numero: c.fei_numero,
              numero_bracelet: c.numero_bracelet,
              zacharie_carcasse_id: c.zacharie_carcasse_id,
              fei_intermediaire_id: newIntermediaire.id,
              fei_intermediaire_user_id: newIntermediaire.fei_intermediaire_user_id,
              fei_intermediaire_entity_id: newIntermediaire.fei_intermediaire_entity_id,
              prise_en_charge: true,
              manquante: null,
              refus: null,
              commentaire: null,
              carcasse_check_finished_at: dayjs().toDate(),
              created_at: dayjs().toDate(),
              updated_at: dayjs().toDate(),
              deleted_at: null,
              is_synced: false,
            }));
          const carcassesIntermediairesObj: Record<
            CarcasseIntermediaire['fei_numero__bracelet__intermediaire_id'],
            CarcasseIntermediaire
          > = {};
          for (const ci of carcassesIntermediaires) {
            carcassesIntermediairesObj[ci.fei_numero__bracelet__intermediaire_id] = ci;
          }
          useZustandStore.setState((state) => {
            return {
              ...state,
              carcassesIntermediaires: {
                ...state.carcassesIntermediaires,
                ...carcassesIntermediairesObj,
              },
              carcassesIntermediairesByIntermediaire: {
                ...state.carcassesIntermediairesByIntermediaire,
                [newIntermediaire.id]: carcassesIntermediaires.map(
                  (c) => c.fei_numero__bracelet__intermediaire_id,
                ),
              },
            };
          });
          // syncData(); // no need to sync data here because it's done by syncing fei already
        },
        updateFeiIntermediaire: (
          feiIntermediaireId: FeiIntermediaire['id'],
          partialFeiIntermediaire: Partial<FeiIntermediaire>,
        ) => {
          useZustandStore.setState((state) => {
            return {
              ...state,
              feisIntermediaires: {
                ...state.feisIntermediaires,
                [feiIntermediaireId]: {
                  ...state.feisIntermediaires[feiIntermediaireId],
                  ...partialFeiIntermediaire,
                  updated_at: dayjs().toDate(),
                  is_synced: false,
                },
              },
            };
          });
          syncData();
        },
        updateCarcasseIntermediaire: (
          fei_numero__bracelet__intermediaire_id: CarcasseIntermediaire['fei_numero__bracelet__intermediaire_id'],
          partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
        ) => {
          useZustandStore.setState((state) => {
            return {
              ...state,
              carcassesIntermediaires: {
                ...state.carcassesIntermediaires,
                [fei_numero__bracelet__intermediaire_id]: {
                  ...state.carcassesIntermediaires[fei_numero__bracelet__intermediaire_id],
                  ...partialCarcasseIntermediaire,
                  updated_at: dayjs().toDate(),
                  is_synced: false,
                },
              },
            };
          });
          syncData();
        },
        _hasHydrated: false,
        setHasHydrated: (state) => {
          set({
            _hasHydrated: state,
          });
        },
      }),
      {
        name: 'zacharie-zustand-store',
        version: 1,
        // storage: createJSONStorage(() => storage),
        storage: createJSONStorage(() => window.localStorage),
        onRehydrateStorage: (state) => {
          return () => state.setHasHydrated(true);
        },
        partialize: (state) =>
          Object.fromEntries(Object.entries(state).filter(([key]) => !['feiDone'].includes(key))),
      },
    ),
  ),
);

export default useZustandStore;

// SYNC DATA
export async function syncFei(nextFei: FeiWithIntermediaires) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncFei not online');
  }
  return fetch(`${import.meta.env.VITE_API_URL}/fei/${nextFei.numero}/`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(nextFei),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => res as FeiResponse)
    .then((res) => {
      if (res.ok && res.data?.fei) {
        console.log('synced fei', res.data.fei);
        useZustandStore.setState({
          feis: {
            ...useZustandStore.getState().feis,
            [nextFei.numero]: res.data.fei,
          },
        });
      }
    });
}

export async function syncFeis() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncFeis not online');
  }
  const feis = useZustandStore.getState().feis;
  for (const fei of Object.values(feis)) {
    if (!fei.is_synced) {
      console.log('syncing fei', fei);
      await syncFei(fei);
    }
  }
}

export async function syncCarcasse(nextCarcasse: Carcasse) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncCarcasse not online');
  }
  return fetch(
    `${import.meta.env.VITE_API_URL}/fei-carcasse/${nextCarcasse.fei_numero}/${nextCarcasse.zacharie_carcasse_id}`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(nextCarcasse),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
  )
    .then((res) => res.json())
    .then((res) => res as CarcasseResponse)
    .then((res) => {
      if (res.ok && res.data.carcasse) {
        const nextCarcassesIdsByFei =
          useZustandStore.getState().carcassesIdsByFei[nextCarcasse.fei_numero] || [];
        if (!nextCarcassesIdsByFei.includes(nextCarcasse.zacharie_carcasse_id)) {
          nextCarcassesIdsByFei.push(nextCarcasse.zacharie_carcasse_id);
        }
        useZustandStore.setState((state) => ({
          ...state,
          carcasses: {
            ...useZustandStore.getState().carcasses,
            [nextCarcasse.zacharie_carcasse_id]: res.data.carcasse!,
          },
          carcassesIdsByFei: {
            ...useZustandStore.getState().carcassesIdsByFei,
            [nextCarcasse.fei_numero]: [...new Set(nextCarcassesIdsByFei)],
          },
        }));
      }
    });
}

export async function syncCarcasses() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncCarcasses not online');
  }
  const carcasses = useZustandStore.getState().carcasses;
  for (const carcasse of Object.values(carcasses)) {
    if (!carcasse.is_synced) {
      console.log('syncing carcasse', carcasse);
      await syncCarcasse(carcasse);
    }
  }
}

export async function syncFeiIntermediaire(nextFeiIntermediaire: FeiIntermediaire) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncFeiIntermediaire not online');
  }
  return fetch(
    `${import.meta.env.VITE_API_URL}/fei-intermediaire/${nextFeiIntermediaire.fei_numero}/${nextFeiIntermediaire.id}`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(nextFeiIntermediaire),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
  )
    .then((res) => res.json())
    .then((res) => res as FeiIntermediaireResponse)
    .then((res) => {
      if (res.ok && res.data.feiIntermediaire) {
        nextFeiIntermediaire = res.data.feiIntermediaire!;
        console.log('nextFeiIntermediaire', nextFeiIntermediaire);
        const nextIntermediairesByFei =
          useZustandStore.getState().feisIntermediairesIdsByFei[nextFeiIntermediaire.fei_numero] || [];
        if (!nextIntermediairesByFei.includes(nextFeiIntermediaire.id)) {
          nextIntermediairesByFei.push(nextFeiIntermediaire.id);
        }
        useZustandStore.setState((state) => ({
          ...state,
          feisIntermediaires: {
            ...useZustandStore.getState().feisIntermediaires,
            [nextFeiIntermediaire.id]: nextFeiIntermediaire,
          },
          feisIntermediairesIdsByFei: {
            ...useZustandStore.getState().feisIntermediairesIdsByFei,
            [nextFeiIntermediaire.fei_numero]: [...new Set(nextIntermediairesByFei)],
          },
        }));
      }
    });
}

export async function syncFeiIntermediaires() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncFeiIntermediaires not online');
  }
  const feisIntermediaires = useZustandStore.getState().feisIntermediaires;
  for (const feiIntermediaire of Object.values(feisIntermediaires)) {
    if (!feiIntermediaire.is_synced) {
      console.log('syncing fei intermediaire', feiIntermediaire);
      await syncFeiIntermediaire(feiIntermediaire);
    }
  }
}

export async function syncCarcasseIntermediaire(nextCarcasseIntermediaire: CarcasseIntermediaire) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncFeiIntermediaire not online');
  }
  const feiNumero = nextCarcasseIntermediaire.fei_numero;
  const intermedaireId = nextCarcasseIntermediaire.fei_intermediaire_id;
  const numeroBracelet = nextCarcasseIntermediaire.numero_bracelet;
  return fetch(
    `${import.meta.env.VITE_API_URL}/fei-carcasse-intermediaire/${feiNumero}/${intermedaireId}/${numeroBracelet}`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(nextCarcasseIntermediaire),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
  )
    .then((res) => res.json())
    .then((res) => res as CarcasseIntermediaireResponse)
    .then((res) => {
      if (res.ok && res.data.carcasseIntermediaire) {
        nextCarcasseIntermediaire = res.data.carcasseIntermediaire!;
        const nextCarcasseIntermediairesByIntermedaire =
          useZustandStore.getState().carcassesIntermediairesByIntermediaire[intermedaireId] || [];
        if (
          !nextCarcasseIntermediairesByIntermedaire.includes(
            nextCarcasseIntermediaire.fei_numero__bracelet__intermediaire_id,
          )
        ) {
          nextCarcasseIntermediairesByIntermedaire.push(
            nextCarcasseIntermediaire.fei_numero__bracelet__intermediaire_id,
          );
        }
        useZustandStore.setState((state) => ({
          ...state,
          carcassesIntermediaires: {
            ...useZustandStore.getState().carcassesIntermediaires,
            [nextCarcasseIntermediaire.fei_numero__bracelet__intermediaire_id]: nextCarcasseIntermediaire,
          },
          carcassesIntermediairesByIntermediaire: {
            ...useZustandStore.getState().carcassesIntermediairesByIntermediaire,
            [nextCarcasseIntermediaire.fei_intermediaire_id]: [
              ...new Set(nextCarcasseIntermediairesByIntermedaire),
            ],
          },
        }));
      }
    });
}

export async function syncCarcassesIntermediaires() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncFeiIntermediaires not online');
  }
  const carcassesIntermediaires = useZustandStore.getState().carcassesIntermediaires;
  for (const carcassesIntermediaire of Object.values(carcassesIntermediaires)) {
    if (!carcassesIntermediaire.is_synced) {
      console.log('syncing carcasse intermediaire', carcassesIntermediaire);
      await syncCarcasseIntermediaire(carcassesIntermediaire);
    }
  }
}

export async function syncData() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not syncing data because not online');
    return;
  }
  return syncFeis()
    .then(() => console.log('synced feis finito'))
    .then(syncCarcasses)
    .then(() => console.log('synced carcasses finito'))
    .then(syncFeiIntermediaires)
    .then(() => console.log('synced intermediaires finito'))
    .then(syncCarcassesIntermediaires)
    .then(() => console.log('synced carcasses intermediaires finito'))
    .then(() => console.log('synced data finito'))
    .catch((error) => {
      capture(error);
    });
}