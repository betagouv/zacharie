import { useMemo, useState } from 'react';
import {
  Prisma,
  EntityTypes,
  DepotType,
  CarcasseIntermediaire,
  EntityRelationType,
  FeiOwnerRole,
} from '@prisma/client';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { useCcgIds, useEtgIds, useCollecteursProIds } from '@app/utils/get-entity-relations';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import type { CarcassesIntermediaire, FeiAndIntermediaireIds } from '@app/types/carcasses-intermediaire';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import CCGNouveau from '@app/components/CCGNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { CarcasseTransmission } from '@app/types/carcasse';
import { useGetTransmissionFromURLParams } from '@app/utils/get-transmissions-sorted';

const ccgModal = createModal({
  isOpenedByDefault: false,
  id: 'collecteur-ccg-modal-int',
});

export default function CollecteurDestinataireIntermediaire({
  className = '',
  canEdit,
  disabled,
  feiAndIntermediaireIds,
  intermediaire,
}: {
  className?: string;
  canEdit: boolean;
  disabled?: boolean;
  feiAndIntermediaireIds?: FeiAndIntermediaireIds;
  intermediaire?: CarcassesIntermediaire;
}) {
  const user = useUser((state) => state.user)!;
  const isOnline = useIsOnline();
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const updateAllCarcasseIntermediaire = useZustandStore((state) => state.updateAllCarcasseIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const entities = useZustandStore((state) => {
    return state.entities;
  });

  const ccgsIds = useCcgIds();
  const etgsIds = useEtgIds();
  const collecteursProIds = useCollecteursProIds();

  const isCCGModalOpen = useIsModalOpen(ccgModal);

  const transmissionMetadata = useGetTransmissionFromURLParams();
  const fei_numero = transmissionMetadata.fei.numero;
  const myCarcasses = transmissionMetadata.carcasses;
  const transmission = transmissionMetadata.content;

  const carcasseIds = useMemo(() => myCarcasses.map((ci) => ci.zacharie_carcasse_id), [myCarcasses]);

  const ccgs = ccgsIds.map((id) => entities[id]);
  const etgs = etgsIds.map((id) => entities[id]);
  const collecteursPros = collecteursProIds.map((id) => entities[id]);

  const prochainsDetenteurs = useMemo(() => {
    return [
      ...etgs.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ...collecteursPros.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
    ];
  }, [etgs, collecteursPros]);

  const canTransmitCarcassesToEntities = useMemo(() => {
    return prochainsDetenteurs.filter(
      (entity) => entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY
    );
  }, [prochainsDetenteurs]);

  const ccgsOptions = useMemo(() => {
    return [
      ...ccgs.map((entity) => ({
        label: getEntityDisplay(entity),
        value: entity.id,
      })),
      {
        label: 'Ajouter une autre chambre froide (CCG)',
        value: 'add_new',
        isLink: true,
      },
    ];
  }, [ccgs]);

  const ccgsWorkingWith = useMemo(() => {
    return ccgs.filter((entity) => entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY);
  }, [ccgs]);

  const prochainsDetenteursOptions = useMemo(() => {
    return prochainsDetenteurs.map((entity) => ({
      label: getEntityDisplay(entity),
      value: entity.id,
    }));
  }, [prochainsDetenteurs]);

  const [prochainDetenteurEntityId, setProchainDetenteurEntityId] = useState(() => {
    if (intermediaire?.intermediaire_prochain_detenteur_id_cache) {
      return intermediaire.intermediaire_prochain_detenteur_id_cache;
    }
    return null;
  });

  const prochainDetenteur = prochainDetenteurEntityId ? entities[prochainDetenteurEntityId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;

  const [depotEntityId, setDepotEntityId] = useState(() => {
    if (intermediaire?.intermediaire_depot_entity_id) {
      return intermediaire.intermediaire_depot_entity_id;
    }
    return null;
  });

  const [depotType, setDepotType] = useState(() => {
    if (intermediaire?.intermediaire_depot_type) {
      return intermediaire.intermediaire_depot_type;
    }
    return null;
  });

  const needToSubmit = useMemo(() => {
    if (!prochainDetenteurEntityId) {
      return true;
    }
    if (prochainDetenteurEntityId !== transmission.next_owner_entity_id) {
      return true;
    }
    if (!depotType) return true;
    if (depotType === EntityTypes.CCG && !depotEntityId) return true;
    if (depotType !== intermediaire?.intermediaire_depot_type) return true;
    if (depotEntityId !== intermediaire?.intermediaire_depot_entity_id) return true;
    return false;
  }, [
    prochainDetenteurEntityId,
    depotType,
    depotEntityId,
    transmission.next_owner_entity_id,
    intermediaire?.intermediaire_depot_type,
    intermediaire?.intermediaire_depot_entity_id,
  ]);

  const [tryToSubmitAtLeastOnce, setTryTOSubmitAtLeastOnce] = useState(false);

  const handleSubmit = () => {
    if (!prochainDetenteurEntityId) return;
    if (!feiAndIntermediaireIds) return;
    const nextTransmission: CarcasseTransmission = {
      next_owner_entity_id: prochainDetenteurEntityId,
      next_owner_role: prochainDetenteurType as FeiOwnerRole,
    };
    updateCarcassesTransmission(carcasseIds, nextTransmission);
    let nextCarcasseIntermediaire: Partial<CarcasseIntermediaire> = {
      intermediaire_prochain_detenteur_id_cache: prochainDetenteurEntityId,
      intermediaire_prochain_detenteur_role_cache: entities[prochainDetenteurEntityId]?.type as FeiOwnerRole,
      intermediaire_depot_type: depotType,
      intermediaire_depot_entity_id: depotType === DepotType.AUCUN ? null : depotEntityId,
    };
    updateAllCarcasseIntermediaire(fei_numero, feiAndIntermediaireIds, nextCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire?.intermediaire_role ?? transmission.current_owner_role!,
      action: 'intermediaire-next-owner-select-destinataire',
      fei_numero: fei_numero,
      history: createHistoryInput(transmission, nextTransmission),
      entity_id: transmission.current_owner_entity_id,
      zacharie_carcasse_id: null,
      carcasse_intermediaire_id: null,
      intermediaire_id: feiAndIntermediaireIds.split('_')[1],
    });
    syncData('intermediaire-next-owner-select-destinataire');
  };

  const jobIsMissing = useMemo(() => {
    if (!prochainDetenteurEntityId) {
      return 'Il manque le prochain détenteur des carcasses';
    }
    if (!depotType) {
      return 'Il manque le lieu de stockage des carcasses';
    }
    if (depotType === DepotType.CCG && !depotEntityId) {
      return 'Il manque la chambre froide';
    }
    return null;
  }, [prochainDetenteurEntityId, depotType, depotEntityId]);

  return (
    <>
      <div
        className={[
          className,
          disabled ? 'cursor-not-allowed opacity-50' : '',
          canEdit ? '' : 'cursor-not-allowed',
          'space-y-6',
        ].join(' ')}
        key={prochainDetenteurEntityId}
      >
        <SelectCustom
          label="Prochain détenteur des carcasses *"
          isDisabled={disabled}
          hint={
            <>
              <span>
                Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en charge
                le gibier.
              </span>
              {!prochainDetenteurEntityId && !disabled && (
                <div>
                  {canTransmitCarcassesToEntities.map((entity) => {
                    return (
                      <Tag
                        key={entity.id}
                        iconId="fr-icon-checkbox-circle-line"
                        className="mr-2"
                        nativeButtonProps={{
                          onClick: () => setProchainDetenteurEntityId(entity.id),
                        }}
                      >
                        {entity.nom_d_usage}
                      </Tag>
                    );
                  })}
                </div>
              )}
            </>
          }
          options={prochainsDetenteursOptions}
          placeholder="Sélectionnez le prochain détenteur des carcasses"
          value={
            prochainsDetenteursOptions.find((option) => option.value === prochainDetenteurEntityId) ?? null
          }
          getOptionLabel={(f) => f.label!}
          getOptionValue={(f) => f.value}
          onChange={(f) => (f ? setProchainDetenteurEntityId(f.value) : setProchainDetenteurEntityId(null))}
          isClearable={!!prochainDetenteurEntityId}
          inputId={Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}
          classNamePrefix={`select-prochain-detenteur`}
          required
          creatable
          isReadOnly={!canEdit}
          name={Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}
        />
        {!!prochainDetenteur && !prochainDetenteur?.zacharie_compatible && (
          <Alert
            severity="warning"
            title="Attention"
            description={`${prochainDetenteur?.nom_d_usage} n'est pas prêt pour Zacharie. Vous pouvez contacter un représentant avant de leur envoyer leur première fiche.`}
          />
        )}
        <RadioButtons
          legend="Lieu de stockage des carcasses *"
          className={canEdit ? '' : 'radio-black'}
          disabled={!prochainDetenteurEntityId}
          options={[
            {
              label: <span className="inline-block">Pas de stockage</span>,
              hintText: <span>Les carcasses sont livrées chez le destinataire</span>,
              nativeInputProps: {
                checked: depotType === DepotType.AUCUN,
                readOnly: !canEdit,
                onChange: () => {
                  setDepotType(DepotType.AUCUN);
                  setDepotEntityId(null);
                },
              },
            },
            {
              label: 'Carcasses déposées dans une chambre froide (Centre de Collecte du Gibier sauvage)',
              hintText:
                'Toute chambre froide où vous entreposez le gibier avant de le céder ou le vendre est un Centre de Collecte du Gibier sauvage (CCG).',
              nativeInputProps: {
                checked: depotType === DepotType.CCG,
                readOnly: !canEdit,
                onChange: () => {
                  setDepotType(DepotType.CCG);
                },
              },
            },
          ]}
        />
        {depotType === DepotType.CCG &&
          (ccgsWorkingWith.length > 0 ? (
            <SelectCustom
              label="Chambre froide (Centre de Collecte du Gibier sauvage) *"
              isDisabled={depotType !== DepotType.CCG}
              isReadOnly={!canEdit}
              hint={
                <>
                  {!depotEntityId && depotType === DepotType.CCG ? (
                    <div>
                      {ccgsWorkingWith.map((entity) => {
                        return (
                          <Tag
                            key={entity.id}
                            iconId="fr-icon-checkbox-circle-line"
                            className="mr-2"
                            nativeButtonProps={{
                              onClick: () => {
                                setDepotEntityId(entity.id);
                              },
                            }}
                          >
                            {entity.nom_d_usage}
                          </Tag>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              }
              options={ccgsOptions}
              placeholder="Sélectionnez la chambre froide"
              value={ccgsOptions.find((option) => option.value === depotEntityId) ?? null}
              getOptionLabel={(f) => f.label!}
              getOptionValue={(f) => f.value}
              onChange={(f) => {
                if (f?.value === 'add_new') {
                  ccgModal.open();
                  return;
                }
                setDepotEntityId(f?.value ?? null);
              }}
              isClearable={!!depotEntityId}
              inputId={Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_id}
              classNamePrefix={`select-ccg`}
              required
              name={Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_id}
            />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <label>Chambre froide (Centre de Collecte du Gibier sauvage) *</label>
              <Button
                type="button"
                nativeButtonProps={{
                  onClick: () => ccgModal.open(),
                }}
              >
                Renseigner ma chambre froide (CCG)
              </Button>
            </div>
          ))}

        {canEdit && (
          <Button
            className="mt-4"
            type="submit"
            disabled={disabled || !needToSubmit}
            nativeButtonProps={{
              onClick: async (event) => {
                event.preventDefault();
                if (!tryToSubmitAtLeastOnce) {
                  setTryTOSubmitAtLeastOnce(true);
                }
                if (jobIsMissing) {
                  alert(jobIsMissing);
                  return;
                }
                handleSubmit();
              },
            }}
          >
            Transmettre la fiche
          </Button>
        )}
        {!disabled && !!jobIsMissing?.length && (
          <Alert
            title="Attention"
            className="mt-4"
            severity="error"
            description={jobIsMissing}
          />
        )}
        {canEdit && !needToSubmit && transmission.next_owner_entity_id && (
          <>
            <Alert
              className="mt-6"
              severity="success"
              description={`${entities[transmission.next_owner_entity_id]?.nom_d_usage} ${transmission.is_synced ? 'a été notifié' : !isOnline ? 'sera notifié dès que vous aurez retrouvé du réseau' : 'va être notifié'}.`}
              title="Attribution effectuée"
            />
          </>
        )}
      </div>
      <ccgModal.Component title="Ajouter une chambre froide (CCG)">
        {isCCGModalOpen && (
          <CCGNouveau
            onFinish={(newEntity) => {
              ccgModal.close();
              if (newEntity) setDepotEntityId(newEntity.id);
            }}
          />
        )}
      </ccgModal.Component>
    </>
  );
}
