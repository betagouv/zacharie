import {
  type Fei,
  type Carcasse,
  type CarcasseIntermediaire,
  type CarcasseModificationRequest,
  CarcasseModificationRequestStatus,
  type Log,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { UserForFei } from '~/src/types/user';
import type { EntityWithUserRelation } from '~/src/types/entity';
import type { SyncRejection, UserConnexionResponse } from '~/src/types/responses';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import type { HistoryInput } from '@app/utils/create-history-entry';
import updateCarcasseStatus from '@app/utils/get-carcasse-status';
import {
  getFeiAndCarcasseAndIntermediaireIds,
  getFeiAndIntermediaireIds,
} from '@app/utils/get-carcasse-intermediaire-id';
import type {
  FeiAndCarcasseAndIntermediaireIds,
  FeiAndIntermediaireIds,
  CarcassesIntermediaire,
} from '@app/types/carcasses-intermediaire';
import { mapFeiFieldsToCarcasse } from '@app/utils/map-fei-fields-to-carcasse';
import { isCarcassePriseEnChargeEnAval } from '@app/utils/carcasse-deja-envoyee';
import { createSlicedIDBStorage } from './idb-sliced-storage';
import { CarcasseTransmission } from '@app/types/carcasse';
import { datesToIso } from '@app/utils/dates-to-iso';
import { hasUnsyncedData } from '@app/utils/has-unsynced-data';

const PERSISTED_KEYS: (keyof State)[] = [
  'feis',
  'users',
  'entities',
  'detenteursInitiauxIds',
  'carcasses',
  'carcassesIntermediaireById',
  'modifRequestsByCarcasseId',
  'apiKeyApprovals',
  'federation',
  'lastUpdateFromServer',
  'carcassesReloadVersion',
  'logs',
  'feiIdsRenvoiToHide',
];

const RECORD_KEYS: (keyof State)[] = [
  'feis',
  'users',
  'entities',
  'carcasses',
  'carcassesIntermediaireById',
  'modifRequestsByCarcasseId',
];

export interface State {
  isOnline: boolean;
  dataIsSynced: boolean;
  feis: Record<Fei['numero'], Fei>;
  users: Record<UserForFei['id'], UserForFei>;
  entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>;
  detenteursInitiauxIds: Array<UserForFei['id']>;
  carcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse>;
  carcassesIntermediaireById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>;
  modifRequestsByCarcasseId: Record<Carcasse['zacharie_carcasse_id'], Array<CarcasseModificationRequest>>;
  apiKeyApprovals: NonNullable<UserConnexionResponse['data']['apiKeyApprovals']>;
  federation: NonNullable<UserConnexionResponse['data']['federation']> | null;
  lastUpdateFromServer: number;
  carcassesReloadVersion: number;
  feiIdsRenvoiToHide: Array<Fei['numero']>;
  logs: Array<Log>;
  syncRejections: Array<SyncRejection & { updated_at: number }>;
  _hasHydrated: boolean;
}

type CreateLog = {
  user_id: UserForFei['id'];
  user_role: string;
  action: string;
  history?: HistoryInput;
  fei_numero: Fei['numero'] | null | undefined;
  entity_id: EntityWithUserRelation['id'] | null | undefined;
  zacharie_carcasse_id: CarcasseModificationRequest['zacharie_carcasse_id'] | null | undefined;
  fei_intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null | undefined;
  intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null | undefined;
  carcasse_intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null | undefined;
};

interface Actions {
  createFei: (newFei: Fei) => void;
  updateFei: (fei_numero: Fei['numero'], fei: Partial<Fei>) => void;
  createCarcasse: (newCarcasse: Carcasse) => void;
  updateCarcasse: (
    zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
    carcasse: Partial<Carcasse>
  ) => void;
  updateCarcassesTransmission: (
    zacharie_carcasse_ids: string[],
    transmissionFields: CarcasseTransmission
  ) => void;
  hideFeiRenvoi: (fei_numero: Fei['numero']) => void;
  createCarcassesIntermediaire: (
    newFeiIntermediaires: CarcassesIntermediaire[],
    specificCarcasseIds: string[]
  ) => Promise<void>;
  updateAllCarcasseIntermediaire: (
    fei_numero: Fei['numero'],
    feiAndIntermediaireIds: FeiAndIntermediaireIds,
    partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>
  ) => void;
  updateCarcasseIntermediaire: (
    feiAndCarcasseAndIntermediaireIds: FeiAndCarcasseAndIntermediaireIds,
    partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>
  ) => void;
  setApiKeyApprovals: (apiKeyApprovals: UserConnexionResponse['data']['apiKeyApprovals']) => void;
  createCarcasseModifRequest: (request: CarcasseModificationRequest) => void;
  updateCarcasseModifRequest: (
    zacharie_carcasse_id: CarcasseModificationRequest['zacharie_carcasse_id'],
    partial: Partial<CarcasseModificationRequest>,
    approvalPayload?: {
      examinateur_anomalies_carcasse?: string[];
      examinateur_anomalies_abats?: string[];
      examinateur_commentaire?: string | null;
      examinateur_carcasse_sans_anomalie?: boolean;
      examinateur_approbation_mise_sur_le_marche?: boolean;
    }
  ) => void;
  setHasHydrated: (state: boolean) => void;
  addLog: (log: Omit<CreateLog, 'fei_intermediaire_id'>) => Log;
  reset: () => void;
}

function initialState(): State {
  return {
    isOnline: true,
    dataIsSynced: true,
    feiIdsRenvoiToHide: [],
    lastUpdateFromServer: 0,
    carcassesReloadVersion: 0,
    logs: [],
    feis: {},
    users: {},
    entities: {},
    detenteursInitiauxIds: [],
    apiKeyApprovals: [],
    federation: null,
    carcasses: {},
    carcassesIntermediaireById: {},
    modifRequestsByCarcasseId: {},
    syncRejections: [],
    _hasHydrated: false,
  };
}

export function migratePersistedState(persistedState: unknown): Partial<State> {
  const persisted = (persistedState ?? {}) as Partial<State>;
  const isUnsynced = (item: { is_synced: boolean }) => !item.is_synced;

  const feis = Object.fromEntries(
    Object.entries(persisted.feis ?? {}).filter(([, fei]) => isUnsynced(fei))
  ) as State['feis'];
  const carcasses = Object.fromEntries(
    Object.entries(persisted.carcasses ?? {}).filter(([, carcasse]) => isUnsynced(carcasse))
  ) as State['carcasses'];
  const carcassesIntermediaireById = Object.fromEntries(
    Object.entries(persisted.carcassesIntermediaireById ?? {}).filter(([, ci]) => isUnsynced(ci))
  ) as State['carcassesIntermediaireById'];
  const modifRequestsByCarcasseId: State['modifRequestsByCarcasseId'] = {};
  for (const [zacharie_carcasse_id, requests] of Object.entries(persisted.modifRequestsByCarcasseId ?? {})) {
    const unsyncedRequests = requests.filter(isUnsynced);
    if (unsyncedRequests.length > 0) modifRequestsByCarcasseId[zacharie_carcasse_id] = unsyncedRequests;
  }
  const logs = (persisted.logs ?? []).filter(isUnsynced);

  const hasUnsynced =
    Object.keys(feis).length > 0 ||
    Object.keys(carcasses).length > 0 ||
    Object.keys(carcassesIntermediaireById).length > 0 ||
    Object.keys(modifRequestsByCarcasseId).length > 0 ||
    logs.length > 0;

  const initial = initialState();
  return {
    ...Object.fromEntries(PERSISTED_KEYS.map((key) => [key, initial[key]])),
    dataIsSynced: !hasUnsynced,
    feis,
    carcasses,
    carcassesIntermediaireById,
    modifRequestsByCarcasseId,
    logs,
    lastUpdateFromServer: 0,
    carcassesReloadVersion: 0,
  };
}

let resolveHydration: () => void;
export const hydrationPromise = new Promise<void>((resolve) => {
  resolveHydration = resolve;
});

const useZustandStore = create<State & Actions>()(
  devtools(
    persist(
      (set, get): State & Actions => ({
        ...initialState(),
        createFei: (newFei: Fei) => {
          newFei.is_synced = false;
          newFei.updated_at = dayjs().toDate();
          useZustandStore.setState((state) => ({
            ...state,
            feis: { ...state.feis, [newFei.numero]: datesToIso(newFei) },
            dataIsSynced: false,
          }));
        },
        updateFei: (fei_numero: Fei['numero'], partialFei: Partial<Fei>) => {
          const carcassefeiCarcasses = Object.values(get().carcasses).filter(
            (c) => c.fei_numero === fei_numero && !isCarcassePriseEnChargeEnAval(c)
          );
          const nextFei: Fei = datesToIso({
            ...useZustandStore.getState().feis[fei_numero],
            ...partialFei,
            updated_at: dayjs().toDate(),
            is_synced: false,
          });

          const nextCarcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
          for (const carcasse of carcassefeiCarcasses) {
            nextCarcasses[carcasse.zacharie_carcasse_id] = datesToIso({
              ...carcasse,
              ...mapFeiFieldsToCarcasse(nextFei),
              updated_at: dayjs().toDate(),
              is_synced: false,
            });
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
            const fei = state.feis[newCarcasse.fei_numero];
            return {
              ...state,
              feis: fei
                ? {
                    ...state.feis,
                    [fei.numero]: datesToIso({ ...fei, updated_at: dayjs().toDate(), is_synced: false }),
                  }
                : state.feis,
              carcasses: {
                ...state.carcasses,
                [newCarcasse.zacharie_carcasse_id]: datesToIso(newCarcasse),
              },
              dataIsSynced: false,
            };
          });
        },
        updateCarcasse: (
          zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
          partialCarcasse: Partial<Carcasse>
        ) => {
          const carcasses = useZustandStore.getState().carcasses;
          const nextCarcasse: Carcasse = {
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
              [zacharie_carcasse_id]: datesToIso(nextCarcasse),
            },
            dataIsSynced: false,
          });
        },
        updateCarcassesTransmission: (zacharie_carcasse_ids, transmissionFields) => {
          const carcasses = useZustandStore.getState().carcasses;
          const now = dayjs().toDate();
          const nextCarcasses = { ...carcasses };
          for (const id of zacharie_carcasse_ids) {
            const existing = carcasses[id];
            if (!existing) continue;
            const nextCarcasse: Carcasse = {
              ...existing,
              ...transmissionFields,
              updated_at: now,
              is_synced: false,
            };
            const nextStatus = updateCarcasseStatus(nextCarcasse);
            if (nextStatus !== nextCarcasse.svi_carcasse_status) {
              nextCarcasse.svi_carcasse_status = nextStatus;
              nextCarcasse.svi_carcasse_status_set_at = now;
            }
            nextCarcasses[id] = datesToIso(nextCarcasse);
          }
          useZustandStore.setState({
            carcasses: nextCarcasses,
            dataIsSynced: false,
          });
        },
        hideFeiRenvoi: (fei_numero) => {
          useZustandStore.setState((state) => ({
            feiIdsRenvoiToHide: state.feiIdsRenvoiToHide.includes(fei_numero)
              ? state.feiIdsRenvoiToHide
              : [...state.feiIdsRenvoiToHide, fei_numero],
          }));
        },
        createCarcassesIntermediaire: async (
          newIntermediaires: CarcassesIntermediaire[],
          specificCarcasseIds: string[]
        ) => {
          if (newIntermediaires.length === 0) return;
          return new Promise((resolve) => {
            const carcasses = Object.values(get().carcasses).filter((c) =>
              specificCarcasseIds.includes(c.zacharie_carcasse_id)
            );
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
                  prise_en_charge: true,
                  prise_en_charge_at: newIntermediaire.prise_en_charge_at,
                  intermediaire_depot_type: newIntermediaire.intermediaire_depot_type,
                  intermediaire_depot_entity_id: newIntermediaire.intermediaire_depot_entity_id,
                  intermediaire_prochain_detenteur_role_cache:
                    newIntermediaire.intermediaire_prochain_detenteur_role_cache,
                  intermediaire_prochain_detenteur_id_cache:
                    newIntermediaire.intermediaire_prochain_detenteur_id_cache,
                  intermediaire_poids: null,
                  numero_bon_reception: newIntermediaire.numero_bon_reception,
                  carcasse_updated_at: null,
                  created_at: newIntermediaire.created_at,
                  updated_at: newIntermediaire.created_at,
                  deleted_at: null,
                  is_synced: false,
                  version: 0,
                  version_user_id: newIntermediaire.intermediaire_user_id,
                }));

              for (const ci of carcassesIntermediaires) {
                const feiAndCarcasseAndIntermediaireId = getFeiAndCarcasseAndIntermediaireIds(ci);
                byId[feiAndCarcasseAndIntermediaireId] = datesToIso(ci);
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
          nextCarcasseIntermediaire: Partial<CarcasseIntermediaire>
        ) => {
          const carcassesIntermediaireById = useZustandStore.getState().carcassesIntermediaireById;
          const nextCarcassesIntermediaireById: Record<
            FeiAndCarcasseAndIntermediaireIds,
            CarcasseIntermediaire
          > = {};
          const matchingEntries = Object.entries(carcassesIntermediaireById).filter(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ([_id, ci]) => getFeiAndIntermediaireIds(ci) === feiAndIntermediaireIds
          );
          for (const [carcassesIntermediaireId, carcassesIntermediaire] of matchingEntries) {
            if (!carcassesIntermediaire.prise_en_charge) continue;
            nextCarcassesIntermediaireById[carcassesIntermediaireId as FeiAndCarcasseAndIntermediaireIds] =
              datesToIso({
                ...carcassesIntermediaire,
                ...nextCarcasseIntermediaire,
                updated_at: dayjs().toDate(),
                is_synced: false,
              });
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
        },
        updateCarcasseIntermediaire: (
          feiAndCarcasseAndIntermediaireIds: FeiAndCarcasseAndIntermediaireIds,
          partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>
        ) => {
          const carcasseIntermediaire =
            useZustandStore.getState().carcassesIntermediaireById[feiAndCarcasseAndIntermediaireIds];

          useZustandStore.setState((state) => {
            return {
              ...state,
              carcassesIntermediaireById: {
                ...state.carcassesIntermediaireById,
                [feiAndCarcasseAndIntermediaireIds]: datesToIso({
                  ...carcasseIntermediaire,
                  ...partialCarcasseIntermediaire,
                  updated_at: dayjs().toDate(),
                  is_synced: false,
                }),
              },
              dataIsSynced: false,
            };
          });
        },
        setApiKeyApprovals: (apiKeyApprovals: UserConnexionResponse['data']['apiKeyApprovals']) => {
          set({ apiKeyApprovals });
        },
        createCarcasseModifRequest: (request: CarcasseModificationRequest) => {
          const next: CarcasseModificationRequest = datesToIso({
            ...request,
            is_synced: false,
            updated_at: dayjs().toDate(),
          });
          useZustandStore.setState((state) => {
            const existing = state.modifRequestsByCarcasseId[next.zacharie_carcasse_id] ?? [];
            return {
              ...state,
              modifRequestsByCarcasseId: {
                ...state.modifRequestsByCarcasseId,
                [next.zacharie_carcasse_id]: [...existing, next],
              },
              dataIsSynced: false,
            };
          });
        },
        updateCarcasseModifRequest: (carcasseId, partial, approvalPayload) => {
          const existing = useZustandStore.getState().modifRequestsByCarcasseId[carcasseId] ?? [];
          const pendingIdx = existing.findIndex(
            (r) => r.status === CarcasseModificationRequestStatus.PENDING && !r.deleted_at
          );
          if (pendingIdx === -1) return;
          const next: CarcasseModificationRequest & { _approvalPayload?: typeof approvalPayload } =
            datesToIso({
              ...existing[pendingIdx],
              ...partial,
              updated_at: dayjs().toDate(),
              is_synced: false,
            });
          if (approvalPayload) next._approvalPayload = approvalPayload;
          const nextArray = [...existing];
          nextArray[pendingIdx] = next;
          useZustandStore.setState((state) => ({
            ...state,
            modifRequestsByCarcasseId: {
              ...state.modifRequestsByCarcasseId,
              [carcasseId]: nextArray,
            },
            dataIsSynced: false,
          }));
        },
        addLog: (newLog: Omit<CreateLog, 'fei_intermediaire_id'>) => {
          const fei = newLog.fei_numero ? get().feis[newLog.fei_numero] : null;
          const carcasse = newLog.zacharie_carcasse_id ? get().carcasses[newLog.zacharie_carcasse_id] : null;
          const history =
            fei || carcasse
              ? {
                  ...newLog.history,
                  ...(fei ? { fei: { version: fei.version, updated_at: fei.updated_at } } : {}),
                  ...(carcasse
                    ? { carcasse: { version: carcasse.version, updated_at: carcasse.updated_at } }
                    : {}),
                }
              : newLog.history;
          const log = datesToIso({
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
            history: JSON.stringify(history),
            date: dayjs().toDate(),
            is_synced: false,
            created_at: dayjs().toDate(),
            updated_at: dayjs().toDate(),
            deleted_at: null,
          });
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
            ...(state && {
              dataIsSynced: !hasUnsyncedData(get()),
            }),
          });
          if (state) resolveHydration();
        },
        reset: () => {
          set({ ...initialState(), _hasHydrated: true });
        },
      }),
      {
        name: 'zacharie-zustand-store',
        version: 11,
        migrate: migratePersistedState,
        storage: createSlicedIDBStorage<Partial<State>>(PERSISTED_KEYS, RECORD_KEYS),
        onRehydrateStorage: (state) => {
          return () => state.setHasHydrated(true);
        },
        partialize: (state) =>
          Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]])) as Partial<State>,
      }
    )
  )
);

export default useZustandStore;
