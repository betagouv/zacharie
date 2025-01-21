import useZustandStore from '@app/zustand/store';
import { UserRoles } from '@prisma/client';
import type { Fei, User } from '@prisma/client';

export function useNextOwnerCollecteurProEntityId(fei: Fei, user: User) {
  const collecteursProsRelatedWithMyETGs = useZustandStore((state) => state.collecteursProsRelatedWithMyETGs);
  const etgsRelatedWithMyEntities = useZustandStore((state) => state.etgsRelatedWithMyEntities);

  if (fei.fei_next_owner_role === UserRoles.COLLECTEUR_PRO) {
    return fei.fei_next_owner_entity_id;
  }
  if (fei.fei_next_owner_role === UserRoles.ETG) {
    if (fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO) {
      return '';
    }
    if (!user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
      return '';
    }
    const etgId = fei.fei_next_owner_entity_id;
    let collecteurProId = etgsRelatedWithMyEntities.find(
      (c) => c.entity_type === UserRoles.COLLECTEUR_PRO && c.etg_id === etgId,
    )?.entity_id;
    if (collecteurProId) {
      return collecteurProId;
    }
    collecteurProId = collecteursProsRelatedWithMyETGs.find(
      (c) => c.entity_type === UserRoles.COLLECTEUR_PRO && c.etg_id === etgId,
    )?.entity_id;
    if (collecteurProId) {
      return collecteurProId;
    }
  }
  return '';
}

export function useGetMyNextRoleForThisFei(fei: Fei, user: User) {
  const nextOwnerCollecteurProEntityId = useNextOwnerCollecteurProEntityId(fei, user);
  if (fei.fei_next_owner_role !== UserRoles.ETG) {
    return fei.fei_next_owner_role;
  }
  if (nextOwnerCollecteurProEntityId) {
    if (!user.roles.includes(UserRoles.ETG)) {
      return UserRoles.COLLECTEUR_PRO;
    }
  }
  return fei.fei_next_owner_role;
}
