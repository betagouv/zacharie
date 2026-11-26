import prisma from '~/prisma';
import type { Fei, Prisma, User } from '@prisma/client';
import { getCarcasseAccessWhere } from '~/utils/carcasse-access';
import { getUserCarcasseEntityIds } from '~/utils/user-entities';

type FeiOwnershipFields = Pick<
  Fei,
  | 'numero'
  | 'created_by_user_id'
  | 'examinateur_initial_user_id'
  | 'premier_detenteur_user_id'
  | 'premier_detenteur_entity_id'
>;

export type SyncScope = {
  entityIds: Array<string>;
  carcasseAccessWhere: Prisma.CarcasseWhereInput | null;
  prefetch: (zacharieCarcasseIds: Array<string>) => Promise<void>;
  canWriteCarcasse: (zacharieCarcasseId: string) => Promise<boolean>;
  grant: (zacharieCarcasseId: string) => void;
  outOfScope: (zacharieCarcasseIds: Array<string>) => Promise<Array<string>>;
  isFeiOwner: (fei: FeiOwnershipFields) => boolean;
  isPremierDetenteur: (fei: FeiOwnershipFields) => boolean;
  canWriteFei: (fei: FeiOwnershipFields) => Promise<boolean>;
};

export async function createSyncScope(user: User): Promise<SyncScope> {
  const entityIds = await getUserCarcasseEntityIds(user.id);
  const accessWhere = await getCarcasseAccessWhere(user, entityIds);

  const granted = new Set<string>();

  async function resolve(zacharieCarcasseIds: Array<string>): Promise<void> {
    if (!accessWhere) return;
    const toResolve = [...new Set(zacharieCarcasseIds)].filter((id) => !!id && !granted.has(id));
    if (!toResolve.length) return;
    const accessible = await prisma.carcasse.findMany({
      where: { zacharie_carcasse_id: { in: toResolve }, ...accessWhere },
      select: { zacharie_carcasse_id: true },
    });
    for (const carcasse of accessible) granted.add(carcasse.zacharie_carcasse_id);
  }

  function isFeiOwner(fei: FeiOwnershipFields): boolean {
    if (fei.created_by_user_id === user.id) return true;
    if (fei.examinateur_initial_user_id === user.id) return true;
    return fei.premier_detenteur_user_id === user.id;
  }

  function isPremierDetenteur(fei: FeiOwnershipFields): boolean {
    if (fei.premier_detenteur_user_id === user.id) return true;
    return !!fei.premier_detenteur_entity_id && entityIds.includes(fei.premier_detenteur_entity_id);
  }

  return {
    entityIds,
    carcasseAccessWhere: accessWhere,
    prefetch: resolve,
    grant(zacharieCarcasseId) {
      granted.add(zacharieCarcasseId);
    },
    async canWriteCarcasse(zacharieCarcasseId) {
      if (granted.has(zacharieCarcasseId)) return true;
      await resolve([zacharieCarcasseId]);
      return granted.has(zacharieCarcasseId);
    },
    async outOfScope(zacharieCarcasseIds) {
      const ids = [...new Set(zacharieCarcasseIds)].filter(Boolean);
      if (!ids.length) return [];
      if (!accessWhere) return ids;
      const accessible = await prisma.carcasse.findMany({
        where: { zacharie_carcasse_id: { in: ids }, ...accessWhere },
        select: { zacharie_carcasse_id: true },
      });
      const accessibleIds = new Set(accessible.map((carcasse) => carcasse.zacharie_carcasse_id));
      return ids.filter((id) => !accessibleIds.has(id));
    },
    isFeiOwner,
    isPremierDetenteur,
    async canWriteFei(fei) {
      if (isFeiOwner(fei)) return true;
      if (!accessWhere) return false;
      const carcassesInScope = await prisma.carcasse.count({
        where: { fei_numero: fei.numero, ...accessWhere },
      });
      return carcassesInScope > 0;
    },
  };
}
