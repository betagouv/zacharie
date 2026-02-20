import { useNavigate, useParams } from 'react-router';
import { useCallback, useMemo, useState } from 'react';
import {
  UserRoles,
  Prisma,
  EntityTypes,
  DepotType,
  TransportType,
  EntityRelationType,
  FeiOwnerRole,
  type Carcasse,
} from '@prisma/client';
import dayjs from 'dayjs';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import InputNotEditable from '@app/components/InputNotEditable';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore, { syncData } from '@app/zustand/store';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { useCcgIds, useEtgIds, useCollecteursProIds, useCircuitCourtIds } from '@app/utils/get-entity-relations';
import { usePrefillPremierDétenteurInfos } from '@app/utils/usePrefillPremierDétenteur';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import CCGNouveau from '@app/components/CCGNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import type { EntityWithUserRelation } from '~/src/types/entity';

const partenaireModal = createModal({
  isOpenedByDefault: false,
  id: 'partenaire-modal-pd',
});

const ccgModal = createModal({
  isOpenedByDefault: false,
  id: 'ccg-modal-pd',
});

const trichineModal = createModal({
  isOpenedByDefault: false,
  id: 'trichine-modal-pd',
});

interface DispatchGroup {
  id: string;
  recipientEntityId: string | null;
  carcasseIds: string[];
  depotType: DepotType | null;
  depotEntityId: string | null;
  depotDate: string | undefined;
  transportType: TransportType | null;
  transportDate: string | undefined;
}

function DispatchGroupForm({
  group,
  groupIndex,
  totalGroups,
  canEdit,
  disabled,
  entities,
  prochainsDetenteursOptions,
  canTransmitCarcassesToEntities,
  ccgsOptions,
  ccgsWorkingWith,
  allCarcassesRestantes,
  carcasseToGroupLabel,
  onToggleCarcasse,
  onUpdateGroup,
  onRemoveGroup,
  onOpenPartenaireModal,
  onOpenCcgModal,
}: {
  group: DispatchGroup;
  groupIndex: number;
  totalGroups: number;
  canEdit: boolean;
  disabled?: boolean;
  entities: Record<string, EntityWithUserRelation>;
  prochainsDetenteursOptions: Array<{ label: string | null; value: string }>;
  canTransmitCarcassesToEntities: EntityWithUserRelation[];
  ccgsOptions: Array<{ label: string | null; value: string; isLink?: boolean }>;
  ccgsWorkingWith: EntityWithUserRelation[];
  allCarcassesRestantes: Carcasse[];
  carcasseToGroupLabel: Record<string, string>;
  onToggleCarcasse: (carcasseId: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<DispatchGroup>) => void;
  onRemoveGroup: (groupId: string) => void;
  onOpenPartenaireModal: (groupId: string, nomDUsage?: string) => void;
  onOpenCcgModal: (groupId: string) => void;
}) {
  const prochainDetenteur = group.recipientEntityId ? entities[group.recipientEntityId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;

  const needTransport = useMemo(() => {
    if (
      prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL ||
      prochainDetenteurType === EntityTypes.COMMERCE_DE_DETAIL ||
      prochainDetenteurType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF
    ) {
      return false;
    }
    return prochainDetenteurType !== EntityTypes.COLLECTEUR_PRO;
  }, [prochainDetenteurType]);

  const Component = canEdit ? Input : InputNotEditable;

  return (
    <div className="rounded border border-gray-300 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-lg font-bold">
          {totalGroups > 1 ? `Destinataire ${groupIndex + 1}` : 'Destinataire'}
          {totalGroups > 1 && (
            <Badge severity={group.carcasseIds.length > 0 ? 'info' : 'warning'} small noIcon as="span" className="ml-2">
              {group.carcasseIds.length} carcasse{group.carcasseIds.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </h4>
        {totalGroups > 1 && canEdit && (
          <Button
            priority="tertiary"
            type="button"
            iconId="fr-icon-delete-line"
            size="small"
            nativeButtonProps={{
              onClick: () => onRemoveGroup(group.id),
            }}
          >
            Supprimer
          </Button>
        )}
      </div>

      {totalGroups > 1 && (
        <div>
          <p className="mb-2 text-sm font-bold">
            Cliquez pour ajouter ou retirer
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            {allCarcassesRestantes.map((carcasse) => {
              const isInGroup = group.carcasseIds.includes(carcasse.zacharie_carcasse_id);
              const otherGroupLabel = !isInGroup
                ? carcasseToGroupLabel[carcasse.zacharie_carcasse_id]
                : null;
              return (
                <button
                  key={carcasse.zacharie_carcasse_id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onToggleCarcasse(carcasse.zacharie_carcasse_id)}
                  className={[
                    'flex flex-col border-0 border-l-3 border-solid px-2 py-1.5 text-left',
                    'bg-contrast-grey cursor-pointer',
                    isInGroup
                      ? 'border-action-high-blue-france'
                      : otherGroupLabel
                        ? 'border-transparent opacity-40'
                        : 'border-transparent opacity-60',
                  ].join(' ')}
                >
                  <span className="text-sm font-bold">
                    {carcasse.espece}
                    {carcasse.nombre_d_animaux && carcasse.nombre_d_animaux > 1
                      ? ` (${carcasse.nombre_d_animaux})`
                      : ''}
                  </span>
                  <span className="text-xs">N° {carcasse.numero_bracelet}</span>
                  {otherGroupLabel && (
                    <span className="mt-0.5 text-xs text-gray-500">→ {otherGroupLabel}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <SelectCustom
        label="Prochain detenteur des carcasses *"
        isDisabled={disabled}
        hint={
          <>
            <span>
              Indiquez ici la personne ou la structure avec qui vous etes en contact pour prendre en charge
              le gibier.
            </span>
            {!group.recipientEntityId && !disabled && (
              <div>
                {canTransmitCarcassesToEntities.map((entity) => {
                  return (
                    <Tag
                      key={entity.id}
                      iconId="fr-icon-checkbox-circle-line"
                      className="mr-2"
                      nativeButtonProps={{
                        onClick: () => onUpdateGroup(group.id, { recipientEntityId: entity.id }),
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
        placeholder="Selectionnez le prochain detenteur des carcasses"
        value={
          prochainsDetenteursOptions.find((option) => option.value === group.recipientEntityId) ?? null
        }
        getOptionLabel={(f) => f.label!}
        getOptionValue={(f) => f.value}
        onChange={(f) =>
          onUpdateGroup(group.id, { recipientEntityId: f ? f.value : null })
        }
        isClearable={!!group.recipientEntityId}
        inputId={`${Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}_${group.id}`}
        classNamePrefix={`select-prochain-detenteur-${group.id}`}
        required
        creatable
        // @ts-expect-error - onCreateOption is not typed
        onCreateOption={(newOption: string) => {
          onOpenPartenaireModal(group.id, newOption);
        }}
        isReadOnly={!canEdit}
        name={`${Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}_${group.id}`}
      />
      {!!prochainDetenteur && !prochainDetenteur?.zacharie_compatible && (
        <Alert
          severity="warning"
          title="Attention"
          description={`${prochainDetenteur?.nom_d_usage} n'est pas pret pour Zacharie. Vous pouvez contacter un representant avant de leur envoyer leur premiere fiche.`}
        />
      )}
      <RadioButtons
        legend="Lieu de stockage des carcasses *"
        className={canEdit ? '' : 'radio-black'}
        disabled={!group.recipientEntityId}
        options={[
          {
            label: <span className="inline-block">Pas de stockage</span>,
            hintText: (
              <span>
                Sans stockage en chambre froide, les carcasses doivent etre transportees{' '}
                <b>le jour-meme du tir</b>
              </span>
            ),
            nativeInputProps: {
              checked: group.depotType === DepotType.AUCUN,
              readOnly: !canEdit,
              onChange: () => {
                onUpdateGroup(group.id, {
                  depotType: DepotType.AUCUN,
                  depotDate: undefined,
                  depotEntityId: null,
                });
              },
            },
          },
          {
            label:
              "J'ai depose mes carcasses dans un Centre de Collecte du Gibier sauvage (chambre froide)",
            nativeInputProps: {
              checked: group.depotType === DepotType.CCG,
              readOnly: !canEdit,
              onChange: () => {
                onUpdateGroup(group.id, { depotType: DepotType.CCG });
              },
            },
          },
        ]}
      />
      {group.depotType === DepotType.CCG &&
        (ccgsWorkingWith.length > 0 ? (
          <>
            <SelectCustom
              label="Chambre froide (centre de collecte du gibier sauvage) *"
              isDisabled={group.depotType !== DepotType.CCG}
              isReadOnly={!canEdit}
              hint={
                <>
                  {!group.depotEntityId && group.depotType === DepotType.CCG ? (
                    <div>
                      {ccgsWorkingWith.map((entity) => {
                        return (
                          <Tag
                            key={entity.id}
                            iconId="fr-icon-checkbox-circle-line"
                            className="mr-2"
                            nativeButtonProps={{
                              onClick: () => {
                                onUpdateGroup(group.id, { depotEntityId: entity.id });
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
              placeholder="Selectionnez le Centre de Collecte du Gibier sauvage"
              value={ccgsOptions.find((option) => option.value === group.depotEntityId) ?? null}
              getOptionLabel={(f) => f.label!}
              getOptionValue={(f) => f.value}
              onChange={(f) => {
                if (f?.value === 'add_new') {
                  onOpenCcgModal(group.id);
                  return;
                }
                onUpdateGroup(group.id, { depotEntityId: f?.value ?? null });
              }}
              isClearable={!!group.depotEntityId}
              inputId={`${Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id}_${group.id}`}
              classNamePrefix={`select-ccg-${group.id}`}
              required
              name={`${Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id}_${group.id}`}
            />
            <Component
              label="Date de depot dans le Centre de Collecte du Gibier sauvage *"
              disabled={group.depotType !== DepotType.CCG}
              hintText={
                canEdit ? (
                  <button
                    className="inline-block text-left"
                    type="button"
                    disabled={group.depotType !== DepotType.CCG}
                    onClick={() => {
                      onUpdateGroup(group.id, {
                        depotDate: dayjs().format('YYYY-MM-DDTHH:mm'),
                      });
                    }}
                  >
                    <u className="inline">Cliquez ici</u> pour definir la date du jour et maintenant
                  </button>
                ) : null
              }
              nativeInputProps={{
                id: `${Prisma.FeiScalarFieldEnum.premier_detenteur_depot_ccg_at}_${group.id}`,
                name: `${Prisma.FeiScalarFieldEnum.premier_detenteur_depot_ccg_at}_${group.id}`,
                type: 'datetime-local',
                required: true,
                autoComplete: 'off',
                suppressHydrationWarning: true,
                disabled: group.depotType !== DepotType.CCG,
                value: group.depotDate,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  onUpdateGroup(group.id, {
                    depotDate: dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'),
                  });
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
                onClick: () => onOpenCcgModal(group.id),
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
            disabled={!group.recipientEntityId}
            options={[
              {
                label: <span className="inline-block">Je transporte les carcasses moi-meme</span>,
                hintText: (
                  <span>
                    N'oubliez pas de notifier le prochain detenteur des carcasses de votre depot.{' '}
                    {group.depotType === DepotType.AUCUN ? (
                      <>
                        Sans stockage en chambre froide, les carcasses doivent etre transportees{' '}
                        <b>le jour-meme du tir</b>
                      </>
                    ) : (
                      ''
                    )}
                  </span>
                ),
                nativeInputProps: {
                  checked: group.transportType === TransportType.PREMIER_DETENTEUR,
                  readOnly: !canEdit,
                  onChange: () => {
                    onUpdateGroup(group.id, { transportType: TransportType.PREMIER_DETENTEUR });
                  },
                },
              },
              {
                label: 'Le transport est realise par un collecteur professionnel',
                hintText: 'La gestion du transport est sous la responsabilite du prochain detenteur.',
                nativeInputProps: {
                  checked: group.transportType === TransportType.COLLECTEUR_PRO,
                  readOnly: !canEdit,
                  onChange: () => {
                    onUpdateGroup(group.id, {
                      transportType: TransportType.COLLECTEUR_PRO,
                      transportDate: undefined,
                    });
                  },
                },
              },
            ]}
          />
          {group.transportType === TransportType.PREMIER_DETENTEUR && group.depotType === DepotType.CCG && (
            <Component
              label="Date a laquelle je transporte les carcasses"
              disabled={
                group.transportType !== TransportType.PREMIER_DETENTEUR || group.depotType !== DepotType.CCG
              }
              hintText={
                canEdit ? (
                  <>
                    <button
                      className="mr-1 inline-block text-left"
                      type="button"
                      disabled={
                        group.transportType !== TransportType.PREMIER_DETENTEUR ||
                        group.depotType !== DepotType.CCG
                      }
                      onClick={() => {
                        onUpdateGroup(group.id, {
                          transportDate: dayjs().format('YYYY-MM-DDTHH:mm'),
                        });
                      }}
                    >
                      <u className="inline">Cliquez ici</u> pour definir la date du jour et maintenant.
                    </button>
                    A ne remplir que si vous etes le transporteur et que vous stockez les carcasses dans un
                    CCG. Indiquer une date permettra au prochain detenteur de s'organiser.
                  </>
                ) : null
              }
              nativeInputProps={{
                id: `${Prisma.FeiScalarFieldEnum.premier_detenteur_transport_date}_${group.id}`,
                name: `${Prisma.FeiScalarFieldEnum.premier_detenteur_transport_date}_${group.id}`,
                type: 'datetime-local',
                required: true,
                autoComplete: 'off',
                suppressHydrationWarning: true,
                value: group.transportDate,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  onUpdateGroup(group.id, {
                    transportDate: dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'),
                  });
                },
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function getGroupValidationError(
  group: DispatchGroup,
  entities: Record<string, EntityWithUserRelation>,
): string | null {
  if (!group.recipientEntityId) {
    return 'Il manque le prochain detenteur des carcasses';
  }
  if (group.carcasseIds.length === 0) {
    return 'Il faut au moins une carcasse dans ce groupe';
  }
  if (!group.depotType) {
    return 'Il manque le lieu de stockage des carcasses';
  }
  if (group.depotType === DepotType.CCG && !group.depotEntityId) {
    return 'Il manque le centre de collecte du gibier sauvage';
  }
  if (group.depotType === DepotType.CCG && !group.depotDate) {
    return 'Il manque la date de depot dans le centre de collecte du gibier sauvage';
  }
  const prochainDetenteurType = entities[group.recipientEntityId]?.type;
  const needTransport = (() => {
    if (
      prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL ||
      prochainDetenteurType === EntityTypes.COMMERCE_DE_DETAIL ||
      prochainDetenteurType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF
    ) {
      return false;
    }
    return prochainDetenteurType !== EntityTypes.COLLECTEUR_PRO;
  })();
  if (needTransport) {
    if (!group.transportType) {
      return 'Il manque le type de transport';
    }
    if (
      group.transportType === TransportType.PREMIER_DETENTEUR &&
      group.depotType === DepotType.CCG &&
      !group.transportDate
    ) {
      return 'Il manque la date de transport';
    }
  }
  return null;
}

export default function DestinatairePremierDetenteur({
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
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const ccgsIds = useCcgIds();
  const etgsIds = useEtgIds();
  const collecteursProIds = useCollecteursProIds();
  const circuitCourtIds = useCircuitCourtIds();

  const isPartenaireModalOpen = useIsModalOpen(partenaireModal);
  const isCCGModalOpen = useIsModalOpen(ccgModal);
  const isTrichineModalOpen = useIsModalOpen(trichineModal);
  const [dontShowTrichineAgain, setDontShowTrichineAgain] = useState(false);

  const fei = feis[params.fei_numero!];
  const prefilledInfos = usePrefillPremierDétenteurInfos();

  const allCarcasses = useCarcassesForFei(params.fei_numero);

  const carcassesDejaEnvoyees = useMemo(
    () => allCarcasses.filter((c) => c.next_owner_entity_id != null),
    [allCarcasses],
  );
  const carcassesRestantes = useMemo(
    () => allCarcasses.filter((c) => c.next_owner_entity_id == null),
    [allCarcasses],
  );
  const carcassesRestantesIds = useMemo(
    () => carcassesRestantes.map((c) => c.zacharie_carcasse_id),
    [carcassesRestantes],
  );

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

  // Multi-group dispatch state
  const [dispatchGroups, setDispatchGroups] = useState<DispatchGroup[]>(() => {
    const initialRecipient = (() => {
      if (fei.premier_detenteur_prochain_detenteur_id_cache) {
        return fei.premier_detenteur_prochain_detenteur_id_cache;
      }
      if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
        if (prefilledInfos?.premier_detenteur_prochain_detenteur_id_cache) {
          return prefilledInfos.premier_detenteur_prochain_detenteur_id_cache;
        }
      }
      return null;
    })();

    const initialDepotEntityId = (() => {
      if (fei.premier_detenteur_depot_entity_id) {
        return fei.premier_detenteur_depot_entity_id;
      }
      if (fei.premier_detenteur_depot_type === DepotType.AUCUN) {
        return null;
      }
      if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
        if (prefilledInfos?.premier_detenteur_depot_entity_id) {
          return prefilledInfos.premier_detenteur_depot_entity_id;
        }
      }
      return null;
    })();

    const initialDepotType = (() => {
      if (fei.premier_detenteur_depot_type) {
        return fei.premier_detenteur_depot_type;
      }
      if (fei.premier_detenteur_depot_entity_id) {
        const type = entities[fei.premier_detenteur_depot_entity_id]?.type;
        if (type === EntityTypes.CCG) return DepotType.CCG;
        if (type === EntityTypes.ETG) return DepotType.ETG;
        return null;
      }
      if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
        if (prefilledInfos?.premier_detenteur_depot_type) {
          return prefilledInfos.premier_detenteur_depot_type;
        }
      }
      return null;
    })();

    const initialTransportType = (() => {
      if (fei.premier_detenteur_transport_type) {
        return fei.premier_detenteur_transport_type;
      }
      if (prefilledInfos?.premier_detenteur_transport_type) {
        return prefilledInfos.premier_detenteur_transport_type;
      }
      return null;
    })();

    return [
      {
        id: 'group-0',
        recipientEntityId: initialRecipient,
        carcasseIds: carcassesRestantesIds,
        depotType: initialDepotType,
        depotEntityId: initialDepotEntityId,
        depotDate: fei.premier_detenteur_depot_ccg_at
          ? dayjs(fei.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm')
          : undefined,
        transportType: initialTransportType,
        transportDate: fei.premier_detenteur_transport_date
          ? dayjs(fei.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm')
          : undefined,
      },
    ];
  });

  // Track which group opened the partenaire/ccg modal
  const [activeModalGroupId, setActiveModalGroupId] = useState<string | null>(null);
  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState<string | null>(null);

  const onUpdateGroup = useCallback((groupId: string, updates: Partial<DispatchGroup>) => {
    setDispatchGroups((prev) => {
      const next = prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g));

      // If carcasseIds was updated: ensure no carcasse is in two groups
      if (updates.carcasseIds) {
        const updatedGroupIndex = next.findIndex((g) => g.id === groupId);
        const newIds = new Set(updates.carcasseIds);
        for (let i = 0; i < next.length; i++) {
          if (i === updatedGroupIndex) continue;
          next[i] = {
            ...next[i],
            carcasseIds: next[i].carcasseIds.filter((id) => !newIds.has(id)),
          };
        }
      }

      return next;
    });
  }, []);

  const onRemoveGroup = useCallback((groupId: string) => {
    setDispatchGroups((prev) => {
      const removedGroup = prev.find((g) => g.id === groupId);
      if (!removedGroup) return prev;
      const remaining = prev.filter((g) => g.id !== groupId);
      // Put freed carcasses into the first remaining group
      if (remaining.length > 0) {
        remaining[0] = {
          ...remaining[0],
          carcasseIds: [...remaining[0].carcasseIds, ...removedGroup.carcasseIds],
        };
      }
      return remaining;
    });
  }, []);

  const addGroup = useCallback(() => {
    setDispatchGroups((prev) => {
      const newGroup: DispatchGroup = {
        id: `group-${Date.now()}`,
        recipientEntityId: null,
        carcasseIds: [],
        depotType: null,
        depotEntityId: null,
        depotDate: undefined,
        transportType: null,
        transportDate: undefined,
      };
      return [...prev, newGroup];
    });
  }, []);

  // Trichine modal check (any group going to circuit court with sanglier)
  const hasSanglier = useMemo(() => {
    return carcassesRestantes.some((carcasse) => carcasse.espece === 'Sanglier');
  }, [carcassesRestantes]);

  const trichineMessage = useMemo(() => {
    // Check if any group has a circuit court recipient
    for (const group of dispatchGroups) {
      if (!group.recipientEntityId) continue;
      const type = entities[group.recipientEntityId]?.type;
      if (
        type === EntityTypes.COMMERCE_DE_DETAIL ||
        type === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF ||
        type === EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE ||
        type === EntityTypes.ASSOCIATION_CARITATIVE
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
      if (type === EntityTypes.CONSOMMATEUR_FINAL) {
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
                <strong>Important :</strong> La cuisson doit etre complete (coeur de la viande a 70C minimum)
                pour eliminer tout risque de contamination.
              </p>
            </>
          ),
        };
      }
    }
    return null;
  }, [dispatchGroups, entities]);

  const shouldShowTrichineModal = useMemo(() => {
    if (!hasSanglier || !trichineMessage) return false;
    return localStorage.getItem('trichine-modal-dont-show-again') !== 'true';
  }, [hasSanglier, trichineMessage]);

  // Unassigned carcasses (restantes not in any group)
  const unassignedCarcasses = useMemo(() => {
    const assignedIds = new Set(dispatchGroups.flatMap((g) => g.carcasseIds));
    return carcassesRestantes.filter((c) => !assignedIds.has(c.zacharie_carcasse_id));
  }, [dispatchGroups, carcassesRestantes]);

  // Validation
  const globalValidationError = useMemo(() => {
    for (let i = 0; i < dispatchGroups.length; i++) {
      const error = getGroupValidationError(dispatchGroups[i], entities);
      if (error) {
        return dispatchGroups.length > 1
          ? `Destinataire ${i + 1} : ${error}`
          : error;
      }
    }
    if (unassignedCarcasses.length > 0) {
      return `${unassignedCarcasses.length} carcasse(s) ne sont attribuees a aucun destinataire`;
    }
    return null;
  }, [dispatchGroups, entities, unassignedCarcasses]);

  const totalCarcassesToSend = useMemo(() => {
    return dispatchGroups.reduce((acc, g) => acc + g.carcasseIds.length, 0);
  }, [dispatchGroups]);

  const submitLabel = useMemo(() => {
    if (carcassesDejaEnvoyees.length === 0 && totalCarcassesToSend === allCarcasses.length) {
      return 'Transmettre la fiche';
    }
    return `Transmettre ${totalCarcassesToSend} carcasse${totalCarcassesToSend > 1 ? 's' : ''} sur ${allCarcasses.length}`;
  }, [carcassesDejaEnvoyees.length, totalCarcassesToSend, allCarcasses.length]);

  const handleSubmit = () => {
    // Process each dispatch group
    for (const group of dispatchGroups) {
      if (!group.recipientEntityId) continue;
      const prochainDetenteurType = entities[group.recipientEntityId]?.type;
      const needTransport = (() => {
        if (
          prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL ||
          prochainDetenteurType === EntityTypes.COMMERCE_DE_DETAIL ||
          prochainDetenteurType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF
        ) {
          return false;
        }
        return prochainDetenteurType !== EntityTypes.COLLECTEUR_PRO;
      })();
      const nextDepotEntityId = group.depotType === DepotType.AUCUN ? null : group.depotEntityId;
      const nextDepotDate = group.depotDate ? dayjs(group.depotDate).toDate() : null;
      const nextTransportType = needTransport ? group.transportType : null;
      const nextTransportDate = nextTransportType
        ? group.transportDate
          ? dayjs(group.transportDate).toDate()
          : null
        : null;

      // Update transmission (next_owner) for the carcasses in this group
      updateCarcassesTransmission(group.carcasseIds, {
        next_owner_entity_id: group.recipientEntityId,
        next_owner_role: entities[group.recipientEntityId]?.type as FeiOwnerRole,
      });

      // Update per-carcasse dispatch details
      for (const carcasseId of group.carcasseIds) {
        updateCarcasse(
          carcasseId,
          {
            premier_detenteur_prochain_detenteur_role_cache: entities[group.recipientEntityId]
              ?.type as FeiOwnerRole,
            premier_detenteur_prochain_detenteur_id_cache: group.recipientEntityId,
            premier_detenteur_depot_type: group.depotType,
            premier_detenteur_depot_entity_id: nextDepotEntityId,
            premier_detenteur_depot_entity_name_cache: nextDepotEntityId
              ? entities[nextDepotEntityId]?.nom_d_usage
              : null,
            premier_detenteur_depot_ccg_at: nextDepotDate,
            premier_detenteur_transport_type: nextTransportType,
            premier_detenteur_transport_date: nextTransportDate,
          },
          false,
        );
      }
    }

    // FEI-level retrocompat: use first group's values
    const firstGroup = dispatchGroups[0];
    if (firstGroup?.recipientEntityId) {
      const prochainDetenteurType = entities[firstGroup.recipientEntityId]?.type;
      const needTransport = (() => {
        if (
          prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL ||
          prochainDetenteurType === EntityTypes.COMMERCE_DE_DETAIL ||
          prochainDetenteurType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF
        ) {
          return false;
        }
        return prochainDetenteurType !== EntityTypes.COLLECTEUR_PRO;
      })();
      const nextDepotEntityId = firstGroup.depotType === DepotType.AUCUN ? null : firstGroup.depotEntityId;
      const nextDepotDate = firstGroup.depotDate ? dayjs(firstGroup.depotDate).toDate() : null;
      const nextTransportType = needTransport ? firstGroup.transportType : null;
      const nextTransportDate = nextTransportType
        ? firstGroup.transportDate
          ? dayjs(firstGroup.transportDate).toDate()
          : null
        : null;

      const nextFei: Partial<typeof fei> = {
        fei_next_owner_entity_id: firstGroup.recipientEntityId,
        fei_next_owner_role: entities[firstGroup.recipientEntityId]?.type as FeiOwnerRole,
        premier_detenteur_prochain_detenteur_id_cache: firstGroup.recipientEntityId,
        premier_detenteur_prochain_detenteur_role_cache: entities[firstGroup.recipientEntityId]
          ?.type as FeiOwnerRole,
        premier_detenteur_depot_type: firstGroup.depotType,
        premier_detenteur_depot_entity_id: nextDepotEntityId,
        premier_detenteur_depot_entity_name_cache: nextDepotEntityId
          ? entities[nextDepotEntityId]?.nom_d_usage
          : null,
        premier_detenteur_depot_ccg_at: nextDepotDate,
        premier_detenteur_transport_type: nextTransportType,
        premier_detenteur_transport_date: nextTransportDate,
      };
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
    }

    syncData('premier-detenteur-need-select-next-select-destinataire');
    navigate(`/app/tableau-de-bord/fei/${fei.numero}/envoyée`);
  };

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y a pas encore de premier detenteur pour cette fiche";
  }

  // Group already-sent carcasses by recipient for display
  const dejaEnvoyeesParDestinataire = useMemo(() => {
    const grouped: Record<string, Carcasse[]> = {};
    for (const c of carcassesDejaEnvoyees) {
      const key = c.next_owner_entity_id || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    }
    return grouped;
  }, [carcassesDejaEnvoyees]);

  const onToggleCarcasse = useCallback((groupId: string, carcasseId: string) => {
    setDispatchGroups((prev) => {
      const targetGroup = prev.find((g) => g.id === groupId);
      const isIn = targetGroup?.carcasseIds.includes(carcasseId);
      return prev.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            carcasseIds: isIn
              ? g.carcasseIds.filter((id) => id !== carcasseId)
              : [...g.carcasseIds, carcasseId],
          };
        }
        // Remove from other groups when adding to this one
        if (!isIn) {
          return {
            ...g,
            carcasseIds: g.carcasseIds.filter((id) => id !== carcasseId),
          };
        }
        return g;
      });
    });
  }, []);

  return (
    <>
      <div
        className={[
          className,
          disabled ? 'cursor-not-allowed opacity-50' : '',
          canEdit ? '' : 'cursor-not-allowed',
          'space-y-4',
        ].join(' ')}
      >
        {/* Already-sent carcasses summary */}
        {carcassesDejaEnvoyees.length > 0 && (
          <Alert
            severity="success"
            title="Carcasses deja attribuees"
            description={
              <div className="mt-2 space-y-3">
                {Object.entries(dejaEnvoyeesParDestinataire).map(([entityId, carcasses]) => {
                  const entity = entities[entityId];
                  return (
                    <div key={entityId}>
                      <p className="mb-1 text-sm font-bold">
                        {entity?.nom_d_usage ?? entityId}
                        <Badge severity="success" small noIcon as="span" className="ml-2">
                          {carcasses.length} carcasse{carcasses.length > 1 ? 's' : ''}
                        </Badge>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {carcasses.map((c) => (
                          <Tag key={c.zacharie_carcasse_id} small>
                            {c.numero_bracelet} - {c.espece}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          />
        )}

        {carcassesRestantes.length === 0 && carcassesDejaEnvoyees.length > 0 && (
          <Alert
            severity="info"
            title="Toutes les carcasses ont ete attribuees"
            description="Il n'y a plus de carcasses a envoyer."
          />
        )}

        {carcassesRestantes.length > 0 && (
          <>
            {/* Dispatch groups */}
            {dispatchGroups.map((group, index) => {
              // Map each carcasse to the label of the OTHER group it belongs to
              const carcasseToGroupLabel: Record<string, string> = {};
              for (const g of dispatchGroups) {
                if (g.id === group.id) continue;
                const gIndex = dispatchGroups.indexOf(g);
                const label = g.recipientEntityId
                  ? entities[g.recipientEntityId]?.nom_d_usage ?? `Dest. ${gIndex + 1}`
                  : `Dest. ${gIndex + 1}`;
                for (const cId of g.carcasseIds) {
                  carcasseToGroupLabel[cId] = label;
                }
              }

              return (
                <DispatchGroupForm
                  key={group.id}
                  group={group}
                  groupIndex={index}
                  totalGroups={dispatchGroups.length}
                  canEdit={canEdit}
                  disabled={disabled}
                  entities={entities}
                  prochainsDetenteursOptions={prochainsDetenteursOptions}
                  canTransmitCarcassesToEntities={canTransmitCarcassesToEntities}
                  ccgsOptions={ccgsOptions}
                  ccgsWorkingWith={ccgsWorkingWith}
                  allCarcassesRestantes={carcassesRestantes}
                  carcasseToGroupLabel={carcasseToGroupLabel}
                  onToggleCarcasse={(carcasseId) => onToggleCarcasse(group.id, carcasseId)}
                  onUpdateGroup={onUpdateGroup}
                  onRemoveGroup={onRemoveGroup}
                  onOpenPartenaireModal={(groupId, nomDUsage) => {
                    setActiveModalGroupId(groupId);
                    setNewEntityNomDUsage(nomDUsage ?? null);
                    partenaireModal.open();
                  }}
                  onOpenCcgModal={(groupId) => {
                    setActiveModalGroupId(groupId);
                    ccgModal.open();
                  }}
                />
              );
            })}

            {/* Unassigned carcasses warning */}
            {unassignedCarcasses.length > 0 && dispatchGroups.length > 1 && (
              <Alert
                severity="warning"
                title={`${unassignedCarcasses.length} carcasse${unassignedCarcasses.length > 1 ? 's' : ''} non attribuee${unassignedCarcasses.length > 1 ? 's' : ''}`}
                description={
                  <div className="mt-1 flex flex-wrap gap-1">
                    {unassignedCarcasses.map((c) => (
                      <Tag key={c.zacharie_carcasse_id} small>
                        {c.numero_bracelet} - {c.espece}
                      </Tag>
                    ))}
                  </div>
                }
              />
            )}

            {/* Add another recipient button */}
            {canEdit && carcassesRestantes.length > 1 && (
              <Button
                priority="secondary"
                type="button"
                iconId="fr-icon-add-line"
                nativeButtonProps={{ onClick: addGroup }}
              >
                Ajouter un autre destinataire
              </Button>
            )}

            {/* Submit button */}
            {canEdit && (
              <Button
                className="mt-4"
                type="submit"
                disabled={disabled}
                nativeButtonProps={{
                  onClick: async (event) => {
                    event.preventDefault();
                    if (globalValidationError) {
                      alert(globalValidationError);
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
                {submitLabel}
              </Button>
            )}
            {!disabled && globalValidationError && (
              <Alert title="Attention" className="mt-4" severity="error" description={globalValidationError} />
            )}
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
              if (newEntity && activeModalGroupId) {
                onUpdateGroup(activeModalGroupId, { recipientEntityId: newEntity.id });
              }
            }}
          />
        )}
      </partenaireModal.Component>
      <ccgModal.Component title="Ajouter une chambre froide (CCG)">
        {isCCGModalOpen && (
          <CCGNouveau
            onFinish={(newEntity) => {
              ccgModal.close();
              if (newEntity && activeModalGroupId) {
                onUpdateGroup(activeModalGroupId, { depotEntityId: newEntity.id });
              }
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
