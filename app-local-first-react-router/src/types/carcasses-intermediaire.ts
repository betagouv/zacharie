import type { CarcasseIntermediaire } from '@prisma/client';

export type CarcassesIntermediaire = {
  // updated_at: Date;
  // is_synced: boolean;
  // deleted_at: Date | null;
  // received_at: Date | null;
  // handover_at: Date | null;
  // commentaire: string | null;
  id: CarcasseIntermediaire['intermediaire_id']; // {user_id}_{HHMMSS} // because a user could be multiple times intermediaire for a same fei
  created_at: CarcasseIntermediaire['created_at'];
  fei_numero: CarcasseIntermediaire['fei_numero'];
  intermediaire_user_id: CarcasseIntermediaire['intermediaire_user_id'];
  intermediaire_entity_id: CarcasseIntermediaire['intermediaire_entity_id'];
  intermediaire_role: CarcasseIntermediaire['intermediaire_role'];
  prise_en_charge_at: CarcasseIntermediaire['prise_en_charge_at'];
  intermediaire_depot_type: CarcasseIntermediaire['intermediaire_depot_type'];
  intermediaire_depot_entity_id: CarcasseIntermediaire['intermediaire_depot_entity_id'];
  intermediaire_prochain_detenteur_role_cache: CarcasseIntermediaire['intermediaire_prochain_detenteur_role_cache'];
  intermediaire_prochain_detenteur_id_cache: CarcasseIntermediaire['intermediaire_prochain_detenteur_id_cache'];
};

export type FeiAndIntermediaireIds =
  `${CarcasseIntermediaire['fei_numero']}_${CarcasseIntermediaire['intermediaire_id']}`;
export type FeiAndCarcasseAndIntermediaireIds =
  `${CarcasseIntermediaire['fei_numero']}_${CarcasseIntermediaire['zacharie_carcasse_id']}_${CarcasseIntermediaire['intermediaire_id']}`;
