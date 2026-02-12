import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import { filterFeiIntermediaires } from '@app/utils/get-carcasses-intermediaires';
import { filterEntitiesWorkingDirectlyFor } from '@app/utils/get-entity-relations';

type FeiSorted = {
  feisUnderMyResponsability: Array<FeiWithIntermediaires>;
  feisToTake: Array<FeiWithIntermediaires>;
  feisOngoing: Array<FeiWithIntermediaires>;
  feisDone: Array<FeiWithIntermediaires>;
};

export function isFeiDone(fei: FeiWithIntermediaires): boolean {
  return !!(fei.svi_assigned_at || fei.intermediaire_closed_at);
}

export function getFeisSorted(): FeiSorted {
  const state = useZustandStore.getState();
  const user = useUser.getState().user;
  const carcassesIntermediaireById = state.carcassesIntermediaireById;
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
  for (const fei of Object.values(state.feis)) {
    if (fei.deleted_at) {
      continue;
    }
    if (isFeiDone(fei)) {
      feisSorted.feisDone.push(fei);
      continue;
    }
    // FEI UNDER MY RESPONSABILITY
    if (
      !fei.automatic_closed_at &&
      !fei.intermediaire_closed_at &&
      !fei.svi_assigned_at &&
      !fei.svi_closed_at &&
      !fei.fei_next_owner_user_id &&
      !fei.fei_next_owner_entity_id
    ) {
      if (fei.fei_current_owner_user_id === user.id) {
        feisSorted.feisUnderMyResponsability.push(fei);
        // if (debug) console.log('1');
        continue;
      }
      if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_current_owner_entity_id!)) {
        feisSorted.feisUnderMyResponsability.push(fei);
        // if (debug) console.log('2');
        continue;
      }
    }
    // FEI TO TAKE
    if (!fei.svi_assigned_at && !fei.intermediaire_closed_at) {
      if (fei.fei_next_owner_user_id === user.id) {
        feisSorted.feisToTake.push(fei);
        // if (debug) console.log('5');
        continue;
      }
      if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_next_owner_entity_id!)) {
        feisSorted.feisToTake.push(fei);
        // if (debug) console.log('6');
        continue;
      }
    }
    // FEI ONGOING
    if (!fei.svi_assigned_at && !fei.intermediaire_closed_at) {
      if (fei.examinateur_initial_user_id === user.id) {
        feisSorted.feisOngoing.push(fei);
        // if (debug) console.log('9');
        continue;
      }
      if (fei.premier_detenteur_user_id === user.id) {
        feisSorted.feisOngoing.push(fei);
        // if (debug) console.log('10');
        continue;
      }
      if (fei.premier_detenteur_entity_id) {
        if (entitiesIdsWorkingDirectlyFor.includes(fei.premier_detenteur_entity_id)) {
          feisSorted.feisOngoing.push(fei);
          // if (debug) console.log('11');
          continue;
        }
      }
      if (fei.fei_next_owner_sous_traite_by_entity_id) {
        if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_next_owner_sous_traite_by_entity_id)) {
          feisSorted.feisOngoing.push(fei);
          continue;
        }
      }
      let isIntermediaire = false;
      for (const intermediaire of filterFeiIntermediaires(carcassesIntermediaireById, fei.numero)) {
        if (intermediaire.intermediaire_user_id === user.id) {
          feisSorted.feisOngoing.push(fei);
          isIntermediaire = true;
          // if (debug) console.log('12');
          break;
        }
        if (intermediaire.intermediaire_entity_id) {
          if (entitiesIdsWorkingDirectlyFor.includes(intermediaire.intermediaire_entity_id)) {
            feisSorted.feisOngoing.push(fei);
            isIntermediaire = true;
            // if (debug) console.log('13');
            break;
          }
        }
      }
      if (isIntermediaire) {
        // if (debug) console.log('14');
        continue;
      }
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
