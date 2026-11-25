import { useState } from 'react';
import { Link } from 'react-router';
import dayjs from 'dayjs';
import { Select } from '@codegouvfr/react-dsfr/Select';
import useZustandStore from '@app/zustand/store';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import { useCcgFiches } from '@app/utils/ccg-fiches';

// Tableau de bord du propriétaire d'un CCG : les fiches déposées dans son CCG, sans leur devenir.
export default function CcgFiches({ basePath }: { basePath: string }) {
  const ccgEntityIds = useZustandStore((state) => state.ccgEntityIds);
  const entities = useZustandStore((state) => state.entities);
  const fiches = useCcgFiches();
  const [ccgId, setCcgId] = useState('');

  useLoaderEffect(() => {
    loadData('ccg-fiches');
  }, []);

  const shownFiches = ccgId
    ? fiches
        .map((fiche) => ({ ...fiche, carcasses: fiche.carcasses.filter((view) => view.ccgId === ccgId) }))
        .filter((fiche) => fiche.carcasses.length > 0)
    : fiches;

  return (
    <>
      <title>{`Mes CCG | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="m-4 flex flex-col gap-6 md:m-0">
          <h1 className="fr-h3 fr-mb-0">Fiches déposées dans mes CCG</h1>
          {ccgEntityIds.length > 1 && (
            <Select
              label="CCG"
              nativeSelectProps={{ value: ccgId, onChange: (event) => setCcgId(event.target.value) }}
            >
              <option value="">Tous mes CCG</option>
              {ccgEntityIds.map((id) => (
                <option
                  key={id}
                  value={id}
                >
                  {entities[id]?.nom_d_usage ?? id}
                </option>
              ))}
            </Select>
          )}
          {shownFiches.length === 0 ? (
            <p>Aucune fiche n'a été déposée dans vos CCG.</p>
          ) : (
            <ul className="flex flex-col gap-4 p-0">
              {shownFiches.map(({ fei, carcasses }) => (
                <li
                  key={fei.numero}
                  className="list-none bg-white"
                >
                  <Link
                    to={`${basePath}/${fei.numero}`}
                    data-matomo="ccg-fiche-ouvrir"
                    className="flex flex-col gap-1 bg-none! p-4 no-underline!"
                  >
                    <span className="font-bold">{fei.numero}</span>
                    <span>
                      {fei.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY') : ''}
                      {fei.commune_mise_a_mort ? ` · ${fei.commune_mise_a_mort}` : ''}
                    </span>
                    {fei.premier_detenteur_name_cache && (
                      <span>Premier détenteur : {fei.premier_detenteur_name_cache}</span>
                    )}
                    <span>
                      {carcasses.length} carcasse{carcasses.length > 1 ? 's' : ''} déposée
                      {carcasses.length > 1 ? 's' : ''} dans{' '}
                      {[...new Set(carcasses.map((view) => entities[view.ccgId]?.nom_d_usage ?? 'le CCG'))].join(
                        ', '
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
