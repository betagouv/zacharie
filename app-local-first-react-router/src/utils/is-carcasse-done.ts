import { Fei, Carcasse, CarcasseStatus, FeiOwnerRole, User, UserEtgRoles } from '@prisma/client';
import updateCarcasseStatus from './get-carcasse-status';
import { EntityWithUserRelation } from '@api/src/types/entity';
import { isRoleCircuitCourt } from './circuit-court';

const TERMINAL_STATUSES = new Set<CarcasseStatus>([
  CarcasseStatus.ACCEPTE,
  CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
  CarcasseStatus.REFUS_ETG_COLLECTEUR,
  CarcasseStatus.MANQUANTE_SVI,
  CarcasseStatus.SAISIE_TOTALE,
  CarcasseStatus.SAISIE_PARTIELLE,
  CarcasseStatus.LEVEE_DE_CONSIGNE,
  CarcasseStatus.TRAITEMENT_ASSAINISSANT,
]);

export function isCarcasseClosedBySvi(carcasse: Carcasse): boolean {
  return !!(carcasse.svi_closed_at || carcasse.svi_automatic_closed_at);
}

export function isCarcasseDone(carcasse: Carcasse): boolean {
  if (carcasse.svi_closed_at || carcasse.svi_automatic_closed_at) return true;
  if (carcasse.intermediaire_closed_at) return true;
  if (carcasse.intermediaire_carcasse_refus_intermediaire_id) return true;
  if (carcasse.intermediaire_carcasse_manquante) return true;
  if (carcasse.consommateur_final_usage_domestique) return true;
  if (isRoleCircuitCourt(carcasse.next_owner_role) || isRoleCircuitCourt(carcasse.current_owner_role)) {
    return true;
  }
  const status = carcasse.svi_carcasse_status ?? updateCarcasseStatus(carcasse);
  return TERMINAL_STATUSES.has(status);
}

export function isFeiDone(fei: Fei, carcasses: Array<Carcasse>): boolean {
  if (fei.consommateur_final_usage_domestique) return true;
  if (carcasses.length === 0) return false;
  return carcasses.every(isCarcasseDone);
}

export function isCarcasseUnderMyResponsability(
  carcasse: Carcasse,
  me: User,
  entitiesWorkingDirectlyFor: Record<EntityWithUserRelation['id'], EntityWithUserRelation>
) {
  if (carcasse.next_owner_user_id || carcasse.next_owner_entity_id) return false;
  if (me.etg_role === UserEtgRoles.TRANSPORT && carcasse.current_owner_role === FeiOwnerRole.ETG) {
    return false;
  }
  if (carcasse.current_owner_user_id === me.id) return true;
  if (carcasse.current_owner_entity_id && entitiesWorkingDirectlyFor[carcasse.current_owner_entity_id]) {
    return true;
  }
  return false;
}

export function isTransportToMyEtgDone(
  carcasse: Partial<
    Pick<
      Carcasse,
      'current_owner_role' | 'current_owner_entity_id' | 'next_owner_role' | 'next_owner_entity_id'
    >
  >,
  etgRole: User['etg_role'] | undefined,
  entitiesWorkingDirectlyFor: Record<EntityWithUserRelation['id'], EntityWithUserRelation>
) {
  if (etgRole !== UserEtgRoles.TRANSPORT) return false;
  if (carcasse.current_owner_role !== FeiOwnerRole.COLLECTEUR_PRO) return false;
  if (carcasse.next_owner_role !== FeiOwnerRole.ETG) return false;
  if (!carcasse.current_owner_entity_id || !entitiesWorkingDirectlyFor[carcasse.current_owner_entity_id]) {
    return false;
  }
  if (!carcasse.next_owner_entity_id || !entitiesWorkingDirectlyFor[carcasse.next_owner_entity_id]) {
    return false;
  }
  return true;
}

export function isCarcasseToTake(
  carcasse: Carcasse,
  me: User,
  entitiesWorkingDirectlyFor: Record<EntityWithUserRelation['id'], EntityWithUserRelation>
) {
  if (isTransportToMyEtgDone(carcasse, me.etg_role, entitiesWorkingDirectlyFor)) return false;
  if (carcasse.next_owner_user_id === me.id) return true;
  if (carcasse.next_owner_entity_id && entitiesWorkingDirectlyFor[carcasse.next_owner_entity_id]) {
    return true;
  }
  return false;
}
