import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CarcasseType, Prisma, type Carcasse, type FeiIntermediaire } from '@prisma/client';
import refusIntermedaire from '@app/data/refus-intermediaire.json';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import InputForSearchPrefilledData from '@app/components/InputForSearchPrefilledData';
import { CustomNotice } from '@app/components/CustomNotice';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import useZustandStore from '@app/zustand/store';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import { createHistoryInput } from '@app/utils/create-history-entry';
import useUser from '@app/zustand/user';
import dayjs from 'dayjs';

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
  const state = useZustandStore((state) => state);
  const updateCarcasseIntermediaire = state.updateCarcasseIntermediaire;
  const updateCarcasse = state.updateCarcasse;
  const addLog = state.addLog;
  const fei = state.feis[params.fei_numero!];
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

  const formRef = useRef<HTMLFormElement>(null);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const _intermediaire of intermediaires) {
      const carcasseIntermediaireId = getCarcasseIntermediaireId(
        fei.numero,
        carcasse.numero_bracelet,
        _intermediaire.id,
      );
      const _carcasseIntermediaire = state.carcassesIntermediaires[carcasseIntermediaireId];
      const _intermediaireEntity = state.entities[_intermediaire.fei_intermediaire_entity_id];
      if (_carcasseIntermediaire?.commentaire) {
        commentaires.push(
          `Commentaire de ${_intermediaireEntity?.nom_d_usage} : ${_carcasseIntermediaire?.commentaire}`,
        );
      }
    }
    return commentaires;
  }, [intermediaires, fei.numero, carcasse.numero_bracelet, state.carcassesIntermediaires, state.entities]);

  const carcasseIntermediaireId = getCarcasseIntermediaireId(
    fei.numero,
    carcasse.numero_bracelet,
    intermediaire.id,
  );

  const intermediaireCarcasse = state.carcassesIntermediaires[carcasseIntermediaireId];

  const refusIntermediaireModal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `refus-intermediaire-modal-carcasse-${intermediaireCarcasse.fei_numero__bracelet__intermediaire_id}`,
    }),
  );

  const [carcasseManquante, setCarcasseManquante] = useState(!!carcasse.intermediaire_carcasse_manquante);
  const [carcasseRefusCheckbox, setCarcasseRefusCheckbox] = useState(!!intermediaireCarcasse.refus);
  const [refus, setRefus] = useState(
    carcasse.intermediaire_carcasse_refus_motif ?? intermediaireCarcasse.refus ?? '',
  );

  const Component = canEdit ? 'button' : 'div';

  const submitCarcasseManquante = () => {
    setCarcasseManquante(true);
    setCarcasseRefusCheckbox(false);
    setRefus('');
    const nextPartialCarcasseIntermediaire = {
      manquante: true,
      refus: null,
      prise_en_charge: false,
      check_manuel: false,
      carcasse_check_finished_at: dayjs().toDate(),
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.fei_intermediaire_role!,
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-manquante',
      history: createHistoryInput(intermediaireCarcasse, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.fei_intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      fei_intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse = {
      intermediaire_carcasse_manquante: true,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: intermediaire.id,
      intermediaire_carcasse_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
    addLog({
      user_id: user.id,
      user_role: intermediaire.fei_intermediaire_role!,
      fei_numero: fei.numero,
      action: 'carcasse-manquante',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.fei_intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      fei_intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const submitCarcasseRefus = (refusToRemember?: string) => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(true);
    // with custom value for InputForSearchPrefilledData, sometimes the user doesnt press on the blue tag to confirm the refus
    // so we need to get the value from the input directly
    const refusInputValue = (document.getElementsByName('carcasse-refus')?.[0] as HTMLInputElement)?.value;

    if (!refus && refus !== refusInputValue) {
      setRefus(refusInputValue);
    }
    if (!refusToRemember) refusToRemember = refus || refusInputValue;
    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: refusToRemember,
      prise_en_charge: false,
      check_manuel: false,
      carcasse_check_finished_at: dayjs().toDate(),
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.fei_intermediaire_role!,
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-refus',
      history: createHistoryInput(intermediaireCarcasse, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.fei_intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      fei_intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: refusToRemember,
      intermediaire_carcasse_refus_intermediaire_id: intermediaire.id,
      intermediaire_carcasse_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
    addLog({
      user_id: user.id,
      user_role: intermediaire.fei_intermediaire_role!,
      fei_numero: fei.numero,
      action: 'carcasse-refus',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.fei_intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      fei_intermediaire_id: intermediaire.id,
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
      carcasse_check_finished_at: dayjs().toDate(),
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.fei_intermediaire_role!,
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-accept',
      history: createHistoryInput(intermediaireCarcasse, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.fei_intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      fei_intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      intermediaire_carcasse_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
    addLog({
      user_id: user.id,
      user_role: intermediaire.fei_intermediaire_role!,
      fei_numero: fei.numero,
      action: 'carcasse-accept',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.fei_intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      fei_intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  return (
    <div
      key={carcasse.numero_bracelet}
      className={[
        'mb-2 border-4 border-transparent',
        !!refus && '!border-red-500',
        carcasseManquante && '!border-red-300',
        intermediaireCarcasse.check_manuel && '!border-action-high-blue-france',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CustomNotice
        key={carcasse.numero_bracelet}
        className={[
          carcasse.type === CarcasseType.PETIT_GIBIER &&
          !refus &&
          !carcasseManquante &&
          !intermediaireCarcasse.check_manuel
            ? '!bg-gray-300'
            : '',
          !!refus && ' !bg-red-500 text-white',
          carcasseManquante && ' !bg-red-300 text-white',
          !!intermediaireCarcasse.check_manuel && '!bg-action-high-blue-france text-white',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Component
          className="block w-full p-8 text-left [&_*]:no-underline [&_*]:hover:no-underline"
          type={canEdit ? 'button' : undefined}
          onClick={canEdit ? () => refusIntermediaireModal.current.open() : undefined}
        >
          <span className="block font-bold text-3xl mb-4">
            {/* {carcasse.type === CarcasseType.PETIT_GIBIER ? "Numéro d'identification" : 'Numéro de bracelet'} */}
            {/* &nbsp;: <span className="whitespace-nowrap">{carcasse.numero_bracelet}</span> */}
            {carcasse.numero_bracelet}
          </span>
          <span className="block font-bold text-2xl">
            {carcasse.espece}
            {carcasse.categorie && ` - ${carcasse.categorie}`}
          </span>
          <span className="block text-sm font-normal italic opacity-50">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Petit gibier' : 'Grand gibier'}
          </span>
          {carcasse.type === CarcasseType.PETIT_GIBIER && (
            <span className="block font-normal">
              Nombre de carcasses dans le lot&nbsp;: {carcasse.nombre_d_animaux || 'À REMPLIR'}
            </span>
          )}

          {carcasse.heure_evisceration && (
            <span className="block font-normal">
              Éviscération&nbsp;: {carcasse.heure_evisceration || 'À REMPLIR'}
            </span>
          )}
          {!!carcasse.examinateur_anomalies_abats?.length && (
            <>
              <br />
              <span className="m-0 block font-bold">Anomalies abats:</span>
              {carcasse.examinateur_anomalies_abats.map((anomalie) => {
                return (
                  <span className="m-0 ml-2 block font-bold" key={anomalie}>
                    {anomalie}
                  </span>
                );
              })}
            </>
          )}
          {!!carcasse.examinateur_anomalies_carcasse?.length && (
            <>
              <br />
              <span className="m-0 block font-bold">Anomalies carcasse:</span>
              {carcasse.examinateur_anomalies_carcasse.map((anomalie) => {
                return (
                  <span className="m-0 ml-2 block font-bold" key={anomalie}>
                    {anomalie}
                  </span>
                );
              })}
            </>
          )}
          {commentairesIntermediaires.map((commentaire, index) => {
            return (
              <span key={commentaire + index} className="mt-2 block font-normal">
                {commentaire}
              </span>
            );
          })}
          {carcasse.intermediaire_carcasse_manquante && (
            <span className="ml-4 mt-4 block font-bold">
              {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot manquant' : 'Carcasse manquante'}
            </span>
          )}
          {intermediaireCarcasse.check_manuel && (
            <span className="ml-4 mt-4 block font-bold">
              {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot accepté' : 'Carcasse acceptée'}
            </span>
          )}
          {intermediaireCarcasse.refus && (
            <span className="ml-4 mt-4 block font-bold">
              {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot refusé' : 'Carcasse refusée'}
            </span>
          )}
          {!!intermediaireCarcasse.refus && (
            <span className="mt-2 block font-normal">
              Motif de refus&nbsp;: {intermediaireCarcasse.refus}
            </span>
          )}
        </Component>
      </CustomNotice>
      {canEdit && (
        <refusIntermediaireModal.current.Component
          title={
            <>
              {carcasse.numero_bracelet}
              <br />
              <span className="text-sm">
                {carcasse.espece}
                {carcasse.categorie && ` - ${carcasse.categorie}`}
              </span>
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
                      checked: intermediaireCarcasse.check_manuel ? true : false,
                      onChange: () => {
                        refusIntermediaireModal.current.close();
                        submitCarcasseAccept();
                      },
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
                    },
                    label: carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse manquante' : 'Lot manquant',
                  },
                ]}
              />
            </div>
            {!!carcasseRefusCheckbox && (
              <div className="mb-4">
                <InputForSearchPrefilledData
                  canEdit
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
                defaultValue: intermediaireCarcasse.commentaire || '',
                onBlur: (e) => {
                  const nextPartialCarcasseIntermediaire = {
                    commentaire: e.target.value,
                  };
                  updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
                  addLog({
                    user_id: user.id,
                    user_role: intermediaire.fei_intermediaire_role!,
                    fei_numero: fei.numero,
                    action: 'carcasse-intermediaire-commentaire',
                    history: createHistoryInput(intermediaireCarcasse, nextPartialCarcasseIntermediaire),
                    entity_id: intermediaire.fei_intermediaire_entity_id,
                    zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                    fei_intermediaire_id: intermediaire.id,
                    carcasse_intermediaire_id: carcasseIntermediaireId,
                  });
                },
              }}
            />

            <div className="mt-8 flex flex-col items-start bg-white [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={
                  intermediaireCarcasse.refus
                    ? [
                        {
                          children: 'Enregistrer',
                          type: 'submit',
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
    </div>
  );
}
