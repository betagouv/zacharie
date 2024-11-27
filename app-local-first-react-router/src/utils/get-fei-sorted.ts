import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { UserRoles } from '@prisma/client';
import type { FeiWithIntermediaires } from '@api/src/types/fei';

type FeiSorted = {
  feisUnderMyResponsability: Array<FeiWithIntermediaires>;
  feisToTake: Array<FeiWithIntermediaires>;
  feisOngoing: Array<FeiWithIntermediaires>;
};

export function getFeisSorted(): FeiSorted {
  const state = useZustandStore.getState();
  const user = useUser.getState().user;
  const feisSorted: FeiSorted = {
    feisUnderMyResponsability: [],
    feisToTake: [],
    feisOngoing: [],
  };
  if (!user) {
    return feisSorted;
  }
  for (const fei of Object.values(state.feis)) {
    if (fei.deleted_at) {
      continue;
    }
    // FEI UNDER MY RESPONSABILITY
    if (
      !fei.svi_assigned_at &&
      !fei.svi_signed_at &&
      !fei.fei_next_owner_user_id &&
      !fei.fei_next_owner_entity_id
    ) {
      if (fei.fei_current_owner_user_id === user.id) {
        feisSorted.feisUnderMyResponsability.push(fei);
        continue;
      }
      if (state.entitiesIdsWorkingDirectlyFor.includes(fei.fei_current_owner_entity_id!)) {
        feisSorted.feisUnderMyResponsability.push(fei);
        continue;
      }
      if (fei.fei_current_owner_role === UserRoles.ETG) {
        // also collecteurs from this etg can take the lead
        const etg = state.entities[fei.fei_current_owner_entity_id!];
        if (etg.relation === 'WORKING_FOR_ENTITY_RELATED_WITH') {
          if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
            feisSorted.feisUnderMyResponsability.push(fei);
            continue;
          }
        }
      }
      if (fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO) {
        // also collecteurs from this etg can take the lead
        const collecteurPro = state.entities[fei.fei_current_owner_entity_id!];
        if (collecteurPro.relation === 'WORKING_FOR_ENTITY_RELATED_WITH') {
          if (user.roles.includes(UserRoles.ETG)) {
            feisSorted.feisUnderMyResponsability.push(fei);
            continue;
          }
        }
      }
    }
    // FEI TO TAKE
    if (!fei.svi_assigned_at) {
      if (fei.fei_next_owner_user_id === user.id) {
        feisSorted.feisToTake.push(fei);
        continue;
      }
      if (state.entitiesIdsWorkingDirectlyFor.includes(fei.fei_next_owner_entity_id!)) {
        feisSorted.feisToTake.push(fei);
        continue;
      }
      if (fei.fei_next_owner_role === UserRoles.ETG) {
        // also collecteurs from this etg can take the lead
        console.log('fei.fei_next_owner_entity_id', fei.fei_next_owner_entity_id);
        console.log('entities', state.entities);
        const etg = state.entities[fei.fei_next_owner_entity_id!];
        console.log('etg', etg);
        if (etg.relation === 'WORKING_FOR_ENTITY_RELATED_WITH') {
          if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
            feisSorted.feisToTake.push(fei);
            continue;
          }
        }
      }
      if (fei.fei_next_owner_role === UserRoles.COLLECTEUR_PRO) {
        // also collecteurs from this etg can take the lead
        const collecteurPro = state.entities[fei.fei_next_owner_entity_id!];
        if (collecteurPro.relation === 'WORKING_FOR_ENTITY_RELATED_WITH') {
          if (user.roles.includes(UserRoles.ETG)) {
            feisSorted.feisToTake.push(fei);
            continue;
          }
        }
      }
    }
    // FEI ONGOING
    if (!fei.svi_assigned_at) {
      if (fei.examinateur_initial_user_id === user.id) {
        feisSorted.feisOngoing.push(fei);
        continue;
      }
      if (fei.premier_detenteur_user_id === user.id) {
        feisSorted.feisOngoing.push(fei);
        continue;
      }
      if (fei.premier_detenteur_entity_id) {
        if (state.entitiesIdsWorkingDirectlyFor.includes(fei.premier_detenteur_entity_id)) {
          feisSorted.feisOngoing.push(fei);
          continue;
        }
      }
      let isIntermediaire = false;
      for (const intermediaire of fei.FeiIntermediaires) {
        if (intermediaire.fei_intermediaire_user_id === user.id) {
          feisSorted.feisOngoing.push(fei);
          isIntermediaire = true;
          break;
        }
        if (intermediaire.fei_intermediaire_entity_id) {
          if (state.entitiesIdsWorkingDirectlyFor.includes(intermediaire.fei_intermediaire_entity_id)) {
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
  }
  return {
    feisUnderMyResponsability: feisSorted.feisUnderMyResponsability.sort(sortFeis),
    feisToTake: feisSorted.feisToTake.sort(sortFeis),
    feisOngoing: feisSorted.feisOngoing.sort(sortFeis),
  };
}

function sortFeis(a: FeiWithIntermediaires, b: FeiWithIntermediaires) {
  const aDate = a.examinateur_initial_date_approbation_mise_sur_le_marche || a.created_at;
  const bDate = b.examinateur_initial_date_approbation_mise_sur_le_marche || b.created_at;
  return bDate < aDate ? -1 : 1;
}
