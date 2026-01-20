import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import { Carcasse, CarcasseStatus, Fei } from '@prisma/client';

// Terminal SVI statuses that indicate a carcasse is "done"
const TERMINAL_SVI_STATUSES: CarcasseStatus[] = [
  CarcasseStatus.SAISIE_TOTALE,
  CarcasseStatus.SAISIE_PARTIELLE,
  CarcasseStatus.MANQUANTE_SVI,
  CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
  CarcasseStatus.TRAITEMENT_ASSAINISSANT,
];

export type CarcasseWithFei = Carcasse & {
  Fei: FeiWithIntermediaires;
};

type CarcassesSorted = {
  carcassesUnderMyResponsability: Array<CarcasseWithFei>;
  carcassesToTake: Array<CarcasseWithFei>;
  carcassesOngoing: Array<CarcasseWithFei>;
  carcassesDone: Array<CarcasseWithFei>;
};

export function getCarcassesSorted(): CarcassesSorted {
  const state = useZustandStore.getState();
  const user = useUser.getState().user;
  const intermediairesByFei = useZustandStore.getState().intermediairesByFei;

  const carcassesSorted: CarcassesSorted = {
    carcassesUnderMyResponsability: [],
    carcassesToTake: [],
    carcassesOngoing: [],
    carcassesDone: [],
  };

  if (!user) {
    return carcassesSorted;
  }

  // Helper to check if entity is one of mine
  const isMyEntity = (entityId: string | null) =>
    entityId && state.entitiesIdsWorkingDirectlyFor.includes(entityId);

  // Helper to get effective ownership (Carcasse or fallback to FEI)
  const getEffectiveOwner = (carcasse: Carcasse, fei: Fei) => {
    return {
      current_user_id: carcasse.current_owner_user_id ?? fei.fei_current_owner_user_id,
      current_entity_id: carcasse.current_owner_entity_id ?? fei.fei_current_owner_entity_id,
      next_user_id: carcasse.next_owner_user_id ?? fei.fei_next_owner_user_id,
      next_entity_id: carcasse.next_owner_entity_id ?? fei.fei_next_owner_entity_id,
      sub_entity_id:
        carcasse.next_owner_sous_traite_by_entity_id ?? fei.fei_next_owner_sous_traite_by_entity_id,
    };
  };

  // Helper to check if fully closed (for Ongoing visibility)
  const isClosed = (carcasse: Carcasse, fei: Fei) => {
    // Check Carcasse specific closure
    if (carcasse.automatic_closed_at || carcasse.intermediaire_closed_at) return true;

    // Check SVI closure (not just assignment)
    if (fei.svi_closed_at) return true;

    // Fallback to FEI closure if Carcasse fields are empty (migration)
    if (!carcasse.current_owner_user_id && !carcasse.current_owner_entity_id) {
      if (fei.automatic_closed_at || fei.intermediaire_closed_at || fei.svi_closed_at) return true;
    }

    return false;
  };

  // Helper to check if assigned to SVI (no longer under user's direct responsibility)
  const isAssignedToSvi = (carcasse: Carcasse, fei: Fei) => {
    return !!(carcasse.svi_assigned_to_fei_at || fei.svi_assigned_at);
  };

  // Combined check for "Under My Responsibility" and "To Take" categories
  const isClosedOrAssigned = (carcasse: Carcasse, fei: Fei) => {
    return isClosed(carcasse, fei) || isAssignedToSvi(carcasse, fei);
  };

  for (const carcasse of Object.values(state.carcasses)) {
    if (carcasse.deleted_at) continue;

    // Search in both feis and feisDone (FEI sent to SVI are in feisDone)
    const feiFromActive = state.feis[carcasse.fei_numero];
    const feiFromDone = state.feisDone[carcasse.fei_numero];
    const fei = feiFromActive ?? feiFromDone;
    if (!fei || fei.deleted_at) continue;

    // If the FEI is in feisDone (not in active feis), it's automatically considered "done"
    const isFeiInDoneStore = !feiFromActive && !!feiFromDone;

    const carcasseWithFei: CarcasseWithFei = { ...carcasse, Fei: fei };
    const owner = getEffectiveOwner(carcasse, fei);

    // Check if carcasse has a terminal SVI status
    const hasTerminalSviStatus =
      carcasse.svi_carcasse_status && TERMINAL_SVI_STATUSES.includes(carcasse.svi_carcasse_status);

    // UNDER MY RESPONSIBILITY
    if (!isClosedOrAssigned(carcasse, fei)) {
      if (owner.current_user_id === user.id) {
        carcassesSorted.carcassesUnderMyResponsability.push(carcasseWithFei);
        continue;
      }
      if (isMyEntity(owner.current_entity_id)) {
        carcassesSorted.carcassesUnderMyResponsability.push(carcasseWithFei);
        continue;
      }
    }

    // TO TAKE
    // Not closed, not assigned to SVI
    if (!isClosedOrAssigned(carcasse, fei)) {
      // logic simplification: To Take implies not yet accepted, so definetely not closed
      if (owner.next_user_id === user.id) {
        carcassesSorted.carcassesToTake.push(carcasseWithFei);
        continue;
      }
      if (isMyEntity(owner.next_entity_id)) {
        carcassesSorted.carcassesToTake.push(carcasseWithFei);
        continue;
      }
    }

    // Helper to check user involvement in this FEI
    const checkInvolvement = () => {
      // Creating user (Examinateur)
      if (fei.examinateur_initial_user_id === user.id) return true;
      // Premier Detenteur
      if (fei.premier_detenteur_user_id === user.id) return true;
      if (isMyEntity(fei.premier_detenteur_entity_id)) return true;
      // Sous-traitance (Entity)
      if (isMyEntity(owner.sub_entity_id)) return true;

      // Intermediaire
      const intermediaires = intermediairesByFei[fei.numero] || [];
      for (const inter of intermediaires) {
        if (inter.intermediaire_user_id === user.id || isMyEntity(inter.intermediaire_entity_id)) {
          return true;
        }
      }

      return false;
    };

    // Determine if this carcasse should be considered "done"
    // A carcasse is "done" if:
    // - The FEI is in the feisDone store (sent to SVI and archived)
    // - OR the carcasse has a terminal SVI status
    // - OR it's closed according to isClosed logic
    const isConsideredDone = isFeiInDoneStore || hasTerminalSviStatus || isClosed(carcasse, fei);

    // ONGOING
    // If I was involved and it's not fully closed, show in Ongoing.
    // This includes carcasses assigned to SVI but not yet closed - the user can still track them.
    if (!isConsideredDone) {
      if (checkInvolvement()) {
        carcassesSorted.carcassesOngoing.push(carcasseWithFei);
        continue;
      }
    }

    // DONE (closed)
    // If I was involved and it's closed, show in Done.
    if (isConsideredDone) {
      if (checkInvolvement()) {
        carcassesSorted.carcassesDone.push(carcasseWithFei);
        continue;
      }
    }
  }

  // Sort by date (newest first)
  const sortFn = (a: CarcasseWithFei, b: CarcasseWithFei) => {
    const aDate = a.date_mise_a_mort || a.created_at;
    const bDate = b.date_mise_a_mort || b.created_at;
    return bDate < aDate ? -1 : 1;
  };

  return {
    carcassesUnderMyResponsability: carcassesSorted.carcassesUnderMyResponsability.sort(sortFn),
    carcassesToTake: carcassesSorted.carcassesToTake.sort(sortFn),
    carcassesOngoing: carcassesSorted.carcassesOngoing.sort(sortFn),
    carcassesDone: carcassesSorted.carcassesDone.sort(sortFn),
  };
}
