import { useCallback, type ReactNode } from 'react';
import { FeiOwnerRole } from '@prisma/client';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { useEntitiesIdsWorkingDirectlyFor } from '@app/utils/get-entity-relations';
import { filterFeiIntermediaires } from '@app/utils/get-carcasses-intermediaires';
import { ChasseIcon } from '@app/assets/svg/ChasseIcon';
import { TransportIcon } from '@app/assets/svg/TransportIcon';

export interface DetenteurDisplay {
  name: string | null;
  icon: ReactNode;
}

function iconForRole(role: FeiOwnerRole | null): ReactNode {
  if (role === FeiOwnerRole.COLLECTEUR_PRO) {
    return <TransportIcon />;
  }
  return <ChasseIcon />;
}

function resolveOwnerName(
  id: string | null | undefined,
  entities: Record<string, { nom_d_usage?: string | null; raison_sociale?: string | null }>,
  usersById: Record<string, { prenom?: string | null; nom_de_famille?: string | null }>
): string | null {
  if (!id) return null;
  const entity = entities[id];
  if (entity?.nom_d_usage) return entity.nom_d_usage;
  if (entity?.raison_sociale) return entity.raison_sociale;
  const u = usersById[id];
  if (u) {
    const name = `${u.prenom ?? ''} ${u.nom_de_famille ?? ''}`.trim();
    if (name) return name;
  }
  return null;
}

interface GetPreviousDetenteurParams {
  fei: FeiWithIntermediaires;
  myEntityIds: Set<string>;
  myUserId: string | undefined;
  carcassesIntermediaireById: ReturnType<typeof useZustandStore.getState>['carcassesIntermediaireById'];
  entities: ReturnType<typeof useZustandStore.getState>['entities'];
  usersById: ReturnType<typeof useZustandStore.getState>['users'];
}

/**
 * Détenteur précédent : celui qui m'a donné la fiche.
 * On reconstitue la chaîne de possession ordonnée (premier détenteur en tête,
 * puis les intermédiaires par created_at croissant) et on prend l'élément qui
 * précède ma première entrée. Si je ne suis pas encore dans la chaîne (fiche
 * attribuée mais pas encore prise en charge), c'est le dernier détenteur de la
 * chaîne. Ce détenteur ne change donc jamais une fois la fiche reçue.
 */
function getPreviousDetenteur({
  fei,
  myEntityIds,
  myUserId,
  carcassesIntermediaireById,
  entities,
  usersById,
}: GetPreviousDetenteurParams): DetenteurDisplay {
  const premierDetenteurName =
    resolveOwnerName(fei.premier_detenteur_entity_id || fei.premier_detenteur_user_id, entities, usersById) ||
    fei.premier_detenteur_name_cache;
  const premierDetenteur: DetenteurDisplay = {
    name: premierDetenteurName,
    icon: iconForRole(FeiOwnerRole.PREMIER_DETENTEUR),
  };

  // Intermédiaires par ordre chronologique croissant (filterFeiIntermediaires renvoie décroissant).
  const intermediaires = filterFeiIntermediaires(carcassesIntermediaireById, fei.numero).reverse();
  if (intermediaires.length === 0) {
    return premierDetenteur;
  }

  const isMine = (i: (typeof intermediaires)[number]) => {
    if (i.intermediaire_entity_id && myEntityIds.has(i.intermediaire_entity_id)) {
      return true;
    }
    if (i.intermediaire_user_id && i.intermediaire_user_id === myUserId) {
      return true;
    }
    return false;
  };

  const myFirstIndex = intermediaires.findIndex(isMine);

  // Ma première entrée est juste après le premier détenteur : c'est lui qui m'a donné la fiche.
  if (myFirstIndex === 0) {
    return premierDetenteur;
  }

  let previous;
  if (myFirstIndex === -1) {
    // Pas encore pris en charge : le détenteur précédent est le dernier de la chaîne.
    previous = intermediaires[intermediaires.length - 1];
  } else {
    previous = intermediaires[myFirstIndex - 1];
  }

  return {
    name:
      resolveOwnerName(
        previous.intermediaire_entity_id || previous.intermediaire_user_id,
        entities,
        usersById
      ) || premierDetenteurName,
    icon: iconForRole(previous.intermediaire_role),
  };
}

/**
 * Renvoie une fonction qui, pour une fiche donnée, calcule son détenteur précédent.
 * Le store n'est lu (et souscrit) qu'une fois ; chaque carte appelle le résultat
 * avec sa propre fei — pas besoin de précalculer toutes les fiches.
 */
export function useGetPreviousDetenteur(): (fei: FeiWithIntermediaires) => DetenteurDisplay {
  const user = useUser((state) => state.user);
  const myEntityIds = useEntitiesIdsWorkingDirectlyFor();
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const entities = useZustandStore((state) => state.entities);
  const usersById = useZustandStore((state) => state.users);

  return useCallback(
    (fei: FeiWithIntermediaires) =>
      getPreviousDetenteur({
        fei,
        myEntityIds: new Set(myEntityIds),
        myUserId: user?.id,
        carcassesIntermediaireById,
        entities,
        usersById,
      }),
    [myEntityIds, user?.id, carcassesIntermediaireById, entities, usersById]
  );
}
