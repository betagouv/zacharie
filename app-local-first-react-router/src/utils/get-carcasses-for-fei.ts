import { useMemo } from 'react';
import type { Carcasse, Fei } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';

export function filterCarcassesForFei(
  carcasses: Record<string, Carcasse>,
  fei_numero: Fei['numero']
): Array<Carcasse> {
  return Object.values(carcasses).filter((c) => c.fei_numero === fei_numero && !c.deleted_at);
}

export function useCarcassesForFei(fei_numero: Fei['numero'] | undefined): Array<Carcasse> {
  const carcasses = useZustandStore((state) => state.carcasses);
  return useMemo(() => {
    if (!fei_numero) return [];
    return filterCarcassesForFei(carcasses, fei_numero).sort((a, b) => {
      return dayjs(a.created_at).diff(dayjs(b.created_at));
    });
  }, [carcasses, fei_numero]);
}
