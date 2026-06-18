import {
  type Fei,
  type CarcasseIntermediaire,
  type CarcasseModificationRequest,
  type Log,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { UserForFei } from '~/src/types/user';
import type { EntityWithUserRelation } from '~/src/types/entity';
import type { UserConnexionResponse } from '~/src/types/responses';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
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
import { createSlicedIDBStorage } from './idb-sliced-storage';
import { CarcasseTransmission } from '@app/types/carcasse';
import { CarcasseWithModificationRequests } from '@api/src/types/carcasse';

// State keys to persist in IndexedDB (each stored as its own entry)
const PERSISTED_KEYS: (keyof State)[] = [
  'dataIsSynced',
  'feis',
  'users',
  'entities',
  'detenteursInitiauxIds',
  'carcasses',
  'carcassesIntermediaireById',
  'carcasseModifActiveByCarcasseId',
  'apiKeyApprovals',
  'lastUpdateFromServer',
  'carcassesRegistry',
  'logs',
];

// Champs fei dénormalisés sur chaque carcasse via `mapFeiFieldsToCarcasse`.
// Quand `updateFei` reçoit l'un d'eux, on doit remapper les carcasses ; sinon non.
// Source de vérité : @app/utils/map-fei-fields-to-carcasse.ts — garder en phase.
const FEI_FIELDS_PROPAGATED_TO_CARCASSE = new Set<keyof FeiWithIntermediaires>([
  'date_mise_a_mort',
  'heure_mise_a_mort_premiere_carcasse',
  'heure_evisceration_derniere_carcasse',
  'premier_detenteur_depot_type',
  'premier_detenteur_depot_entity_id',
  'premier_detenteur_depot_entity_name_cache',
  'premier_detenteur_depot_ccg_at',
  'premier_detenteur_transport_type',
  'premier_detenteur_transport_date',
  'premier_detenteur_prochain_detenteur_role_cache',
  'premier_detenteur_prochain_detenteur_id_cache',
  'examinateur_initial_offline',
  'examinateur_initial_user_id',
  'examinateur_initial_approbation_mise_sur_le_marche',
  'examinateur_initial_date_approbation_mise_sur_le_marche',
  'consommateur_final_usage_domestique',
  'premier_detenteur_offline',
  'premier_detenteur_user_id',
  'premier_detenteur_entity_id',
  'premier_detenteur_name_cache',
  'intermediaire_closed_at',
  'intermediaire_closed_by_user_id',
  'intermediaire_closed_by_entity_id',
  'latest_intermediaire_user_id',
  'latest_intermediaire_entity_id',
  'latest_intermediaire_name_cache',
  'svi_assigned_at',
  'svi_user_id',
]);

export interface State {
  isOnline: boolean;
  dataIsSynced: boolean;
  feis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires>;
  users: Record<UserForFei['id'], UserForFei>;
  entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>;
  detenteursInitiauxIds: Array<UserForFei['id']>;
  carcasses: Record<
    CarcasseWithModificationRequests['zacharie_carcasse_id'],
    CarcasseWithModificationRequests
  >;
  // single intermediaire for a single carcasse
  carcassesIntermediaireById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>;
  carcasseModifActiveByCarcasseId: Record<CarcasseModificationRequest['id'], CarcasseModificationRequest>;
  apiKeyApprovals: NonNullable<UserConnexionResponse['data']['apiKeyApprovals']>;
  lastUpdateFromServer: number;
  carcassesRegistry: Array<CarcasseWithModificationRequests>;
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
  zacharie_carcasse_id: CarcasseModificationRequest['zacharie_carcasse_id'] | null;
  fei_intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
  intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
  carcasse_intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
};

interface Actions {
  createFei: (newFei: FeiWithIntermediaires) => void;
  updateFei: (fei_numero: FeiWithIntermediaires['numero'], fei: Partial<FeiWithIntermediaires>) => void;
  createCarcasse: (newCarcasse: CarcasseWithModificationRequests) => void;
  updateCarcasse: (
    zacharie_carcasse_id: CarcasseWithModificationRequests['zacharie_carcasse_id'],
    carcasse: Partial<CarcasseWithModificationRequests>,
    updateFei: boolean
  ) => void;
  updateCarcassesTransmission: (
    zacharie_carcasse_ids: string[],
    transmissionFields: CarcasseTransmission
  ) => void;
  createCarcassesIntermediaire: (
    newFeiIntermediaires: CarcassesIntermediaire[],
    specificCarcasseIds?: string[]
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
    carcassesRegistry: [],
    lastUpdateFromServer: 0,
    logs: [],
    feis: {},
    users: {},
    entities: {},
    detenteursInitiauxIds: [],
    apiKeyApprovals: [],
    carcasses: {},
    carcassesIntermediaireById: {},
    carcasseModifActiveByCarcasseId: {},
    _hasHydrated: false,
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
          partialFei: Partial<FeiWithIntermediaires>
        ) => {
          const carcassefeiCarcasses = filterCarcassesForFei(
            useZustandStore.getState().carcasses,
            fei_numero
          );
          const countCarcassesByEspece = formatCountCarcasseByEspece(carcassefeiCarcasses);
          const nextFei: FeiWithIntermediaires = {
            ...useZustandStore.getState().feis[fei_numero],
            ...partialFei,
            resume_nombre_de_carcasses: countCarcassesByEspece.join('\n'),
            updated_at: dayjs().toDate(),
            is_synced: false,
          };

          // On ne réécrit les carcasses que si un champ fei propagé aux carcasses change.
          // Sinon (ex. simple bump `updated_at` à l'ajout d'une carcasse), on évite de
          // remapper les N carcasses existantes — coût O(n²) sur une grande fiche.
          const remapsCarcasses = Object.keys(partialFei).some((key) =>
            FEI_FIELDS_PROPAGATED_TO_CARCASSE.has(key as keyof FeiWithIntermediaires)
          );

          if (!remapsCarcasses) {
            useZustandStore.setState((state) => ({
              feis: {
                ...state.feis,
                [fei_numero]: nextFei,
              },
              dataIsSynced: false,
            }));
            return;
          }

          const nextCarcasses: Record<
            CarcasseModificationRequest['zacharie_carcasse_id'],
            CarcasseWithModificationRequests
          > = {};
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
        createCarcasse: (newCarcasse: CarcasseWithModificationRequests) => {
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
          zacharie_carcasse_id: CarcasseModificationRequest['zacharie_carcasse_id'],
          partialCarcasse: Partial<CarcasseWithModificationRequests>,
          updateFei: boolean
        ) => {
          const carcasses = useZustandStore.getState().carcasses;
          const nextCarcasse: CarcasseWithModificationRequests = {
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
          // Un seul setState pour tout le lot : sur une grande fiche, boucler des
          // setState individuels coûte O(n²) (spread du Record entier à chaque carcasse).
          const carcasses = useZustandStore.getState().carcasses;
          const now = dayjs().toDate();
          const nextCarcasses: Record<
            CarcasseModificationRequest['zacharie_carcasse_id'],
            CarcasseWithModificationRequests
          > = {};
          for (const id of zacharie_carcasse_ids) {
            const current = carcasses[id];
            if (!current) continue;
            const nextCarcasse: CarcasseWithModificationRequests = {
              ...current,
              ...transmissionFields,
              updated_at: now,
              is_synced: false,
            };
            const nextStatus = updateCarcasseStatus(nextCarcasse);
            if (nextStatus !== nextCarcasse.svi_carcasse_status) {
              nextCarcasse.svi_carcasse_status = nextStatus;
              nextCarcasse.svi_carcasse_status_set_at = now;
            }
            nextCarcasses[id] = nextCarcasse;
          }
          useZustandStore.setState((state) => ({
            carcasses: {
              ...state.carcasses,
              ...nextCarcasses,
            },
            dataIsSynced: false,
          }));
        },
        createCarcassesIntermediaire: async (
          newIntermediaires: CarcassesIntermediaire[],
          specificCarcasseIds?: string[]
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
          partialCarcasseIntermediaire: Partial<CarcasseIntermediaire>
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
        createCarcasseModifRequest: (request: CarcasseModificationRequest) => {
          // we store modif-request in store for syncing them (PENDING/APPROVED/REJECTED)
          // we consume them through the `carcasse.CarcasseModificationRequests` array
          const next: CarcasseModificationRequest = {
            ...request,
            is_synced: false,
            updated_at: dayjs().toDate(),
          };
          useZustandStore.setState((state) => ({
            ...state,
            carcasseModifActiveByCarcasseId: {
              ...state.carcasseModifActiveByCarcasseId,
              [next.zacharie_carcasse_id]: next,
            },
            dataIsSynced: false,
          }));
        },
        updateCarcasseModifRequest: (carcasseId, partial, approvalPayload) => {
          const existing = useZustandStore.getState().carcasseModifActiveByCarcasseId[carcasseId];
          if (!existing) return;
          const next: CarcasseModificationRequest & { _approvalPayload?: typeof approvalPayload } = {
            ...existing,
            ...partial,
            updated_at: dayjs().toDate(),
            is_synced: false,
          };
          // approvalPayload is transient: it rides along on this row only to be sent in the next /sync
          // POST so the backend can apply the examinateur sanitary fields to the underlying Carcasse on
          // NEW_CARCASSE approval. It's not part of the persisted CarcasseModificationRequest schema.
          if (approvalPayload) next._approvalPayload = approvalPayload;
          useZustandStore.setState((state) => ({
            ...state,
            carcasseModifActiveByCarcasseId: {
              ...state.carcasseModifActiveByCarcasseId,
              [next.zacharie_carcasse_id]: next,
            },
            dataIsSynced: false,
          }));
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
          if (state) resolveHydration();
        },
        reset: () => {
          set({ ...initialState(), _hasHydrated: true });
        },
      }),
      {
        name: 'zacharie-zustand-store',
        version: 9,
        storage: createSlicedIDBStorage<Partial<State>>(PERSISTED_KEYS),
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
