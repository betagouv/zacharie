import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { CarcasseType, Prisma, UserRoles } from '@prisma/client';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import grandGibierCarcasseList from '@app/data/grand-gibier-carcasse/list.json';
import grandGibierCarcasseTree from '@app/data/grand-gibier-carcasse/tree.json';
import petitGibierCarcasseList from '@app/data/petit-gibier-carcasse/list.json';
import petitGibierCarcasseTree from '@app/data/petit-gibier-carcasse/tree.json';
import grandGibierAbatstree from '@app/data/grand-gibier-abats/tree.json';
import grandGibierAbatsList from '@app/data/grand-gibier-abats/list.json';
import { useEffect, useMemo, useRef, useState } from 'react';
import InputForSearchPrefilledData from '@app/components/InputForSearchPrefilledData';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import { Button } from '@codegouvfr/react-dsfr/Button';
import InputNotEditable from '@app/components/InputNotEditable';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import ModalTreeDisplay from '@app/components/ModalTreeDisplay';
import NotFound from '@app/components/NotFound';
import Chargement from '@app/components/Chargement';
import { useNavigate, useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { loadMyRelations } from '@app/utils/load-my-relations';
import { loadFei } from '@app/utils/load-fei';
import useUser from '@app/zustand/user';
import dayjs from 'dayjs';

const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

// export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
//   const user = await getMostFreshUser();
//   if (!user) {
//     throw redirect(`/app/connexion?type=compte-existant`);
//   }
//   async function get(pathname: string) {
//     return fetch(`${import.meta.env.VITE_API_URL}${pathname}`, {
//       method: "GET",
//       credentials: "include",
//       headers: new Headers({
//         Accept: "application/json",
//         "Content-Type": "application/json",
//       }),
//     }).then((res) => res.json());
//   }

//   const response = (await get(
//     `/api/fei-carcasse/${params.fei_numero}/${params.numero_bracelet}`,
//   )) as CarcasseLoaderData;

//   if (!response?.ok) {
//     throw redirect(`/app/tableau-de-bord/fei/${params.fei_numero}`);
//   }

//   const feiResponse = (await get(`/api/fei/${params.fei_numero}`)) as FeiLoaderData;

//   return json({ carcasse: response.data!.carcasse!, user, fei: feiResponse.data!.fei! });
// }

const anomaliesAbatsModal = createModal({
  isOpenedByDefault: false,
  id: 'anomalie-abats-modal-carcasse',
});

const anomaliesCarcasseModal = createModal({
  isOpenedByDefault: false,
  id: 'anomalie-carcasse-modal-carcasse',
});

export default function CarcasseLoader() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  console.log({ params });
  const carcasse = state.carcasses[params.zacharie_carcasse_id!];
  console.log({ carcasse });
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refreshUser('carcasse')
      .then(loadMyRelations)
      .then(() => loadFei(params.fei_numero!))
      .then(() => {
        setHasTriedLoading(true);
      })
      .catch((error) => {
        setHasTriedLoading(true);
        console.error(error);
      });
  }, []);

  if (!fei || !carcasse) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <CarcasseReadAndWrite />;
}

function CarcasseReadAndWrite() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const user = useUser((state) => state.user)!;
  const fei = state.feis[params.fei_numero!];
  const carcasse = state.carcasses[params.zacharie_carcasse_id!];
  const updateCarcasse = state.updateCarcasse;
  console.log({ params });
  console.log({ carcasse });
  const existingsNumeroBracelet = (state.carcassesIdsByFei[fei.numero] || []).map(
    (zacharie_carcasse_id) => state.carcasses[zacharie_carcasse_id]?.numero_bracelet,
  );
  const [numeroError, setNumeroError] = useState<string | null>(null);

  const navigate = useNavigate();
  const canEdit = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.EXAMINATEUR_INITIAL) {
      return false;
    }
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    // if (fei.examinateur_initial_approbation_mise_sur_le_marche) {
    //   return false;
    // }
    return true;
  }, [fei, user]);

  const Component = canEdit ? Input : InputNotEditable;

  const [espece, setEspece] = useState(carcasse.espece || '');

  const [anomaliesAbats, setAnomaliesAbats] = useState<Array<string>>(
    carcasse.examinateur_anomalies_abats?.filter(Boolean) || [],
  );
  const [anomaliesCarcasse, setAnomaliesCarcasse] = useState<Array<string>>(
    carcasse.examinateur_anomalies_carcasse?.filter(Boolean) || [],
  );
  // const [addAnomalieAbats, setAddAnomalieAbats] = useState(true);
  // const [addAnomalieCarcasse, setAddAnomalieCarcasse] = useState(true);
  const addAnomalieAbats = true;
  const addAnomalieCarcasse = true;
  const [showScroll, setShowScroll] = useState(
    canEdit && espece && !anomaliesAbats.length && !anomaliesCarcasse.length,
  );

  const numeroFormRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLFormElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const referentielAnomaliesCarcasseList =
    carcasse.type === CarcasseType.PETIT_GIBIER ? petitGibierCarcasseList : grandGibierCarcasseList;
  const referentielAnomaliesCarcasseTree =
    carcasse.type === CarcasseType.PETIT_GIBIER ? petitGibierCarcasseTree : grandGibierCarcasseTree;

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
        setShowScroll(false);
      }
    };
    if (showScroll) {
      // on window scroll to bottom, hide the button
      window.addEventListener('scroll', handleScroll);
    }
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showScroll]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot de carcasses' : 'Carcasse'}{' '}
            {carcasse.numero_bracelet}
          </h1>
          <Breadcrumb
            currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
            segments={[
              {
                label: 'Mon tableau de bord',
                linkProps: {
                  to: '/app/tableau-de-bord',
                  href: '#',
                },
              },
              {
                label: fei.numero,
                linkProps: {
                  to: `/app/tableau-de-bord/fei/${fei.numero}`,
                  href: '#',
                },
              },
            ]}
          />
          {canEdit && (
            <form
              id="carcasse-edit-form"
              method="POST"
              ref={numeroFormRef}
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(numeroFormRef.current!);
                const nextNumeroBracelet = formData.get(
                  Prisma.CarcasseScalarFieldEnum.numero_bracelet,
                ) as string;
                if (existingsNumeroBracelet.includes(nextNumeroBracelet)) {
                  setNumeroError('Le numéro de marquage est déjà utilisé pour cette fiche');
                  return;
                }
                setNumeroError(null);
                updateCarcasse(carcasse.zacharie_carcasse_id, {
                  numero_bracelet: formData.get(Prisma.CarcasseScalarFieldEnum.numero_bracelet) as string,
                  examinateur_signed_at: dayjs().toDate(),
                });
              }}
              className="mb-6 bg-white py-2 md:shadow"
            >
              <div className="p-4 pb-8 md:p-8 md:pb-4">
                <div className="fr-fieldset__element">
                  <Input
                    label={
                      carcasse.type === CarcasseType.PETIT_GIBIER
                        ? "Numéro d'identification"
                        : 'Numéro de bracelet'
                    }
                    state={numeroError ? 'error' : 'default'}
                    stateRelatedMessage={numeroError ?? ''}
                    nativeInputProps={{
                      type: 'text',
                      name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
                      defaultValue: carcasse.numero_bracelet,
                    }}
                  />
                </div>
                <div className="fr-fieldset__element m-0 flex justify-end">
                  <Button type="submit">Modifier</Button>
                </div>
              </div>
            </form>
          )}
          <form
            id="carcasse-metadata-form"
            method="POST"
            ref={formRef}
            className="mb-6 bg-white py-2 md:shadow"
          >
            <div className="p-4 pb-8 md:p-8 md:pb-4">
              {!canEdit && (
                <div className="fr-fieldset__element">
                  <InputNotEditable
                    label={
                      carcasse.type === CarcasseType.PETIT_GIBIER
                        ? "Numéro d'identification"
                        : 'Numéro de bracelet'
                    }
                    nativeInputProps={{
                      type: 'text',
                      name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
                      defaultValue: carcasse.numero_bracelet,
                    }}
                  />
                </div>
              )}
              {canEdit ? (
                <div className="fr-fieldset__element">
                  <Select
                    label="Sélectionnez l'espèce du gibier"
                    className="group !mb-0 grow"
                    nativeSelectProps={{
                      name: Prisma.CarcasseScalarFieldEnum.espece,
                      value: espece,
                      disabled: !canEdit,
                      onChange: (e) => {
                        const newEspece = e.currentTarget.value;
                        setEspece(newEspece);
                        updateCarcasse(carcasse.zacharie_carcasse_id, {
                          espece: newEspece,
                          type: petitGibier.especes.includes(espece)
                            ? CarcasseType.PETIT_GIBIER
                            : CarcasseType.GROS_GIBIER,
                          examinateur_signed_at: dayjs().toDate(),
                        });
                      },
                    }}
                  >
                    <option value="">Sélectionnez l'espèce du gibier</option>
                    <hr />
                    {Object.entries(gibierSelect).map(([typeGibier, _especes]) => {
                      return (
                        <optgroup label={typeGibier} key={typeGibier}>
                          {_especes.map((_espece: string) => {
                            return (
                              <option value={_espece} key={_espece}>
                                {_espece}
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })}
                  </Select>
                </div>
              ) : (
                <div className="fr-fieldset__element">
                  <InputNotEditable
                    label="Espèce"
                    nativeInputProps={{
                      type: 'text',
                      name: Prisma.CarcasseScalarFieldEnum.espece,
                      defaultValue: carcasse.espece ?? '',
                    }}
                  />
                </div>
              )}
              <div className={carcasse.type === CarcasseType.GROS_GIBIER ? 'hidden' : 'fr-fieldset__element'}>
                <Component
                  label="Nombre de carcasses"
                  className="!mb-0 grow"
                  hintText="Optionel"
                  nativeInputProps={{
                    type: 'number',
                    name: Prisma.CarcasseScalarFieldEnum.nombre_d_animaux,
                    defaultValue:
                      carcasse.type === CarcasseType.GROS_GIBIER ? '1' : (carcasse.nombre_d_animaux ?? ''),
                    disabled: carcasse.type === CarcasseType.GROS_GIBIER,
                    onChange: (e) => {
                      updateCarcasse(carcasse.zacharie_carcasse_id, {
                        nombre_d_animaux: Number(e.currentTarget.value),
                        examinateur_signed_at: dayjs().toDate(),
                      });
                    },
                  }}
                />
              </div>
            </div>
          </form>
          {espece && (
            <>
              <div className="mb-6 bg-white md:shadow">
                <div className="p-4 pb-8 md:p-8 md:pb-4">
                  <div className="fr-fieldset__element">
                    <h3 className="fr-h4 fr-mb-2w">
                      Anomalies carcasse<span className="fr-hint-text"></span>
                    </h3>
                    <div className="mt-4">
                      {anomaliesCarcasse.map((anomalie, index) => {
                        return (
                          // @ts-expect-error isClosable is of type `true` but we expect `boolean`
                          <Notice
                            className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey p-2 [&_p.fr-notice\\_\\_title]:before:hidden"
                            title={anomalie}
                            isClosable={canEdit}
                            onClose={() => {
                              const nextAnomalies = anomaliesCarcasse
                                .filter((a) => a !== anomalie)
                                .filter(Boolean);
                              setAnomaliesCarcasse(nextAnomalies);
                              updateCarcasse(carcasse.zacharie_carcasse_id, {
                                examinateur_anomalies_carcasse: nextAnomalies,
                                examinateur_signed_at: dayjs().toDate(),
                                examinateur_carcasse_sans_anomalie:
                                  nextAnomalies.length === 0 && !anomaliesAbats.length,
                              });
                            }}
                            key={anomalie + index}
                          />
                        );
                      })}
                      {!anomaliesCarcasse.length && <p className="fr-text--sm">Aucune anomalie carcasse.</p>}
                    </div>
                    {canEdit && (
                      <>
                        {/* <div className="mt-2">
                          <Button onClick={() => setAddAnomalieCarcasse(true)} type="button" iconId="ri-add-box-fill">
                            Ajouter une anomalie carcasse
                          </Button>
                        </div> */}
                        {addAnomalieCarcasse && (
                          <div className="fr-fieldset__element mt-4">
                            <InputForSearchPrefilledData
                              canEdit={canEdit}
                              data={referentielAnomaliesCarcasseList}
                              clearInputOnClick
                              label="Ajouter une nouvelle anomalie"
                              hintText={
                                <button type="button" onClick={() => anomaliesCarcasseModal.open()}>
                                  Voir le référentiel des saisies de carcasse en{' '}
                                  <u className="inline">cliquant ici</u>
                                </button>
                              }
                              hideDataWhenNoSearch
                              onSelect={(newAnomalie) => {
                                // setAddAnomalieCarcasse(false);
                                const nextAnomalies = [...anomaliesCarcasse, newAnomalie].filter(Boolean);
                                setAnomaliesCarcasse(nextAnomalies);
                                updateCarcasse(carcasse.zacharie_carcasse_id, {
                                  examinateur_anomalies_carcasse: nextAnomalies,
                                  examinateur_signed_at: dayjs().toDate(),
                                  examinateur_carcasse_sans_anomalie: false,
                                });
                              }}
                            />
                            <ModalTreeDisplay
                              data={referentielAnomaliesCarcasseTree}
                              modal={anomaliesCarcasseModal}
                              title="Anomalies carcasse"
                              onItemClick={(newAnomalie) => {
                                // setAddAnomalieCarcasse(false);
                                const nextAnomalies = [...anomaliesCarcasse, newAnomalie].filter(Boolean);
                                setAnomaliesCarcasse(nextAnomalies);
                                updateCarcasse(carcasse.zacharie_carcasse_id, {
                                  examinateur_anomalies_carcasse: nextAnomalies,
                                  examinateur_signed_at: dayjs().toDate(),
                                  examinateur_carcasse_sans_anomalie: false,
                                });
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              {carcasse.type === CarcasseType.GROS_GIBIER && (
                <div className="mb-6 bg-white md:shadow">
                  <div className="p-4 pb-8 md:p-8 md:pb-4">
                    <div className="fr-fieldset__element">
                      <h3 className="fr-h4 fr-mb-2w">
                        Anomalies abat<span className="fr-hint-text"></span>
                      </h3>
                      <div className="mt-4">
                        {anomaliesAbats.map((anomalie, index) => {
                          return (
                            // @ts-expect-error isClosable is of type `true` but we expect `boolean`
                            <Notice
                              className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey p-2 [&_p.fr-notice\\_\\_title]:before:hidden"
                              title={anomalie}
                              isClosable={canEdit}
                              onClose={() => {
                                const nextAnomalies = anomaliesAbats
                                  .filter((a) => a !== anomalie)
                                  .filter(Boolean);
                                setAnomaliesAbats(nextAnomalies);
                                updateCarcasse(carcasse.zacharie_carcasse_id, {
                                  examinateur_anomalies_abats: nextAnomalies,
                                  examinateur_signed_at: dayjs().toDate(),
                                  examinateur_carcasse_sans_anomalie:
                                    nextAnomalies.length === 0 && !anomaliesCarcasse.length,
                                });
                              }}
                              key={anomalie + index}
                            />
                          );
                        })}
                        {!anomaliesAbats.length && <p className="fr-text--sm">Aucune anomalie abat.</p>}
                      </div>
                      {canEdit && (
                        <>
                          {/* <div className="mt-2">
                          <Button onClick={() => setAddAnomalieAbats(true)} type="button" iconId="ri-add-box-fill">
                            Ajouter une anomalie abat
                          </Button>
                        </div> */}
                          {addAnomalieAbats && (
                            <div className="fr-fieldset__element mt-4">
                              <InputForSearchPrefilledData
                                data={grandGibierAbatsList}
                                label="Ajouter une nouvelle anomalie"
                                clearInputOnClick
                                hintText={
                                  <button type="button" onClick={() => anomaliesAbatsModal.open()}>
                                    Voir le référentiel des saisies d'abats en{' '}
                                    <u className="inline">cliquant ici</u>
                                  </button>
                                }
                                hideDataWhenNoSearch
                                onSelect={(newAnomalie) => {
                                  // setAddAnomalieAbats(false);
                                  const nextAnomalies = [...anomaliesAbats, newAnomalie].filter(Boolean);
                                  setAnomaliesAbats(nextAnomalies);
                                  updateCarcasse(carcasse.zacharie_carcasse_id, {
                                    examinateur_anomalies_abats: nextAnomalies,
                                    examinateur_signed_at: dayjs().toDate(),
                                    examinateur_carcasse_sans_anomalie: false,
                                  });
                                }}
                              />
                              <ModalTreeDisplay
                                data={grandGibierAbatstree}
                                modal={anomaliesAbatsModal}
                                title="Anomalies abats"
                                onItemClick={(newAnomalie) => {
                                  // setAddAnomalieAbats(false);
                                  const nextAnomalies = [...anomaliesAbats, newAnomalie].filter(Boolean);
                                  setAnomaliesAbats(nextAnomalies);
                                  updateCarcasse(carcasse.zacharie_carcasse_id, {
                                    examinateur_anomalies_abats: nextAnomalies,
                                    examinateur_signed_at: dayjs().toDate(),
                                    examinateur_carcasse_sans_anomalie: false,
                                  });
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
            {showScroll && (
              <div className="w-full p-6 pb-2 md:hidden">
                <button
                  type="button"
                  className="ml-auto block rounded-full bg-white px-4 py-1 shadow-lg"
                  onClick={() => {
                    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
                    setShowScroll(false);
                  }}
                >
                  ⬇️ Anomalies
                </button>
              </div>
            )}
            <form
              className="w-full bg-white p-6 pb-2"
              method="POST"
              id="carcasse-submit-form"
              ref={submitRef}
              onSubmit={(e) => {
                e.preventDefault();
                updateCarcasse(carcasse.zacharie_carcasse_id, {
                  examinateur_signed_at: dayjs().toDate(),
                  examinateur_carcasse_sans_anomalie:
                    anomaliesAbats.length === 0 && anomaliesCarcasse.length === 0,
                });
              }}
            >
              <ButtonsGroup
                buttons={[
                  {
                    children: canEdit ? 'Enregistrer et retourner à la fiche' : 'Retourner à la fiche',
                    type: canEdit ? 'submit' : 'button',
                    nativeButtonProps: {
                      form: 'carcasse-submit-form',
                      onClick: () => {
                        navigate(-1);
                      },
                    },
                  },
                ]}
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
