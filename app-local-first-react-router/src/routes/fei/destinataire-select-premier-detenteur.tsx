import { useNavigate, useParams } from 'react-router';
import { useMemo, useState } from 'react';
import {
  UserRoles,
  Prisma,
  EntityTypes,
  DepotType,
  TransportType,
  EntityRelationType,
  FeiOwnerRole,
} from '@prisma/client';
import dayjs from 'dayjs';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import InputNotEditable from '@app/components/InputNotEditable';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { usePrefillPremierDétenteurInfos } from '@app/utils/usePrefillPremierDétenteur';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import CCGNouveau from '@app/components/CCGNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';

const partenaireModal = createModal({
  isOpenedByDefault: false,
  id: 'partenaire-modal-premier-detenteur',
});

const ccgModal = createModal({
  isOpenedByDefault: false,
  id: 'ccg-modal-premier-detenteur',
});

const trichineModal = createModal({
  isOpenedByDefault: false,
  id: 'trichine-modal-premier-detenteur',
});

export default function DestinataireSelectPremierDetenteur({
  className = '',
  canEdit,
  disabled,
}: {
  className?: string;
  canEdit: boolean;
  disabled?: boolean;
}) {
  const params = useParams();
  const navigate = useNavigate();
  const user = useUser((state) => state.user)!;
  const isOnline = useIsOnline();
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const ccgsIds = useZustandStore((state) => state.ccgsIds);
  const etgsIds = useZustandStore((state) => state.etgsIds);
  const collecteursProIds = useZustandStore((state) => state.collecteursProIds);
  const circuitCourtIds = useZustandStore((state) => state.circuitCourtIds);

  const isPartenaireModalOpen = useIsModalOpen(partenaireModal);
  const isCCGModalOpen = useIsModalOpen(ccgModal);
  const isTrichineModalOpen = useIsModalOpen(trichineModal);
  const [dontShowTrichineAgain, setDontShowTrichineAgain] = useState(false);

  const fei = feis[params.fei_numero!];
  const prefilledInfos = usePrefillPremierDétenteurInfos();

  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const carcassesState = useZustandStore((state) => state.carcasses);
  const carcasses = (carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => carcassesState[cId])
    .filter((c) => !c.deleted_at);

  const ccgs = ccgsIds.map((id) => entities[id]);
  const etgs = etgsIds.map((id) => entities[id]);
  const collecteursPros = collecteursProIds.map((id) => entities[id]);
  const circuitCourt = circuitCourtIds.map((id) => entities[id]);

  const prochainsDetenteurs = useMemo(() => {
    return [
      ...circuitCourt.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ...etgs.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ...collecteursPros.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
    ];
  }, [etgs, collecteursPros, circuitCourt]);

  const canTransmitCarcassesToEntities = useMemo(() => {
    return prochainsDetenteurs.filter(
      (entity) => entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
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
    if (fei.premier_detenteur_prochain_detenteur_id_cache) {
      return fei.premier_detenteur_prochain_detenteur_id_cache;
    }
    if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
      if (prefilledInfos?.premier_detenteur_prochain_detenteur_id_cache) {
        return prefilledInfos.premier_detenteur_prochain_detenteur_id_cache;
      }
    }
    return null;
  });
  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState<string | null>(null);

  const prochainDetenteur = prochainDetenteurEntityId ? entities[prochainDetenteurEntityId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;

  // Check if recipient is circuit court
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

  // Check if at least one carcasse is sanglier
  const hasSanglier = useMemo(() => {
    return carcasses.some((carcasse) => carcasse.espece === 'Sanglier');
  }, [carcasses]);

  // Get the appropriate message based on recipient type
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
              <strong>Les carcasses de sanglier transmises nécessitent un test trichine obligatoire.</strong>
            </p>
            <p>
              Conformément à la réglementation, vous devez vous assurer que le test trichine a été réalisé
              avant toute mise sur le marché ou consommation de ces carcasses.
            </p>
          </>
        ),
      };
    }
    if (prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL) {
      return {
        title: 'Rappel : test trichine recommandé',
        content: (
          <>
            <p className="mb-3">
              <strong>Les carcasses de sanglier transmises nécessitent un test trichine recommandé.</strong>
            </p>
            <p className="mb-3">
              Si le test trichine n'a pas été réalisé, vous devez impérativement informer le consommateur du
              risque trichine et de l'obligation de cuisson complète de la viande avant consommation.
            </p>
            <p className="text-sm text-gray-600">
              <strong>Important :</strong> La cuisson doit être complète (cœur de la viande à 70°C minimum)
              pour éliminer tout risque de contamination.
            </p>
          </>
        ),
      };
    }
    return null;
  }, [prochainDetenteurType]);

  // Check if we should show trichine modal
  const shouldShowTrichineModal = useMemo(() => {
    if (!isRecipientCircuitCourt || !hasSanglier) return false;
    if (!trichineMessage) return false;
    const dontShowKey = 'trichine-modal-dont-show-again';
    return localStorage.getItem(dontShowKey) !== 'true';
  }, [isRecipientCircuitCourt, hasSanglier, trichineMessage]);

  const needTransport = useMemo(() => {
    // Ne pas afficher la question sur le transport pour particulier, commerce de détail ou repas associatif (circuit court)
    if (
      prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL ||
      prochainDetenteurType === EntityTypes.COMMERCE_DE_DETAIL ||
      prochainDetenteurType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF
    ) {
      return false;
    }
    return prochainDetenteurType !== EntityTypes.COLLECTEUR_PRO;
  }, [prochainDetenteurType]);

  const [depotEntityId, setDepotEntityId] = useState(() => {
    if (fei.premier_detenteur_depot_entity_id) {
      return fei.premier_detenteur_depot_entity_id;
    }
    if (fei.premier_detenteur_depot_type === DepotType.AUCUN) {
      return null;
    }
    if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
      if (prefilledInfos?.premier_detenteur_depot_entity_id) {
        if (ccgsWorkingWith.find((entity) => entity.id === prefilledInfos.premier_detenteur_depot_entity_id)) {
          return prefilledInfos.premier_detenteur_depot_entity_id;
        }
        return null;
      }
    }
    return null;
  });

  const [depotType, setDepotType] = useState(() => {
    if (fei.premier_detenteur_depot_type) {
      return fei.premier_detenteur_depot_type;
    }
    if (fei.premier_detenteur_depot_entity_id) {
      const type = entities[fei.premier_detenteur_depot_entity_id]?.type;
      if (type === EntityTypes.CCG) {
        return DepotType.CCG;
      }
      if (type === EntityTypes.ETG) {
        return DepotType.ETG;
      }
      return null;
    }
    if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
      if (prefilledInfos?.premier_detenteur_depot_type) {
        return prefilledInfos.premier_detenteur_depot_type;
      }
    }
    return null;
  });

  const [transportType, setTransportType] = useState(() => {
    if (fei.premier_detenteur_transport_type) {
      return fei.premier_detenteur_transport_type;
    }
    if (needTransport) {
      if (prefilledInfos?.premier_detenteur_transport_type) {
        return prefilledInfos.premier_detenteur_transport_type;
      }
    }
    return null;
  });

  const [depotDate, setDepotDate] = useState(() => {
    if (fei.premier_detenteur_depot_ccg_at) {
      return dayjs(fei.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm');
    }
    return undefined;
  });

  const [transportDate, setTransportDate] = useState(() => {
    if (fei.premier_detenteur_transport_date) {
      return dayjs(fei.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm');
    }
    return undefined;
  });

  const Component = canEdit ? Input : InputNotEditable;

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
    if (needTransport && !transportType) return true;
    if (!depotType) return true;
    if (depotType === EntityTypes.CCG && !depotEntityId) return true;
    if (needTransport && transportType === TransportType.PREMIER_DETENTEUR && depotType === DepotType.CCG && !depotDate) {
      return true;
    }
    if (depotType !== fei.premier_detenteur_depot_type) return true;
    if (depotEntityId !== fei.premier_detenteur_depot_entity_id) return true;
    if (!needTransport && fei.premier_detenteur_transport_type) return true;
    if (needTransport && transportType !== fei.premier_detenteur_transport_type) return true;
    if (depotDate || fei.premier_detenteur_depot_ccg_at) {
      if (!depotDate) return !fei.premier_detenteur_depot_ccg_at;
      if (!fei.premier_detenteur_depot_ccg_at) return !depotDate;
      if (depotDate !== dayjs(fei.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm')) return true;
    }
    if (!needTransport && fei.premier_detenteur_transport_date) return true;
    if (needTransport && (transportDate || fei.premier_detenteur_transport_date)) {
      if (!transportDate) return !fei.premier_detenteur_transport_date;
      if (!fei.premier_detenteur_transport_date) return !transportDate;
      if (transportDate !== dayjs(fei.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm')) return true;
    }
    return false;
  }, [
    prochainDetenteurEntityId,
    prochainDetenteurType,
    depotType,
    depotEntityId,
    needTransport,
    transportType,
    depotDate,
    fei.fei_next_owner_entity_id,
    fei.premier_detenteur_depot_type,
    fei.premier_detenteur_depot_entity_id,
    fei.premier_detenteur_transport_type,
    fei.premier_detenteur_depot_ccg_at,
    fei.premier_detenteur_transport_date,
    transportDate,
  ]);

  const [tryToSubmitAtLeastOnce, setTryTOSubmitAtLeastOnce] = useState(false);

  const handleSubmit = () => {
    if (!prochainDetenteurEntityId) return;

    const nextDepotEntityId = depotType === DepotType.AUCUN ? null : depotEntityId;
    const nextDepotDate = depotDate ? dayjs(depotDate).toDate() : null;
    const nextTransportType = needTransport ? transportType : null;
    const nextTransportDate = nextTransportType ? (transportDate ? dayjs(transportDate).toDate() : null) : null;

    setDepotEntityId(nextDepotEntityId);
    setDepotDate(nextDepotDate ? dayjs(nextDepotDate).format('YYYY-MM-DDTHH:mm') : undefined);
    setTransportType(nextTransportType);
    setTransportDate(nextTransportDate ? dayjs(nextTransportDate).format('YYYY-MM-DDTHH:mm') : undefined);

    let nextFei: Partial<typeof fei> = {
      fei_next_owner_entity_id: prochainDetenteurEntityId,
      fei_next_owner_role: entities[prochainDetenteurEntityId]?.type as FeiOwnerRole,
      premier_detenteur_prochain_detenteur_id_cache: prochainDetenteurEntityId,
      premier_detenteur_prochain_detenteur_role_cache: entities[prochainDetenteurEntityId]?.type as FeiOwnerRole,
      premier_detenteur_depot_type: depotType,
      premier_detenteur_depot_entity_id: nextDepotEntityId,
      premier_detenteur_depot_entity_name_cache: nextDepotEntityId ? entities[nextDepotEntityId!]?.nom_d_usage : null,
      premier_detenteur_depot_ccg_at: nextDepotDate,
      premier_detenteur_transport_type: nextTransportType,
      premier_detenteur_transport_date: nextTransportDate,
    };

    for (const carcasse of carcasses) {
      updateCarcasse(
        carcasse.zacharie_carcasse_id,
        {
          premier_detenteur_prochain_detenteur_role_cache: nextFei.premier_detenteur_prochain_detenteur_role_cache,
          premier_detenteur_prochain_detenteur_id_cache: nextFei.premier_detenteur_prochain_detenteur_id_cache,
          premier_detenteur_depot_type: nextFei.premier_detenteur_depot_type,
          premier_detenteur_depot_entity_id: nextFei.premier_detenteur_depot_entity_id,
          premier_detenteur_depot_entity_name_cache: nextFei.premier_detenteur_depot_entity_id
            ? entities[nextFei.premier_detenteur_depot_entity_id!]?.nom_d_usage
            : null,
          premier_detenteur_depot_ccg_at: nextFei.premier_detenteur_depot_ccg_at,
          premier_detenteur_transport_type: nextFei.premier_detenteur_transport_type,
          premier_detenteur_transport_date: nextFei.premier_detenteur_transport_date,
        },
        false,
      );
    }

    updateFei(fei.numero, nextFei);
    addLog({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      action: 'premier-detenteur-need-select-next-select-destinataire',
      fei_numero: fei.numero,
      history: createHistoryInput(fei, nextFei),
      entity_id: fei.premier_detenteur_entity_id,
      zacharie_carcasse_id: null,
      carcasse_intermediaire_id: null,
      intermediaire_id: null,
    });
    navigate(`/app/tableau-de-bord/fei/${fei.numero}/envoyée`);
  };

  const jobIsMissing = useMemo(() => {
    if (!prochainDetenteurEntityId) {
      return 'Il manque le prochain détenteur des carcasses';
    }
    if (!depotType) {
      return 'Il manque le lieu de stockage des carcasses';
    }
    if (depotType === DepotType.CCG && !depotEntityId) {
      return 'Il manque le centre de collecte du gibier sauvage';
    }
    if (depotType === DepotType.CCG && !depotDate) {
      return 'Il manque la date de dépôt dans le centre de collecte du gibier sauvage';
    }
    if (needTransport) {
      if (!transportType) {
        return 'Il manque le type de transport';
      }
      if (transportType === TransportType.PREMIER_DETENTEUR && depotType === DepotType.CCG && !transportDate) {
        return 'Il manque la date de transport';
      }
    }
    return null;
  }, [prochainDetenteurEntityId, depotType, depotEntityId, depotDate, needTransport, transportType, transportDate]);

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y a pas encore de premier détenteur pour cette fiche";
  }

  return (
    <>
      <div
        className={[className, disabled ? 'cursor-not-allowed opacity-50' : '', canEdit ? '' : 'cursor-not-allowed', 'space-y-6'].join(' ')}
        key={prochainDetenteurEntityId}
      >
        <SelectCustom
          label="Prochain détenteur des carcasses *"
          isDisabled={disabled}
          hint={
            <>
              <span>
                Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en charge le gibier.
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
          value={prochainsDetenteursOptions.find((option) => option.value === prochainDetenteurEntityId) ?? null}
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
        <RadioButtons
          legend="Lieu de stockage des carcasses *"
          className={canEdit ? '' : 'radio-black'}
          disabled={!prochainDetenteurEntityId}
          options={[
            {
              label: <span className="inline-block">Pas de stockage</span>,
              hintText: (
                <span>
                  Sans stockage en chambre froide, les carcasses doivent être transportées <b>le jour-même du tir</b>
                </span>
              ),
              nativeInputProps: {
                checked: depotType === DepotType.AUCUN,
                readOnly: !canEdit,
                onChange: () => {
                  setDepotType(DepotType.AUCUN);
                  setDepotDate(undefined);
                  setDepotEntityId(null);
                },
              },
            },
            {
              label: "J'ai déposé mes carcasses dans un Centre de Collecte du Gibier sauvage (chambre froide)",
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
            <>
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
              <Component
                label="Date de dépôt dans le Centre de Collecte du Gibier sauvage *"
                disabled={depotType !== DepotType.CCG}
                hintText={
                  canEdit ? (
                    <button
                      className="inline-block text-left"
                      type="button"
                      disabled={depotType !== DepotType.CCG}
                      onClick={() => {
                        setDepotDate(dayjs().format('YYYY-MM-DDTHH:mm'));
                      }}
                    >
                      <u className="inline">Cliquez ici</u> pour définir la date du jour et maintenant
                    </button>
                  ) : null
                }
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_ccg_at,
                  name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_ccg_at,
                  type: 'datetime-local',
                  required: true,
                  autoComplete: 'off',
                  suppressHydrationWarning: true,
                  disabled: depotType !== DepotType.CCG,
                  value: depotDate,
                  onChange: (e) => {
                    setDepotDate(dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'));
                  },
                }}
              />
            </>
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
        {needTransport && (
          <>
            <RadioButtons
              legend="Transport des carcasses jusqu'au destinataire *"
              className={canEdit ? '' : 'radio-black'}
              disabled={!prochainDetenteurEntityId}
              options={[
                {
                  label: <span className="inline-block">Je transporte les carcasses moi-même</span>,
                  hintText: (
                    <span>
                      N'oubliez pas de notifier le prochain détenteur des carcasses de votre dépôt.{' '}
                      {depotType === DepotType.AUCUN ? (
                        <>
                          Sans stockage en chambre froide, les carcasses doivent être transportées{' '}
                          <b>le jour-même du tir</b>
                        </>
                      ) : (
                        ''
                      )}
                    </span>
                  ),
                  nativeInputProps: {
                    checked: transportType === TransportType.PREMIER_DETENTEUR,
                    readOnly: !canEdit,
                    onChange: () => {
                      setTransportType(TransportType.PREMIER_DETENTEUR);
                    },
                  },
                },
                {
                  label: 'Le transport est réalisé par un collecteur professionnel',
                  hintText: 'La gestion du transport est sous la responsabilité du prochain détenteur.',
                  nativeInputProps: {
                    checked: transportType === TransportType.COLLECTEUR_PRO,
                    readOnly: !canEdit,
                    onChange: () => {
                      setTransportType(TransportType.COLLECTEUR_PRO);
                      setTransportDate(undefined);
                    },
                  },
                },
              ]}
            />
            {transportType === TransportType.PREMIER_DETENTEUR && depotType === DepotType.CCG && (
              <Component
                label="Date à laquelle je transporte les carcasses"
                disabled={transportType !== TransportType.PREMIER_DETENTEUR || depotType !== DepotType.CCG}
                hintText={
                  canEdit ? (
                    <>
                      <button
                        className="mr-1 inline-block text-left"
                        type="button"
                        disabled={transportType !== TransportType.PREMIER_DETENTEUR || depotType !== DepotType.CCG}
                        onClick={() => {
                          setTransportDate(dayjs().format('YYYY-MM-DDTHH:mm'));
                        }}
                      >
                        <u className="inline">Cliquez ici</u> pour définir la date du jour et maintenant.
                      </button>
                      À ne remplir que si vous êtes le transporteur et que vous stockez les carcasses dans un CCG. Indiquer
                      une date permettra au prochain détenteur de s'organiser.
                    </>
                  ) : null
                }
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.premier_detenteur_transport_date,
                  name: Prisma.FeiScalarFieldEnum.premier_detenteur_transport_date,
                  type: 'datetime-local',
                  required: true,
                  autoComplete: 'off',
                  suppressHydrationWarning: true,
                  value: transportDate,
                  onChange: (e) => {
                    setTransportDate(dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'));
                  },
                }}
              />
            )}
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
