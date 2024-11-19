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
import type { FeiDone, FeiWithIntermediaires } from '~/src/types/fei';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval'; // can use anything: IndexedDB, Ionic Storage, etc.

// Custom storage object
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // console.log(name, "has been retrieved");
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // console.log(name, "with value", value, "has been saved");
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    // console.log(name, "has been deleted");
    await del(name);
  },
};

// interface PopulatedIntermediaire extends FeiIntermediaire {
//   user?: UserForFei;
//   entity?: Entity;
//   carcasses?: Array<Carcasse>;
// }

export interface State {
  feisDone: Array<FeiDone>;
  feis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires>;
  users: Record<UserForFei['id'], UserForFei>;
  entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>;
  entitiesIdsWorkingDirectlyFor: Array<EntityWithUserRelation['id']>;
  collecteursProsRelatedWithMyETGs: Array<ETGAndEntityRelations>;
  detenteursInitiaux: Record<UserForFei['id'], UserForFei>;
  entityAndUserRelations: Record<EntityAndUserRelations['entity_id'], EntityAndUserRelations>;
  etgAndEntityRelations: Record<ETGAndEntityRelations['etg_id'], ETGAndEntityRelations>;
  entityAndETGRelations: Record<ETGAndEntityRelations['entity_id'], ETGAndEntityRelations>;
  carcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse>;
  carcassesByFei: Record<Fei['numero'], Array<Carcasse['zacharie_carcasse_id']>>;
  feisIntermediaires: Record<FeiIntermediaire['id'], FeiIntermediaire>;
  carcassesIntermediaires: Record<
    CarcasseIntermediaire['fei_numero__bracelet__intermediaire_id'],
    CarcasseIntermediaire
  >;
  // inetermediairesPopulated: Array<PopulatedIntermediaire>; // Note: fixed typo from 'inetermediaires'
  _hasHydrated: boolean;
}

interface Actions {
  updateFei: (fei_numero: FeiWithIntermediaires['numero'], fei: Partial<FeiWithIntermediaires>) => void;
  updateCarcasse: (
    zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
    carcasse: Partial<Carcasse>,
  ) => void;
  setHasHydrated: (state: boolean) => void;
}

const useZustandStore = create<State & Actions>()(
  devtools(
    persist(
      (set): State & Actions => ({
        feisDone: [],
        feis: {},
        users: {},
        entities: {},
        entitiesIdsWorkingDirectlyFor: [],
        collecteursProsRelatedWithMyETGs: [],
        detenteursInitiaux: {},
        entityAndUserRelations: {},
        etgAndEntityRelations: {},
        entityAndETGRelations: {},
        carcasses: {},
        carcassesByFei: {},
        feisIntermediaires: {},
        carcassesIntermediaires: {},
        updateFei: (
          fei_numero: FeiWithIntermediaires['numero'],
          partialFei: Partial<FeiWithIntermediaires>,
        ) => {
          useZustandStore.setState((state) => ({
            feis: {
              ...state.feis,
              [fei_numero]: {
                ...state.feis[fei_numero],
                ...partialFei,
              },
            },
          }));
        },
        updateCarcasse: (
          zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
          partialCarcasse: Partial<Carcasse>,
        ) => {
          useZustandStore.setState((state) => ({
            carcasses: {
              ...state.carcasses,
              [zacharie_carcasse_id]: {
                ...state.carcasses[zacharie_carcasse_id],
                ...partialCarcasse,
              },
            },
          }));
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
        storage: createJSONStorage(() => storage),
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
