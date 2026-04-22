import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CarcasseType } from '@prisma/client';
import dayjs from 'dayjs';
import CardCarcasseSvi from '@app/components/CardCarcasseSvi';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import useZustandStore from '@app/zustand/store';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadFei } from '@app/utils/load-fei';
import { loadMyRelations } from '@app/utils/load-my-relations';
import NotFound from '@app/components/NotFound';
import Chargement from '@app/components/Chargement';
import FEIDonneesDeChasse from '@app/routes/fei/donnees-de-chasse';
import Section from '@app/components/Section';
import ItemNotEditable from '@app/components/ItemNotEditable';

export default function SviInspectionCarcasseLoader() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refreshUser('connexion')
      .then(loadMyRelations)
      .then(() => loadFei(params.fei_numero!))
      .then(() => {
        setHasTriedLoading(true);
      })
      .catch((error) => {
        setHasTriedLoading(true);
        console.error(error);
      });
  }, [params.fei_numero]);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <SviInspectionCarcasse key={fei.numero} />;
}

export function SviInspectionCarcasse() {
  const params = useParams();
  const navigate = useNavigate();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcasse = carcasses[params.zacharie_carcasse_id!];
  const carcassesIntermediaires = useCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);
  const entities = useZustandStore((state) => state.entities);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const carcassesIntermediaire of carcassesIntermediaires) {
      if (carcassesIntermediaire?.commentaire) {
        const intermediaireEntity = entities[carcassesIntermediaire.intermediaire_entity_id];
        commentaires.push(
          `${intermediaireEntity?.nom_d_usage}\u00A0: ${carcassesIntermediaire?.commentaire}`
        );
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        {`${carcasse.numero_bracelet} - ${carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot de carcasses de petit gibier' : 'Carcasse de grand gibier'} - Zacharie`}
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">
            {carcasse.numero_bracelet} - {carcasse.espece}
          </h1>
          <Breadcrumb
            className="[&_a]:text-base!"
            currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
            segments={[
              {
                label: 'Fiches',
                linkProps: {
                  to: '/app/etg',
                  href: '#',
                },
              },
              {
                label: fei.numero,
                linkProps: {
                  to: `/app/etg/fei/${fei.numero}`,
                  href: '#',
                },
              },
            ]}
          />
          <Section
            title={`Infos sur la chasse et ${carcasse.type === CarcasseType.PETIT_GIBIER ? 'le lot de carcasses' : 'la carcasse'}`}
            open={false}
          >
            <>
              <FEIDonneesDeChasse carcasseId={carcasse.zacharie_carcasse_id} />
              {carcasse.type === CarcasseType.PETIT_GIBIER && (
                <ItemNotEditable
                  label="Nombre d'animaux initialement prélevés"
                  value={carcasse.nombre_d_animaux!.toString()}
                />
              )}
              <ItemNotEditable
                label="Commentaires des destinataires"
                value={commentairesIntermediaires.join('\n') || 'N/A'}
              />
            </>
          </Section>
          <Section title="Résumé de la décision">
            <CardCarcasseSvi
              carcasse={carcasse}
              canClick={false}
              key={dayjs(carcasse.updated_at).toISOString()}
            />
          </Section>

          <div className="mt-4">
            <Button
              nativeButtonProps={{
                onClick: () => {
                  navigate(-1);
                },
              }}
            >
              Retour
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
