import { useMemo } from 'react';
import type { Carcasse, Fei } from '@prisma/client';
import useZustandStore from '@app/zustand/store';

export function filterCarcassesForFei(
  carcasses: Record<string, Carcasse>,
  fei_numero: Fei['numero'],
): Array<Carcasse> {
  return Object.values(carcasses).filter((c) => c.fei_numero === fei_numero && !c.deleted_at);
}

export function useCarcassesForFei(fei_numero: Fei['numero'] | undefined): Array<Carcasse> {
  const carcasses = useZustandStore((state) => state.carcasses);
  return useMemo(() => {
    if (!fei_numero) return [];
    return filterCarcassesForFei(carcasses, fei_numero);
  }, [carcasses, fei_numero]);
}
