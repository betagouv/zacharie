import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { loadFei } from '@app/utils/load-fei';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadMyRelations } from '@app/utils/load-my-relations';
import Chargement from '@app/components/Chargement';
import NotFound from '@app/components/NotFound';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';
import FEIDonneesDeChasse from './donnees-de-chasse';
import { sortCarcassesApproved } from '@app/utils/sort';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import dayjs from 'dayjs';

export default function FeiReadOnlyLoader() {
  const params = useParams();
  const feisUpcomingForSvi = useZustandStore((state) => state.feisUpcomingForSvi);
  const feis = useZustandStore((state) => state.feis);
  // Check if FEI is in feis first (where loadFei stores it), then fall back to feisUpcomingForSvi
  const fei = feis[params.fei_numero!] || feisUpcomingForSvi[params.fei_numero!];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <FeiReadOnly key={fei.numero} />;
}

function FeiReadOnly() {
  const params = useParams();
  const feisUpcomingForSvi = useZustandStore((state) => state.feisUpcomingForSvi);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!] || feisUpcomingForSvi[params.fei_numero!];

  const carcasses = useZustandStore((state) => state.carcasses);
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const entities = useZustandStore((state) => state.entities);

  const allCarcassesForFei = useMemo(
    () =>
      (carcassesIdsByFei[params.fei_numero!] || [])
        .map((cId) => carcasses[cId])
        .filter((carcasse) => carcasse && !carcasse.deleted_at)
        .sort(sortCarcassesApproved),
    [carcassesIdsByFei, params.fei_numero, carcasses],
  );

  const carcassesDejaRefusees = useMemo(
    () => allCarcassesForFei.filter((c) => !!c.intermediaire_carcasse_refus_intermediaire_id),
    [allCarcassesForFei],
  );

  const carcassesAAfficher = useMemo(
    () => allCarcassesForFei.filter((c) => !c.intermediaire_carcasse_refus_intermediaire_id),
    [allCarcassesForFei],
  );

  const [showRefusedCarcasses, setShowRefusedCarcasses] = useState(false);

  // Get the ETG entity name
  const etgEntity = fei?.fei_current_owner_entity_id ? entities[fei.fei_current_owner_entity_id] : null;

  // Guard against missing FEI data
  if (!fei) {
    return <Chargement />;
  }

  return (
    <>
      <title>
        {`${params.fei_numero} (À venir) | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}
      </title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 bg-alt-blue-france m-4 md:m-0 md:p-0">
            <div className="flex items-center gap-4 p-4 md:p-8">
              <h1 className="fr-h3 m-0">Fiche {fei?.numero}</h1>
              <Tag
                small
                className="items-center rounded-[4px] bg-[#C3FAD5] font-semibold uppercase text-[#18753C]"
              >
                À venir
              </Tag>
            </div>

            <Alert
              severity="info"
              className="mb-4 bg-white"
              title="Fiche en prévisualisation"
              description={
                <>
                  Cette fiche est actuellement en cours de traitement par{' '}
                  <strong>{etgEntity?.nom_d_usage || "l'ETG"}</strong>. Elle sera assignée à votre
                  service lorsque l'ETG aura terminé le traitement des carcasses.
                  <br />
                  <span className="text-sm text-gray-600">
                    Dernière mise à jour : {dayjs(fei.updated_at).format('DD/MM/YYYY à HH:mm')}
                  </span>
                </>
              }
            />

            <Section open title="Données de chasse">
              <FEIDonneesDeChasse />
            </Section>

            <Section title={`Carcasses (${carcassesAAfficher.length})`}>
              {carcassesAAfficher.length === 0 ? (
                <p className="text-gray-600">Aucune carcasse enregistrée pour le moment.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {carcassesAAfficher.map((carcasse) => {
                    return <CardCarcasse key={carcasse.numero_bracelet} carcasse={carcasse} />;
                  })}
                </div>
              )}
              {carcassesDejaRefusees.length > 0 && (
                <div className="my-8 flex justify-center">
                  <Button
                    onClick={() => {
                      setShowRefusedCarcasses(!showRefusedCarcasses);
                    }}
                    priority="secondary"
                  >
                    {showRefusedCarcasses ? 'Masquer' : 'Afficher'} les carcasses déjà refusées (
                    {carcassesDejaRefusees.length})
                  </Button>
                </div>
              )}
              {showRefusedCarcasses && (
                <div className="flex flex-col gap-4">
                  {carcassesDejaRefusees.map((carcasse) => {
                    return <CardCarcasse carcasse={carcasse} key={carcasse.numero_bracelet} />;
                  })}
                </div>
              )}
            </Section>

            <div className="m-8 flex flex-col justify-start gap-4">
              <Button
                linkProps={{
                  to: `/app/tableau-de-bord/`,
                }}
              >
                Voir toutes mes fiches
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
