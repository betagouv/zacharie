import { FeiOwnerRole } from '@prisma/client';

export function isCarcasseDejaEnvoyee(carcasse: {
  next_owner_entity_id?: string | null;
  next_owner_role?: FeiOwnerRole | null;
  current_owner_role?: FeiOwnerRole | null;
  consommateur_final_usage_domestique?: Date | null;
}) {
  if (carcasse.next_owner_entity_id != null && carcasse.next_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR) {
    return true;
  }
  if (carcasse.consommateur_final_usage_domestique != null) {
    return true;
  }
  return isCarcassePriseEnChargeEnAval(carcasse);
}

export function isCarcassePriseEnChargeEnAval(carcasse: { current_owner_role?: FeiOwnerRole | null }) {
  if (carcasse.current_owner_role == null) {
    return false;
  }
  return (
    carcasse.current_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR &&
    carcasse.current_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL
  );
}

export function isPremierDetenteurVerrouille(carcasse: {
  next_owner_role?: FeiOwnerRole | null;
  current_owner_role?: FeiOwnerRole | null;
  consommateur_final_usage_domestique?: Date | null;
}) {
  if (carcasse.next_owner_role != null && carcasse.next_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR) {
    return true;
  }
  if (carcasse.consommateur_final_usage_domestique != null) {
    return true;
  }
  return isCarcassePriseEnChargeEnAval(carcasse);
}
