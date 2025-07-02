import { CarcasseForResponseForRegistry } from '@api/src/types/carcasse';
import { Carcasse, DepotType, EntityTypes, UserRoles, type CarcasseIntermediaire } from '@prisma/client';
import dayjs from 'dayjs';

export function getNewCarcasseIntermediaireId(
  userId: string,
  feiNumero: string,
): CarcasseIntermediaire['intermediaire_id'] {
  return `${userId}_${feiNumero}_${dayjs().format('HHmmss')}`;
}

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

export function getFeiAndIntermediaireIds(
  carcasseIntermediaire: CarcasseIntermediaire,
): FeiAndIntermediaireIds {
  return `${carcasseIntermediaire.fei_numero}_${carcasseIntermediaire.intermediaire_id}`;
}

export function getFeiAndCarcasseAndIntermediaireIds(
  carcasseIntermediaire: CarcasseIntermediaire,
): FeiAndCarcasseAndIntermediaireIds {
  return `${carcasseIntermediaire.fei_numero}_${carcasseIntermediaire.zacharie_carcasse_id}_${carcasseIntermediaire.intermediaire_id}`;
}

export function getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
  carcasse: CarcasseForResponseForRegistry | Carcasse,
  intermediaireId: FeiIntermediaire['id'],
): FeiAndCarcasseAndIntermediaireIds {
  return `${carcasse.fei_numero}_${carcasse.zacharie_carcasse_id}_${intermediaireId}`;
}

export function getFeiAndIntermediaireIdsFromFeiIntermediaire(
  intermediaire: FeiIntermediaire,
): FeiAndIntermediaireIds {
  return `${intermediaire.fei_numero}_${intermediaire.id}`;
}
