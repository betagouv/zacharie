import type { DepotType, EntityTypes, UserRoles, CarcasseIntermediaire } from '@prisma/client';

export type FeiIntermediaire = {
  // updated_at: Date;
  // is_synced: boolean;
  // deleted_at: Date | null;
  // received_at: Date | null;
  // handover_at: Date | null;
  // commentaire: string | null;
  id: CarcasseIntermediaire['intermediaire_id']; // {user_id}_{HHMMSS} // because a user could be multiple times intermediaire for a same fei
  created_at: Date;
  fei_numero: string;
  intermediaire_user_id: string;
  intermediaire_entity_id: string;
  intermediaire_role: UserRoles | null;
  prise_en_charge_at: Date | null;
  intermediaire_depot_type: DepotType | null;
  intermediaire_depot_entity_id: string | null;
  intermediaire_prochain_detenteur_type_cache: EntityTypes | null;
  intermediaire_prochain_detenteur_id_cache: string | null;
};

export type FeiAndIntermediaireIds =
  `${CarcasseIntermediaire['fei_numero']}_${CarcasseIntermediaire['intermediaire_id']}`;
export type FeiAndCarcasseAndIntermediaireIds =
  `${CarcasseIntermediaire['fei_numero']}_${CarcasseIntermediaire['zacharie_carcasse_id']}_${CarcasseIntermediaire['intermediaire_id']}`;
