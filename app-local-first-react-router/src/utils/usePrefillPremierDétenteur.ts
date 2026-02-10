import useZustandStore from '@app/zustand/store';
import { Fei } from '@prisma/client';
import { useState } from 'react';
import { useParams } from 'react-router';

interface PrefillPremierDétenteurInfos {
  premier_detenteur_depot_type: Fei['premier_detenteur_depot_type'];
  premier_detenteur_depot_entity_id: Fei['premier_detenteur_depot_entity_id'];
  premier_detenteur_depot_entity_name_cache: Fei['premier_detenteur_depot_entity_name_cache'];
  premier_detenteur_prochain_detenteur_role_cache: Fei['premier_detenteur_prochain_detenteur_role_cache'];
  premier_detenteur_prochain_detenteur_id_cache: Fei['premier_detenteur_prochain_detenteur_id_cache'];
  premier_detenteur_transport_type: Fei['premier_detenteur_transport_type'];
  premier_detenteur_user_id: Fei['premier_detenteur_user_id'];
  premier_detenteur_entity_id: Fei['premier_detenteur_entity_id'];
}

export function usePrefillPremierDétenteurInfos(): PrefillPremierDétenteurInfos | null {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const feiNumero = params.fei_numero as Fei['numero'];

  const fei = feis[feiNumero];

  const [state] = useState(() => {
    const nullDefaults = {
      premier_detenteur_depot_type: null,
      premier_detenteur_depot_entity_id: null,
      premier_detenteur_depot_entity_name_cache: null,
      premier_detenteur_prochain_detenteur_id_cache: null,
      premier_detenteur_prochain_detenteur_role_cache: null,
      premier_detenteur_transport_type: null,
      premier_detenteur_user_id: null,
      premier_detenteur_entity_id: null,
    };
    if (!fei) {
      return nullDefaults;
    }
    const matchingFeis = Object.values(feis).filter(
      (otherFei) =>
        otherFei.commune_mise_a_mort === fei.commune_mise_a_mort && otherFei.numero !== feiNumero,
    );
    // Prefer done FEIs (those with svi_assigned_at or intermediaire_closed_at)
    const match =
      matchingFeis.find((f) => !!(f.svi_assigned_at || f.intermediaire_closed_at)) || matchingFeis[0];
    if (match) {
      return {
        premier_detenteur_depot_type: match.premier_detenteur_depot_type,
        premier_detenteur_depot_entity_id: match.premier_detenteur_depot_entity_id,
        premier_detenteur_depot_entity_name_cache: match.premier_detenteur_depot_entity_name_cache,
        premier_detenteur_prochain_detenteur_id_cache:
          match.premier_detenteur_prochain_detenteur_id_cache,
        premier_detenteur_prochain_detenteur_role_cache:
          match.premier_detenteur_prochain_detenteur_role_cache,
        premier_detenteur_transport_type: match.premier_detenteur_transport_type,
        premier_detenteur_user_id: match.premier_detenteur_user_id,
        premier_detenteur_entity_id: match.premier_detenteur_entity_id,
      };
    }
    return nullDefaults;
  });

  if (!fei) {
    return null;
  }
  return {
    premier_detenteur_depot_type: state.premier_detenteur_depot_type,
    premier_detenteur_depot_entity_id: state.premier_detenteur_depot_entity_id,
    premier_detenteur_depot_entity_name_cache: state.premier_detenteur_depot_entity_name_cache,
    premier_detenteur_prochain_detenteur_id_cache: state.premier_detenteur_prochain_detenteur_id_cache,
    premier_detenteur_prochain_detenteur_role_cache: state.premier_detenteur_prochain_detenteur_role_cache,
    premier_detenteur_transport_type: state.premier_detenteur_transport_type,
    premier_detenteur_user_id: state.premier_detenteur_user_id,
    premier_detenteur_entity_id: state.premier_detenteur_entity_id,
  };
}
