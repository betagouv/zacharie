import { useMemo } from 'react';
import CardTransmission from '@app/components/CardTransmission';
import FichesEmptyState from '@app/components/FichesEmptyState';
import { ChasseIcon } from '@app/assets/svg/ChasseIcon';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import { sortTransmissions, useTransmissions } from '@app/utils/get-transmissions-sorted';

// fédération : seulement les fiches des CCG dont l'utilisateur est propriétaire
export default function CcgFiches({ basePath }: { basePath: string }) {
  const transmissions = useTransmissions();
  const sortedTransmissions = useMemo(
    () => Object.values(transmissions).sort(sortTransmissions),
    [transmissions]
  );

  useLoaderEffect(() => {
    loadData('ccg-fiches');
  }, []);

  return (
    <>
      <title>{`Mes fiches | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="m-4 md:m-0">
          {sortedTransmissions.length === 0 ? (
            <FichesEmptyState
              title="Pas encore de fiches"
              description="Les fiches déposées dans vos CCG apparaîtront ici."
            />
          ) : (
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTransmissions.map((transmission) => (
                <CardTransmission
                  key={
                    transmission.fei.numero +
                    transmission.content.premier_detenteur_prochain_detenteur_id_cache
                  }
                  transmission={transmission}
                  filter="Toutes les fiches"
                  linkTo={`${basePath}/${transmission.fei.numero}`}
                  detenteurName={transmission.content.premier_detenteur_name_cache ?? null}
                  detenteurIcon={<ChasseIcon />}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
