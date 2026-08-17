import prisma from '~/prisma';
import type { Fei, User } from '@prisma/client';
import { getCarcasseAccessWhere } from '~/utils/carcasse-access';
import { getUserCarcasseEntityIds } from '~/utils/user-entities';

// Les colonnes de la fiche qui portent le rattachement d'un utilisateur : le reste de la chaîne se
// lit sur les carcasses.
type FeiOwnershipFields = Pick<
  Fei,
  'numero' | 'created_by_user_id' | 'examinateur_initial_user_id' | 'premier_detenteur_user_id'
>;

// Périmètre d'écriture d'une requête /sync, résolu une fois et passé à chaque fonction de synchro.
// Le lot porte plusieurs centaines de carcasses mais un seul utilisateur : ses entités et son WHERE
// d'accès ne changent pas d'une carcasse à l'autre.
export type SyncScope = {
  entityIds: Array<string>;
  // Résout en une requête l'accès à tout un lot. Facultatif — `canWriteCarcasse` sait résoudre seul,
  // c'est juste ce qui évite une requête par carcasse dans les boucles.
  prefetch: (zacharieCarcasseIds: Array<string>) => Promise<void>;
  canWriteCarcasse: (zacharieCarcasseId: string) => Promise<boolean>;
  isFeiOwner: (fei: FeiOwnershipFields) => boolean;
  canWriteFei: (fei: FeiOwnershipFields) => Promise<boolean>;
};

export async function createSyncScope(user: User): Promise<SyncScope> {
  const entityIds = await getUserCarcasseEntityIds(user.id);
  const accessWhere = await getCarcasseAccessWhere(user, entityIds);

  // On ne mémorise que les accès accordés. Une carcasse hors périmètre peut y entrer au cours de la
  // même requête — elle vient d'être créée, transmise, ou une ligne d'intermédiaire vient de la
  // rattacher — donc un refus mis en cache la bloquerait à tort quelques lignes plus loin.
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

  // Le rattachement direct s'arrête aux colonnes de la fiche qui nomment un utilisateur. La
  // désignation d'une entité comme premier détenteur n'en est pas une : côté lecture elle n'ouvre la
  // fiche qu'une fois celle-ci sortie de l'examinateur initial (voir `getCarcasseAccessWhere`), une
  // condition qui se lit sur les carcasses et n'existe pas sur la fiche. On la laisse donc à
  // `canWriteFei`, qui l'évalue là où elle vit — l'asso désignée obtient l'écriture par le décompte
  // de ses carcasses, exactement quand elle obtient la lecture.
  function isFeiOwner(fei: FeiOwnershipFields): boolean {
    if (fei.created_by_user_id === user.id) return true;
    if (fei.examinateur_initial_user_id === user.id) return true;
    return fei.premier_detenteur_user_id === user.id;
  }

  return {
    entityIds,
    prefetch: resolve,
    async canWriteCarcasse(zacharieCarcasseId) {
      if (granted.has(zacharieCarcasseId)) return true;
      await resolve([zacharieCarcasseId]);
      return granted.has(zacharieCarcasseId);
    },
    isFeiOwner,
    // Une fiche est modifiable par un rattaché, ou par un détenteur aval tant qu'il en détient au
    // moins une carcasse — même règle que `/carcasse/refusees/:fei_numero`.
    async canWriteFei(fei) {
      if (user.isZacharieAdmin) return true;
      if (isFeiOwner(fei)) return true;
      if (!accessWhere) return false;
      const carcassesInScope = await prisma.carcasse.count({
        where: { fei_numero: fei.numero, ...accessWhere },
      });
      return carcassesInScope > 0;
    },
  };
}
