import { Fragment, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CarcasseType, Prisma, UserRoles, type Carcasse } from '@prisma/client';
import refusIntermedaire from '@app/data/refus-intermediaire.json';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
// import InputForSearchPrefilledData from '@app/components/InputForSearchPrefilledData';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import useZustandStore from '@app/zustand/store';
import { getFeiAndCarcasseAndIntermediaireIdsFromCarcasse } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiIntermediaire } from '@app/types/fei-intermediaire';
import { createHistoryInput } from '@app/utils/create-history-entry';
import useUser from '@app/zustand/user';
import dayjs from 'dayjs';
import CardCarcasse from '@app/components/CardCarcasse';
import InputMultiSelect from '@app/components/InputMultiSelect';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';

interface CarcasseIntermediaireProps {
  carcasse: Carcasse;
  canEdit: boolean;
  intermediaire: FeiIntermediaire;
}

export default function CarcasseIntermediaireComp({
  carcasse,
  canEdit,
  intermediaire,
}: CarcasseIntermediaireProps) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateCarcasseIntermediaire = useZustandStore((state) => state.updateCarcasseIntermediaire);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);
  const fei = useZustandStore((state) => state.feis[params.fei_numero!]);
  const entities = useZustandStore((state) => state.entities);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const carcasseIntermediaireId = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
    carcasse,
    intermediaire.id,
  );
  const carcasseIntermediaire = carcassesIntermediaireById[carcasseIntermediaireId];
  const getCarcassesIntermediairesForCarcasse = useZustandStore(
    (state) => state.getCarcassesIntermediairesForCarcasse,
  );
  const carcassesIntermediaires = getCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id!);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const _carcasseIntermediaire of carcassesIntermediaires) {
      if (_carcasseIntermediaire.intermediaire_id === carcasseIntermediaire.intermediaire_id) continue;
      if (_carcasseIntermediaire?.commentaire) {
        const intermediaireEntity = entities[_carcasseIntermediaire.intermediaire_entity_id];
        commentaires.push(
          `${intermediaireEntity?.nom_d_usage}\u00A0: ${_carcasseIntermediaire?.commentaire}`,
        );
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities, carcasseIntermediaire]);

  const formRef = useRef<HTMLFormElement>(null);

  const refusIntermediaireModal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `refus-intermediaire-modal-carcasse-${carcasseIntermediaireId}`,
    }),
  ).current;
  const isRefusIntermediaireModalOpen = useIsModalOpen(refusIntermediaireModal);

  const [carcasseManquante, setCarcasseManquante] = useState(!!carcasse.intermediaire_carcasse_manquante);
  const [carcasseRefusCheckbox, setCarcasseRefusCheckbox] = useState(!!carcasseIntermediaire.refus);
  const [carcasseEcarteePourInspectionCheckbox, setCarcasseEcarteePourInspectionCheckbox] = useState(
    !!carcasseIntermediaire.ecarte_pour_inspection,
  );
  const [carcasseAcceptCheckbox, setCarcasseAcceptCheckbox] = useState(
    !!carcasseIntermediaire.check_manuel &&
      !carcasseIntermediaire.refus &&
      !carcasse.intermediaire_carcasse_manquante,
  );
  const [refus, setRefus] = useState(
    carcasse.intermediaire_carcasse_refus_motif ?? carcasseIntermediaire.refus ?? '',
  );
  const [commentaire, setCommentaire] = useState(carcasseIntermediaire.commentaire ?? '');
  const [poids, setPoids] = useState(carcasseIntermediaire.intermediaire_poids ?? '');

  const nombreAnimauxTotal = carcasse.nombre_d_animaux ?? 0;
  // Prioriser la valeur de CarcasseIntermediaire si disponible, sinon celle de Carcasse
  const nombreAnimauxAccepteFromDb = carcasseIntermediaire.nombre_d_animaux_acceptes ?? null;

  // Si le lot est refusé, préremplir avec 0 acceptés
  const isLotRefuse = !!carcasseIntermediaire.refus;
  const [nombreAnimauxAcceptes, setNombreAnimauxAcceptes] = useState<number | null>(
    carcasse.type === CarcasseType.PETIT_GIBIER
      ? isLotRefuse
        ? 0 // Si le lot est refusé, 0 animaux acceptés
        : (nombreAnimauxAccepteFromDb ?? null)
      : null,
  );

  const submitCarcasseManquante = () => {
    setCarcasseManquante(true);
    setCarcasseRefusCheckbox(false);
    setCarcasseEcarteePourInspectionCheckbox(false);
    setCarcasseAcceptCheckbox(false);
    setRefus('');
    const nextPartialCarcasseIntermediaire = {
      manquante: true,
      refus: null,
      prise_en_charge: false,
      ecarte_pour_inspection: false,
      check_manuel: false,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-manquante',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: true,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: intermediaire.id,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-manquante',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const submitCarcasseRefus = (refusToRemember?: string) => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(true);
    setCarcasseEcarteePourInspectionCheckbox(false);
    setCarcasseAcceptCheckbox(false);
    // with custom value for InputForSearchPrefilledData, sometimes the user doesnt press on the blue tag to confirm the refus
    // so we need to get the value from the input directly
    const refusInputValue = (document.getElementsByName('carcasse-refus')?.[0] as HTMLInputElement)?.value;

    if (!refusToRemember && !refus && refus !== refusInputValue) {
      setRefus(refusInputValue);
    }
    if (!refusToRemember) refusToRemember = refus || refusInputValue;

    // Si c'est un petit gibier et que le lot est refusé, préremplir automatiquement à 0 acceptés
    if (carcasse.type === CarcasseType.PETIT_GIBIER && nombreAnimauxTotal > 0) {
      setNombreAnimauxAcceptes(0);
    }

    const nombreAcceptes = carcasse.type === CarcasseType.PETIT_GIBIER ? nombreAnimauxAcceptes : null;
    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: refusToRemember,
      prise_en_charge: false,
      ecarte_pour_inspection: false,
      check_manuel: false,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
      nombre_d_animaux_acceptes: nombreAcceptes,
    };

    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-refus',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: refusToRemember,
      intermediaire_carcasse_refus_intermediaire_id: intermediaire.id,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-refus',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const submitCarcasseEcarteePourInspection = () => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(false);
    setCarcasseEcarteePourInspectionCheckbox(true);
    setCarcasseAcceptCheckbox(false);
    const nombreAcceptes = carcasse.type === CarcasseType.PETIT_GIBIER ? nombreAnimauxAcceptes : null;

    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: null,
      prise_en_charge: false,
      ecarte_pour_inspection: true,
      check_manuel: false,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
      nombre_d_animaux_acceptes: nombreAcceptes,
    };

    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-ecarte-pour-inspection',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-ecarte-pour-inspection',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const submitCarcasseAccept = () => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(false);
    setCarcasseEcarteePourInspectionCheckbox(false);
    setCarcasseAcceptCheckbox(true);
    setRefus('');
    const nombreAcceptes = carcasse.type === CarcasseType.PETIT_GIBIER ? nombreAnimauxAcceptes : null;
    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: null,
      prise_en_charge: true,
      ecarte_pour_inspection: false,
      check_manuel: true,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
      nombre_d_animaux_acceptes: nombreAcceptes,
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-accept',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-accept',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  let commentaireHint = [];
  if (carcasseManquante) {
    commentaireHint.push(`Un commentaire à ajouter\u00A0?`);
  } else {
    commentaireHint.push(
      `Un commentaire à ajouter\u00A0? Une carcasse retirée d'un lot de petit gibier\u00A0? Indiquez le ici et précisez-en les motifs le cas échéant.`,
    );
  }
  if (commentairesIntermediaires.length) {
    commentaireHint.push(``);
    commentaireHint.push(`Commentaires des autres intermédiaires :`);
    commentairesIntermediaires.forEach((commentaire) => {
      commentaireHint.push(`- ${commentaire}`);
    });
  }

  return (
    <>
      <CardCarcasse
        carcasse={carcasse}
        forceRefus={!!refus}
        forceManquante={!!carcasseManquante}
        forceAccept={!!carcasseIntermediaire.check_manuel}
        onClick={canEdit ? () => refusIntermediaireModal.open() : undefined}
        className="[zoom:1.3] [&_.text-manquante]:text-gray-500! [&.border-manquante]:border-gray-500!"
      />
      {canEdit && (
        <refusIntermediaireModal.Component
          title={
            <>
              {carcasse.espece} - N° {carcasse.numero_bracelet}
              <br />
              {commentairesIntermediaires.map((commentaire, index) => {
                return (
                  <p key={commentaire + index} className="mt-2 block text-sm font-normal opacity-70">
                    {commentaire}
                  </p>
                );
              })}
              {!!carcasse.examinateur_anomalies_abats?.length && (
                <p className="mt-2 text-sm">
                  Anomalies abats:
                  <br />
                  {carcasse.examinateur_anomalies_abats.map((anomalie) => {
                    return (
                      <span className="m-0 ml-2 block font-normal opacity-70" key={anomalie}>
                        {anomalie}
                      </span>
                    );
                  })}
                </p>
              )}
              {!!carcasse.examinateur_anomalies_carcasse?.length && (
                <p className="mt-2 text-sm">
                  Anomalies carcasse:
                  <br />
                  {carcasse.examinateur_anomalies_carcasse.map((anomalie) => {
                    return (
                      <span className="m-0 ml-2 block font-normal opacity-70" key={anomalie}>
                        {anomalie}
                      </span>
                    );
                  })}
                </p>
              )}
            </>
          }
        >
          {isRefusIntermediaireModalOpen && (
            <form
              method="POST"
              ref={formRef}
              onSubmit={(e) => e.preventDefault()}
              id={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
            >
              <div className="mt-4">
                <RadioButtons
                  options={[
                    {
                      nativeInputProps: {
                        required: true,
                        name: 'carcasse-status',
                        checked:
                          !carcasseRefusCheckbox &&
                          !carcasseManquante &&
                          (carcasseIntermediaire.check_manuel ? true : false),
                        onChange: () => {
                          refusIntermediaireModal.close();
                          submitCarcasseAccept();
                        },
                        disabled: !canEdit,
                      },
                      label: carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse acceptée' : 'Lot accepté',
                    },
                    {
                      nativeInputProps: {
                        required: true,
                        name: 'carcasse-status',
                        checked: !!carcasseRefusCheckbox && !carcasseManquante,
                        onChange: () => {
                          setCarcasseManquante(false);
                          setCarcasseRefusCheckbox(true);
                          setCarcasseEcarteePourInspectionCheckbox(false);
                        },
                        disabled: !canEdit,
                      },
                      label: carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse refusée' : 'Lot refusé',
                      hintText:
                        carcasse.type === CarcasseType.PETIT_GIBIER
                          ? "Si vous refusez seulement quelques animaux, ne cochez pas cette case, précisez le nombre d'animaux refusés dans le commentaire"
                          : '',
                    },
                    ...(!user.roles.includes(UserRoles.ETG)
                      ? []
                      : [
                          {
                            nativeInputProps: {
                              required: true,
                              name: 'carcasse-status',
                              checked: !!carcasseEcarteePourInspectionCheckbox && !carcasseManquante,
                              onChange: () => {
                                refusIntermediaireModal.close();
                                submitCarcasseEcarteePourInspection();
                              },
                              disabled: !canEdit,
                            },
                            label:
                              carcasse.type === CarcasseType.GROS_GIBIER
                                ? 'Carcasse en peau écartée pour avis du SVI'
                                : 'Lot en plume écarté pour avis du SVI',
                            hintText:
                              carcasse.type === CarcasseType.PETIT_GIBIER
                                ? "Si vous écartez seulement quelques animaux, ne cochez pas cette case, précisez le nombre d'animaux écartés pour inspection dans le commentaire"
                                : '',
                          },
                        ]),
                    {
                      nativeInputProps: {
                        required: true,
                        name: 'carcasse-status',
                        checked: carcasseManquante && !refus,
                        onChange: () => {
                          refusIntermediaireModal.close();
                          submitCarcasseManquante();
                        },
                        disabled: !canEdit,
                      },
                      label:
                        carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse manquante' : 'Lot manquant',
                    },
                  ]}
                />
              </div>
              {!!carcasseRefusCheckbox && (
                <div className="mb-4">
                  <InputMultiSelect
                    label={
                      carcasse.type === CarcasseType.GROS_GIBIER
                        ? 'Vous refusez cette carcasse ? Indiquez le motif *'
                        : 'Vous refusez ce lot ? Indiquez le motif *'
                    }
                    isMulti={false}
                    canEdit
                    data={refusIntermedaire[carcasse.type || CarcasseType.GROS_GIBIER]}
                    placeholder="Tapez un motif de refus"
                    onChange={([refus]) => {
                      setRefus(refus);
                      submitCarcasseRefus(refus);
                    }}
                    values={[refus]}
                    creatable
                  />
                </div>
              )}
              <Input
                label="Poids"
                hintText="En kg, facultatif"
                nativeInputProps={{
                  type: 'number',
                  min: 0,
                  name: Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_poids,
                  form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                  value: poids || '',
                  onChange: (e) => {
                    if (!canEdit) return;
                    setPoids(e.currentTarget.value);
                  },
                }}
              />
              <Input
                label="Votre commentaire"
                className="mt-2"
                hintText={
                  <>
                    {commentaireHint.map((sentence) => (
                      <Fragment key={sentence}>
                        {sentence}
                        <br />
                      </Fragment>
                    ))}
                  </>
                }
                textArea
                nativeTextAreaProps={{
                  name: Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire,
                  form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                  defaultValue: carcasseIntermediaire.commentaire || '',
                  disabled: !canEdit,
                  onChange: (e) => {
                    if (!canEdit) return;
                    setCommentaire(e.currentTarget.value);
                  },
                }}
              />

              <div className="mt-8 flex flex-col items-start bg-white md:[&_ul]:min-w-96">
                <ButtonsGroup
                  buttons={
                    carcasseIntermediaire.refus
                      ? [
                          {
                            children: 'Enregistrer',
                            type: 'submit',
                            disabled: !canEdit,
                            nativeButtonProps: {
                              onClick: (e) => {
                                e.preventDefault();
                                refusIntermediaireModal.close();
                                submitCarcasseRefus();
                              },
                            },
                          },
                          {
                            children: 'Annuler',
                            priority: 'secondary',
                            type: 'button',
                            disabled: !canEdit,
                            nativeButtonProps: {
                              onClick: (e) => {
                                e.preventDefault();
                                refusIntermediaireModal.close();
                                submitCarcasseAccept();
                              },
                            },
                          },
                        ]
                      : [
                          {
                            children: carcasseRefusCheckbox ? 'Refuser' : 'Enregistrer',
                            type: 'submit',
                            disabled: !canEdit,
                            nativeButtonProps: {
                              form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                              disabled: carcasseRefusCheckbox && !refus,
                              onClick: (e) => {
                                console.log('submit refus');
                                e.preventDefault();
                                if (carcasseRefusCheckbox) {
                                  submitCarcasseRefus();
                                }
                                refusIntermediaireModal.close();
                              },
                            },
                          },
                          // {
                          //   children: 'Fermer',
                          //   priority: 'secondary',
                          //   type: 'button',
                          //   nativeButtonProps: {
                          //     onClick: () => refusIntermediaireModal.close(),
                          //   },
                          // },
                        ]
                  }
                />
              </div>
            </form>
          )}
        </refusIntermediaireModal.Component>
      )}
    </>
  );
}
