import { useEffect, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import TableResponsive from '@app/components/TableResponsive';
import { getOngoingCellFeiUnderMyResponsability } from '@app/utils/get-ongoing-cell';
import useZustandStore, { syncData } from '@app/zustand/store';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getFeisSorted } from '@app/utils/get-fei-sorted';
import { createNewFei } from '@app/utils/create-new-fei';
import { useNavigate } from 'react-router';
import { loadFeis } from '@app/utils/load-feis';
import { loadMyRelations } from '@app/utils/load-my-relations';
import useExportFeis from '@app/utils/export-feis';
import { getFeiKeyDates } from '@app/utils/gert-fei-key-dates';
import { useSaveScroll } from '@app/services/useSaveScroll';

async function loadData() {
  await syncData('tableau-de-bord');
  await loadMyRelations();
  await loadFeis();
}

export default function TableauDeBordIndex() {
  const navigate = useNavigate();
  const user = useMostFreshUser('tableau de bord index')!;
  const entities = useZustandStore((state) => state.entities);
  const feisDone = useZustandStore((state) => state.feisDone);
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
  const { feiActivesForSvi, feisDoneForSvi } = feisDone.reduce(
    (acc, fei) => {
      if (fei.automatic_closed_at) {
        acc.feisDoneForSvi.push(fei);
      } else if (fei.svi_signed_at) {
        acc.feisDoneForSvi.push(fei);
      } else if (dayjs(fei!.svi_assigned_at).isBefore(dayjs().subtract(10, 'days'))) {
        acc.feisDoneForSvi.push(fei);
      } else {
        acc.feiActivesForSvi.push(fei);
      }
      return acc;
    },
    {
      feiActivesForSvi: [] as typeof feisDone,
      feisDoneForSvi: [] as typeof feisDone,
    },
  );

  const hackForCounterDoubleEffectInDevMode = useRef(false);
  useEffect(() => {
    if (hackForCounterDoubleEffectInDevMode.current) {
      return;
    }
    hackForCounterDoubleEffectInDevMode.current = true;
    refreshUser('tableau-de-bord').then(loadData);
  }, []);

  useSaveScroll('tableau-de-bord-scrollY');

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
          <div className="items-center gap-2 my-2 justify-end hidden sm:flex">
            <Button
              onClick={() => {
                onExportToXlsx(selectedFeis);
              }}
              disabled={selectedFeis.length === 0 || isExporting}
            >
              Télécharger un fichier Excel avec les fiches sélectionnées
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
                  <TableResponsive
                    onCheckboxClick={handleCheckboxClick}
                    checkedItemIds={selectedFeis}
                    headers={['Chasse', 'Dates clés', 'Carcasses', 'Étape en cours']}
                    data={feisAssigned
                      .filter((fei) => fei !== null)
                      .map((fei) => ({
                        link: `/app/tableau-de-bord/fei/${fei.numero}`,
                        id: fei.numero,
                        isSynced: fei.is_synced,
                        cols: [
                          // fei.numero!,
                          <>
                            {fei.premier_detenteur_name_cache!}
                            <br />
                            {fei.commune_mise_a_mort!}
                          </>,
                          getFeiKeyDates(fei),
                          <>
                            {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                              return (
                                <p className="m-0" key={line}>
                                  {line}
                                </p>
                              );
                            })}
                          </>,
                          getOngoingCellFeiUnderMyResponsability(fei, entities),
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
              {feisOngoing.length > 0 && (
                <section className="mb-6 bg-white md:shadow">
                  <div className="p-4 md:p-8 md:pb-0">
                    <h2 className="fr-h3">
                      Fiches en cours
                      {feisOngoing.length > 0 ? ` (${feisOngoing.length})` : null}
                    </h2>
                  </div>
                  {feisOngoing.length ? (
                    <TableResponsive
                      onCheckboxClick={handleCheckboxClick}
                      checkedItemIds={selectedFeis}
                      headers={['Chasse', 'Dates clés', 'Carcasses', 'Étape en cours']}
                      data={feisOngoing
                        .filter((fei) => fei !== null)
                        .map((fei) => ({
                          link: `/app/tableau-de-bord/fei/${fei.numero}`,
                          id: fei.numero,
                          isSynced: fei.is_synced,
                          cols: [
                            // fei.numero!,
                            <>
                              {fei.premier_detenteur_name_cache!}
                              <br />
                              {fei.commune_mise_a_mort!}
                            </>,
                            getFeiKeyDates(fei),
                            <>
                              {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                                return (
                                  <p className="m-0" key={line}>
                                    {line}
                                  </p>
                                );
                              })}
                            </>,
                            getOngoingCellFeiUnderMyResponsability(fei, entities),
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
              )}
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
                  <TableResponsive
                    onCheckboxClick={handleCheckboxClick}
                    checkedItemIds={selectedFeis}
                    headers={['Chasse', 'Dates clés', 'Carcasses', "Transmission au service d'inspection"]}
                    data={feisDone
                      .filter((fei) => fei !== null)
                      .map((fei) => ({
                        link: `/app/tableau-de-bord/fei/${fei.numero}`,
                        id: fei.numero,
                        isSynced: fei.is_synced,
                        cols: [
                          // fei.numero!,
                          <>
                            {fei.premier_detenteur_name_cache!}
                            <br />
                            {fei.commune_mise_a_mort!}
                          </>,
                          getFeiKeyDates(fei),
                          <>
                            {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                              return (
                                <p className="m-0" key={line}>
                                  {line}
                                </p>
                              );
                            })}
                          </>,
                          fei.svi_assigned_at ? dayjs(fei.svi_assigned_at).format('DD/MM/YYYY à HH:mm') : '',
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
                    <TableResponsive
                      onCheckboxClick={handleCheckboxClick}
                      checkedItemIds={selectedFeis}
                      strongId
                      headers={['Chasse', 'Dates clés', 'Carcasses', "Envoyée par l'ETG le"]}
                      data={feiActivesForSvi
                        .filter((fei) => fei !== null)
                        .map((fei) => ({
                          link: `/app/tableau-de-bord/fei/${fei.numero}`,
                          id: fei.numero,
                          isSynced: fei.is_synced,
                          cols: [
                            <>
                              {fei.premier_detenteur_name_cache!}
                              <br />
                              {fei.commune_mise_a_mort!}
                            </>,
                            getFeiKeyDates(fei),
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
                    <TableResponsive
                      onCheckboxClick={handleCheckboxClick}
                      checkedItemIds={selectedFeis}
                      headers={['Chasse', 'Dates clés', 'Carcasses', 'Clôturée le']}
                      data={feisDoneForSvi
                        .filter((fei) => fei !== null)
                        .map((fei) => ({
                          link: `/app/tableau-de-bord/fei/${fei.numero}`,
                          id: fei.numero,
                          isSynced: fei.is_synced,
                          cols: [
                            // fei.numero!,
                            <>
                              {fei.premier_detenteur_name_cache!}
                              <br />
                              {fei.commune_mise_a_mort!}
                            </>,
                            getFeiKeyDates(fei),
                            <>
                              {fei.resume_nombre_de_carcasses?.split('\n').map((line) => {
                                return (
                                  <p className="m-0" key={line}>
                                    {line}
                                  </p>
                                );
                              })}
                            </>,
                            dayjs(fei.svi_signed_at || fei.automatic_closed_at).format('DD/MM/YYYY à HH:mm'),
                          ],
                        }))}
                    />
                  ) : (
                    <p className="m-8">Pas encore de fiche clôturée</p>
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
        </div>
      </div>
    </div>
  );
}
