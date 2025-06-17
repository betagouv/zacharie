import useZustandStore from '@app/zustand/store';
import { Fei } from '@prisma/client';
import { useState } from 'react';
import { useParams } from 'react-router';

interface PrefillPremierDétenteurInfos {
  premier_detenteur_depot_type: Fei['premier_detenteur_depot_type'];
  premier_detenteur_depot_entity_id: Fei['premier_detenteur_depot_entity_id'];
  premier_detenteur_prochain_detenteur_type_cache: Fei['premier_detenteur_prochain_detenteur_type_cache'];
  premier_detenteur_prochain_detenteur_id_cache: Fei['premier_detenteur_prochain_detenteur_id_cache'];
  premier_detenteur_transport_type: Fei['premier_detenteur_transport_type'];
}

export function usePrefillPremierDétenteurInfos(): PrefillPremierDétenteurInfos | null {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const feisDone = useZustandStore((state) => state.feisDone);
  const feiNumero = params.fei_numero as Fei['numero'];

  const fei = feis[feiNumero];

  const [state] = useState(() => {
    if (!fei) {
      return {
        premier_detenteur_depot_type: null,
        premier_detenteur_depot_entity_id: null,
        premier_detenteur_prochain_detenteur_id_cache: null,
        premier_detenteur_prochain_detenteur_type_cache: null,
        premier_detenteur_transport_type: null,
      };
    }
    const latestFeiDone = Object.values(feisDone).find(
      (feiDone) => feiDone.commune_mise_a_mort === fei.commune_mise_a_mort,
    );
    if (latestFeiDone) {
      return {
        premier_detenteur_depot_type: latestFeiDone.premier_detenteur_depot_type,
        premier_detenteur_depot_entity_id: latestFeiDone.premier_detenteur_depot_entity_id,
        premier_detenteur_prochain_detenteur_id_cache:
          latestFeiDone.premier_detenteur_prochain_detenteur_id_cache,
        premier_detenteur_prochain_detenteur_type_cache:
          latestFeiDone.premier_detenteur_prochain_detenteur_type_cache,
        premier_detenteur_transport_type: latestFeiDone.premier_detenteur_transport_type,
      };
    }
    const latestFei = Object.values(feis).find(
      (fei) => fei.commune_mise_a_mort === fei.commune_mise_a_mort && fei.numero !== feiNumero,
    );
    if (latestFei) {
      return {
        premier_detenteur_depot_type: latestFei.premier_detenteur_depot_type,
        premier_detenteur_depot_entity_id: latestFei.premier_detenteur_depot_entity_id,
        premier_detenteur_prochain_detenteur_id_cache:
          latestFei.premier_detenteur_prochain_detenteur_id_cache,
        premier_detenteur_prochain_detenteur_type_cache:
          latestFei.premier_detenteur_prochain_detenteur_type_cache,
        premier_detenteur_transport_type: latestFei.premier_detenteur_transport_type,
      };
    }
    return {
      premier_detenteur_depot_type: null,
      premier_detenteur_depot_entity_id: null,
      premier_detenteur_prochain_detenteur_id_cache: null,
      premier_detenteur_prochain_detenteur_type_cache: null,
      premier_detenteur_transport_type: null,
    };
  });

  if (!fei) {
    return null;
  }
  return {
    premier_detenteur_depot_type: state.premier_detenteur_depot_type,
    premier_detenteur_depot_entity_id: state.premier_detenteur_depot_entity_id,
    premier_detenteur_prochain_detenteur_id_cache: state.premier_detenteur_prochain_detenteur_id_cache,
    premier_detenteur_prochain_detenteur_type_cache: state.premier_detenteur_prochain_detenteur_type_cache,
    premier_detenteur_transport_type: state.premier_detenteur_transport_type,
  };
}
