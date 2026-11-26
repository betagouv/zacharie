import { useParams } from 'react-router';
import dayjs from 'dayjs';
import { Button } from '@codegouvfr/react-dsfr/Button';
import type { CarcasseIntermediaire } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import { useCcgFiches } from '@app/utils/ccg-fiches';
import Section from '@app/components/Section';
import NotFound from '@app/components/NotFound';

const formatDate = (date: Date | string | null | undefined) => (date ? dayjs(date).format('DD/MM/YYYY') : '');
const formatDateTime = (date: Date | string | null | undefined) =>
  date ? dayjs(date).format('DD/MM/YYYY à HH:mm') : '';

export default function CcgFiche({ basePath }: { basePath: string }) {
  const params = useParams();
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const fiche = useCcgFiches().find((ccgFiche) => ccgFiche.fei.numero === params.fei_numero);

  useLoaderEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadData('ccg-fiche');
  }, []);

  if (!fiche) return <NotFound />;
  const { fei, carcasses } = fiche;

  const userName = (userId: string | null | undefined) => {
    const user = userId ? users[userId] : null;
    return user ? `${user.prenom ?? ''} ${user.nom_de_famille ?? ''}`.trim() : '';
  };
  const intermediaireName = (intermediaire: CarcasseIntermediaire) =>
    [
      entities[intermediaire.intermediaire_entity_id]?.nom_d_usage,
      userName(intermediaire.intermediaire_user_id),
    ]
      .filter(Boolean)
      .join(' – ');

  return (
    <>
      <title>{`${fei.numero} | Mes fiches | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="m-4 md:m-0">
          <h1 className="fr-h3 fr-mb-2w">Fiche {fei.numero}</h1>
          <Section title="Données de chasse">
            <dl className="flex flex-col gap-2">
              <div>
                <dt className="font-bold">Date de mise à mort</dt>
                <dd>{formatDate(fei.date_mise_a_mort)}</dd>
              </div>
              <div>
                <dt className="font-bold">Commune de mise à mort</dt>
                <dd>{fei.commune_mise_a_mort}</dd>
              </div>
              <div>
                <dt className="font-bold">Examinateur initial</dt>
                <dd>{userName(fei.examinateur_initial_user_id)}</dd>
              </div>
              <div>
                <dt className="font-bold">Premier détenteur</dt>
                <dd>{fei.premier_detenteur_name_cache}</dd>
              </div>
            </dl>
          </Section>
          <Section
            title={`${carcasses.length > 1 ? 'Carcasses déposées' : 'Carcasse déposée'} dans mes chambres froides (${carcasses.length})`}
          >
            <ul className="flex flex-col gap-4 p-0">
              {carcasses.map(({ carcasse, ccgId, deposeAt, deposant, sortie }) => {
                const anomalies = [
                  ...carcasse.examinateur_anomalies_carcasse,
                  ...carcasse.examinateur_anomalies_abats,
                ];
                return (
                  <li
                    key={carcasse.zacharie_carcasse_id}
                    className="flex list-none flex-col gap-1 bg-white p-4"
                  >
                    <span className="font-bold">
                      {carcasse.espece} – {carcasse.numero_bracelet}
                      {carcasse.nombre_d_animaux && carcasse.nombre_d_animaux > 1
                        ? ` (${carcasse.nombre_d_animaux} animaux)`
                        : ''}
                    </span>
                    {anomalies.length > 0 && <span>Examen initial : {anomalies.join(', ')}</span>}
                    <span>Chambre froide : {entities[ccgId]?.nom_d_usage ?? ''}</span>
                    <span>Dépôt : {deposeAt ? `le ${formatDateTime(deposeAt)}` : 'date non renseignée'}</span>
                    <span>
                      Déposée par :{' '}
                      {deposant ? intermediaireName(deposant) : fei.premier_detenteur_name_cache}
                    </span>
                    {sortie ? (
                      <>
                        <span>
                          Sortie :{' '}
                          {sortie.prise_en_charge_at ? `le ${formatDateTime(sortie.prise_en_charge_at)}` : ''}
                        </span>
                        <span>Sortie par : {intermediaireName(sortie)}</span>
                      </>
                    ) : (
                      <span>Sortie : pas encore sortie de la chambre froide</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
          <div className="m-8 flex flex-col justify-start gap-4">
            <Button
              priority="secondary"
              linkProps={{ to: basePath }}
            >
              Retour aux fiches
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
