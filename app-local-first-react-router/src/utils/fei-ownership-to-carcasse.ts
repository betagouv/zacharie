import type { Carcasse, Fei } from '@prisma/client';

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

export function extractFeiOwnershipForCarcasse(fei: Partial<Fei>): Partial<Carcasse> {
  const result: Partial<Carcasse> = {};
  for (const field of FEI_OWNERSHIP_FIELDS) {
    if (field in fei) {
      (result as Record<string, unknown>)[field] = fei[field as keyof Fei];
    }
  }
  return result;
}
