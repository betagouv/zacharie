import { useMemo } from 'react';
import type { Fei } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { CarcasseWithModificationRequests } from '@api/src/types/carcasse';

export function filterCarcassesForFei(
  carcasses: Record<string, CarcasseWithModificationRequests>,
  fei_numero: Fei['numero']
): Array<CarcasseWithModificationRequests> {
  return Object.values(carcasses).filter((c) => c.fei_numero === fei_numero && !c.deleted_at);
}

export function useCarcassesForFei(
  fei_numero: Fei['numero'] | undefined
): Array<CarcasseWithModificationRequests> {
  const carcasses = useZustandStore((state) => state.carcasses);
  return useMemo(() => {
    if (!fei_numero) return [];
    return filterCarcassesForFei(carcasses, fei_numero).sort((a, b) => {
      return dayjs(a.created_at).diff(dayjs(b.created_at));
    });
  }, [carcasses, fei_numero]);
}
