import { type Fei, type User, UserRoles } from "@prisma/client";
import type { FeiByNumero } from "./fei.server";

type NonNullFeiByNumero = Exclude<FeiByNumero, null>;

type OfflineNullFei = Omit<
  NonNullFeiByNumero,
  | "id"
  | "created_at"
  | "updated_at"
  | "numero"
  | "date_mise_a_mort"
  | "created_by_user_id"
  | "FeiExaminateurInitialUser"
  | "fei_current_owner_user_id"
  | "fei_current_owner_role"
  | "examinateur_initial_user_id"
  | "FeiCreatedByUser"
  | "FeiCurrentUser"
>;

function offlineNullFei(): OfflineNullFei {
  return {
    commune_mise_a_mort: null,
    fei_current_owner_entity_id: null,
    fei_current_owner_wants_to_transfer: null,
    fei_next_owner_user_id: null,
    fei_next_owner_entity_id: null,
    fei_next_owner_role: null,
    fei_prev_owner_user_id: null,
    fei_prev_owner_entity_id: null,
    fei_prev_owner_role: null,
    examinateur_initial_approbation_mise_sur_le_marche: null,
    examinateur_initial_date_approbation_mise_sur_le_marche: null,
    premier_detenteur_user_id: null,
    premier_detenteur_date_depot_quelque_part: null,
    premier_detenteur_depot_entity_id: null,
    premier_detenteur_depot_sauvage: null,
    svi_entity_id: null,
    svi_user_id: null,
    svi_carcasses_saisies: null,
    svi_aucune_carcasse_saisie: null,
    svi_commentaire: null,
    svi_signed_at: null,
    deleted_at: null,
    FeiCurrentEntity: null,
    FeiNextEntity: null,
    Carcasses: [],
    FeiDetenteurInitialUser: null,
    FeiDepotEntity: null,
    FeiSviEntity: null,
    FeiSviUser: null,
    FeiIntermediaires: [],
  } as const;
}

export function formatNouvelleFeiOfflineQueue(fei: Fei, examinateur: User): FeiByNumero {
  const baseFei = offlineNullFei();
  return {
    ...baseFei,
    id: Date.now(),
    numero: fei.numero,
    date_mise_a_mort: fei.date_mise_a_mort,
    created_by_user_id: examinateur.id,
    fei_current_owner_user_id: examinateur.id,
    fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
    examinateur_initial_user_id: examinateur.id,
    created_at: fei.created_at,
    updated_at: fei.updated_at,
    FeiExaminateurInitialUser: examinateur,
    FeiCreatedByUser: examinateur,
    FeiCurrentUser: examinateur,
  };
}
