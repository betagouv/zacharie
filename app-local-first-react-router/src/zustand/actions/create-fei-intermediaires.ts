import type { CarcasseIntermediaire } from '@prisma/client';
import useZustandStore from '../store';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { getFeiAndCarcasseAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiAndCarcasseAndIntermediaireIds, FeiIntermediaire } from '@app/types/fei-intermediaire';

export async function createFeiIntermediaires(newIntermediaires: FeiIntermediaire[]) {
  if (newIntermediaires.length === 0) return;
  return new Promise<void>((resolve) => {
    const feiNumero = newIntermediaires[0].fei_numero;
    const carcasses = filterCarcassesForFei(useZustandStore.getState().carcasses, feiNumero);
    const byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire> = {};
    for (const newIntermediaire of newIntermediaires) {
      const carcassesIntermediaires: Array<CarcasseIntermediaire> = carcasses
        .filter((c) => !c.intermediaire_carcasse_refus_intermediaire_id)
        .map((c) => ({
          fei_numero: c.fei_numero,
          numero_bracelet: c.numero_bracelet,
          zacharie_carcasse_id: c.zacharie_carcasse_id,
          intermediaire_id: newIntermediaire.id,
          intermediaire_entity_id: newIntermediaire.intermediaire_entity_id,
          intermediaire_role: newIntermediaire.intermediaire_role,
          intermediaire_user_id: newIntermediaire.intermediaire_user_id,
          check_manuel: null,
          manquante: null,
          refus: null,
          nombre_d_animaux_acceptes: null,
          commentaire: null,
          decision_at: null,
          ecarte_pour_inspection: false,
          prise_en_charge: true, // always true by default, confirmed by the intermediaire globally
          prise_en_charge_at: newIntermediaire.prise_en_charge_at, // will be set by the intermediaire when he confirms all the carcasse
          intermediaire_depot_type: null,
          intermediaire_depot_entity_id: null,
          intermediaire_prochain_detenteur_role_cache: null,
          intermediaire_prochain_detenteur_id_cache: null,
          intermediaire_poids: null,
          created_at: newIntermediaire.created_at,
          updated_at: newIntermediaire.created_at,
          deleted_at: null,
          is_synced: false,
        }));

      for (const ci of carcassesIntermediaires) {
        const feiAndCarcasseAndIntermediaireId = getFeiAndCarcasseAndIntermediaireIds(ci);
        byId[feiAndCarcasseAndIntermediaireId] = ci;
      }
    }

    useZustandStore.setState((state) => {
      return {
        ...state,
        carcassesIntermediaireById: {
          ...state.carcassesIntermediaireById,
          ...byId,
        },
        dataIsSynced: false,
      };
    });
    resolve();
  });
}
