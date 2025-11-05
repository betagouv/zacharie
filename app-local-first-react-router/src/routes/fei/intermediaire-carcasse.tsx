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
    for (const carcasseIntermediaire of carcassesIntermediaires) {
      if (carcasseIntermediaire?.commentaire) {
        const intermediaireEntity = entities[carcasseIntermediaire.intermediaire_entity_id];
        commentaires.push(`${intermediaireEntity?.nom_d_usage}\u00A0: ${carcasseIntermediaire?.commentaire}`);
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities]);

  const formRef = useRef<HTMLFormElement>(null);

  const refusIntermediaireModal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `refus-intermediaire-modal-carcasse-${carcasseIntermediaireId}`,
    }),
  );

  const [carcasseManquante, setCarcasseManquante] = useState(!!carcasse.intermediaire_carcasse_manquante);
  const [carcasseRefusCheckbox, setCarcasseRefusCheckbox] = useState(!!carcasseIntermediaire.refus);
  const [carcasseEcarteePourInspectionCheckbox, setCarcasseEcarteePourInspectionCheckbox] = useState(
    !!carcasseIntermediaire.ecarte_pour_inspection,
  );
  const [refus, setRefus] = useState(
    carcasse.intermediaire_carcasse_refus_motif ?? carcasseIntermediaire.refus ?? '',
  );

  const submitCarcasseManquante = () => {
    setCarcasseManquante(true);
    setCarcasseRefusCheckbox(false);
    setCarcasseEcarteePourInspectionCheckbox(false);
    setRefus('');
    const nextPartialCarcasseIntermediaire = {
      manquante: true,
      refus: null,
      prise_en_charge: false,
      ecarte_pour_inspection: false,
      check_manuel: false,
      decision_at: dayjs().toDate(),
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
    // with custom value for InputForSearchPrefilledData, sometimes the user doesnt press on the blue tag to confirm the refus
    // so we need to get the value from the input directly
    const refusInputValue = (document.getElementsByName('carcasse-refus')?.[0] as HTMLInputElement)?.value;

    if (!refusToRemember && !refus && refus !== refusInputValue) {
      setRefus(refusInputValue);
    }
    if (!refusToRemember) refusToRemember = refus || refusInputValue;

    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: refusToRemember,
      prise_en_charge: false,
      ecarte_pour_inspection: false,
      check_manuel: false,
      decision_at: dayjs().toDate(),
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

    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: null,
      prise_en_charge: false,
      ecarte_pour_inspection: true,
      check_manuel: false,
      decision_at: dayjs().toDate(),
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
    setRefus('');
    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: null,
      prise_en_charge: true,
      ecarte_pour_inspection: false,
      check_manuel: true,
      decision_at: dayjs().toDate(),
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
        onClick={canEdit ? () => refusIntermediaireModal.current.open() : undefined}
        className="[zoom:1.3] [&_.text-manquante]:text-gray-500! [&.border-manquante]:border-gray-500!"
      />
      {canEdit && (
        <refusIntermediaireModal.current.Component
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
                        refusIntermediaireModal.current.close();
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
                              refusIntermediaireModal.current.close();
                              submitCarcasseEcarteePourInspection();
                            },
                            disabled: !canEdit,
                          },
                          label:
                            carcasse.type === CarcasseType.GROS_GIBIER
                              ? 'Carcasse écartée pour inspection'
                              : 'Lot écarté pour inspection',
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
                        refusIntermediaireModal.current.close();
                        submitCarcasseManquante();
                      },
                      disabled: !canEdit,
                    },
                    label: carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse manquante' : 'Lot manquant',
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
                defaultValue: carcasseIntermediaire.intermediaire_poids || '',
                onBlur: (e) => {
                  if (!canEdit) return;
                  const nextPartialCarcasseIntermediaire = {
                    intermediaire_poids: Number(e.target.value),
                  };
                  updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
                  addLog({
                    user_id: user.id,
                    user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
                    fei_numero: fei.numero,
                    action: 'carcasse-intermediaire-poids',
                    history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
                    entity_id: intermediaire.intermediaire_entity_id,
                    zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                    intermediaire_id: intermediaire.id,
                    carcasse_intermediaire_id: carcasseIntermediaireId,
                  });
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
                onBlur: (e) => {
                  if (!canEdit) return;
                  const nextPartialCarcasseIntermediaire = {
                    commentaire: e.target.value,
                  };
                  updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
                  addLog({
                    user_id: user.id,
                    user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
                    fei_numero: fei.numero,
                    action: 'carcasse-intermediaire-commentaire',
                    history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
                    entity_id: intermediaire.intermediaire_entity_id,
                    zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                    intermediaire_id: intermediaire.id,
                    carcasse_intermediaire_id: carcasseIntermediaireId,
                  });
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
                              refusIntermediaireModal.current.close();
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
                              refusIntermediaireModal.current.close();
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
                              refusIntermediaireModal.current.close();
                            },
                          },
                        },
                        // {
                        //   children: 'Fermer',
                        //   priority: 'secondary',
                        //   type: 'button',
                        //   nativeButtonProps: {
                        //     onClick: () => refusIntermediaireModal.current.close(),
                        //   },
                        // },
                      ]
                }
              />
            </div>
          </form>
        </refusIntermediaireModal.current.Component>
      )}
    </>
  );
}
