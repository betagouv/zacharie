import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { CarcasseType } from '@prisma/client';
import { createModal } from '@app/components/Modal';
import API from '@app/services/api';
import type { SviCarcassesAVenirResponse, SviCarcasseAVenir } from '@api/src/types/responses';

export const sviCarcassesAVenirModal = createModal({
  id: 'svi-carcasses-a-venir',
  isOpenedByDefault: false,
});

export function countAnimaux(carcasse: Pick<SviCarcasseAVenir, 'type' | 'nombre_d_animaux'>): number {
  return carcasse.type === CarcasseType.PETIT_GIBIER ? (carcasse.nombre_d_animaux ?? 1) : 1;
}

export type SviFicheAVenir = {
  fei_numero: string;
  etg_nom: string;
  arrived_at: Date | null;
  carcasses: Array<SviCarcasseAVenir>;
};

export function groupCarcassesAVenirByFiche(carcasses: Array<SviCarcasseAVenir>): Array<SviFicheAVenir> {
  const ficheMap = new Map<string, SviFicheAVenir>();
  for (const carcasse of carcasses) {
    const fiche = ficheMap.get(carcasse.fei_numero);
    if (fiche) {
      fiche.carcasses.push(carcasse);
      if (carcasse.arrived_at && (!fiche.arrived_at || carcasse.arrived_at > fiche.arrived_at)) {
        fiche.arrived_at = carcasse.arrived_at;
      }
    } else {
      ficheMap.set(carcasse.fei_numero, {
        fei_numero: carcasse.fei_numero,
        etg_nom: carcasse.etg_nom,
        arrived_at: carcasse.arrived_at,
        carcasses: [carcasse],
      });
    }
  }
  return Array.from(ficheMap.values()).sort((a, b) => {
    const da = a.arrived_at ? dayjs(a.arrived_at).valueOf() : 0;
    const db = b.arrived_at ? dayjs(b.arrived_at).valueOf() : 0;
    return da - db;
  });
}

export function useSviCarcassesAVenir() {
  const [carcasses, setCarcasses] = useState<Array<SviCarcasseAVenir> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    API.get({ path: 'svi/carcasses-a-venir' })
      .then((res) => res as SviCarcassesAVenirResponse)
      .then((res) => {
        if (res.ok && res.data) {
          setCarcasses(res.data.carcasses);
        } else {
          setCarcasses([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { carcasses, loading };
}
