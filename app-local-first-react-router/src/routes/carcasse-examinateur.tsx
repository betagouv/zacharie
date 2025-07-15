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
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
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
import { createHistoryInput } from '@app/utils/create-history-entry';
import InputMultiSelect from '@app/components/InputMultiSelect';

const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

const anomaliesAbatsModal = createModal({
  isOpenedByDefault: false,
  id: 'anomalie-abats-modal-carcasse',
});

const anomaliesCarcasseModal = createModal({
  isOpenedByDefault: false,
  id: 'anomalie-carcasse-modal-carcasse',
});

export default function CarcasseExaminateurLoader() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const carcasse = state.carcasses[params.zacharie_carcasse_id!];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fei || !carcasse) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <CarcasseExaminateur />;
}

function CarcasseExaminateur() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const user = useUser((state) => state.user)!;
  const fei = state.feis[params.fei_numero!];
  const carcasse = state.carcasses[params.zacharie_carcasse_id!];
  const updateStateCarcasse = state.updateCarcasse;
  const addLog = state.addLog;
  const updateCarcasse: typeof updateStateCarcasse = (zacharie_carcasse_id, partialCarcasse) => {
    updateStateCarcasse(zacharie_carcasse_id, partialCarcasse);
    addLog({
      user_id: user.id,
      user_role: UserRoles.EXAMINATEUR_INITIAL,
      fei_numero: fei.numero,
      action: 'examinateur-carcasse-edit',
      history: createHistoryInput(carcasse, partialCarcasse),
      entity_id: null,
      zacharie_carcasse_id,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
  };

  const existingsNumeroBracelet = (state.carcassesIdsByFei[fei.numero] || []).map(
    (zacharie_carcasse_id) => state.carcasses[zacharie_carcasse_id]?.numero_bracelet,
  );
  const [numeroError, setNumeroError] = useState<string | null>(null);

  const navigate = useNavigate();
  const canEdit = useMemo(() => {
    // if (fei.fei_current_owner_role !== UserRoles.EXAMINATEUR_INITIAL) {
    //   return false;
    // }
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
    <>
      <title>
        {`Carcasse ${carcasse.numero_bracelet} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}
      </title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
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
                  label: 'Mes fiches',
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
                className="mb-6 bg-white py-2 md:shadow-sm"
              >
                <div className="p-4 pb-8 md:p-8 md:pb-4">
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
                  <div className="flex justify-end">
                    <Button type="submit">Modifier</Button>
                  </div>
                </div>
              </form>
            )}
            <form
              id="carcasse-metadata-form"
              method="POST"
              ref={formRef}
              className="mb-6 bg-white py-2 md:shadow-sm"
            >
              <div className="p-4 pb-8 md:p-8 md:pb-4">
                {!canEdit && (
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
                )}
                {canEdit ? (
                  <Select
                    label="Sélectionnez l'espèce du gibier"
                    className="group mb-0! grow"
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
                ) : (
                  <InputNotEditable
                    label="Espèce"
                    nativeInputProps={{
                      type: 'text',
                      name: Prisma.CarcasseScalarFieldEnum.espece,
                      defaultValue: carcasse.espece ?? '',
                    }}
                  />
                )}
                <Component
                  label="Nombre de carcasses"
                  className={['mb-0! grow', carcasse.type === CarcasseType.GROS_GIBIER ? 'hidden' : ''].join(
                    ' ',
                  )}
                  hintText="Optionel"
                  nativeInputProps={{
                    type: 'number',
                    min: 0,
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
            </form>
            {espece && (
              <>
                <div className="mb-6 bg-white md:shadow-sm">
                  <div className="p-4 pb-8 md:p-8 md:pb-4">
                    <h3 className="fr-h4 fr-mb-2w">
                      Anomalies carcasse<span className="fr-hint-text"></span>
                    </h3>
                    {canEdit && (
                      <>
                        {/* <div className="mt-2">
                          <Button onClick={() => setAddAnomalieCarcasse(true)} type="button" iconId="ri-add-box-fill">
                            Ajouter une anomalie carcasse
                          </Button>
                        </div> */}
                        {addAnomalieCarcasse && (
                          <>
                            <InputMultiSelect
                              data={referentielAnomaliesCarcasseList}
                              label="Ajouter une nouvelle anomalie"
                              hintText={
                                <button type="button" onClick={() => anomaliesCarcasseModal.open()}>
                                  Voir le référentiel des saisies de carcasse en{' '}
                                  <u className="inline">cliquant ici</u>
                                </button>
                              }
                              canEdit
                              placeholder="Tapez une anomalie carcasse"
                              onChange={(newAnomalies) => {
                                setAnomaliesCarcasse(newAnomalies);
                                updateCarcasse(carcasse.zacharie_carcasse_id, {
                                  examinateur_anomalies_carcasse: newAnomalies,
                                  examinateur_signed_at: dayjs().toDate(),
                                  examinateur_carcasse_sans_anomalie: false,
                                });
                              }}
                              values={anomaliesCarcasse}
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
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {carcasse.type === CarcasseType.GROS_GIBIER && (
                  <div className="mb-6 bg-white md:shadow-sm">
                    <div className="p-4 pb-8 md:p-8 md:pb-4">
                      <h3 className="fr-h4 fr-mb-2w">
                        Anomalies abats<span className="fr-hint-text"></span>
                      </h3>
                      {canEdit && (
                        <>
                          {/* <div className="mt-2">
                          <Button onClick={() => setAddAnomalieAbats(true)} type="button" iconId="ri-add-box-fill">
                            Ajouter une anomalie abats
                          </Button>
                        </div> */}
                          {addAnomalieAbats && (
                            <div className="mt-4">
                              <InputMultiSelect
                                data={grandGibierAbatsList}
                                label="Observations (lésions) *"
                                hintText={
                                  <button type="button" onClick={() => anomaliesAbatsModal.open()}>
                                    Voir le référentiel des saisies d'abats en{' '}
                                    <u className="inline">cliquant ici</u>
                                  </button>
                                }
                                canEdit
                                placeholder="Tapez une anomalie abats"
                                onChange={(newAnomalies) => {
                                  setAnomaliesAbats(newAnomalies);
                                  updateCarcasse(carcasse.zacharie_carcasse_id, {
                                    examinateur_anomalies_abats: newAnomalies,
                                    examinateur_signed_at: dayjs().toDate(),
                                    examinateur_carcasse_sans_anomalie: false,
                                  });
                                }}
                                values={anomaliesAbats}
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
                )}
              </>
            )}
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
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
    </>
  );
}
