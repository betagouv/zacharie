import { useEffect, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import useZustandStore, { syncData } from '@app/zustand/store';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getFeisSorted } from '@app/utils/get-fei-sorted';
import { createNewFei } from '@app/utils/create-new-fei';
import { useNavigate } from 'react-router';
import { loadFeis } from '@app/utils/load-feis';
import { loadMyRelations } from '@app/utils/load-my-relations';
import useExportFeis from '@app/utils/export-feis';
import { useSaveScroll } from '@app/services/useSaveScroll';
import Card from '@app/components/Card';

async function loadData() {
  await syncData('tableau-de-bord');
  await loadMyRelations();
  await loadFeis();
}

export default function TableauDeBordIndex() {
  const navigate = useNavigate();
  const user = useMostFreshUser('tableau de bord index')!;
  const feisDoneNumeros = useZustandStore((state) => state.feisDoneNumeros);
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
  const { feiActivesForSvi, feisDoneForSvi } = feisDoneNumeros.reduce(
    (acc, feiNumero) => {
      const fei = feisDone[feiNumero]!;
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
      feiActivesForSvi: [] as Array<(typeof feisDone)[string]>,
      feisDoneForSvi: [] as Array<(typeof feisDone)[string]>,
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
      <title>Mes fiches | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
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

          {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
            <ButtonsGroup
              className="block sm:hidden"
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
          )}
          <div className="my-2 hidden items-center justify-end gap-2 lg:flex">
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
              <section className="mb-6">
                <div className="p-4 md:p-8 md:pb-0">
                  <h2 className="fr-h3">
                    Fiches à compléter{feisAssigned.length > 0 ? ` (${feisAssigned.length})` : null}
                  </h2>
                </div>
                {feisAssigned.length ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {feisAssigned
                      .filter((fei) => fei !== null)
                      .map((fei) => {
                        return (
                          <Card
                            key={fei.numero}
                            fei={fei}
                            onPrintSelect={handleCheckboxClick}
                            isPrintSelected={selectedFeis.includes(fei.numero)}
                          />
                        );
                      })}
                  </div>
                ) : (
                  <p className="flex max-w-96 shrink-0 cursor-pointer flex-col gap-3 rounded border border-gray-200 bg-white bg-none p-6 !no-underline hover:!no-underline">
                    Pas de fiche assignée
                  </p>
                )}
                <div className="my-4 flex flex-col items-start justify-between gap-4 px-8">
                  <Button
                    priority="tertiary"
                    className="bg-white"
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
                <section className="mb-6">
                  <div className="p-4 md:p-8 md:pb-0">
                    <h2 className="fr-h3">
                      Fiches en cours
                      {feisOngoing.length > 0 ? ` (${feisOngoing.length})` : null}
                    </h2>
                  </div>
                  {feisOngoing.length ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {feisOngoing
                        .filter((fei) => fei !== null)
                        .map((fei) => {
                          return (
                            <Card
                              key={fei.numero}
                              fei={fei}
                              onPrintSelect={handleCheckboxClick}
                              isPrintSelected={selectedFeis.includes(fei.numero)}
                            />
                          );
                        })}
                    </div>
                  ) : (
                    <p className="flex max-w-96 shrink-0 cursor-pointer flex-col gap-3 rounded border border-gray-200 bg-white bg-none p-6 !no-underline hover:!no-underline">
                      Pas de fiche en cours
                    </p>
                  )}
                  <div className="my-4 flex flex-col items-start justify-between gap-4 px-8">
                    <Button
                      priority="tertiary"
                      className="bg-white"
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
              className="mb-6 open:[&_summary]:md:pb-0"
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
                  Fiches clôturées {feisDoneNumeros.length > 0 ? ` (${feisDoneNumeros.length})` : null}
                </h2>
              </summary>
              <div className="py-2 md:pb-0 md:pt-2">
                {feisDoneNumeros.length ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {feisDoneNumeros.map((feiNumero) => {
                      const fei = feisDone[feiNumero]!;
                      if (!fei) {
                        return null;
                      }
                      return (
                        <Card
                          key={fei.numero}
                          fei={fei}
                          onPrintSelect={handleCheckboxClick}
                          isPrintSelected={selectedFeis.includes(fei.numero)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="flex max-w-96 shrink-0 cursor-pointer flex-col gap-3 rounded border border-gray-200 bg-white bg-none p-6 !no-underline hover:!no-underline">
                    Pas encore de fiche clôturée
                  </p>
                )}
              </div>
              <div className="my-4 flex flex-col items-start justify-between gap-4 px-8">
                <Button
                  priority="tertiary"
                  className="bg-white"
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
            </details>
          )}
          {isOnlySvi && (
            <>
              <section className="mb-6">
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
                <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2">
                  {feiActivesForSvi.length ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {feiActivesForSvi
                        .filter((fei) => fei !== null)
                        .map((fei) => {
                          return (
                            <Card
                              key={fei.numero}
                              fei={fei}
                              onPrintSelect={handleCheckboxClick}
                              isPrintSelected={selectedFeis.includes(fei.numero)}
                            />
                          );
                        })}
                    </div>
                  ) : (
                    <p className="flex max-w-96 shrink-0 cursor-pointer flex-col gap-3 rounded border border-gray-200 bg-white bg-none p-6 !no-underline hover:!no-underline">
                      Pas encore de fiche clôturée
                    </p>
                  )}
                </div>
                <div className="my-4 flex flex-col items-start justify-between gap-4 px-8">
                  <Button
                    priority="tertiary"
                    className="bg-white"
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
              <section className="mb-6">
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
                <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2">
                  {feisDoneForSvi.length ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {feisDoneForSvi
                        .filter((fei) => fei !== null)
                        .map((fei) => {
                          return (
                            <Card
                              key={fei.numero}
                              fei={fei}
                              onPrintSelect={handleCheckboxClick}
                              isPrintSelected={selectedFeis.includes(fei.numero)}
                            />
                          );
                        })}
                    </div>
                  ) : (
                    <p className="flex max-w-96 shrink-0 cursor-pointer flex-col gap-3 rounded border border-gray-200 bg-white bg-none p-6 !no-underline hover:!no-underline">
                      Pas encore de fiche clôturée
                    </p>
                  )}
                </div>
                <div className="my-4 flex flex-col items-start justify-between gap-4 px-8">
                  <Button
                    priority="tertiary"
                    className="bg-white"
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
