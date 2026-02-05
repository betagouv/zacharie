import { FeiWithIntermediaires } from '@api/src/types/fei';
import { Fei } from '@prisma/client';
import dayjs from 'dayjs';

export function getFeiKeyDates(fei: FeiWithIntermediaires | Fei) {
  return (
    <>
      Mise à mort&nbsp;:
      <br />
      <span className="ml-4">
        {fei.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY') : 'À remplir'}
      </span>
      <br />
      Dernière éviscération&nbsp;:
      <br />
      <span className="ml-4">{fei.heure_evisceration_derniere_carcasse ?? 'À remplir'}</span>
      <br />
      Fin examen initial&nbsp;:
      <br />
      <span className="ml-4">
        {fei.examinateur_initial_date_approbation_mise_sur_le_marche
          ? dayjs(fei.examinateur_initial_date_approbation_mise_sur_le_marche).format('DD/MM/YYYY à HH:mm')
          : 'À remplir'}
      </span>
      <br />
      Dépôt en chambre froide&nbsp;:
      <br />
      <span className="ml-4">
        {fei.premier_detenteur_depot_ccg_at ? (
          <>{dayjs(fei.premier_detenteur_depot_ccg_at).format('DD/MM/YYYY à HH:mm')}</>
        ) : (
          '/'
        )}
      </span>
    </>
  );
}
