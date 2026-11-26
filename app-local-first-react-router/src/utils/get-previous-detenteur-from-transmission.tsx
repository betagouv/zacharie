import { type ReactNode } from 'react';
import { FeiOwnerRole } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { ChasseIcon } from '@app/assets/svg/ChasseIcon';
import { TransportIcon } from '@app/assets/svg/TransportIcon';
import { CarcasseTransmissionWihMetadata } from '@app/types/carcasse';
import { UserForFei } from '@api/src/types/user';
import { EntityWithUserRelation } from '@api/src/types/entity';

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

export function getPremierDetenteur(
  transmission: CarcasseTransmissionWihMetadata,
  usersById: Record<UserForFei['id'], UserForFei>
): DetenteurDisplay {
  const entities = useZustandStore.getState().entities;
  const name =
    resolveOwnerName(
      transmission.content.premier_detenteur_entity_id || transmission.content.premier_detenteur_user_id,
      entities,
      usersById
    ) ||
    transmission.content.premier_detenteur_name_cache ||
    null;
  return {
    name,
    icon: iconForRole(FeiOwnerRole.PREMIER_DETENTEUR),
  };
}

export function getPreviousDetenteur(
  transmission: CarcasseTransmissionWihMetadata,
  usersById: Record<UserForFei['id'], UserForFei>,
  myEntities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>,
  myUserId: string
): DetenteurDisplay {
  const entities = useZustandStore.getState().entities;
  const premierDetenteur = getPremierDetenteur(transmission, usersById);

  const intermediaires = transmission.intermediaires;
  const lastIndex = intermediaires.length - 1;
  if (intermediaires.length === 0) {
    return premierDetenteur;
  }

  const isMine = (intermediaire: (typeof intermediaires)[number]) => {
    if (intermediaire.intermediaire_entity_id && myEntities[intermediaire.intermediaire_entity_id]) {
      return true;
    }
    if (intermediaire.intermediaire_user_id && intermediaire.intermediaire_user_id === myUserId) {
      return true;
    }
    return false;
  };

  let myEarliestIndex = -1;
  for (let i = lastIndex; i >= 0; i--) {
    if (isMine(intermediaires[i])) {
      myEarliestIndex = i;
      break;
    }
  }

  if (myEarliestIndex === lastIndex) {
    return premierDetenteur;
  }

  let previous;
  if (myEarliestIndex === -1) {
    previous = intermediaires[0];
  } else {
    previous = intermediaires[myEarliestIndex + 1];
  }

  return {
    name:
      resolveOwnerName(
        previous.intermediaire_entity_id || previous.intermediaire_user_id,
        entities,
        usersById
      ) ||
      premierDetenteur.name ||
      null,
    icon: iconForRole(previous.intermediaire_role),
  };
}
