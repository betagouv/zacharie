import { FeiOwnerRole, type Carcasse, type Prisma } from '@prisma/client';

// Une carcasse est prise en charge en aval dès qu'elle a quitté l'examinateur initial et le premier
// détenteur (même frontière que `isCarcassePriseEnChargeEnAval` côté client). Au-delà, la fiche et
// ses carcasses ne se suppriment plus que par le superadmin.
const ROLES_AMONT: Array<FeiOwnerRole> = [FeiOwnerRole.EXAMINATEUR_INITIAL, FeiOwnerRole.PREMIER_DETENTEUR];

export function isCarcassePriseEnChargeEnAval(carcasse: Pick<Carcasse, 'current_owner_role'>): boolean {
  return !!carcasse.current_owner_role && !ROLES_AMONT.includes(carcasse.current_owner_role);
}

// La même règle, en WHERE Prisma. `notIn` écarte aussi les carcasses sans `current_owner_role`.
export const carcassePriseEnChargeEnAvalWhere: Prisma.CarcasseWhereInput = {
  current_owner_role: { notIn: ROLES_AMONT },
};
