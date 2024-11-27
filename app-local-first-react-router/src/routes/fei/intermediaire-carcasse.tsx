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
  const state = useZustandStore((state) => state);
  const updateCarcasseIntermediaire = state.updateCarcasseIntermediaire;
  const updateCarcasse = state.updateCarcasse;
  const fei = state.feis[params.fei_numero!];
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

  const formRef = useRef<HTMLFormElement>(null);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const _intermediaire of intermediaires) {
      const carcasseIntermediaireId = getCarcasseIntermediaireId(
        fei.numero,
        carcasse.numero_bracelet,
        intermediaire.id,
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
  }, [intermediaires, carcasse]);

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
    updateCarcasseIntermediaire(carcasseIntermediaireId, {
      manquante: true,
      refus: null,
      prise_en_charge: false,
    });
    updateCarcasse(carcasse.zacharie_carcasse_id, {
      intermediaire_carcasse_manquante: true,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: intermediaire.id,
      intermediaire_carcasse_signed_at: new Date(),
    });
  };

  const submitCarcasseRefus = () => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(true);
    // with custom value for InputForSearchPrefilledData, sometimes the user doesnt press on the blue tag to confirm the refus
    // so we need to get the value from the input directly
    const refusInputValue = (document.getElementsByName('carcasse-refus')?.[0] as HTMLInputElement)?.value;
    if (refus !== refusInputValue) {
      setRefus(refusInputValue);
    }
    updateCarcasseIntermediaire(carcasseIntermediaireId, {
      manquante: false,
      refus: refusInputValue,
      prise_en_charge: false,
    });
    updateCarcasse(carcasse.zacharie_carcasse_id, {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: refusInputValue,
      intermediaire_carcasse_refus_intermediaire_id: intermediaire.id,
      intermediaire_carcasse_signed_at: new Date(),
    });
  };

  const submitCarcasseAccept = () => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(false);
    setRefus('');
    updateCarcasseIntermediaire(carcasseIntermediaireId, {
      manquante: false,
      refus: null,
      prise_en_charge: true,
    });
    updateCarcasse(carcasse.zacharie_carcasse_id, {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      intermediaire_carcasse_signed_at: new Date(),
    });
  };

  return (
    <div
      key={carcasse.numero_bracelet}
      className={[
        'mb-2 border-4 border-transparent',
        !!refus && '!border-red-500',
        carcasseManquante && '!border-red-500',
        // intermediaireCarcasse.prise_en_charge && "!border-action-high-blue-france",
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CustomNotice
        key={carcasse.numero_bracelet}
        className={`${carcasse.type === CarcasseType.PETIT_GIBIER ? '!bg-gray-300' : ''}`}
      >
        <Component
          className="block w-full p-4 text-left [&_*]:no-underline [&_*]:hover:no-underline"
          type={canEdit ? 'button' : undefined}
          onClick={canEdit ? () => refusIntermediaireModal.current.open() : undefined}
        >
          <span className="block font-bold">
            {carcasse.espece}
            {carcasse.categorie && ` - ${carcasse.categorie}`}
          </span>
          <span className="absolute right-8 top-2.5 block text-sm font-normal italic opacity-50">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Petit gibier' : 'Grand gibier'}
          </span>
          <span className="block font-normal">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? "Numéro d'identification" : 'Numéro de bracelet'}
            &nbsp;: <span className="whitespace-nowrap">{carcasse.numero_bracelet}</span>
          </span>
          {carcasse.type === CarcasseType.PETIT_GIBIER && (
            <span className="block font-normal">
              Nombre de carcasses dans le lot&nbsp;: {carcasse.nombre_d_animaux || 'À REMPLIR'}
            </span>
          )}
          {carcasse.intermediaire_carcasse_manquante && (
            <span className="ml-4 mt-4 block font-bold">Carcasse manquante</span>
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
                  <>
                    <span className="m-0 ml-2 block font-bold">{anomalie}</span>
                  </>
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
                  <>
                    <span className="m-0 ml-2 block font-bold">{anomalie}</span>
                  </>
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
          {intermediaireCarcasse.refus && <span className="ml-4 mt-4 block font-bold">Carcasse refusée</span>}
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
              {carcasse.espece}
              <br />
              <small>
                {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot ' : 'Carcasse '}{' '}
                {carcasse.numero_bracelet}
              </small>
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
                      name: 'caracsse-status',
                      checked: !carcasseManquante && !carcasseRefusCheckbox,
                      onChange: () => {
                        submitCarcasseAccept();
                      },
                    },
                    label: carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse acceptée' : 'Lot accepté',
                  },
                  {
                    nativeInputProps: {
                      required: true,
                      name: 'caracsse-status',
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
                      name: 'caracsse-status',
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
                  updateCarcasseIntermediaire(carcasseIntermediaireId, {
                    commentaire: e.target.value,
                  });
                },
              }}
            />
            {!!carcasseRefusCheckbox && (
              <div className="mb-2">
                <InputForSearchPrefilledData
                  canEdit
                  data={refusIntermedaire}
                  label="Vous refusez cette carcasse ? Indiquez le motif *"
                  hideDataWhenNoSearch={false}
                  required
                  name="carcasse-refus"
                  hintText="Cliquez sur un bouton bleu ciel pour valider le motif"
                  placeholder="Tapez un motif de refus"
                  onSelect={setRefus}
                  defaultValue={refus ?? ''}
                  key={refus ?? ''}
                />
              </div>
            )}

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
                        {
                          children: 'Fermer',
                          priority: 'secondary',
                          type: 'button',
                          nativeButtonProps: {
                            onClick: () => refusIntermediaireModal.current.close(),
                          },
                        },
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
