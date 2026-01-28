import {
  type Fei,
  type EntityAndUserRelations,
  type Carcasse,
  type CarcasseIntermediaire,
  type Log,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { UserForFei } from '~/src/types/user';
import type { EntityWithUserRelation } from '~/src/types/entity';
import type { UserConnexionResponse, SyncResponse } from '~/src/types/responses';
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
// PQueue removed - using bulk sync instead
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
import { capture } from '@app/services/sentry';

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
  ccgsIds: Array<EntityWithUserRelation['id']>;
  collecteursProIds: Array<EntityWithUserRelation['id']>;
  etgsIds: Array<EntityWithUserRelation['id']>;
  svisIds: Array<EntityWithUserRelation['id']>;
  circuitCourtIds: Array<EntityWithUserRelation['id']>;
  detenteursInitiaux: Record<UserForFei['id'], UserForFei>;
  entityAndUserRelations: Record<EntityAndUserRelations['entity_id'], EntityAndUserRelations>;
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
  apiKeyApprovals: NonNullable<UserConnexionResponse['data']['apiKeyApprovals']>;
  lastUpdateCarcassesRegistry: number;
  carcassesRegistry: Array<CarcasseForResponseForRegistry>;
  logs: Array<Log>;
  // inetermediairesPopulated: Array<PopulatedIntermediaire>; // Note: fixed typo from 'inetermediaires'
  _hasHydrated: boolean;
}

type CreateLog = {
  user_id: UserForFei['id'];
  user_role: string;
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
  setApiKeyApprovals: (apiKeyApprovals: UserConnexionResponse['data']['apiKeyApprovals']) => void;
  setHasHydrated: (state: boolean) => void;
  addLog: (log: Omit<CreateLog, 'fei_intermediaire_id'>) => Log;
  reset: () => void;
}

const initialState: State = {
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
  ccgsIds: [],
  collecteursProIds: [],
  etgsIds: [],
  circuitCourtIds: [],
  svisIds: [],
  apiKeyApprovals: [],
  detenteursInitiaux: {},
  entityAndUserRelations: {},
  carcasses: {},
  carcassesIdsByFei: {},
  carcassesIntermediaireById: {},
  carcassesIntermediairesIdsByCarcasse: {},
  carcassesIntermediaireIdsByIntermediaire: {},
  intermediairesByFei: {},
  _hasHydrated: false,
};

const useZustandStore = create<State & Actions>()(
  devtools(
    persist(
      (set, get): State & Actions => ({
        ...initialState,
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
              .filter((c) => !c.intermediaire_carcasse_refus_intermediaire_id && !c.deleted_at)
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
                nombre_d_animaux_acceptes: null,
                commentaire: null,
                decision_at: null,
                ecarte_pour_inspection: false,
                prise_en_charge: true, // always true by default, confirmed by the intermediaire globally
                prise_en_charge_at: newIntermediaire.prise_en_charge_at, // will be set by the intermediaire when he confirms all the carcasse
                intermediaire_depot_type: null,
                intermediaire_depot_entity_id: null,
                intermediaire_prochain_detenteur_role_cache: null,
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
              if (!byCarcasseId[ci.zacharie_carcasse_id].includes(feiAndCarcasseAndIntermediaireId)) {
                byCarcasseId[ci.zacharie_carcasse_id].push(feiAndCarcasseAndIntermediaireId);
              }
              if (!byIntermediaireId[feiAndIntermediaireId]) byIntermediaireId[feiAndIntermediaireId] = [];
              if (!byIntermediaireId[feiAndIntermediaireId].includes(feiAndCarcasseAndIntermediaireId)) {
                byIntermediaireId[feiAndIntermediaireId].push(feiAndCarcasseAndIntermediaireId);
              }
            }

            useZustandStore.setState((state) => {
              return {
                ...state,
                intermediairesByFei: {
                  ...state.intermediairesByFei,
                  [newIntermediaire.fei_numero]: nextIntermediairesForFei.sort((a, b) =>
                    dayjs(a.created_at).diff(b.created_at) < 0 ? 1 : -1,
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
          // FIXME: pourquoi on n'envoie pas de syncData ici ?
          // explication : parce qu'on fait un syncData après updateFei seulement
          // et qu'on appelle TOUT LE TEMPS updateFei APRÈS updateAllCarcasseIntermediaire
          // à vérifier toutefois : que c'est bien la dernière version du store
          // qui est envoyée
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
        setApiKeyApprovals: (apiKeyApprovals: UserConnexionResponse['data']['apiKeyApprovals']) => {
          set({ apiKeyApprovals });
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
        reset: () => {
          set(initialState);
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

// Throttle sync calls to prevent overwhelming the server
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let syncAbortController: AbortController | null = null;
const SYNC_THROTTLE_MS = 100;

/**
 * Bulk sync function that sends all unsynced data to /sync endpoint
 */
export async function syncData(calledFrom: string) {
  const state = useZustandStore.getState();
  console.log('syncData called from', calledFrom, 'isOnline', state.isOnline);
  if (!state.isOnline) {
    console.log('not syncing data because not online');
    return;
  }

  if (debug) console.log('syncing data from', calledFrom);

  // Cancel any pending sync
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  if (syncAbortController) {
    syncAbortController.abort('new sync requested');
  }

  // Throttle sync calls
  syncTimeout = setTimeout(async () => {
    syncAbortController = new AbortController();
    await performSync(syncAbortController.signal);
  }, SYNC_THROTTLE_MS);
}

async function performSync(signal: AbortSignal) {
  const state = useZustandStore.getState();

  // Sync bracelet first (independent)
  await syncProchainBraceletAUtiliser();

  if (signal.aborted) return;

  // Collect all unsynced data
  const unsyncedFeis = Object.values(state.feis).filter((f) => !f.is_synced);
  const unsyncedCarcasses = Object.values(state.carcasses).filter((c) => !c.is_synced);
  const unsyncedIntermediaires = Object.values(state.carcassesIntermediaireById).filter(
    (ci) => !ci.is_synced,
  );
  const unsyncedLogs = state.logs.filter((l) => !l.is_synced);

  // Nothing to sync
  if (
    !unsyncedFeis.length &&
    !unsyncedCarcasses.length &&
    !unsyncedIntermediaires.length &&
    !unsyncedLogs.length
  ) {
    if (debug) console.log('nothing to sync');
    useZustandStore.setState({ dataIsSynced: true });
    return;
  }

  if (debug) {
    console.log('syncing:', {
      feis: unsyncedFeis.length,
      carcasses: unsyncedCarcasses.length,
      intermediaires: unsyncedIntermediaires.length,
      logs: unsyncedLogs.length,
    });
  }

  try {
    const response = await API.post({
      path: '/sync',
      body: {
        feis: unsyncedFeis,
        carcasses: unsyncedCarcasses,
        carcassesIntermediaires: unsyncedIntermediaires,
        logs: unsyncedLogs,
      },
      signal,
    }).then((res) => res as SyncResponse);

    if (signal.aborted) return;

    if (response.ok && response.data) {
      const { feis, carcasses, carcassesIntermediaires, syncedLogIds } = response.data;

      if (debug) {
        console.log('sync response:', {
          feis: feis.length,
          carcasses: carcasses.length,
          intermediaires: carcassesIntermediaires.length,
          logs: syncedLogIds.length,
        });
      }

      // Merge synced data back into store
      useZustandStore.setState((state) => {
        // Update FEIs
        const updatedFeis = { ...state.feis };
        for (const fei of feis) {
          updatedFeis[fei.numero] = fei;
        }

        // Update Carcasses
        const updatedCarcasses = { ...state.carcasses };
        const updatedCarcassesIdsByFei = { ...state.carcassesIdsByFei };
        for (const carcasse of carcasses) {
          updatedCarcasses[carcasse.zacharie_carcasse_id] = carcasse;
          // Update carcassesIdsByFei
          if (!updatedCarcassesIdsByFei[carcasse.fei_numero]) {
            updatedCarcassesIdsByFei[carcasse.fei_numero] = [];
          }
          if (!updatedCarcassesIdsByFei[carcasse.fei_numero].includes(carcasse.zacharie_carcasse_id)) {
            updatedCarcassesIdsByFei[carcasse.fei_numero].push(carcasse.zacharie_carcasse_id);
          }
        }

        // Update CarcassesIntermediaires
        const updatedIntermediaires = { ...state.carcassesIntermediaireById };
        for (const ci of carcassesIntermediaires) {
          const id = getFeiAndCarcasseAndIntermediaireIds(ci);
          updatedIntermediaires[id] = ci;
        }

        // Remove synced logs
        const updatedLogs = state.logs.filter((l) => !syncedLogIds.includes(l.id));

        return {
          feis: updatedFeis,
          carcasses: updatedCarcasses,
          carcassesIdsByFei: updatedCarcassesIdsByFei,
          carcassesIntermediaireById: updatedIntermediaires,
          logs: updatedLogs,
          dataIsSynced: true,
        };
      });
    } else if (!response.ok) {
      console.error('sync failed:', response.error);
      capture(new Error('Sync failed'), {
        extra: {
          error: response.error,
          feiCount: unsyncedFeis.length,
          carcasseCount: unsyncedCarcasses.length,
          intermediairesCount: unsyncedIntermediaires.length,
          logsCount: unsyncedLogs.length,
        },
      });
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      if (debug) console.log('sync aborted');
      return;
    }
    capture(error as Error, {
      extra: { error: error as Error },
    });
    console.error('sync error:', error);
  }
}
