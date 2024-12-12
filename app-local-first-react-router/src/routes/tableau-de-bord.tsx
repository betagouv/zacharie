import { useEffect, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import ResponsiveTable from '@app/components/TableResponsive';
import { getOngoingCellFeiUnderMyResponsability } from '@app/utils/get-ongoing-cell';
import useZustandStore, { syncData } from '@app/zustand/store';
import { getMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getFeisSorted } from '@app/utils/get-fei-sorted';
import { createNewFei } from '@app/utils/create-new-fei';
import { useNavigate } from 'react-router';
import { loadFeis } from '@app/utils/load-feis';
import { loadMyRelations } from '@app/utils/load-my-relations';
import useExportFeis from '@app/utils/export-feis';

async function loadData() {
  await syncData();
  await loadMyRelations();
  await loadFeis();
}

export default function TableauDeBordIndex() {
  const navigate = useNavigate();
  const data = useZustandStore((state) => state);
  const user = getMostFreshUser('tableau de bord index')!;
  const entities = data.entities!;
  const feisDone = data.feisDone!;
  const { feisOngoing, feisToTake, feisUnderMyResponsability } = getFeisSorted();
  const { onExportToXlsx, isExporting } = useExportFeis();
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

  const hackForCounterDoubleEffectInDevMode = useRef(false);
  useEffect(() => {
    if (hackForCounterDoubleEffectInDevMode.current) {
      return;
    }
    hackForCounterDoubleEffectInDevMode.current = true;
    refreshUser('tableau-de-bord').then(loadData);
  }, []);

  useEffect(() => {
    function handleScrollEnd() {
      window.sessionStorage.setItem('tableau-de-bord-scrollY', window.scrollY.toString());
    }
    const savedScrollY = window.sessionStorage.getItem('tableau-de-bord-scrollY');
    if (savedScrollY) {
      window.scrollTo({
        top: parseInt(savedScrollY, 10),
        behavior: 'instant',
      });
    }
    window.addEventListener('scrollend', handleScrollEnd);
    return () => {
      window.removeEventListener('scrollend', handleScrollEnd);
    };
  }, []);

  const [selectedFeis, setSelectedFeis] = useState<string[]>([]);
  const handleCheckboxClick = (id: string) => {
    setSelectedFeis((prev) => {
      if (prev.includes(id)) {
        return prev.filter((fei) => fei !== id);
      }
      return [...prev, id];
    });
  };

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
          <div className="items-center gap-2 my-2 justify-end hidden sm:flex">
            <Button
              onClick={() => {
                onExportToXlsx(selectedFeis);
              }}
              disabled={selectedFeis.length === 0 || isExporting}
            >
              Exporter les fiches sélectionnées dans un fichier Excel
            </Button>
          </div>
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
                    onCheckboxClick={handleCheckboxClick}
                    checkedItemIds={selectedFeis}
                    headers={['Numéro', 'Chasse', 'Carcasses', 'Étape en cours']}
                    data={feisAssigned
                      .filter((fei) => fei !== null)
                      .map((fei) => ({
                        link: `/app/tableau-de-bord/fei/${fei.numero}`,
                        id: fei.numero,
                        isSynced: fei.is_synced,
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
                    onCheckboxClick={handleCheckboxClick}
                    checkedItemIds={selectedFeis}
                    headers={['Numéro', 'Chasse', 'Carcasses', 'Étape en cours']}
                    data={feisOngoing
                      .filter((fei) => fei !== null)
                      .map((fei) => ({
                        link: `/app/tableau-de-bord/fei/${fei.numero}`,
                        id: fei.numero,
                        isSynced: fei.is_synced,
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
            <details
              className="mb-6 bg-white md:shadow open:[&_summary]:md:pb-0"
              open
              // open={window.sessionStorage.getItem('fiches-cloturees-opened') ? true : false}
              // onToggle={() => {
              //   console.log('tottle');
              //   if (window.sessionStorage.getItem('fiches-cloturees-opened')) {
              //     window.sessionStorage.removeItem('fiches-cloturees-opened');
              //   } else {
              //     window.sessionStorage.setItem('fiches-cloturees-opened', 'true');
              //   }
              // }}
            >
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
              <div className="py-2 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
                {feisDone.length ? (
                  <ResponsiveTable
                    onCheckboxClick={handleCheckboxClick}
                    checkedItemIds={selectedFeis}
                    headers={['Numéro', 'Chasse', 'Carcasses', "Transmission au service d'inspection"]}
                    data={feisDone
                      .filter((fei) => fei !== null)
                      .map((fei) => ({
                        link: `/app/tableau-de-bord/fei/${fei.numero}`,
                        id: fei.numero,
                        isSynced: fei.is_synced,
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
                  <p className="m-8">Pas encore de fiche clôturée</p>
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
                      onCheckboxClick={handleCheckboxClick}
                      checkedItemIds={selectedFeis}
                      headers={['Numéro', 'Chasse', 'Carcasses', "RéceptionnéeEnvoyée par l'ETG le"]}
                      data={feiActivesForSvi
                        .filter((fei) => fei !== null)
                        .map((fei) => ({
                          link: `/app/tableau-de-bord/fei/${fei.numero}`,
                          id: fei.numero,
                          isSynced: fei.is_synced,
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
                      onCheckboxClick={handleCheckboxClick}
                      checkedItemIds={selectedFeis}
                      headers={['Numéro', 'Chasse', 'Carcasses', 'Clôturée le']}
                      data={feisDoneForSvi
                        .filter((fei) => fei !== null)
                        .map((fei) => ({
                          link: `/app/tableau-de-bord/fei/${fei.numero}`,
                          id: fei.numero,
                          isSynced: fei.is_synced,
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
