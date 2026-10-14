import type { TransmissionSimpleStatus } from '@app/types/transmission-steps';

export type FeiQuickFilterMeta = {
  collecteurIds: Array<string>;
  simpleStatus: TransmissionSimpleStatus | undefined;
  premierDetenteurName: string | null | undefined;
};

type CheckedValues = Record<string, boolean | undefined>;

export type FeiQuickFilters = {
  collecteurIds?: CheckedValues;
  transmissionStatuses: CheckedValues;
  premierDetenteurs: CheckedValues;
};

const isActive = (checked: CheckedValues | undefined) => !!checked && Object.values(checked).some(Boolean);

// Un filtre rapide de fiche garde les fiches qui ont au moins une des valeurs cochées ;
// plusieurs filtres cochés se cumulent.
export function isFeiExcludedByQuickFilters(meta: FeiQuickFilterMeta, filters: FeiQuickFilters): boolean {
  if (isActive(filters.collecteurIds) && !meta.collecteurIds.some((id) => filters.collecteurIds![id])) {
    return true;
  }
  if (
    isActive(filters.transmissionStatuses) &&
    !(meta.simpleStatus && filters.transmissionStatuses[meta.simpleStatus])
  ) {
    return true;
  }
  if (
    isActive(filters.premierDetenteurs) &&
    !(meta.premierDetenteurName && filters.premierDetenteurs[meta.premierDetenteurName])
  ) {
    return true;
  }
  return false;
}
