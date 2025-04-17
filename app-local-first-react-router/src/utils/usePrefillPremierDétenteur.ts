import useZustandStore from '@app/zustand/store';
import { Fei } from '@prisma/client';
import { useState } from 'react';
import { useParams } from 'react-router';

interface PrefillPremierDétenteurInfos {
  premier_detenteur_depot_type: Fei['premier_detenteur_depot_type'];
  // premier_detenteur_date_depot_quelque_part: Fei['premier_detenteur_date_depot_quelque_part'];
  premier_detenteur_depot_entity_id: Fei['premier_detenteur_depot_entity_id'];
}

export function usePrefillPremierDétenteurInfos(): PrefillPremierDétenteurInfos | null {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const feisDone = useZustandStore((state) => state.feisDone);
  const feiNumero = params.feiNumero as Fei['numero'];

  const fei = feis[feiNumero];

  const [state] = useState(() => {
    if (!fei) {
      return {
        premier_detenteur_depot_type: null,
        premier_detenteur_depot_entity_id: null,
      };
    }
    const latestFei = Object.values(feisDone).find(
      (feiDone) => feiDone.commune_mise_a_mort === fei.commune_mise_a_mort,
    );
    if (!latestFei) {
      return {
        premier_detenteur_depot_type: null,
        premier_detenteur_depot_entity_id: null,
      };
    }
    return {
      premier_detenteur_depot_type: latestFei.premier_detenteur_depot_type,
      premier_detenteur_depot_entity_id: latestFei.premier_detenteur_depot_entity_id,
    };
  });

  if (!fei) {
    return null;
  }
  return {
    premier_detenteur_depot_type: state.premier_detenteur_depot_type,
    premier_detenteur_depot_entity_id: state.premier_detenteur_depot_entity_id,
  };
}
