import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { FeiStepSimpleStatus } from '@app/types/fei-steps';
import { EntityRelationType, UserRoles } from '@prisma/client';
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
import useUser from '@app/zustand/user';
import { UserConnexionResponse } from '@api/src/types/responses';

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
  const entities = useZustandStore((state) => state.entities);
  const allEtgIds = useZustandStore((state) => state.etgsIds);
  const { feisOngoing, feisToTake, feisUnderMyResponsability } = getFeisSorted();
  const { onExportToXlsx, isExporting } = useExportFeis();
  const feisAssigned = [...feisUnderMyResponsability, ...feisToTake].sort((a, b) => {
    return b.updated_at < a.updated_at ? -1 : 1;
  });
  const [loading, setLoading] = useState(false);
  const isOnline = useIsOnline();

  useEffect(() => {
    window.onNativePushToken = async function handleNativePushToken(token) {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/${user.id}`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ native_push_token: token }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
        .then((response) => response.json())
        .then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    };
    let timeoutId = setTimeout(() => {
      // if user is activated already, either we just take the latest token,
      // either it's a web user that just installed the app so we need to ask for permission for notifications
      if (user.activated_at) {
        window.ReactNativeWebView?.postMessage('request-native-expo-push-permission');
      }
      clearTimeout(timeoutId);
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TABLEAU_DE_BORD_OPEN' });
    }
  }, [user]);

  const isOnlySvi =
    user.roles.includes(UserRoles.SVI) && user.roles.filter((r) => r !== UserRoles.ADMIN).length === 1;
  const sviWorkingForEtgIds = allEtgIds.filter(
    (id) => entities[id]?.relation === EntityRelationType.WORKING_FOR_ENTITY_RELATED_WITH,
  );
  const { feiActivesForSvi, feisDoneForSvi } = feisDoneNumeros.reduce(
    (acc, feiNumero) => {
      const fei = feisDone[feiNumero]!;
      if (fei.automatic_closed_at) {
        acc.feisDoneForSvi.push(fei);
      } else if (fei.svi_closed_at) {
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
        return 'Filtrer par statut';
      case 'À compléter':
        return 'Fiches à compléter';
      case 'En cours':
        return 'Fiches en cours';
      case 'Clôturée':
        return 'Fiches clôturées';
    }
  }, [filter]);
  const [filterETG, setFilterETG] = useState<string>('');
  const dropDownMenuFilterTextSvi = useMemo(() => {
    if (sviWorkingForEtgIds.includes(filterETG)) {
      return `Fiches de ${entities[filterETG]?.nom_d_usage}`;
    }
    return 'Filtrer par ETG';
  }, [filterETG, sviWorkingForEtgIds, entities]);

  function Actions() {
    return (
      <div className="xs:flex-row relative my-2 flex flex-col items-end justify-end gap-2">
        <Button
          priority="tertiary"
          className="hidden shrink-0 bg-white lg:flex"
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
            className="block shrink-0 lg:hidden"
            onClick={async () => {
              const newFei = await createNewFei();
              navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
            }}
          >
            Nouvelle fiche
          </Button>
        )}
        <DropDownMenu
          text={dropDownMenuFilterText}
          isActive={filter !== 'Toutes les fiches'}
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
        {isOnlySvi && sviWorkingForEtgIds.length > 1 && (
          <DropDownMenu
            text={dropDownMenuFilterTextSvi}
            isActive={filterETG !== 'Toutes les fiches'}
            menuLinks={[
              {
                linkProps: {
                  href: '#',
                  title: 'Toutes les fiches',
                  onClick: (e) => {
                    e.preventDefault();
                    setFilterETG('');
                  },
                },
                text: 'Toutes les fiches',
                isActive: !filterETG,
              },
              ...[...sviWorkingForEtgIds].map((etgId) => ({
                linkProps: {
                  href: '#',
                  title: `Fiches de ${entities[etgId]?.nom_d_usage}`,
                  onClick: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                    e.preventDefault();
                    setFilterETG(etgId);
                  },
                },
                text: `Fiches de ${entities[etgId]?.nom_d_usage}`,
                isActive: filterETG === etgId,
              })),
            ]}
          />
        )}
        <DropDownMenu
          className="hidden lg:block"
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
          <div className="fr-col-12 fr-col-md-10 min-h-96 p-4 md:p-0">
            <Actions />
            {!isOnlySvi && (
              <FeisWrapper>
                {feisAssigned.map((fei) => {
                  if (!fei) return null;
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
                {feisOngoing.map((fei) => {
                  if (!fei) return null;
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
                  if (!fei) return null;
                  return (
                    <CardFiche
                      key={fei.numero}
                      fei={fei}
                      filter={filter}
                      onPrintSelect={handleCheckboxClick}
                      isPrintSelected={selectedFeis.includes(fei.numero)}
                      // disabledBecauseOffline={!isOnline}
                    />
                  );
                })}
              </FeisWrapper>
            )}
            {isOnlySvi && (
              <FeisWrapper>
                {feiActivesForSvi.map((fei) => {
                  if (!fei) return null;
                  console.log(fei.numero, fei.latest_intermediaire_entity_id, filterETG);
                  if (filterETG && fei.latest_intermediaire_entity_id !== filterETG) return null;
                  return (
                    <CardFiche
                      key={fei.numero}
                      fei={fei}
                      filter={filter}
                      onPrintSelect={handleCheckboxClick}
                      isPrintSelected={selectedFeis.includes(fei.numero)}
                      // disabledBecauseOffline={!isOnline}
                    />
                  );
                })}
                {feisDoneForSvi.map((fei) => {
                  if (!fei) return null;
                  console.log(fei.numero, fei.latest_intermediaire_entity_id, filterETG);
                  if (filterETG && fei.latest_intermediaire_entity_id !== filterETG) return null;
                  return (
                    <CardFiche
                      key={fei.numero}
                      fei={fei}
                      filter={filter}
                      onPrintSelect={handleCheckboxClick}
                      isPrintSelected={selectedFeis.includes(fei.numero)}
                      // disabledBecauseOffline={!isOnline}
                    />
                  );
                })}
              </FeisWrapper>
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

function FeisWrapper({ children }: { children: React.ReactNode }) {
  const user = useMostFreshUser('tableau de bord index')!;
  const navigate = useNavigate();
  const nothingToShow =
    !children || (Array.isArray(children) && children.filter((child) => child.length > 0).length === 0);

  if (nothingToShow) {
    return (
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center bg-white p-4 md:p-8">
          <div className="fr-py-0 fr-col-12 fr-col-md-6">
            <h1 className="fr-h4">Vous n'avez pas encore de fiche</h1>
            {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) ? (
              <>
                <p className="fr-text--lead fr-mb-3w lg:hidden">
                  Vous pouvez créer une nouvelle fiche en cliquant sur le bouton ci-dessous.
                </p>
                <Button
                  priority="primary"
                  // on a déjà le bouton de base en mobile, on ne veut pas le dupliquer
                  className="hidden shrink-0 lg:block"
                  onClick={async () => {
                    const newFei = await createNewFei();
                    navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
                  }}
                >
                  Nouvelle fiche
                </Button>
              </>
            ) : (
              <p className="fr-text--lead fr-mb-3w">Veuillez patienter, Zach'arrive&nbsp;!</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
