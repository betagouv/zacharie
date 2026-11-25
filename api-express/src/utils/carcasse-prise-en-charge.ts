import { FeiOwnerRole, type Carcasse, type Prisma } from '@prisma/client';

const ROLES_AMONT: Array<FeiOwnerRole> = [FeiOwnerRole.EXAMINATEUR_INITIAL, FeiOwnerRole.PREMIER_DETENTEUR];

export function isCarcassePriseEnChargeEnAval(carcasse: Pick<Carcasse, 'current_owner_role'>): boolean {
  return !!carcasse.current_owner_role && !ROLES_AMONT.includes(carcasse.current_owner_role);
}

export const carcassePriseEnChargeEnAvalWhere: Prisma.CarcasseWhereInput = {
  current_owner_role: { notIn: ROLES_AMONT },
};
