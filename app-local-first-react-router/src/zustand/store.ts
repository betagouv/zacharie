import { type Fei, type Carcasse, type CarcasseIntermediaire, type Log } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { UserForFei } from '~/src/types/user';
import type { EntityWithUserRelation } from '~/src/types/entity';
import type { SyncResponse, UserConnexionResponse } from '~/src/types/responses';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import type { HistoryInput } from '@app/utils/create-history-entry';
import { syncProchainBraceletAUtiliser } from './user';
import updateCarcasseStatus from '@app/utils/get-carcasse-status';
import { CarcasseForResponseForRegistry } from '@api/src/types/carcasse';
// PQueue removed - using bulk sync via POST /sync
import {
  getFeiAndCarcasseAndIntermediaireIds,
  getFeiAndIntermediaireIds,
} from '@app/utils/get-carcasse-intermediaire-id';
import type {
  FeiAndCarcasseAndIntermediaireIds,
  FeiAndIntermediaireIds,
  FeiIntermediaire,
} from '@app/types/fei-intermediaire';
import API from '@app/services/api';
import { capture } from '@app/services/sentry';
import { mapFeiFieldsToCarcasse } from '@app/utils/map-fei-fields-to-carcasse';
import { createSlicedIDBStorage } from './idb-sliced-storage';

// State keys to persist in IndexedDB (each stored as its own entry)
const PERSISTED_KEYS: (keyof State)[] = [
  'dataIsSynced',
  'feis',
  'users',
  'entities',
  'detenteursInitiauxIds',
  'carcasses',
  'carcassesIntermediaireById',
  'apiKeyApprovals',
  'lastUpdateCarcassesRegistry',
  'carcassesRegistry',
  'logs',
];

export interface State {
  isOnline: boolean;
  dataIsSynced: boolean;
  feis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires>;
  users: Record<UserForFei['id'], UserForFei>;
  entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>;
  detenteursInitiauxIds: Array<UserForFei['id']>;
  carcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse>;
  // single intermediaire for a single carcasse
  carcassesIntermediaireById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>;
  apiKeyApprovals: NonNullable<UserConnexionResponse['data']['apiKeyApprovals']>;
  lastUpdateCarcassesRegistry: number;
  carcassesRegistry: Array<CarcasseForResponseForRegistry>;
  logs: Array<Log>;
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
  updateCarcassesTransmission: (
    zacharie_carcasse_ids: string[],
    transmissionFields: Partial<
      Pick<
        Carcasse,
        | 'current_owner_user_id'
        | 'current_owner_user_name_cache'
        | 'current_owner_entity_id'
        | 'current_owner_entity_name_cache'
        | 'current_owner_role'
        | 'next_owner_user_id'
        | 'next_owner_user_name_cache'
        | 'next_owner_entity_id'
        | 'next_owner_entity_name_cache'
        | 'next_owner_role'
        | 'next_owner_wants_to_sous_traite'
        | 'next_owner_sous_traite_at'
        | 'next_owner_sous_traite_by_user_id'
        | 'next_owner_sous_traite_by_entity_id'
        | 'prev_owner_user_id'
        | 'prev_owner_entity_id'
        | 'prev_owner_role'
      >
    >,
  ) => void;
  createFeiIntermediaires: (
    newFeiIntermediaires: FeiIntermediaire[],
    specificCarcasseIds?: string[],
  ) => Promise<void>;
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
  logs: [],
  feis: {},
  users: {},
  entities: {},
  detenteursInitiauxIds: [],
  apiKeyApprovals: [],
  carcasses: {},
  carcassesIntermediaireById: {},
  _hasHydrated: false,
};

const useZustandStore = create<State & Actions>()(
  devtools(
    persist(
      (set, get): State & Actions => ({
        ...initialState,
        createFei: (newFei: FeiWithIntermediaires) => {
          newFei.is_synced = false;
          newFei.updated_at = dayjs().toDate();
          useZustandStore.setState((state) => ({
            ...state,
            feis: { ...state.feis, [newFei.numero]: newFei },
            dataIsSynced: false,
          }));
        },
        updateFei: (
          fei_numero: FeiWithIntermediaires['numero'],
          partialFei: Partial<FeiWithIntermediaires>,
        ) => {
          console.log('updateFei', fei_numero, JSON.stringify(partialFei, null, 2));
          const carcassefeiCarcasses = filterCarcassesForFei(
            useZustandStore.getState().carcasses,
            fei_numero,
          );
          const countCarcassesByEspece = formatCountCarcasseByEspece(carcassefeiCarcasses);
          const nextFei: FeiWithIntermediaires = {
            ...useZustandStore.getState().feis[fei_numero],
            ...partialFei,
            resume_nombre_de_carcasses: countCarcassesByEspece.join('\n'),
            updated_at: dayjs().toDate(),
            is_synced: false,
          };

          const nextCarcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
          for (const carcasse of carcassefeiCarcasses) {
            nextCarcasses[carcasse.zacharie_carcasse_id] = {
              ...carcasse,
              ...mapFeiFieldsToCarcasse(nextFei, carcasse),
              updated_at: dayjs().toDate(),
              is_synced: false,
            };
          }

          useZustandStore.setState((state) => ({
            feis: {
              ...state.feis,
              [fei_numero]: nextFei,
            },
            carcasses: {
              ...state.carcasses,
              ...nextCarcasses,
            },
            dataIsSynced: false,
          }));
        },
        createCarcasse: (newCarcasse: Carcasse) => {
          newCarcasse.is_synced = false;
          newCarcasse.updated_at = dayjs().toDate();

          useZustandStore.setState((state) => {
            return {
              ...state,
              carcasses: {
                ...state.carcasses,
                [newCarcasse.zacharie_carcasse_id]: newCarcasse,
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
        updateCarcassesTransmission: (zacharie_carcasse_ids, transmissionFields) => {
          for (const id of zacharie_carcasse_ids) {
            get().updateCarcasse(id, transmissionFields, false);
          }
        },
        createFeiIntermediaires: async (
          newIntermediaires: FeiIntermediaire[],
          specificCarcasseIds?: string[],
        ) => {
          if (newIntermediaires.length === 0) return;
          return new Promise((resolve) => {
            const feiNumero = newIntermediaires[0].fei_numero;
            const allCarcasses = filterCarcassesForFei(useZustandStore.getState().carcasses, feiNumero);
            const carcasses = specificCarcasseIds
              ? allCarcasses.filter((c) => specificCarcasseIds.includes(c.zacharie_carcasse_id))
              : allCarcasses;
            const byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire> = {};
            for (const newIntermediaire of newIntermediaires) {
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

              for (const ci of carcassesIntermediaires) {
                const feiAndCarcasseAndIntermediaireId = getFeiAndCarcasseAndIntermediaireIds(ci);
                byId[feiAndCarcasseAndIntermediaireId] = ci;
              }
            }

            useZustandStore.setState((state) => {
              return {
                ...state,
                carcassesIntermediaireById: {
                  ...state.carcassesIntermediaireById,
                  ...byId,
                },
                dataIsSynced: false,
              };
            });
            resolve();
          });
        },
        updateAllCarcasseIntermediaire: (
          _fei_numero: Fei['numero'],
          feiAndIntermediaireIds: FeiAndIntermediaireIds,
          nextCarcasseIntermediaire: Partial<CarcasseIntermediaire>,
        ) => {
          const carcassesIntermediaireById = useZustandStore.getState().carcassesIntermediaireById;
          const nextCarcassesIntermediaireById: Record<
            FeiAndCarcasseAndIntermediaireIds,
            CarcasseIntermediaire
          > = {};
          const matchingEntries = Object.entries(carcassesIntermediaireById).filter(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ([_id, ci]) => getFeiAndIntermediaireIds(ci) === feiAndIntermediaireIds,
          );
          for (const [carcassesIntermediaireId, carcassesIntermediaire] of matchingEntries) {
            if (!carcassesIntermediaire.prise_en_charge) continue;
            nextCarcassesIntermediaireById[carcassesIntermediaireId as FeiAndCarcasseAndIntermediaireIds] = {
              ...carcassesIntermediaire,
              ...nextCarcasseIntermediaire,
              updated_at: dayjs().toDate(),
              is_synced: false,
            };
          }

          useZustandStore.setState((state) => {
            return {
              ...state,
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
        storage: createSlicedIDBStorage<Partial<State>>(PERSISTED_KEYS),
        onRehydrateStorage: (state) => {
          return () => state.setHasHydrated(true);
        },
        partialize: (state) =>
          Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]])) as Partial<State>,
      },
    ),
  ),
);

export default useZustandStore;

// SYNC DATA

let debug = false;

// Single AbortController for the current sync request
let syncAbortController: AbortController | null = null;

export async function syncData(calledFrom: string) {
  const state = useZustandStore.getState();
  if (!state.isOnline) {
    console.log('not syncing data because not online');
    return;
  }

  if (debug) console.log('syncing data from', calledFrom);

  // Cancel any in-flight sync
  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort('new sync requested');
  }
  syncAbortController = new AbortController();
  const signal = syncAbortController.signal;

  // Sync bracelet first (independent)
  await syncProchainBraceletAUtiliser();

  // Collect all unsynced items
  const unsyncedFeis = Object.values(state.feis).filter((f) => !f.is_synced);
  const unsyncedCarcasses = Object.values(state.carcasses).filter((c) => !c.is_synced);
  const unsyncedIntermediaires = Object.values(state.carcassesIntermediaireById).filter(
    (ci) => !ci.is_synced,
  );
  const unsyncedLogs = state.logs.filter((l) => !l.is_synced);

  // Nothing to sync
  if (
    unsyncedFeis.length === 0 &&
    unsyncedCarcasses.length === 0 &&
    unsyncedIntermediaires.length === 0 &&
    unsyncedLogs.length === 0
  ) {
    useZustandStore.setState({ dataIsSynced: true });
    return;
  }

  if (debug) {
    console.log(
      `syncing: ${unsyncedFeis.length} feis, ${unsyncedCarcasses.length} carcasses, ${unsyncedIntermediaires.length} intermediaires, ${unsyncedLogs.length} logs`,
    );
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
    });

    if (signal.aborted) return;

    const res = response as SyncResponse;
    if (!res.ok || !res.data) {
      console.error('sync failed', res.error);
      return;
    }

    // Merge response back into store
    const nextFeis = { ...useZustandStore.getState().feis };
    for (const fei of res.data.feis) {
      nextFeis[fei.numero] = fei;
    }

    const nextCarcasses = { ...useZustandStore.getState().carcasses };
    for (const carcasse of res.data.carcasses) {
      nextCarcasses[carcasse.zacharie_carcasse_id] = carcasse;
    }

    const nextIntermediaires = { ...useZustandStore.getState().carcassesIntermediaireById };
    for (const ci of res.data.carcassesIntermediaires) {
      const id = getFeiAndCarcasseAndIntermediaireIds(ci);
      nextIntermediaires[id] = ci;
    }

    const syncedLogIdsSet = new Set(res.data.syncedLogIds);
    const nextLogs = useZustandStore.getState().logs.filter((log) => !syncedLogIdsSet.has(log.id));

    useZustandStore.setState({
      feis: nextFeis,
      carcasses: nextCarcasses,
      carcassesIntermediaireById: nextIntermediaires,
      logs: nextLogs,
      dataIsSynced: true,
    });
  } catch (error) {
    if (signal.aborted) return;
    console.error('sync error', error);
    capture(error as Error, { extra: { calledFrom } });
  }
}
