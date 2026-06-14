import { type ReactNode } from 'react';
import { FeiOwnerRole } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { filterEntitiesWorkingDirectlyFor } from '@app/utils/get-entity-relations';
import { ChasseIcon } from '@app/assets/svg/ChasseIcon';
import { TransportIcon } from '@app/assets/svg/TransportIcon';
import { CarcasseTransmissionWihMetadata } from '@app/types/carcasse';

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
export function getPreviousDetenteur(transmission: CarcasseTransmissionWihMetadata): DetenteurDisplay {
  const { entities, users: usersById } = useZustandStore.getState();
  const myUserId = useUser.getState().user?.id;
  const myEntityIds = new Set(filterEntitiesWorkingDirectlyFor(entities));

  const premierDetenteurName = transmission.premier_detenteur_name_cache;
  const premierDetenteur: DetenteurDisplay = {
    name: premierDetenteurName || null,
    icon: iconForRole(FeiOwnerRole.PREMIER_DETENTEUR),
  };

  // ordre chronologique décroissant, du plus récent au plus ancien
  const intermediaires = transmission.intermediaires;
  if (intermediaires.length === 0) {
    return premierDetenteur;
  }

  let myFirstIndex = -1;
  for (let i = intermediaires.length - 1; i >= 0; i--) {
    const intermediaire = intermediaires[i];
    if (intermediaire.intermediaire_entity_id && myEntityIds.has(intermediaire.intermediaire_entity_id)) {
      myFirstIndex = i;
      break;
    }
    if (intermediaire.intermediaire_user_id && intermediaire.intermediaire_user_id === myUserId) {
      myFirstIndex = i;
      break;
    }
  }

  // Ma première entrée est juste après le premier détenteur : c'est lui qui m'a donné la fiche.
  if (myFirstIndex === 0) {
    return premierDetenteur;
  }

  let previous;
  if (myFirstIndex === -1) {
    // Pas encore pris en charge : le détenteur précédent est le dernier de la chaîne.
    previous = intermediaires[intermediaires.length - 1];
  } else {
    previous = intermediaires[myFirstIndex];
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
