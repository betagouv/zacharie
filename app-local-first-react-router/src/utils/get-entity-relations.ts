import { useMemo } from 'react';
import { EntityRelationType, EntityTypes } from '@prisma/client';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import type { UserForFei } from '~/src/types/user';
import useZustandStore from '@app/zustand/store';

const circuitCourtTypes: EntityTypes[] = [
  EntityTypes.COMMERCE_DE_DETAIL,
  EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
  EntityTypes.ASSOCIATION_CARITATIVE,
  EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
  EntityTypes.CONSOMMATEUR_FINAL,
];

// Plain filter functions (for non-hook contexts like get-fei-sorted.ts)

export function filterEntitiesWorkingDirectlyFor(
  entities: Record<string, EntityWithUserRelation>,
): string[] {
  return Object.values(entities)
    .filter(
      (e) =>
        !e.deleted_at && e.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
    )
    .map((e) => e.id);
}

export function filterCcgs(
  entities: Record<string, EntityWithUserRelation>,
): EntityWithUserRelation[] {
  return Object.values(entities).filter(
    (e) => !e.deleted_at && e.type === EntityTypes.CCG && e.relation !== EntityRelationType.NONE,
  );
}

export function filterEtgs(
  entities: Record<string, EntityWithUserRelation>,
): EntityWithUserRelation[] {
  return Object.values(entities).filter(
    (e) => !e.deleted_at && e.type === EntityTypes.ETG && e.relation !== EntityRelationType.NONE,
  );
}

export function filterSvis(
  entities: Record<string, EntityWithUserRelation>,
): EntityWithUserRelation[] {
  return Object.values(entities).filter(
    (e) => !e.deleted_at && e.type === EntityTypes.SVI && e.relation !== EntityRelationType.NONE,
  );
}

export function filterCollecteursPro(
  entities: Record<string, EntityWithUserRelation>,
): EntityWithUserRelation[] {
  return Object.values(entities).filter(
    (e) =>
      !e.deleted_at &&
      e.type === EntityTypes.COLLECTEUR_PRO &&
      e.relation !== EntityRelationType.NONE,
  );
}

export function filterCircuitCourt(
  entities: Record<string, EntityWithUserRelation>,
): EntityWithUserRelation[] {
  return Object.values(entities).filter(
    (e) =>
      !e.deleted_at &&
      circuitCourtTypes.includes(e.type!) &&
      e.relation !== EntityRelationType.NONE,
  );
}

// Hooks (for components)

export function useEntitiesIdsWorkingDirectlyFor(): string[] {
  const entities = useZustandStore((state) => state.entities);
  return useMemo(() => filterEntitiesWorkingDirectlyFor(entities), [entities]);
}

export function useCcgIds(): string[] {
  const entities = useZustandStore((state) => state.entities);
  return useMemo(() => filterCcgs(entities).map((e) => e.id), [entities]);
}

export function useEtgIds(): string[] {
  const entities = useZustandStore((state) => state.entities);
  return useMemo(() => filterEtgs(entities).map((e) => e.id), [entities]);
}

export function useSviIds(): string[] {
  const entities = useZustandStore((state) => state.entities);
  return useMemo(() => filterSvis(entities).map((e) => e.id), [entities]);
}

export function useCollecteursProIds(): string[] {
  const entities = useZustandStore((state) => state.entities);
  return useMemo(() => filterCollecteursPro(entities).map((e) => e.id), [entities]);
}

export function useCircuitCourtIds(): string[] {
  const entities = useZustandStore((state) => state.entities);
  return useMemo(() => filterCircuitCourt(entities).map((e) => e.id), [entities]);
}

export function useDetenteursInitiaux(): Record<string, UserForFei> {
  const detenteursInitiauxIds = useZustandStore((state) => state.detenteursInitiauxIds);
  const users = useZustandStore((state) => state.users);
  return useMemo(() => {
    const result: Record<string, UserForFei> = {};
    for (const id of detenteursInitiauxIds) {
      if (users[id]) {
        result[id] = users[id];
      }
    }
    return result;
  }, [detenteursInitiauxIds, users]);
}
