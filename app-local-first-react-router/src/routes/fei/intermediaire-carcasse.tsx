import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CarcasseType, Prisma, type Carcasse } from '@prisma/client';
import refusIntermedaire from '@app/data/refus-intermediaire.json';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import InputForSearchPrefilledData from '@app/components/InputForSearchPrefilledData';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import useZustandStore from '@app/zustand/store';
import {
  getFeiAndCarcasseAndIntermediaireIdsFromCarcasse,
  type FeiIntermediaire,
} from '@app/utils/get-carcasse-intermediaire-id';
import { createHistoryInput } from '@app/utils/create-history-entry';
import useUser from '@app/zustand/user';
import dayjs from 'dayjs';
import CardCarcasse from '@app/components/CardCarcasse';

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
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const carcasseIntermediaireId = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
    carcasse,
    intermediaire.id,
  );
  const carcasseIntermediaire = carcassesIntermediaireById[carcasseIntermediaireId];

  const formRef = useRef<HTMLFormElement>(null);

  const refusIntermediaireModal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `refus-intermediaire-modal-carcasse-${carcasseIntermediaireId}`,
    }),
  );

  const [carcasseManquante, setCarcasseManquante] = useState(!!carcasse.intermediaire_carcasse_manquante);
  const [carcasseRefusCheckbox, setCarcasseRefusCheckbox] = useState(!!carcasseIntermediaire.refus);
  const [refus, setRefus] = useState(
    carcasse.intermediaire_carcasse_refus_motif ?? carcasseIntermediaire.refus ?? '',
  );

  const submitCarcasseManquante = () => {
    setCarcasseManquante(true);
    setCarcasseRefusCheckbox(false);
    setRefus('');
    const nextPartialCarcasseIntermediaire = {
      manquante: true,
      refus: null,
      prise_en_charge: false,
      check_manuel: false,
      decision_at: dayjs().toDate(),
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role!,
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
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role!,
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
      check_manuel: false,
      decision_at: dayjs().toDate(),
    };

    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role!,
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
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role!,
      fei_numero: fei.numero,
      action: 'carcasse-refus',
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
    setRefus('');
    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: null,
      prise_en_charge: true,
      check_manuel: true,
      decision_at: dayjs().toDate(),
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role!,
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
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role!,
      fei_numero: fei.numero,
      action: 'carcasse-accept',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  return (
    <>
      <CardCarcasse
        carcasse={carcasse}
        forceRefus={!!refus}
        forceManquante={!!carcasseManquante}
        forceAccept={!!carcasseIntermediaire.check_manuel}
        onClick={canEdit ? () => refusIntermediaireModal.current.open() : undefined}
        className="[zoom:1.3] [&.border-manquante]:!border-gray-500 [&_.text-manquante]:!text-gray-500"
      />
      {canEdit && (
        <refusIntermediaireModal.current.Component
          title={
            <>
              {carcasse.numero_bracelet}
              <br />
              <span className="text-sm">{carcasse.espece}</span>
              <br />
              <span className="text-sm font-normal italic opacity-50">
                {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Petit gibier' : 'Grand gibier'}
              </span>
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
                      },
                      disabled: !canEdit,
                    },
                    label: carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse refusée' : 'Lot refusé',
                  },
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
                <InputForSearchPrefilledData
                  canEdit={canEdit}
                  data={refusIntermedaire}
                  label="Vous refusez cette carcasse ? Indiquez le motif *"
                  hideDataWhenNoSearch={false}
                  required
                  name="carcasse-refus"
                  hintText="Cliquez sur un bouton bleu ciel pour valider le motif"
                  placeholder="Tapez un motif de refus"
                  onSelect={(refus) => {
                    setRefus(refus);
                    submitCarcasseRefus(refus);
                  }}
                  defaultValue={refus ?? ''}
                  key={refus ?? ''}
                />
              </div>
            )}
            <Input
              label="Commentaire"
              className="mt-2"
              hintText={
                carcasseManquante
                  ? `Un commentaire à ajouter\u00A0?`
                  : `Un commentaire à ajouter\u00A0? Une carcasse retirée d'un lot de petit gibier\u00A0? Indiquez le ici et précisez-en les motifs le cas échéant.`
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
                    user_role: intermediaire.intermediaire_role!,
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

            <div className="mt-8 flex flex-col items-start bg-white [&_ul]:md:min-w-96">
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
