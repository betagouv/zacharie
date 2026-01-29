import type { Carcasse, Fei, FeiOwnerRole } from '@prisma/client';

export const FEI_OWNERSHIP_FIELDS = [
  'created_by_user_id',
  'examinateur_initial_offline',
  'examinateur_initial_user_id',
  'examinateur_initial_approbation_mise_sur_le_marche',
  'examinateur_initial_date_approbation_mise_sur_le_marche',
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
  'svi_entity_id',
  'svi_user_id',
  'svi_closed_at',
  'svi_closed_by_user_id',
  'fei_current_owner_user_id',
  'fei_current_owner_user_name_cache',
  'fei_current_owner_entity_id',
  'fei_current_owner_entity_name_cache',
  'fei_current_owner_role',
  'fei_next_owner_wants_to_sous_traite',
  'fei_next_owner_sous_traite_at',
  'fei_next_owner_sous_traite_by_user_id',
  'fei_next_owner_sous_traite_by_entity_id',
  'fei_next_owner_user_id',
  'fei_next_owner_user_name_cache',
  'fei_next_owner_entity_id',
  'fei_next_owner_entity_name_cache',
  'fei_next_owner_role',
  'fei_prev_owner_user_id',
  'fei_prev_owner_entity_id',
  'fei_prev_owner_role',
] as const;

type FeiOwnershipFields = {
  created_by_user_id?: string | null;
  examinateur_initial_offline?: boolean | null;
  examinateur_initial_user_id?: string | null;
  examinateur_initial_approbation_mise_sur_le_marche?: boolean | null;
  examinateur_initial_date_approbation_mise_sur_le_marche?: Date | null;
  premier_detenteur_offline?: boolean | null;
  premier_detenteur_user_id?: string | null;
  premier_detenteur_entity_id?: string | null;
  premier_detenteur_name_cache?: string | null;
  intermediaire_closed_at?: Date | null;
  intermediaire_closed_by_user_id?: string | null;
  intermediaire_closed_by_entity_id?: string | null;
  latest_intermediaire_user_id?: string | null;
  latest_intermediaire_entity_id?: string | null;
  latest_intermediaire_name_cache?: string | null;
  svi_assigned_at?: Date | null;
  svi_entity_id?: string | null;
  svi_user_id?: string | null;
  svi_closed_at?: Date | null;
  svi_closed_by_user_id?: string | null;
  fei_current_owner_user_id?: string | null;
  fei_current_owner_user_name_cache?: string | null;
  fei_current_owner_entity_id?: string | null;
  fei_current_owner_entity_name_cache?: string | null;
  fei_current_owner_role?: FeiOwnerRole | null;
  fei_next_owner_wants_to_sous_traite?: boolean | null;
  fei_next_owner_sous_traite_at?: Date | null;
  fei_next_owner_sous_traite_by_user_id?: string | null;
  fei_next_owner_sous_traite_by_entity_id?: string | null;
  fei_next_owner_user_id?: string | null;
  fei_next_owner_user_name_cache?: string | null;
  fei_next_owner_entity_id?: string | null;
  fei_next_owner_entity_name_cache?: string | null;
  fei_next_owner_role?: FeiOwnerRole | null;
  fei_prev_owner_user_id?: string | null;
  fei_prev_owner_entity_id?: string | null;
  fei_prev_owner_role?: FeiOwnerRole | null;
};

export function extractFeiOwnershipForCarcasse(fei: Partial<Fei>): FeiOwnershipFields {
  const result: FeiOwnershipFields = {};
  for (const field of FEI_OWNERSHIP_FIELDS) {
    if (field in fei) {
      (result as Record<string, unknown>)[field] = fei[field as keyof Fei];
    }
  }
  return result;
}
