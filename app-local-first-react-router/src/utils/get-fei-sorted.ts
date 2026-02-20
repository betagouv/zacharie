import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import { filterFeiIntermediaires } from '@app/utils/get-carcasses-intermediaires';
import { filterEntitiesWorkingDirectlyFor } from '@app/utils/get-entity-relations';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { UserRoles } from '@prisma/client';

type FeiSorted = {
  feisUnderMyResponsability: Array<FeiWithIntermediaires>;
  feisToTake: Array<FeiWithIntermediaires>;
  feisOngoing: Array<FeiWithIntermediaires>;
  feisDone: Array<FeiWithIntermediaires>;
};

export function isFeiDone(fei: FeiWithIntermediaires): boolean {
  return !!(fei.svi_closed_at || fei.automatic_closed_at || fei.intermediaire_closed_at);
}

export function getFeisSorted(): FeiSorted {
  const state = useZustandStore.getState();
  const user = useUser.getState().user;
  const carcassesIntermediaireById = state.carcassesIntermediaireById;
  const allCarcasses = state.carcasses;
  const entitiesIdsWorkingDirectlyFor = filterEntitiesWorkingDirectlyFor(state.entities);

  const feisSorted: FeiSorted = {
    feisUnderMyResponsability: [],
    feisToTake: [],
    feisOngoing: [],
    feisDone: [],
  };
  if (!user) {
    return feisSorted;
  }
  console.log('state.feis', state.feis);
  for (const fei of Object.values(state.feis)) {
    const debug = fei.numero === 'ZACH-20260216-IKO5X-063936';
    if (debug) {
      console.log('fei', fei);
    }
    if (fei.deleted_at) {
      continue;
    }

    const carcasses = filterCarcassesForFei(allCarcasses, fei.numero);

    if (isFeiDone(fei)) {
      feisSorted.feisDone.push(fei);
      continue;
    }
    if (debug) {
      console.log('fei is not done');
    }

    // FEI UNDER MY RESPONSABILITY
    // At least one carcasse where current_owner is me/my entity AND no next_owner
    const isUnderMyResponsability = carcasses.some((c) => {
      if (c.next_owner_user_id || c.next_owner_entity_id) return false;
      if (c.current_owner_user_id === user.id) return true;
      if (c.current_owner_entity_id && entitiesIdsWorkingDirectlyFor.includes(c.current_owner_entity_id)) {
        return true;
      }
      return false;
    });
    if (debug) {
      console.log('isUnderMyResponsability', isUnderMyResponsability);
    }
    // Fallback to FEI-level for FEIs with no carcasses yet (e.g. just created)
    const isUnderMyResponsabilityFallback =
      carcasses.length === 0 &&
      !fei.automatic_closed_at &&
      !fei.intermediaire_closed_at &&
      !fei.svi_assigned_at &&
      !fei.svi_closed_at &&
      !fei.fei_next_owner_user_id &&
      !fei.fei_next_owner_entity_id &&
      (fei.fei_current_owner_user_id === user.id ||
        entitiesIdsWorkingDirectlyFor.includes(fei.fei_current_owner_entity_id!));

    if (debug) {
      console.log('isUnderMyResponsabilityFallback', isUnderMyResponsabilityFallback);
    }
    if (isUnderMyResponsability || isUnderMyResponsabilityFallback) {
      feisSorted.feisUnderMyResponsability.push(fei);
      continue;
    }

    // FEI TO TAKE
    // At least one carcasse where next_owner is me/my entity
    const isToTake = carcasses.some((c) => {
      if (c.next_owner_user_id === user.id) return true;
      if (c.next_owner_entity_id && entitiesIdsWorkingDirectlyFor.includes(c.next_owner_entity_id)) {
        return true;
      }
      return false;
    });
    if (debug) {
      console.log('isToTake', isToTake);
    }
    if (isToTake && !fei.svi_assigned_at && !fei.intermediaire_closed_at) {
      feisSorted.feisToTake.push(fei);
      continue;
    }

    // FEI ONGOING
    if (!fei.svi_assigned_at && !fei.intermediaire_closed_at) {
      if (fei.examinateur_initial_user_id === user.id) {
        feisSorted.feisOngoing.push(fei);
        continue;
      }
      if (fei.premier_detenteur_user_id === user.id) {
        feisSorted.feisOngoing.push(fei);
        continue;
      }
      if (fei.premier_detenteur_entity_id) {
        if (entitiesIdsWorkingDirectlyFor.includes(fei.premier_detenteur_entity_id)) {
          feisSorted.feisOngoing.push(fei);
          continue;
        }
      }
      // Check sous-traite at carcasse level
      const hasSousTraite = carcasses.some(
        (c) =>
          c.next_owner_sous_traite_by_entity_id &&
          entitiesIdsWorkingDirectlyFor.includes(c.next_owner_sous_traite_by_entity_id),
      );
      if (hasSousTraite) {
        feisSorted.feisOngoing.push(fei);
        continue;
      }
      let isIntermediaire = false;
      for (const intermediaire of filterFeiIntermediaires(carcassesIntermediaireById, fei.numero)) {
        if (intermediaire.intermediaire_user_id === user.id) {
          feisSorted.feisOngoing.push(fei);
          isIntermediaire = true;
          break;
        }
        if (intermediaire.intermediaire_entity_id) {
          if (entitiesIdsWorkingDirectlyFor.includes(intermediaire.intermediaire_entity_id)) {
            feisSorted.feisOngoing.push(fei);
            isIntermediaire = true;
            break;
          }
        }
      }
      if (isIntermediaire) {
        continue;
      }
    }
    if (fei.svi_assigned_at) {
      if (user.roles.includes(UserRoles.SVI)) {
        feisSorted.feisUnderMyResponsability.push(fei);
        continue;
      }
      feisSorted.feisOngoing.push(fei);
      continue;
    }
  }
  return {
    feisUnderMyResponsability: [...feisSorted.feisUnderMyResponsability].sort(sortFeis),
    feisToTake: [...feisSorted.feisToTake].sort(sortFeis),
    feisOngoing: [...feisSorted.feisOngoing].sort(sortFeis),
    feisDone: [...feisSorted.feisDone].sort(sortFeis),
  };
}

function sortFeis(a: FeiWithIntermediaires, b: FeiWithIntermediaires) {
  const aDate = a.examinateur_initial_date_approbation_mise_sur_le_marche || a.created_at;
  const bDate = b.examinateur_initial_date_approbation_mise_sur_le_marche || b.created_at;
  return bDate < aDate ? -1 : 1;
}
