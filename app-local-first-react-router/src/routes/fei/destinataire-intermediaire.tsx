import { useParams } from 'react-router';
import { useMemo, useState } from 'react';
import {
  UserRoles,
  Prisma,
  EntityTypes,
  DepotType,
  CarcasseIntermediaire,
  EntityRelationType,
  FeiOwnerRole,
} from '@prisma/client';
import dayjs from 'dayjs';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore, { syncData } from '@app/zustand/store';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { useCcgIds, useEtgIds, useSviIds, useCollecteursProIds, useCircuitCourtIds } from '@app/utils/get-entity-relations';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import type { FeiIntermediaire, FeiAndIntermediaireIds } from '@app/types/fei-intermediaire';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import CCGNouveau from '@app/components/CCGNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';

const partenaireModal = createModal({
  isOpenedByDefault: false,
  id: 'partenaire-modal-int',
});

const ccgModal = createModal({
  isOpenedByDefault: false,
  id: 'ccg-modal-int',
});

const trichineModal = createModal({
  isOpenedByDefault: false,
  id: 'trichine-modal-int',
});

export default function DestinataireIntermediaire({
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
  intermediaire?: FeiIntermediaire;
}) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const isOnline = useIsOnline();
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const updateAllCarcasseIntermediaire = useZustandStore((state) => state.updateAllCarcasseIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const ccgsIds = useCcgIds();
  const etgsIds = useEtgIds();
  const svisIds = useSviIds();
  const collecteursProIds = useCollecteursProIds();
  const circuitCourtIds = useCircuitCourtIds();

  const isPartenaireModalOpen = useIsModalOpen(partenaireModal);
  const isCCGModalOpen = useIsModalOpen(ccgModal);
  const isTrichineModalOpen = useIsModalOpen(trichineModal);
  const [dontShowTrichineAgain, setDontShowTrichineAgain] = useState(false);

  const fei = feis[params.fei_numero!];

  const carcasses = useCarcassesForFei(params.fei_numero);
  const carcasseIds = carcasses.map((c) => c.zacharie_carcasse_id);

  const ccgs = ccgsIds.map((id) => entities[id]);
  const etgs = etgsIds.map((id) => entities[id]);
  const collecteursPros = collecteursProIds.map((id) => entities[id]);
  const circuitCourt = circuitCourtIds.map((id) => entities[id]);
  const svis = svisIds.map((id) => entities[id]);

  const intermediaireEntity = intermediaire?.intermediaire_entity_id
    ? entities[intermediaire.intermediaire_entity_id]
    : null;
  const intermediaireEntityType = intermediaireEntity?.type;

  const prochainsDetenteurs = useMemo(() => {
    if (fei.fei_current_owner_role === FeiOwnerRole.ETG) {
      return [
        ...svis.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
        ...etgs.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
        ...collecteursPros.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
        ...circuitCourt.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ];
    }
    return [
      ...circuitCourt.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ...etgs.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ...collecteursPros.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
    ];
  }, [etgs, collecteursPros, svis, fei.fei_current_owner_role, circuitCourt]);

  const canTransmitCarcassesToEntities = useMemo(() => {
    return prochainsDetenteurs.filter(
      (entity) =>
        entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY
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
  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState<string | null>(null);

  const prochainDetenteur = prochainDetenteurEntityId ? entities[prochainDetenteurEntityId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;

  const isRecipientCircuitCourt = useMemo(() => {
    if (!prochainDetenteurType) return false;
    return (
      prochainDetenteurType === EntityTypes.COMMERCE_DE_DETAIL ||
      prochainDetenteurType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF ||
      prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL ||
      prochainDetenteurType === EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE ||
      prochainDetenteurType === EntityTypes.ASSOCIATION_CARITATIVE
    );
  }, [prochainDetenteurType]);

  const hasSanglier = useMemo(() => {
    return carcasses.some((carcasse) => carcasse.espece === 'Sanglier');
  }, [carcasses]);

  const trichineMessage = useMemo(() => {
    if (!prochainDetenteurType) return null;
    if (
      prochainDetenteurType === EntityTypes.COMMERCE_DE_DETAIL ||
      prochainDetenteurType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF ||
      prochainDetenteurType === EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE ||
      prochainDetenteurType === EntityTypes.ASSOCIATION_CARITATIVE
    ) {
      return {
        title: 'Rappel : test trichine obligatoire',
        content: (
          <>
            <p className="mb-3">
              <strong>Les carcasses de sanglier transmises necessitent un test trichine obligatoire.</strong>
            </p>
            <p>
              Conformement a la reglementation, vous devez vous assurer que le test trichine a ete realise
              avant toute mise sur le marche ou consommation de ces carcasses.
            </p>
          </>
        ),
      };
    }
    if (prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL) {
      return {
        title: 'Rappel : test trichine recommande',
        content: (
          <>
            <p className="mb-3">
              <strong>Les carcasses de sanglier transmises necessitent un test trichine recommande.</strong>
            </p>
            <p className="mb-3">
              Si le test trichine n'a pas ete realise, vous devez imperativement informer le consommateur du
              risque trichine et de l'obligation de cuisson complete de la viande avant consommation.
            </p>
            <p className="text-sm text-gray-600">
              <strong>Important :</strong> La cuisson doit etre complete (coeur de la viande a 70°C minimum)
              pour eliminer tout risque de contamination.
            </p>
          </>
        ),
      };
    }
    return null;
  }, [prochainDetenteurType]);

  const shouldShowTrichineModal = useMemo(() => {
    if (!isRecipientCircuitCourt || !hasSanglier) return false;
    if (!trichineMessage) return false;
    const dontShowKey = 'trichine-modal-dont-show-again';
    return localStorage.getItem(dontShowKey) !== 'true';
  }, [isRecipientCircuitCourt, hasSanglier, trichineMessage]);

  // Depot only for Collecteur Pro intermediaires, not ETG
  const needDepot = intermediaireEntityType !== EntityTypes.ETG;

  const [depotEntityId, setDepotEntityId] = useState(() => {
    if (!needDepot) return null;
    if (intermediaire?.intermediaire_depot_entity_id) {
      return intermediaire.intermediaire_depot_entity_id;
    }
    return null;
  });

  const [depotType, setDepotType] = useState(() => {
    if (!needDepot) return null;
    if (intermediaire?.intermediaire_depot_type) {
      return intermediaire.intermediaire_depot_type;
    }
    return null;
  });

  const needToSubmit = useMemo(() => {
    if (!prochainDetenteurEntityId) {
      return true;
    }
    if (prochainDetenteurEntityId !== fei.fei_next_owner_entity_id) {
      return true;
    }
    if (prochainDetenteurType === EntityTypes.SVI) {
      return false;
    }
    if (fei.fei_current_owner_role === EntityTypes.COLLECTEUR_PRO) {
      if (!depotType) return true;
      if (depotType === EntityTypes.CCG && !depotEntityId) return true;
      if (depotType !== intermediaire?.intermediaire_depot_type) return true;
      if (depotEntityId !== intermediaire?.intermediaire_depot_entity_id) return true;
    }
    if (fei.fei_current_owner_role === EntityTypes.ETG) {
      // no additional checks for ETG
    }
    return false;
  }, [
    prochainDetenteurEntityId,
    prochainDetenteurType,
    depotType,
    depotEntityId,
    fei.fei_next_owner_entity_id,
    fei.fei_current_owner_role,
    intermediaire?.intermediaire_depot_type,
    intermediaire?.intermediaire_depot_entity_id,
  ]);

  const [tryToSubmitAtLeastOnce, setTryTOSubmitAtLeastOnce] = useState(false);

  const handleSubmit = () => {
    if (!prochainDetenteurEntityId) return;
    if (!feiAndIntermediaireIds) return;
    let nextFei: Partial<typeof fei> = {
      fei_next_owner_entity_id: prochainDetenteurEntityId,
      fei_next_owner_role: prochainDetenteurType as FeiOwnerRole,
      svi_assigned_at: prochainDetenteurType === EntityTypes.SVI ? dayjs().toDate() : null,
      svi_entity_id: prochainDetenteurType === EntityTypes.SVI ? prochainDetenteurEntityId : null,
    };
    updateCarcassesTransmission(carcasseIds, {
      next_owner_entity_id: prochainDetenteurEntityId,
      next_owner_role: prochainDetenteurType as FeiOwnerRole,
    });
    if (prochainDetenteurType === EntityTypes.SVI) {
      for (const carcasse of carcasses) {
        updateCarcasse(
          carcasse.zacharie_carcasse_id,
          {
            svi_assigned_to_fei_at: nextFei.svi_assigned_at,
          },
          false,
        );
      }
    }
    let nextCarcasseIntermediaire: Partial<CarcasseIntermediaire> = {
      intermediaire_prochain_detenteur_id_cache: prochainDetenteurEntityId,
      intermediaire_prochain_detenteur_role_cache: entities[prochainDetenteurEntityId]
        ?.type as FeiOwnerRole,
      intermediaire_depot_type: depotType,
      intermediaire_depot_entity_id: depotType === DepotType.AUCUN ? null : depotEntityId,
    };
    updateAllCarcasseIntermediaire(fei.numero, feiAndIntermediaireIds, nextCarcasseIntermediaire);
    updateFei(fei.numero, nextFei);
    addLog({
      user_id: user.id,
      user_role:
        fei.fei_current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL
          ? UserRoles.CHASSEUR
          : fei.fei_current_owner_role!,
      action: 'intermediaire-next-owner-select-destinataire',
      fei_numero: fei.numero,
      history: createHistoryInput(fei, nextFei),
      entity_id: fei.fei_current_owner_entity_id,
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
    if (needDepot) {
      if (!depotType) {
        return 'Il manque le lieu de stockage des carcasses';
      }
      if (depotType === DepotType.CCG && !depotEntityId) {
        return 'Il manque le centre de collecte du gibier sauvage';
      }
    }
    return null;
  }, [
    prochainDetenteurEntityId,
    needDepot,
    depotType,
    depotEntityId,
  ]);

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y a pas encore de premier détenteur pour cette fiche";
  }

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
          inputId={Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}
          classNamePrefix={`select-prochain-detenteur`}
          required
          creatable
          // @ts-expect-error - onCreateOption is not typed
          onCreateOption={(newOption) => {
            setNewEntityNomDUsage(newOption);
            partenaireModal.open();
          }}
          isReadOnly={!canEdit}
          name={Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}
        />
        {!!prochainDetenteur && !prochainDetenteur?.zacharie_compatible && (
          <Alert
            severity="warning"
            title="Attention"
            description={`${prochainDetenteur?.nom_d_usage} n'est pas prêt pour Zacharie. Vous pouvez contacter un représentant avant de leur envoyer leur première fiche.`}
          />
        )}
        {needDepot && (
          <>
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
                  label:
                    "J'ai déposé mes carcasses dans un Centre de Collecte du Gibier sauvage (chambre froide)",
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
                  label="Chambre froide (centre de collecte du gibier sauvage) *"
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
                  placeholder="Sélectionnez le Centre de Collecte du Gibier sauvage"
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
                  inputId={Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id}
                  classNamePrefix={`select-ccg`}
                  required
                  name={Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id}
                />
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <label>Chambre froide (centre de collecte du gibier sauvage) *</label>
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
          </>
        )}
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
                if (shouldShowTrichineModal) {
                  trichineModal.open();
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
          <Alert title="Attention" className="mt-4" severity="error" description={jobIsMissing} />
        )}
        {canEdit && !needToSubmit && fei.fei_next_owner_entity_id && (
          <>
            <Alert
              className="mt-6"
              severity="success"
              description={`${entities[fei.fei_next_owner_entity_id]?.nom_d_usage} ${fei.is_synced ? 'a été notifié' : !isOnline ? 'sera notifié dès que vous aurez retrouvé du réseau' : 'va être notifié'}.`}
              title="Attribution effectuée"
            />
          </>
        )}
      </div>
      <partenaireModal.Component title="Ajouter un partenaire">
        {isPartenaireModalOpen && (
          <PartenaireNouveau
            key={newEntityNomDUsage ?? ''}
            newEntityNomDUsageProps={newEntityNomDUsage ?? undefined}
            onFinish={(newEntity) => {
              partenaireModal.close();
              if (newEntity) setProchainDetenteurEntityId(newEntity.id);
            }}
          />
        )}
      </partenaireModal.Component>
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
      <trichineModal.Component
        title={trichineMessage?.title || 'Rappel trichine'}
        buttons={[
          {
            children: "J'ai compris",
            onClick: () => {
              if (dontShowTrichineAgain) {
                localStorage.setItem('trichine-modal-dont-show-again', 'true');
              }
              trichineModal.close();
              setDontShowTrichineAgain(false);
              handleSubmit();
            },
          },
        ]}
      >
        {isTrichineModalOpen && trichineMessage && (
          <div className="space-y-4">
            <div className="text-base leading-relaxed">{trichineMessage.content}</div>
            <Checkbox
              options={[
                {
                  label: "J'ai compris, ne plus afficher ce message",
                  nativeInputProps: {
                    checked: dontShowTrichineAgain,
                    onChange: (e) => setDontShowTrichineAgain(e.target.checked),
                  },
                },
              ]}
            />
          </div>
        )}
      </trichineModal.Component>
    </>
  );
}
