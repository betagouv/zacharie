import {
  type Fei,
  type EntityAndUserRelations,
  type ETGAndEntityRelations,
  type Carcasse,
  type CarcasseIntermediaire,
  type Log,
  UserRoles,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { UserForFei } from '~/src/types/user';
import type { EntityWithUserRelation } from '~/src/types/entity';
import type {
  FeiResponse,
  CarcasseResponse,
  CarcasseIntermediaireResponse,
  LogResponse,
} from '~/src/types/responses';
import type { FeiDone, FeiWithIntermediaires } from '~/src/types/fei';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import type { HistoryInput } from '@app/utils/create-history-entry';
import { syncProchainBraceletAUtiliser } from './user';
import updateCarcasseStatus from '@app/utils/get-carcasse-status';
import { CarcasseForResponseForRegistry } from '@api/src/types/carcasse';
import PQueue from 'p-queue';
import {
  getFeiAndCarcasseAndIntermediaireIds,
  getFeiAndIntermediaireIds,
  getFeiAndIntermediaireIdsFromFeiIntermediaire,
} from '@app/utils/get-carcasse-intermediaire-id';
import type {
  FeiAndCarcasseAndIntermediaireIds,
  FeiAndIntermediaireIds,
  FeiIntermediaire,
} from '@app/types/fei-intermediaire';
import { get, set, del } from 'idb-keyval'; // can use anything: IndexedDB, Ionic Storage, etc.
import API from '@app/services/api';

// Custom storage object
export const indexDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // console.log(name, 'has been retrieved');
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // console.log(name, 'with value', value, 'has been saved');
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    // console.log(name, 'has been deleted');
    await del(name);
  },
};

export interface State {
  isOnline: boolean;
  dataIsSynced: boolean;
  feisDoneNumeros: Array<FeiDone['numero']>;
  feisDone: Record<FeiDone['numero'], FeiDone>;
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
  // single intermediaire for a single carcasse
  carcassesIntermediaireById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>;
  // list of intermediaires for a carcasse
  carcassesIntermediairesIdsByCarcasse: Record<
    Carcasse['zacharie_carcasse_id'],
    Array<FeiAndCarcasseAndIntermediaireIds>
  >;
  // list of carcasses for an intermediaire
  carcassesIntermediaireIdsByIntermediaire: Record<
    FeiAndIntermediaireIds,
    Array<FeiAndCarcasseAndIntermediaireIds>
  >;
  intermediairesByFei: Record<Fei['numero'], Array<FeiIntermediaire>>;
  lastUpdateCarcassesRegistry: number;
  carcassesRegistry: Array<CarcasseForResponseForRegistry>;
  logs: Array<Log>;
  // inetermediairesPopulated: Array<PopulatedIntermediaire>; // Note: fixed typo from 'inetermediaires'
  _hasHydrated: boolean;
}

type CreateLog = {
  user_id: UserForFei['id'];
  user_role: UserRoles;
  action: string;
  history?: HistoryInput;
  fei_numero: Fei['numero'] | null;
  entity_id: EntityWithUserRelation['id'] | null;
  zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'] | null;
  fei_intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
  intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
  carcasse_intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
};

interface Actions {
  createFei: (newFei: FeiWithIntermediaires) => void;
  updateFei: (fei_numero: FeiWithIntermediaires['numero'], fei: Partial<FeiWithIntermediaires>) => void;
  createCarcasse: (newCarcasse: Carcasse) => void;
  updateCarcasse: (
    zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
    carcasse: Partial<Carcasse>,
    updateFei: boolean,
  ) => void;
  getFeiIntermediairesForFeiNumero: (fei_numero: Fei['numero']) => Array<FeiIntermediaire>;
  getCarcassesIntermediairesForCarcasse: (
    zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
  ) => Array<CarcasseIntermediaire>;
  createFeiIntermediaire: (newFeiIntermediaire: FeiIntermediaire) => Promise<void>;
  updateAllCarcasseIntermediaire: (
    fei_numero: Fei['numero'],
    feiAndIntermediaireIds: FeiAndIntermediaireIds,
    partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
  ) => void;
  updateCarcasseIntermediaire: (
    feiAndCarcasseAndIntermediaireIds: FeiAndCarcasseAndIntermediaireIds,
    partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
  ) => void;
  setHasHydrated: (state: boolean) => void;
  addLog: (log: Omit<CreateLog, 'fei_intermediaire_id'>) => Log;
}

const useZustandStore = create<State & Actions>()(
  devtools(
    persist(
      (set, get): State & Actions => ({
        isOnline: true,
        dataIsSynced: true,
        carcassesRegistry: [],
        lastUpdateCarcassesRegistry: 0,
        feisDoneNumeros: [],
        feisDone: {},
        logs: [],
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
        carcassesIntermediaireById: {},
        // feisIntermediaires: {},
        carcassesIntermediairesIdsByCarcasse: {},
        carcassesIntermediaireIdsByIntermediaire: {},
        intermediairesByFei: {},
        getFeiIntermediairesForFeiNumero: (fei_numero: Fei['numero']) => {
          return get().intermediairesByFei[fei_numero] || [];
        },
        getCarcassesIntermediairesForCarcasse: (zacharie_carcasse_id: Carcasse['zacharie_carcasse_id']) => {
          const carcassesIntermediairesIdsByCarcasse = get().carcassesIntermediairesIdsByCarcasse;
          const carcassesIntermediairesIds = carcassesIntermediairesIdsByCarcasse[zacharie_carcasse_id] || [];
          const carcassesIntermediaires = [];
          for (const carcassesIntermediaireId of carcassesIntermediairesIds) {
            const carcassesIntermediaire = get().carcassesIntermediaireById[carcassesIntermediaireId];
            carcassesIntermediaires.push(carcassesIntermediaire);
          }
          return carcassesIntermediaires;
        },
        // carcassesIntermediaires: {},
        // carcassesIntermediairesByIntermediaire: {},
        // carcassesIntermediairesIdsByCarcasse: {},
        createFei: (newFei: FeiWithIntermediaires) => {
          newFei.is_synced = false;
          newFei.updated_at = dayjs().toDate();
          useZustandStore.setState((state) => ({
            ...state,
            feis: { ...state.feis, [newFei.numero]: newFei },
            carcassesIdsByFei: { ...state.carcassesIdsByFei, [newFei.numero]: [] },
            dataIsSynced: false,
          }));
          syncData(`create-fei-${newFei.numero}`);
        },
        updateFei: (
          fei_numero: FeiWithIntermediaires['numero'],
          partialFei: Partial<FeiWithIntermediaires>,
        ) => {
          console.log('updateFei', fei_numero, JSON.stringify(partialFei, null, 2));
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
            dataIsSynced: false,
          });
          syncData(`update-fei-${fei_numero}`);
        },
        createCarcasse: (newCarcasse: Carcasse) => {
          newCarcasse.is_synced = false;
          newCarcasse.updated_at = dayjs().toDate();
          const nextCarcassesIdsByFei =
            useZustandStore.getState().carcassesIdsByFei[newCarcasse.fei_numero] || [];
          if (!nextCarcassesIdsByFei.includes(newCarcasse.zacharie_carcasse_id)) {
            nextCarcassesIdsByFei.unshift(newCarcasse.zacharie_carcasse_id);
          }
          useZustandStore.setState((state) => {
            return {
              ...state,
              carcasses: {
                [newCarcasse.zacharie_carcasse_id]: newCarcasse,
                ...state.carcasses,
              },
              carcassesIdsByFei: {
                ...state.carcassesIdsByFei,
                [newCarcasse.fei_numero]: nextCarcassesIdsByFei,
              },
              dataIsSynced: false,
            };
          });
          get().updateFei(newCarcasse.fei_numero, { updated_at: dayjs().toDate() });
        },
        updateCarcasse: (
          zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
          partialCarcasse: Partial<Carcasse>,
          updateFei: boolean,
        ) => {
          const carcasses = useZustandStore.getState().carcasses;
          console.log('NOT SYNCED 1');
          const nextCarcasse = {
            ...carcasses[zacharie_carcasse_id],
            ...partialCarcasse,
            updated_at: dayjs().toDate(),
            is_synced: false,
          };
          const nextStatus = updateCarcasseStatus(nextCarcasse);
          if (nextStatus !== nextCarcasse.svi_carcasse_status) {
            nextCarcasse.svi_carcasse_status = nextStatus;
            nextCarcasse.svi_carcasse_status_set_at = dayjs().toDate();
          }
          useZustandStore.setState({
            carcasses: {
              ...carcasses,
              [zacharie_carcasse_id]: nextCarcasse,
            },
            dataIsSynced: false,
          });
          if (updateFei) {
            get().updateFei(nextCarcasse.fei_numero, { updated_at: dayjs().toDate() });
          }
        },
        createFeiIntermediaire: async (newIntermediaire: FeiIntermediaire) => {
          return new Promise((resolve) => {
            const intermediairesByFei = useZustandStore.getState().intermediairesByFei;
            const nextIntermediairesForFei = intermediairesByFei[newIntermediaire.fei_numero] || [];
            nextIntermediairesForFei.push(newIntermediaire);
            intermediairesByFei[newIntermediaire.fei_numero] = nextIntermediairesForFei;
            const feiCarcassesIds =
              useZustandStore.getState().carcassesIdsByFei[newIntermediaire.fei_numero] || [];
            const carcasses = feiCarcassesIds.map((id) => useZustandStore.getState().carcasses[id]);
            const carcassesIntermediaires: Array<CarcasseIntermediaire> = carcasses
              .filter((c) => !c.intermediaire_carcasse_refus_intermediaire_id)
              .map((c) => ({
                fei_numero: c.fei_numero,
                numero_bracelet: c.numero_bracelet,
                zacharie_carcasse_id: c.zacharie_carcasse_id,
                intermediaire_id: newIntermediaire.id,
                intermediaire_entity_id: newIntermediaire.intermediaire_entity_id,
                intermediaire_role: newIntermediaire.intermediaire_role,
                intermediaire_user_id: newIntermediaire.intermediaire_user_id,
                check_manuel: null,
                manquante: null,
                refus: null,
                commentaire: null,
                decision_at: null,
                prise_en_charge: true, // always true by default, confirmed by the intermediaire globally
                prise_en_charge_at: newIntermediaire.prise_en_charge_at, // will be set by the intermediaire when he confirms all the carcasse
                intermediaire_depot_type: null,
                intermediaire_depot_entity_id: null,
                intermediaire_prochain_detenteur_type_cache: null,
                intermediaire_prochain_detenteur_id_cache: null,
                intermediaire_poids: null,
                created_at: newIntermediaire.created_at,
                updated_at: newIntermediaire.created_at,
                deleted_at: null,
                is_synced: false,
              }));
            const byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire> = {};
            const byCarcasseId = useZustandStore.getState().carcassesIntermediairesIdsByCarcasse;
            const byIntermediaireId: Record<
              FeiAndIntermediaireIds,
              Array<FeiAndCarcasseAndIntermediaireIds>
            > = {};
            for (const ci of carcassesIntermediaires) {
              const feiAndIntermediaireId = getFeiAndIntermediaireIds(ci);
              const feiAndCarcasseAndIntermediaireId = getFeiAndCarcasseAndIntermediaireIds(ci);

              byId[feiAndCarcasseAndIntermediaireId] = ci;
              if (!byCarcasseId[ci.zacharie_carcasse_id]) byCarcasseId[ci.zacharie_carcasse_id] = [];
              byCarcasseId[ci.zacharie_carcasse_id].push(feiAndCarcasseAndIntermediaireId);
              if (!byIntermediaireId[feiAndIntermediaireId]) byIntermediaireId[feiAndIntermediaireId] = [];
              byIntermediaireId[feiAndIntermediaireId].push(feiAndCarcasseAndIntermediaireId);
            }
            useZustandStore.setState((state) => {
              return {
                ...state,
                intermediairesByFei: {
                  ...state.intermediairesByFei,
                  [newIntermediaire.fei_numero]: nextIntermediairesForFei.sort((a, b) =>
                    a.created_at < b.created_at ? 1 : -1,
                  ),
                },
                carcassesIntermediaireById: {
                  ...state.carcassesIntermediaireById,
                  ...byId,
                },
                carcassesIntermediairesIdsByCarcasse: {
                  ...byCarcasseId,
                },
                carcassesIntermediaireIdsByIntermediaire: {
                  ...byIntermediaireId,
                },
                dataIsSynced: false,
              };
            });
            resolve();
          });
        },
        updateAllCarcasseIntermediaire: (
          fei_numero: Fei['numero'],
          feiAndIntermediaireIds: FeiAndIntermediaireIds,
          nextCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
        ) => {
          const carcassesIntermediaireById = useZustandStore.getState().carcassesIntermediaireById;
          const nextCarcassesIntermediaireById: Record<
            FeiAndCarcasseAndIntermediaireIds,
            CarcasseIntermediaire
          > = {};
          const carcassesIntermediaireIds =
            useZustandStore.getState().carcassesIntermediaireIdsByIntermediaire[feiAndIntermediaireIds];
          for (const carcassesIntermediaireId of carcassesIntermediaireIds) {
            const carcassesIntermediaire = carcassesIntermediaireById[carcassesIntermediaireId];
            if (!carcassesIntermediaire.prise_en_charge) continue;
            nextCarcassesIntermediaireById[carcassesIntermediaireId] = {
              ...carcassesIntermediaire,
              ...nextCarcasseIntermediaire,
              updated_at: dayjs().toDate(),
              is_synced: false,
            };
          }
          useZustandStore.setState((state) => {
            return {
              ...state,
              intermediairesByFei: {
                ...state.intermediairesByFei,
                [fei_numero]: state.intermediairesByFei[fei_numero].map((intermediaire) => {
                  if (
                    feiAndIntermediaireIds === getFeiAndIntermediaireIdsFromFeiIntermediaire(intermediaire)
                  ) {
                    return {
                      ...intermediaire,
                      ...nextCarcasseIntermediaire,
                      updated_at: dayjs().toDate(),
                      is_synced: false,
                    };
                  }
                  return intermediaire;
                }),
              },
              carcassesIntermediaireById: {
                ...state.carcassesIntermediaireById,
                ...nextCarcassesIntermediaireById,
              },
              dataIsSynced: false,
            };
          });
        },
        updateCarcasseIntermediaire: (
          feiAndCarcasseAndIntermediaireIds: FeiAndCarcasseAndIntermediaireIds,
          partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
        ) => {
          const carcasseIntermediaire =
            useZustandStore.getState().carcassesIntermediaireById[feiAndCarcasseAndIntermediaireIds];

          useZustandStore.setState((state) => {
            return {
              ...state,
              carcassesIntermediaireById: {
                ...state.carcassesIntermediaireById,
                [feiAndCarcasseAndIntermediaireIds]: {
                  ...carcasseIntermediaire,
                  ...partialCarcasseIntermediaire,
                  updated_at: dayjs().toDate(),
                  is_synced: false,
                },
              },
              dataIsSynced: false,
            };
          });
        },
        addLog: (newLog: Omit<CreateLog, 'fei_intermediaire_id'>) => {
          const log = {
            id: uuidv4(),
            user_id: newLog.user_id!,
            user_role: newLog.user_role!,
            fei_numero: newLog.fei_numero || null,
            entity_id: newLog.entity_id || null,
            zacharie_carcasse_id: newLog.zacharie_carcasse_id || null,
            fei_intermediaire_id: newLog.intermediaire_id || null,
            intermediaire_id: newLog.intermediaire_id || null,
            carcasse_intermediaire_id: newLog.carcasse_intermediaire_id || null,
            action: newLog.action!,
            history: JSON.stringify(newLog.history!),
            date: dayjs().toDate(),
            is_synced: false,
            created_at: dayjs().toDate(),
            updated_at: dayjs().toDate(),
            deleted_at: null,
          };
          useZustandStore.setState((state) => ({
            ...state,
            logs: [...state.logs, log],
            dataIsSynced: false,
          }));
          return log;
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
        version: 5,
        // storage: createJSONStorage(() => storage),
        storage: createJSONStorage(() => indexDBStorage), // (optional) by default, 'localStorage' is used
        // storage: createJSONStorage(() => window.localStorage),
        onRehydrateStorage: (state) => {
          return () => state.setHasHydrated(true);
        },
        partialize: (state) =>
          Object.fromEntries(
            Object.entries(state).filter(
              ([key]) =>
                ![
                  'isOnline',
                  // 'feiDone',
                  // fix the carcasses registry
                  // 'carcassesRegistry',
                  // 'lastUpdateCarcassesRegistry',
                ].includes(key),
            ),
          ),
      },
    ),
  ),
);

export default useZustandStore;

// SYNC DATA

let debug = false;

// we suffer from a SQL related bug while testing which is "cache lookup failed for type", not easy to debug
// it might be a problem with race condition:
// playwright is going so fast, and coupled with our local-first and submit-on-blur policies,
// too many requests are sent to the server,
// and too many SQL queries are made for the same data
// so we need to
// 1. throttle and cancel the sync if it's called too soon, thanks to intervalCap and interval
// 2. cancel the sync if it's called too soon, thanks to AbortController

const queue = new PQueue({ concurrency: 1, intervalCap: 1, interval: 30 });
let count = 0;

queue.on('active', () => {
  if (debug) console.log(`Working on item #${++count}.  Size: ${queue.size}  Pending: ${queue.pending}`);
});

queue.on('add', () => {
  if (debug) console.log(`Task is added.  Size: ${queue.size}  Pending: ${queue.pending}`);
});

queue.on('next', () => {
  // if (debug) console.log(`Task is completed.  Size: ${queue.size}  Pending: ${queue.pending}`);
  console.log(`Task is completed.  Size: ${queue.size}  Pending: ${queue.pending}`);
});

export async function syncFei(nextFei: FeiWithIntermediaires, signal: AbortSignal) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncFei not online');
  }
  return API.post({
    path: `/fei/${nextFei.numero}/`,
    body: nextFei,
    signal,
  })
    .then((res) => res as FeiResponse)
    .then((res) => {
      if (signal?.aborted) return;
      if (res.ok && res.data?.fei) {
        if (debug) console.log('synced fei', res.data.fei);
        useZustandStore.setState({
          feis: {
            ...useZustandStore.getState().feis,
            [nextFei.numero]: res.data.fei,
          },
        });
      }
    });
}

const feisControllers = new Map<string, AbortController>();

export async function syncFeis() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncFeis not online');
  }
  const feis = useZustandStore.getState().feis;
  for (const fei of Object.values(feis)) {
    if (!fei.is_synced) {
      if (debug) console.log('syncing fei', fei);
      const controller = new AbortController();
      queue.add(
        async ({ signal }) => {
          const existingController = feisControllers.get(fei.numero);
          if (existingController && !existingController.signal.aborted) {
            existingController.abort('race condition in feisControllers');
          } else {
            feisControllers.set(fei.numero, controller);
          }
          await syncFei(fei, signal!);
        },
        { signal: controller.signal },
      );
    }
  }
}

export async function syncCarcasse(nextCarcasse: Carcasse, signal: AbortSignal) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncCarcasse not online');
  }
  return API.post({
    path: `/fei-carcasse/${nextCarcasse.fei_numero}/${nextCarcasse.zacharie_carcasse_id}`,
    body: nextCarcasse,
    signal,
  })
    .then((res) => res as CarcasseResponse)
    .then((res) => {
      if (signal?.aborted) return;
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

const carcassesControllers = new Map<string, AbortController>();

export async function syncCarcasses() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncCarcasses not online');
  }
  const carcasses = useZustandStore.getState().carcasses;
  for (const carcasse of Object.values(carcasses)) {
    if (!carcasse.is_synced) {
      if (debug) console.log('syncing carcasse', carcasse);
      const controller = new AbortController();
      queue.add(
        async ({ signal }) => {
          const existingController = carcassesControllers.get(carcasse.zacharie_carcasse_id);
          if (existingController && !existingController.signal.aborted) {
            existingController.abort('race condition in carcassesControllers');
          } else {
            carcassesControllers.set(carcasse.zacharie_carcasse_id, controller);
          }
          await syncCarcasse(carcasse, signal!);
        },
        { signal: controller.signal },
      );
    }
  }
}

export async function syncCarcasseIntermediaire(
  nextCarcasseIntermediaire: CarcasseIntermediaire,
  signal: AbortSignal,
) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncCarcasseIntermediaire not online');
  }
  const feiNumero = nextCarcasseIntermediaire.fei_numero;
  const intermedaireId = nextCarcasseIntermediaire.intermediaire_id;
  const zacharieCarcasseId = nextCarcasseIntermediaire.zacharie_carcasse_id;
  return API.post({
    path: `/fei-carcasse-intermediaire/${feiNumero}/${intermedaireId}/${zacharieCarcasseId}`,
    body: nextCarcasseIntermediaire,
    signal,
  })
    .then((res) => res as CarcasseIntermediaireResponse)
    .then((res) => {
      if (signal?.aborted) return;
      if (res.ok && res.data.carcasseIntermediaire) {
        nextCarcasseIntermediaire = res.data.carcasseIntermediaire!;
        const feiAndCarcasseAndIntermediaireId =
          getFeiAndCarcasseAndIntermediaireIds(nextCarcasseIntermediaire);
        useZustandStore.setState((state) => ({
          carcassesIntermediaireById: {
            ...state.carcassesIntermediaireById,
            [feiAndCarcasseAndIntermediaireId]: {
              ...state.carcassesIntermediaireById[feiAndCarcasseAndIntermediaireId],
              ...nextCarcasseIntermediaire,
            },
          },
        }));
      }
    });
}

const intermediairesControllers = new Map<string, AbortController>();

export async function syncCarcassesIntermediaires() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncCarcassesIntermediaires not online');
  }
  const carcassesIntermediaires = useZustandStore.getState().carcassesIntermediaireById;
  for (const carcassesIntermediaire of Object.values(carcassesIntermediaires)) {
    if (!carcassesIntermediaire.is_synced) {
      if (debug) console.log('syncing carcasse intermediaire', carcassesIntermediaire);
      const controller = new AbortController();
      console.log(
        'adding to queue',
        carcassesIntermediaire.intermediaire_id + carcassesIntermediaire.zacharie_carcasse_id,
      );
      queue.add(
        async ({ signal }) => {
          const existingController = intermediairesControllers.get(
            carcassesIntermediaire.intermediaire_id + carcassesIntermediaire.zacharie_carcasse_id,
          );
          if (existingController && !existingController.signal.aborted) {
            console.log(
              'aborting',
              carcassesIntermediaire.intermediaire_id + carcassesIntermediaire.zacharie_carcasse_id,
            );
            existingController.abort('race condition in intermediairesControllers');
          } else {
            intermediairesControllers.set(
              carcassesIntermediaire.intermediaire_id + carcassesIntermediaire.zacharie_carcasse_id,
              controller,
            );
          }
          // prevent race condition
          await syncCarcasseIntermediaire(carcassesIntermediaire, signal!);
        },
        {
          signal: controller.signal,
        },
      );
    }
  }
}

export async function syncLog(nextLog: Log) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    throw new Error('syncLog not online');
  }
  return API.post({
    path: '/log',
    body: nextLog,
  })
    .then((res) => res as LogResponse)
    .then((res) => {
      if (res.ok) {
        useZustandStore.setState((state) => ({
          ...state,
          // we don't need to store locally the logs
          logs: state.logs.filter((log) => log.id !== nextLog.id),
        }));
      }
    });
}

export async function syncLogs() {
  const isOnline = useZustandStore.getState().logs;
  if (!isOnline) {
    throw new Error('syncLogs not online');
  }
  const logs = useZustandStore.getState().logs;
  for (const log of Object.values(logs)) {
    if (!log.is_synced) {
      if (debug) console.log('syncing log', log);
      await syncLog(log);
    }
  }
}

export async function syncData(calledFrom: string) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not syncing data because not online');
    return;
  }
  // if (import.meta.env.VITE_TEST_PLAYWRIGHT === 'true') {
  //   if (FOR_TEST_ONLY_started) {
  //     console.log('TEST_ONLY: waiting for queue to be empty');
  //     await new Promise((resolve) => queue.on('empty', resolve));
  //   }
  //   let FOR_TEST_ONLY_curentTryAskForSync = Date.now();
  //   FOR_TEST_ONLY_askedForSync = FOR_TEST_ONLY_curentTryAskForSync;
  //   // just wait one second to avoid race condition
  //   await new Promise((resolve) => setTimeout(resolve, 1000));
  //   if (FOR_TEST_ONLY_askedForSync !== FOR_TEST_ONLY_curentTryAskForSync) {
  //     console.log(
  //       'TEST_ONLY: not syncing data because another request has been made since this one was started',
  //     );
  //     // it means another request has been made since this one was started
  //     return;
  //   }
  //   FOR_TEST_ONLY_started = true;
  // }
  console.log('syncing data from', calledFrom);
  queue.add(async () => {
    await syncProchainBraceletAUtiliser();
  });
  syncFeis();
  syncCarcasses();
  syncCarcassesIntermediaires();
  syncLogs();
  queue.on('empty', () => {
    useZustandStore.setState({ dataIsSynced: true });
  });
  // queue.add(async () => {
  //   if (debug) {
  //     console.log('------------------------------------------');
  //     console.log('------------------------------------------');
  //     console.log('------------------------------------------');
  //     console.log('------------------------------------------');
  //     console.log(`--------SYNCING DATA called from ${calledFrom}----------------------`);
  //     console.log('------------------------------------------');
  //     console.log('------------------------------------------');
  //     console.log('------------------------------------------');
  //   }
  //   await syncProchainBraceletAUtiliser();
  //   if (debug) console.log('synced dernier bracelet utilise');
  //   await syncFeis();
  //   if (debug) console.log('synced feis finito');
  //   await syncCarcasses();
  //   if (debug) console.log('synced intermediaires finito');
  //   await syncCarcassesIntermediaires();
  //   if (debug) console.log('synced carcasses intermediaires finito');
  //   await syncLogs();
  //   if (debug) console.log('synced logs finito');
  //   if (debug) console.log('synced data finito');
  //   useZustandStore.setState({ dataIsSynced: true });
  //   FOR_TEST_ONLY_askedForSync = null;
  //   FOR_TEST_ONLY_started = false;
  // });
}
