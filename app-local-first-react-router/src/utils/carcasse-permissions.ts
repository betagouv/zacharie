import { Carcasse, FeiOwnerRole, User, UserRoles } from '@prisma/client';
import type useZustandStore from '@app/zustand/store';
import { isCircuitCourt } from '@app/utils/circuit-court';
import type { CarcasseTab } from '@app/zustand/ui-modals';

type Fei = ReturnType<typeof useZustandStore.getState>['feis'][string];

export interface CarcasseCapabilities {
  primaryRole: 'chasseur' | 'etg' | 'collecteur' | 'svi' | 'circuit-court' | 'admin' | 'other';
  defaultTab: CarcasseTab;
  canSeeIntermediaireTab: boolean;
  canActIntermediaire: boolean;
  canSeeSviTab: boolean;
  canActSvi: boolean;
}

export function getCarcasseCapabilities(
  carcasse: Carcasse | undefined,
  fei: Fei | undefined,
  user: User
): CarcasseCapabilities {
  const roles = user.roles ?? [];
  const isAdmin = roles.includes(UserRoles.ADMIN);
  const isSvi = roles.includes(UserRoles.SVI);
  const isEtg = roles.includes(UserRoles.ETG);
  const isCollecteur = roles.includes(UserRoles.COLLECTEUR_PRO);
  const isChasseur = roles.includes(UserRoles.CHASSEUR);
  const isCC = isCircuitCourt(user);

  const primaryRole: CarcasseCapabilities['primaryRole'] = isSvi
    ? 'svi'
    : isEtg
      ? 'etg'
      : isCollecteur
        ? 'collecteur'
        : isChasseur
          ? 'chasseur'
          : isCC
            ? 'circuit-court'
            : isAdmin
              ? 'admin'
              : 'other';

  const currentOwnerRole = fei?.fei_current_owner_role;
  const isOwnedByEtg = currentOwnerRole === FeiOwnerRole.ETG;
  const isOwnedByCollecteur = currentOwnerRole === FeiOwnerRole.COLLECTEUR_PRO;
  const isOwnedBySvi = currentOwnerRole === FeiOwnerRole.SVI;

  const canActIntermediaire =
    !!carcasse &&
    ((isEtg && isOwnedByEtg) || (isCollecteur && isOwnedByCollecteur)) &&
    !carcasse.svi_carcasse_status_set_at;

  const canActSvi = !!carcasse && isSvi && isOwnedBySvi;

  const canSeeIntermediaireTab = isEtg || isCollecteur || isAdmin || isSvi;
  const canSeeSviTab = isSvi || isEtg || isAdmin || isChasseur || (isCC && !!carcasse?.svi_ipm2_date);

  const defaultTab: CarcasseTab = canActIntermediaire
    ? 'intermediaire'
    : canActSvi
      ? 'svi'
      : isSvi
        ? 'svi'
        : isChasseur
          ? 'identite'
          : 'tracabilite';

  return {
    primaryRole,
    defaultTab,
    canSeeIntermediaireTab,
    canActIntermediaire,
    canSeeSviTab,
    canActSvi,
  };
}
