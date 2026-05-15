import { Carcasse, Fei, FeiOwnerRole, User } from '@prisma/client';

export type CarcasseUserRole =
  | 'ADMIN'
  | 'EXAMINATEUR_INITIAL'
  | 'PREMIER_DETENTEUR'
  | 'INTERMEDIAIRE'
  | 'PAST_INTERMEDIAIRE'
  | 'NEXT_OWNER'
  | 'SVI'
  | 'NONE';

export type CarcasseAccess = {
  roles: CarcasseUserRole[];
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type CarcasseAccessInput = {
  user: Pick<User, 'id' | 'isZacharieAdmin'>;
  carcasse: Carcasse;
  fei: Fei;
  userEntityIds: string[];
  hasPastIntermediaireInvolvement: boolean;
};

const PRE_TRANSMISSION_ROLES: FeiOwnerRole[] = [
  FeiOwnerRole.EXAMINATEUR_INITIAL,
  FeiOwnerRole.PREMIER_DETENTEUR,
];

function isFeiGloballyClosed(fei: Fei): boolean {
  return Boolean(fei.svi_closed_at || fei.automatic_closed_at);
}

function isFeiPreTransmission(fei: Fei): boolean {
  return (
    !fei.intermediaire_closed_at &&
    !fei.svi_assigned_at &&
    PRE_TRANSMISSION_ROLES.includes(fei.fei_current_owner_role!)
  );
}

function userMatches(
  userId: string,
  entityIds: string[],
  userField?: string | null,
  entityField?: string | null
): boolean {
  if (userField && userField === userId) return true;
  if (entityField && entityIds.includes(entityField)) return true;
  return false;
}

export function getCarcasseAccess({
  user,
  carcasse,
  fei,
  userEntityIds,
  hasPastIntermediaireInvolvement,
}: CarcasseAccessInput): CarcasseAccess {
  if (user.isZacharieAdmin) {
    return { roles: ['ADMIN'], canView: true, canEdit: true, canDelete: true };
  }

  const roles: CarcasseUserRole[] = [];
  let canView = false;
  let canEdit = false;
  let canDelete = false;

  const globallyClosed = isFeiGloballyClosed(fei);
  const preTransmission = isFeiPreTransmission(fei);

  // EXAMINATEUR_INITIAL
  if (carcasse.examinateur_initial_user_id === user.id) {
    roles.push('EXAMINATEUR_INITIAL');
    canView = true;
    if (!globallyClosed && preTransmission) {
      canEdit = true;
      canDelete = true;
    }
  }

  // PREMIER_DETENTEUR (via user or entity)
  if (userMatches(user.id, userEntityIds, fei.premier_detenteur_user_id, fei.premier_detenteur_entity_id)) {
    roles.push('PREMIER_DETENTEUR');
    canView = true;
    if (!globallyClosed && preTransmission) {
      canEdit = true;
    }
  }

  // INTERMEDIAIRE actuel (la carcasse est entre ses mains)
  const isCurrentIntermediaire = userMatches(
    user.id,
    userEntityIds,
    carcasse.latest_intermediaire_user_id,
    carcasse.latest_intermediaire_entity_id
  );
  if (isCurrentIntermediaire) {
    roles.push('INTERMEDIAIRE');
    canView = true;
    if (!globallyClosed && !fei.intermediaire_closed_at && !carcasse.intermediaire_closed_at) {
      canEdit = true;
    }
  }

  // SVI (user direct ou via entité)
  const isSviForCarcasse = userMatches(
    user.id,
    userEntityIds,
    carcasse.svi_user_id ?? fei.svi_user_id,
    carcasse.svi_entity_id ?? fei.svi_entity_id
  );
  if (isSviForCarcasse) {
    roles.push('SVI');
    canView = true;
    if (!globallyClosed && !carcasse.svi_closed_at) {
      canEdit = true;
    }
  }

  // PAST_INTERMEDIAIRE (déjà passé n'importe où dans la chaîne) → view seulement
  // Calculé en amont via la table CarcasseIntermediaire (cf. middleware).
  if (hasPastIntermediaireInvolvement && !roles.includes('INTERMEDIAIRE')) {
    roles.push('PAST_INTERMEDIAIRE');
    canView = true;
  }

  // NEXT_OWNER (pas encore reçu) → view seulement
  const isNextOwner = userMatches(
    user.id,
    userEntityIds,
    carcasse.next_owner_user_id,
    carcasse.next_owner_entity_id
  );
  if (isNextOwner) {
    roles.push('NEXT_OWNER');
    canView = true;
  }

  if (roles.length === 0) {
    return { roles: ['NONE'], canView: false, canEdit: false, canDelete: false };
  }

  return { roles, canView, canEdit, canDelete };
}

export function canEditFei({
  user,
  fei,
  userEntityIds,
}: {
  user: Pick<User, 'id' | 'isZacharieAdmin'>;
  fei: Fei;
  userEntityIds: string[];
}): boolean {
  if (user.isZacharieAdmin) return true;
  if (isFeiGloballyClosed(fei)) return false;
  if (!isFeiPreTransmission(fei)) return false;

  if (fei.examinateur_initial_user_id === user.id) return true;
  if (userMatches(user.id, userEntityIds, fei.premier_detenteur_user_id, fei.premier_detenteur_entity_id)) {
    return true;
  }
  return false;
}
