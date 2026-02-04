import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import type { FeiWithIntermediaires } from '@api/src/types/fei';

type FeiSorted = {
  feisUnderMyResponsability: Array<FeiWithIntermediaires>;
  feisToTake: Array<FeiWithIntermediaires>;
  feisOngoing: Array<FeiWithIntermediaires>;
};

export function useFeisSorted(
  feis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires>,
): FeiSorted {
  const entitiesIdsWorkingDirectlyFor = useZustandStore((state) => state.entitiesIdsWorkingDirectlyFor);
  const intermediairesByFei = useZustandStore((state) => state.intermediairesByFei);
  const user = useUser((state) => state.user);

  const feisUnderMyResponsability: Array<FeiWithIntermediaires> = [];
  const feisToTake: Array<FeiWithIntermediaires> = [];
  const feisOngoing: Array<FeiWithIntermediaires> = [];
  if (!user) {
    return {
      feisUnderMyResponsability,
      feisToTake,
      feisOngoing,
    };
  }
  for (const feiNumero of Object.keys(feis)) {
    const fei = feis[feiNumero];
    if (fei.deleted_at) {
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
        feisUnderMyResponsability.push(fei);
        // if (debug) console.log('1');
        continue;
      }
      if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_current_owner_entity_id!)) {
        feisUnderMyResponsability.push(fei);
        // if (debug) console.log('2');
        continue;
      }
    }
    // FEI TO TAKE
    if (!fei.svi_assigned_at && !fei.intermediaire_closed_at) {
      if (fei.fei_next_owner_user_id === user.id) {
        feisToTake.push(fei);
        // if (debug) console.log('5');
        continue;
      }
      if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_next_owner_entity_id!)) {
        feisToTake.push(fei);
        // if (debug) console.log('6');
        continue;
      }
    }
    // FEI ONGOING
    if (!fei.svi_assigned_at && !fei.intermediaire_closed_at) {
      if (fei.examinateur_initial_user_id === user.id) {
        feisOngoing.push(fei);
        // if (debug) console.log('9');
        continue;
      }
      if (fei.premier_detenteur_user_id === user.id) {
        feisOngoing.push(fei);
        // if (debug) console.log('10');
        continue;
      }
      if (fei.premier_detenteur_entity_id) {
        if (entitiesIdsWorkingDirectlyFor.includes(fei.premier_detenteur_entity_id)) {
          feisOngoing.push(fei);
          // if (debug) console.log('11');
          continue;
        }
      }
      if (fei.fei_next_owner_sous_traite_by_entity_id) {
        if (entitiesIdsWorkingDirectlyFor.includes(fei.fei_next_owner_sous_traite_by_entity_id)) {
          feisOngoing.push(fei);
          continue;
        }
      }
      let isIntermediaire = false;
      for (const intermediaire of intermediairesByFei[fei.numero] || []) {
        if (intermediaire.intermediaire_user_id === user.id) {
          feisOngoing.push(fei);
          isIntermediaire = true;
          // if (debug) console.log('12');
          break;
        }
        if (intermediaire.intermediaire_entity_id) {
          if (entitiesIdsWorkingDirectlyFor.includes(intermediaire.intermediaire_entity_id)) {
            feisOngoing.push(fei);
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
    feisUnderMyResponsability: [...feisUnderMyResponsability].sort(sortFeis),
    feisToTake: [...feisToTake].sort(sortFeis),
    feisOngoing: [...feisOngoing].sort(sortFeis),
  };
}

function sortFeis(a: FeiWithIntermediaires, b: FeiWithIntermediaires) {
  const aDate = a.examinateur_initial_date_approbation_mise_sur_le_marche || a.created_at;
  const bDate = b.examinateur_initial_date_approbation_mise_sur_le_marche || b.created_at;
  return bDate < aDate ? -1 : 1;
}
