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

/**
 * Détenteur précédent d'une fiche : celui qui m'a donné la fiche.
 * On reconstitue la chaîne de possession ordonnée (premier détenteur en tête,
 * puis les intermédiaires par created_at croissant) et on prend l'élément qui
 * précède ma première entrée. Si je ne suis pas encore dans la chaîne (fiche
 * attribuée mais pas encore prise en charge), c'est le dernier détenteur de la
 * chaîne. Ce détenteur ne change donc jamais une fois la fiche reçue.
 *
 * Lecture non réactive du store : la fonction est appelée pendant le rendu d'un
 * composant qui souscrit déjà au store (la liste des fiches), donc un changement
 * pertinent re-rend le parent et relance ce calcul.
 */
export function getPreviousDetenteur(
  transmission: CarcasseTransmissionWihMetadata,
  usersById: Record<UserForFei['id'], UserForFei>,
  myEntities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>,
  myUserId: string
): DetenteurDisplay {
  const entities = useZustandStore.getState().entities;

  // Le name_cache peut être absent (ex. fiche transmise avant que le cache soit rempli) :
  // on résout d'abord depuis l'id du premier détenteur, le cache n'est qu'un fallback.
  const premierDetenteurName =
    resolveOwnerName(
      transmission.content.premier_detenteur_entity_id || transmission.content.premier_detenteur_user_id,
      entities,
      usersById
    ) ||
    transmission.content.premier_detenteur_name_cache ||
    null;
  const premierDetenteur: DetenteurDisplay = {
    name: premierDetenteurName,
    icon: iconForRole(FeiOwnerRole.PREMIER_DETENTEUR),
  };

  // transmission.intermediaires est en ordre chronologique décroissant (index 0 = plus récent,
  // dernier index = plus ancien). On raisonne directement sur cet ordre, sans copie ni reverse :
  // cette fonction tourne pour chaque carte de la liste, on évite toute allocation.
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

  // Ma première entrée dans la chaîne (la plus ancienne) = le plus grand index qui est moi,
  // puisque l'ordre est décroissant. On scanne depuis le plus ancien (fin) vers le plus récent.
  let myEarliestIndex = -1;
  for (let i = lastIndex; i >= 0; i--) {
    if (isMine(intermediaires[i])) {
      myEarliestIndex = i;
      break;
    }
  }

  // Ma première entrée est tout au bout de la chaîne (juste après le premier détenteur) :
  // c'est lui qui m'a donné la fiche.
  if (myEarliestIndex === lastIndex) {
    return premierDetenteur;
  }

  let previous;
  if (myEarliestIndex === -1) {
    // Pas encore pris en charge : le détenteur précédent est le dernier de la chaîne (le plus récent).
    previous = intermediaires[0];
  } else {
    // Celui qui m'a donné la fiche est juste plus ancien que ma première entrée → index supérieur.
    previous = intermediaires[myEarliestIndex + 1];
  }

  return {
    name:
      resolveOwnerName(
        previous.intermediaire_entity_id || previous.intermediaire_user_id,
        entities,
        usersById
      ) ||
      premierDetenteurName ||
      null,
    icon: iconForRole(previous.intermediaire_role),
  };
}
