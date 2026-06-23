import { CarcasseFieldsTakenFromFei } from '@app/types/carcasse';
import { Fei, Carcasse } from '@prisma/client';

export function mapFeiFieldsToCarcasse(fei: Fei, carcasse: Carcasse): CarcasseFieldsTakenFromFei {
  return {
    date_mise_a_mort: fei.date_mise_a_mort,
    heure_mise_a_mort: carcasse.heure_mise_a_mort,
    heure_evisceration: carcasse.heure_evisceration,
    heure_mise_a_mort_premiere_carcasse_fei: fei.heure_mise_a_mort_premiere_carcasse,
    heure_evisceration_derniere_carcasse_fei: fei.heure_evisceration_derniere_carcasse,
    examinateur_initial_offline: fei.examinateur_initial_offline,
    examinateur_initial_user_id: fei.examinateur_initial_user_id,
    examinateur_initial_approbation_mise_sur_le_marche:
      fei.examinateur_initial_approbation_mise_sur_le_marche,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      fei.examinateur_initial_date_approbation_mise_sur_le_marche,
    consommateur_final_usage_domestique: fei.consommateur_final_usage_domestique,
    premier_detenteur_offline: fei.premier_detenteur_offline,
    premier_detenteur_user_id: fei.premier_detenteur_user_id,
    premier_detenteur_entity_id: fei.premier_detenteur_entity_id,
    premier_detenteur_name_cache: fei.premier_detenteur_name_cache,
  };
}
