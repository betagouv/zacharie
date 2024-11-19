import { useEffect, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { UserRoles } from '@prisma/client';
import type { UserMyRelationsResponse, FeisResponse, FeisDoneResponse } from '@api/src/types/responses';
import type { UserForFei } from '@api/src/types/user';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import dayjs from 'dayjs';
import { useIsOnline } from '@app/components/OfflineMode';
import ResponsiveTable from '@app/components/TableResponsive';
// import { loadFei } from "@app/db/fei.client";
import { getOngoingCellFeiUnderMyResponsability } from '@app/utils/get-ongoing-cell';
import useZustandStore from '@app/zustand/store';
import { getMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getFeisSorted } from '@app/utils/get-fei-sorted';
import { createNewFei } from '@app/utils/create-new-fei';
import { useNavigate } from 'react-router';
import { loadFei } from '@app/utils/load-fei';

async function loadData() {
  console.log('chargement');
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/fei`, {
      method: 'GET',
      credentials: 'include',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    })
      .then((res) => res.json())
      .then((res) => res as FeisResponse);

    if (!response.ok) {
      return;
    }

    const allFeis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires> =
      useZustandStore.getState().feis;
    for (const fei of [
      ...response.data.feisOngoing,
      ...response.data.feisToTake,
      ...response.data.feisUnderMyResponsability,
    ]) {
      allFeis[fei.numero] = fei;
    }

    useZustandStore.setState({ feis: allFeis });

    for (const fei of Object.values(allFeis)) {
      loadFei(fei.numero);
    }

    const responseDone = await fetch(`${import.meta.env.VITE_API_URL}/fei/done`, {
      method: 'GET',
      credentials: 'include',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    })
      .then((res) => res.json())
      .then((res) => res as FeisDoneResponse);

    if (!response.ok) {
      return;
    }

    useZustandStore.setState({
      feisDone: responseDone.data.feisDone,
    });

    // we call myRelations here because
    // even if the data is not used here (it's used within a FEI, so in /api/fei/$fei_numero)
    // we want to cache the data before the user goes to the FEI page
    // for the offline mode to work properly
    const myRelationsData = await fetch(`${import.meta.env.VITE_API_URL}/user/my-relations`, {
      method: 'GET',
      credentials: 'include',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    })
      .then((res) => res.json())
      .then((res) => res as UserMyRelationsResponse);

    const entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation> = {};
    const entitiesIdsWorkingDirectlyFor: Array<EntityWithUserRelation['id']> = [];

    for (const entity of [
      ...(myRelationsData.data?.associationsDeChasse || []),
      ...(myRelationsData.data?.ccgs || []),
      ...(myRelationsData.data?.collecteursPro || []),
      ...(myRelationsData.data?.etgs || []),
      ...(myRelationsData.data?.svis || []),
      ...(myRelationsData.data?.entitiesWorkingFor || []),
    ]) {
      entities[entity.id] = entity;
      if (entity.relation === 'WORKING_FOR') {
        entitiesIdsWorkingDirectlyFor.push(entity.id);
      }
    }

    useZustandStore.setState({ entities, entitiesIdsWorkingDirectlyFor });

    const detenteursInitiaux: Record<UserForFei['id'], UserForFei> = {};

    for (const detenteurInitial of [...(myRelationsData.data?.detenteursInitiaux || [])]) {
      detenteursInitiaux[detenteurInitial.id] = detenteurInitial;
    }

    useZustandStore.setState({ detenteursInitiaux });

    console.log('chargement fini');
  } catch (error) {
    console.error('Error fetching data:', error);
    // If fetch fails (e.g., offline), the service worker will handle serving cached data
    return null;
  }
}

export default function TableauDeBordIndex() {
  const navigate = useNavigate();
  const data = useZustandStore((state) => state);
  const user = getMostFreshUser('tableau de bord index')!;
  const entities = data.entities!;
  const feisDone = data.feisDone!;
  const { feisOngoing, feisToTake, feisUnderMyResponsability } = getFeisSorted();
  const feisAssigned = [...feisUnderMyResponsability, ...feisToTake].sort((a, b) => {
    return b.updated_at < a.updated_at ? -1 : 1;
  });
  const [showBackOnlineRefresh, setShowBackOnlineRefresh] = useState(false);
  const isOnline = useIsOnline(() => {
    setShowBackOnlineRefresh(true);
  });

  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TABLEAU_DE_BORD_OPEN' });
    }
  }, [user]);

  const isOnlySvi =
    user.roles.includes(UserRoles.SVI) && user.roles.filter((r) => r !== UserRoles.ADMIN).length === 1;
  const feiActivesForSvi = feisDone.filter(
    (fei) => !fei!.svi_signed_at && dayjs(fei!.svi_assigned_at).isAfter(dayjs().subtract(10, 'days')),
  );
  const feisDoneForSvi = feisDone.filter(
    (fei) => fei!.svi_signed_at || dayjs(fei!.svi_assigned_at).isBefore(dayjs().subtract(10, 'days')),
  );

  useEffect(() => {
    refreshUser('tableau-de-bord').then(loadData);
  }, []);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Mes fiches | Zacharie | Ministère de l'Agriculture</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          {showBackOnlineRefresh && (
            <button
              className="block bg-action-high-blue-france px-4 py-2 text-sm text-white"
              onClick={() => {
                window.location.reload();
                setShowBackOnlineRefresh(false);
              }}
              type="button"
            >
              Vous êtes de retour en ligne. Cliquez <u>ici</u> pour rafraichir les données.
            </button>
          )}
          <h1 className="fr-h2 fr-mb-2w">Mes fiches d'accompagnement du gibier sauvage</h1>
          {!isOnlySvi && (
            <>
              <section className="mb-6 bg-white md:shadow">
                <div className="p-4 md:p-8 md:pb-0">
                  <h2 className="fr-h3">
                    Fiches à compléter{feisAssigned.length > 0 ? ` (${feisAssigned.length})` : null}
                  </h2>
                </div>
                {feisAssigned.length ? (
                  <ResponsiveTable
                    headers={['Numéro', 'Chasse', 'Carcasses', 'Étape en cours']}
                    data={feisAssigned
                      .filter((fei) => fei !== null)
                      .map((fei) => ({
                        link: `/app/tableau-de-bord/fei/${fei.numero}`,
                        id: fei.numero,
                        rows: [
                          fei.numero!,
                          <>
                            {dayjs(
                              fei.examinateur_initial_date_approbation_mise_sur_le_marche || fei.created_at,
                            ).format('DD/MM/YYYY à HH:mm')}
                            <br />
                            {fei.premier_detenteur_name_cache!}
                            <br />
                            {fei.commune_mise_a_mort!}
                            <br />
                          </>,
                          <>
                            {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                              return (
                                <p className="m-0" key={line}>
                                  {line}
                                </p>
                              );
                            })}
                          </>,
                          <>{getOngoingCellFeiUnderMyResponsability(fei, entities)}</>,
                        ],
                      }))}
                  />
                ) : (
                  <p className="m-8">Pas de fiche assignée</p>
                )}
                <div className="my-4 flex flex-col items-start justify-between gap-4 bg-white px-8">
                  <Button
                    priority="tertiary"
                    iconId="ri-refresh-line"
                    disabled={!isOnline}
                    onClick={loadData}
                  >
                    Mettre à jour
                  </Button>
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                    Haut de page
                  </a>
                </div>
              </section>
              <section className="mb-6 bg-white md:shadow">
                <div className="p-4 md:p-8 md:pb-0">
                  <h2 className="fr-h3">
                    Fiches en cours
                    {feisOngoing.length > 0 ? ` (${feisOngoing.length})` : null}
                  </h2>
                </div>
                {feisOngoing.length ? (
                  <ResponsiveTable
                    headers={['Numéro', 'Chasse', 'Carcasses', 'Étape en cours']}
                    data={feisOngoing
                      .filter((fei) => fei !== null)
                      .map((fei) => ({
                        link: `/app/tableau-de-bord/fei/${fei.numero}`,
                        id: fei.numero,
                        rows: [
                          fei.numero!,
                          <>
                            {dayjs(
                              fei.examinateur_initial_date_approbation_mise_sur_le_marche || fei.created_at,
                            ).format('DD/MM/YYYY à HH:mm')}
                            <br />
                            {fei.premier_detenteur_name_cache!}
                            <br />
                            {fei.commune_mise_a_mort!}
                            <br />
                          </>,
                          <>
                            {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                              return (
                                <p className="m-0" key={line}>
                                  {line}
                                </p>
                              );
                            })}
                          </>,
                          <>{getOngoingCellFeiUnderMyResponsability(fei, entities)}</>,
                        ],
                      }))}
                  />
                ) : (
                  <p className="m-8">Pas de fiche en cours</p>
                )}
                <div className="my-4 flex flex-col items-start justify-between gap-4 bg-white px-8">
                  <Button
                    priority="tertiary"
                    iconId="ri-refresh-line"
                    disabled={!isOnline}
                    onClick={loadData}
                  >
                    Mettre à jour
                  </Button>
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                    Haut de page
                  </a>
                </div>
              </section>
            </>
          )}
          {!isOnlySvi && (
            <details className="mb-6 bg-white md:shadow open:[&_summary]:md:pb-0" open={false}>
              {!isOnline && (
                <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                  Vous ne pouvez pas accéder au détail de vos fiches archivées sans connexion internet.
                </p>
              )}
              <summary className="p-4 md:p-8">
                <h2 className="fr-h3 inline">
                  Fiches clôturées {feisDone.length > 0 ? ` (${feisDone.length})` : null}
                </h2>
              </summary>
              <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
                {feisDone.length ? (
                  <ResponsiveTable
                    headers={['Numéro', 'Chasse', 'Carcasses', "Transmission au service d'inspection"]}
                    data={feisDone
                      .filter((fei) => fei !== null)
                      .map((fei) => ({
                        link: `/app/tableau-de-bord/fei/${fei.numero}`,
                        id: fei.numero,
                        rows: [
                          fei.numero!,
                          <>
                            {dayjs(
                              fei.examinateur_initial_date_approbation_mise_sur_le_marche || fei.created_at,
                            ).format('DD/MM/YYYY à HH:mm')}
                            <br />
                            {fei.premier_detenteur_name_cache!}
                            <br />
                            {fei.commune_mise_a_mort!}
                            <br />
                          </>,
                          <>
                            {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                              return (
                                <p className="m-0" key={line}>
                                  {line}
                                </p>
                              );
                            })}
                          </>,
                          dayjs(fei.svi_assigned_at).format('DD/MM/YYYY à HH:mm'),
                        ],
                      }))}
                  />
                ) : (
                  <>
                    <p className="m-8">Pas encore de fiche clôturée</p>
                  </>
                )}
              </div>
              <div className="my-4 flex flex-col items-start justify-between gap-4 bg-white px-8">
                <Button priority="tertiary" iconId="ri-refresh-line" disabled={!isOnline} onClick={loadData}>
                  Mettre à jour
                </Button>
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                  Haut de page
                </a>
              </div>
            </details>
          )}
          {isOnlySvi && (
            <>
              <section className="mb-6 bg-white md:shadow">
                {!isOnline && (
                  <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                    Vous ne pouvez pas accéder au détail de vos fiches sans connexion internet.
                  </p>
                )}
                <div className="p-4 md:p-8">
                  <h2 className="fr-h3 inline">
                    Fiches sous ma responsabilité{' '}
                    {feiActivesForSvi.length > 0 ? ` (${feiActivesForSvi.length})` : null}
                  </h2>
                </div>
                <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
                  {feiActivesForSvi.length ? (
                    <ResponsiveTable
                      headers={['Numéro', 'Chasse', 'Carcasses', 'Réceptionnée le']}
                      data={feiActivesForSvi
                        .filter((fei) => fei !== null)
                        .map((fei) => ({
                          link: `/app/tableau-de-bord/fei/${fei.numero}`,
                          id: fei.numero,
                          rows: [
                            fei.numero!,
                            <>
                              {dayjs(
                                fei.examinateur_initial_date_approbation_mise_sur_le_marche || fei.created_at,
                              ).format('DD/MM/YYYY à HH:mm')}
                              <br />
                              {fei.premier_detenteur_name_cache!}
                              <br />
                              {fei.commune_mise_a_mort!}
                              <br />
                            </>,
                            <>
                              {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                                return (
                                  <p className="m-0" key={line}>
                                    {line}
                                  </p>
                                );
                              })}
                            </>,
                            dayjs(fei.svi_assigned_at).format('DD/MM/YYYY à HH:mm'),
                          ],
                        }))}
                    />
                  ) : (
                    <>
                      <p className="m-8">Pas encore de fiche clôturée</p>
                    </>
                  )}
                </div>
                <div className="my-4 flex flex-col items-start justify-between gap-4 bg-white px-8">
                  <Button
                    priority="tertiary"
                    iconId="ri-refresh-line"
                    disabled={!isOnline}
                    onClick={loadData}
                  >
                    Mettre à jour
                  </Button>
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                    Haut de page
                  </a>
                </div>
              </section>
              <section className="mb-6 bg-white md:shadow">
                {!isOnline && (
                  <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                    Vous ne pouvez pas accéder au détail de vos fiches sans connexion internet.
                  </p>
                )}
                <div className="p-4 md:p-8">
                  <h2 className="fr-h3 inline">
                    Fiches clôturées {feisDoneForSvi.length > 0 ? ` (${feisDoneForSvi.length})` : null}
                  </h2>
                </div>
                <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
                  {feisDoneForSvi.length ? (
                    <ResponsiveTable
                      headers={['Numéro', 'Chasse', 'Carcasses', 'Clôturée le']}
                      data={feisDoneForSvi
                        .filter((fei) => fei !== null)
                        .map((fei) => ({
                          link: `/app/tableau-de-bord/fei/${fei.numero}`,
                          id: fei.numero,
                          rows: [
                            fei.numero!,
                            <>
                              {dayjs(
                                fei.examinateur_initial_date_approbation_mise_sur_le_marche || fei.created_at,
                              ).format('DD/MM/YYYY à HH:mm')}
                              <br />
                              {fei.premier_detenteur_name_cache!}
                              <br />
                              {fei.commune_mise_a_mort!}
                              <br />
                            </>,
                            <>
                              {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                                return (
                                  <p className="m-0" key={line}>
                                    {line}
                                  </p>
                                );
                              })}
                            </>,
                            dayjs(fei.svi_signed_at).format('DD/MM/YYYY à HH:mm'),
                          ],
                        }))}
                    />
                  ) : (
                    <>
                      <p className="m-8">Pas encore de fiche clôturée</p>
                    </>
                  )}
                </div>
                <div className="my-4 flex flex-col items-start justify-between gap-4 bg-white px-8">
                  <Button
                    priority="tertiary"
                    iconId="ri-refresh-line"
                    disabled={!isOnline}
                    onClick={loadData}
                  >
                    Mettre à jour
                  </Button>
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                    Haut de page
                  </a>
                </div>
              </section>
            </>
          )}
          {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
            <section className="mb-6 bg-white md:shadow">
              <div className="p-4 md:p-8 md:pb-0">
                <h2 className="fr-h3 fr-mb-2w">Nouvelle fiche</h2>
                <p className="fr-text--regular mb-4">Pour créer une nouvelle fiche, c'est par ici 👇</p>
                <div className="flex flex-col items-start bg-white [&_ul]:md:min-w-96">
                  <ButtonsGroup
                    buttons={[
                      {
                        children: 'Nouvelle fiche',
                        nativeButtonProps: {
                          onClick: () => {
                            const newFei = createNewFei();
                            navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
                          },
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
