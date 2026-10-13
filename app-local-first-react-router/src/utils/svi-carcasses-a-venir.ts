import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { CarcasseType } from '@prisma/client';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import API from '@app/services/api';
import type { SviCarcassesAVenirResponse, SviCarcasseAVenir } from '@api/src/types/responses';

// Modale partagée (dashboard + registre SVI) — instance unique au niveau module.
// Une seule route SVI est montée à la fois, donc pas de collision d'id DSFR.
export const sviCarcassesAVenirModal = createModal({
  id: 'svi-carcasses-a-venir',
  isOpenedByDefault: false,
});

// Nombre d'animaux comptés par carcasse, comme ailleurs dans l'app :
// petit gibier = un lot de plusieurs animaux, grand gibier = 1 carcasse = 1 animal.
export function countAnimaux(carcasse: Pick<SviCarcasseAVenir, 'type' | 'nombre_d_animaux'>): number {
  return carcasse.type === CarcasseType.PETIT_GIBIER ? (carcasse.nombre_d_animaux ?? 1) : 1;
}

export type SviFicheAVenir = {
  fei_numero: string;
  etg_nom: string;
  arrived_at: Date | null;
  carcasses: Array<SviCarcasseAVenir>;
};

// Regroupement des carcasses à venir par fiche, trié par ancienneté (les plus anciennes
// en premier = les transmissions au SVI les plus probablement imminentes).
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

// Carcasses acceptées par un ETG rattaché au SVI mais pas encore transmises au SVI.
// Servi hors du store local-first via un endpoint dédié.
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
