import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { FeiStepSimpleStatus } from '@app/types/fei-steps';
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
import CardFiche from '@app/components/CardFiche';
import DropDownMenu from '@app/components/DropDownMenu';

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
  const [loading, setLoading] = useState(false);
  const isOnline = useIsOnline();

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

  const [filter, setFilter] = useState<FeiStepSimpleStatus | 'Toutes les fiches'>('Toutes les fiches');
  const dropDownMenuFilterText = useMemo(() => {
    switch (filter) {
      case 'Toutes les fiches':
      default:
        return 'Filtrer';
      case 'À compléter':
        return 'Fiches à compléter';
      case 'En cours':
        return 'Fiches en cours';
      case 'Clôturée':
        return 'Fiches clôturées';
    }
  }, [filter]);

  function Actions() {
    return (
      <div className="relative my-2 flex items-center justify-end gap-2">
        <Button
          priority="tertiary"
          className="bg-white"
          iconId="ri-refresh-line"
          disabled={!isOnline || loading}
          onClick={async () => {
            setLoading(true);
            await loadData();
            setLoading(false);
          }}
        >
          Mettre à jour
        </Button>
        {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
          <Button
            priority="primary"
            className="block lg:hidden"
            onClick={() => {
              const newFei = createNewFei();
              navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
            }}
          >
            Nouvelle fiche
          </Button>
        )}
        <DropDownMenu
          text={dropDownMenuFilterText}
          isActive={selectedFeis.length > 0}
          menuLinks={[
            {
              linkProps: {
                href: '#',
                title: 'Toutes les fiches',
                onClick: (e) => {
                  e.preventDefault();
                  setFilter('Toutes les fiches');
                },
              },
              text: 'Toutes les fiches',
              isActive: filter === 'Toutes les fiches',
            },
            {
              linkProps: {
                href: '#',
                title: 'Fiches à compléter',
                onClick: (e) => {
                  e.preventDefault();
                  setFilter('À compléter');
                },
              },
              text: 'Fiches à compléter',
              isActive: filter === 'À compléter',
            },
            {
              linkProps: {
                href: '#',
                title: 'Fiches en cours',
                onClick: (e) => {
                  e.preventDefault();
                  setFilter('En cours');
                },
              },
              text: 'Fiches en cours',
              isActive: filter === 'En cours',
            },
            {
              linkProps: {
                href: '#',
                title: 'Fiches à compléter',
                onClick: (e) => {
                  e.preventDefault();
                  setFilter('Clôturée');
                },
              },
              text: 'Fiches clôturées',
              isActive: filter === 'Clôturée',
            },
          ]}
        />
        <DropDownMenu
          text="Action sur les fiches sélectionnées"
          isActive={selectedFeis.length > 0}
          menuLinks={[
            {
              linkProps: {
                href: '#',
                'aria-disabled': selectedFeis.length === 0,
                className: isExporting || !selectedFeis.length ? 'cursor-not-allowed opacity-50' : '',
                title:
                  selectedFeis.length === 0
                    ? 'Sélectionnez des fiches avec la case à cocher en haut à droite de chaque carte'
                    : '',
                onClick: (e) => {
                  e.preventDefault();
                  if (selectedFeis.length === 0) return;
                  if (isExporting) return;
                  onExportToXlsx(selectedFeis);
                },
              },
              text: 'Télécharger un fichier Excel avec les fiches sélectionnées',
            },
          ]}
        />
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-0 z-30 w-full bg-white shadow-md">
        <div className="fr-container mx-auto">
          <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
            <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
              <Actions />
            </div>
          </div>
        </div>
      </div>
      <div className="fr-container fr-container--fluid">
        <title>Mes fiches | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center pt-4">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Actions />
            {!isOnlySvi && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {feisAssigned
                  .filter((fei) => fei !== null)
                  .map((fei) => {
                    return (
                      <CardFiche
                        key={fei.numero}
                        fei={fei}
                        filter={filter}
                        onPrintSelect={handleCheckboxClick}
                        isPrintSelected={selectedFeis.includes(fei.numero)}
                      />
                    );
                  })}
                {feisOngoing
                  .filter((fei) => fei !== null)
                  .map((fei) => {
                    return (
                      <CardFiche
                        key={fei.numero}
                        fei={fei}
                        filter={filter}
                        onPrintSelect={handleCheckboxClick}
                        isPrintSelected={selectedFeis.includes(fei.numero)}
                      />
                    );
                  })}

                {feisDoneNumeros.map((feiNumero) => {
                  const fei = feisDone[feiNumero]!;
                  if (!fei) {
                    return null;
                  }
                  return (
                    <CardFiche
                      key={fei.numero}
                      fei={fei}
                      filter={filter}
                      onPrintSelect={handleCheckboxClick}
                      isPrintSelected={selectedFeis.includes(fei.numero)}
                      disabledBecauseOffline={!isOnline}
                    />
                  );
                })}
              </div>
            )}
            {isOnlySvi && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {feiActivesForSvi
                  .filter((fei) => fei !== null)
                  .map((fei) => {
                    return (
                      <CardFiche
                        key={fei.numero}
                        fei={fei}
                        filter={filter}
                        onPrintSelect={handleCheckboxClick}
                        isPrintSelected={selectedFeis.includes(fei.numero)}
                        disabledBecauseOffline={!isOnline}
                      />
                    );
                  })}
                {feisDoneForSvi
                  .filter((fei) => fei !== null)
                  .map((fei) => {
                    return (
                      <CardFiche
                        key={fei.numero}
                        fei={fei}
                        filter={filter}
                        onPrintSelect={handleCheckboxClick}
                        isPrintSelected={selectedFeis.includes(fei.numero)}
                        disabledBecauseOffline={!isOnline}
                      />
                    );
                  })}
              </div>
            )}
            <div className="my-4 flex flex-col items-start justify-between gap-4 px-8">
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
