import useZustandStore from '@app/zustand/store';
import { Carcasse, Fei } from '@prisma/client';
import { useState } from 'react';
import { useParams } from 'react-router';

interface PrefillPremierDétenteurInfos {
  premier_detenteur_depot_type: Carcasse['premier_detenteur_depot_type'];
  premier_detenteur_depot_entity_id: Carcasse['premier_detenteur_depot_entity_id'];
  premier_detenteur_depot_entity_name_cache: Carcasse['premier_detenteur_depot_entity_name_cache'];
  premier_detenteur_prochain_detenteur_role_cache: Carcasse['premier_detenteur_prochain_detenteur_role_cache'];
  premier_detenteur_prochain_detenteur_id_cache: Carcasse['premier_detenteur_prochain_detenteur_id_cache'];
  premier_detenteur_transport_type: Carcasse['premier_detenteur_transport_type'];
  premier_detenteur_user_id: Carcasse['premier_detenteur_user_id'];
  premier_detenteur_entity_id: Carcasse['premier_detenteur_entity_id'];
}

export function usePrefillPremierDétenteurInfos(): PrefillPremierDétenteurInfos | null {
  const params = useParams();
  const carcasses = useZustandStore((state) => state.carcasses);
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
    const searchWithinFeiNumbers: Record<string, boolean> = {};
    for (const _fei_numero of Object.keys(feis)) {
      if (_fei_numero === feiNumero) continue;
      const _fei = feis[_fei_numero];
      if (_fei.commune_mise_a_mort !== fei.commune_mise_a_mort) continue;
      searchWithinFeiNumbers[_fei_numero] = true;
    }
    let match: Carcasse | undefined = undefined;
    for (const zacharie_carcasse_id of Object.keys(carcasses)) {
      const carcasse = carcasses[zacharie_carcasse_id];
      if (carcasse.premier_detenteur_prochain_detenteur_id_cache) {
        match = carcasse;
        break;
      }
    }
    if (match) {
      return {
        premier_detenteur_depot_type: match.premier_detenteur_depot_type,
        premier_detenteur_depot_entity_id: match.premier_detenteur_depot_entity_id,
        premier_detenteur_depot_entity_name_cache: match.premier_detenteur_depot_entity_name_cache,
        premier_detenteur_prochain_detenteur_id_cache: match.premier_detenteur_prochain_detenteur_id_cache,
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
