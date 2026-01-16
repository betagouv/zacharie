import {
  DepotType,
  TransportType,
  EntityRelationType,
  FeiOwnerRole,
  EntityTypes,
  Entity
} from '@prisma/client';
import dayjs from 'dayjs';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import InputNotEditable from '@app/components/InputNotEditable';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { EntityWithUserRelation } from '@api/src/types/entity';
import { UserForFei } from '@api/src/types/user';
import { useMemo } from 'react';

export type DestinataireGroupData = {
  recipientId: string | null;
  depotType: DepotType | null;
  depotEntityId: string | null;
  depotDate: string | undefined;
  transportType: TransportType | null;
  transportDate: string | undefined;
};

type EntityWithRelation = Entity & { relation?: EntityRelationType };

type Props = {
  index: number;
  data: DestinataireGroupData;
  onChange: (data: DestinataireGroupData) => void;
  canEdit: boolean;
  disabled?: boolean;
  sousTraite?: boolean;
  premierDetenteurEntity?: EntityWithUserRelation | null;
  premierDetenteurUser?: UserForFei | null;
  entities: Record<string, Entity>;
  prochainsDetenteurs: EntityWithRelation[];
  ccgs: Entity[];
  ccgsWorkingWith: EntityWithRelation[];
  ccgsOptions: any[];
  onAddNewEntity: (name: string) => void;
  onNavigateToCcgs: () => void;
  feiCurrentOwnerRole?: FeiOwnerRole;
  intermediaireEntityType?: string;
  intermediaire?: any;
};

export default function DestinataireSubForm({
  index,
  data,
  onChange,
  canEdit,
  disabled,
  sousTraite,
  premierDetenteurEntity,
  premierDetenteurUser,
  entities,
  prochainsDetenteurs,
  ccgs,
  ccgsWorkingWith,
  ccgsOptions,
  onAddNewEntity,
  onNavigateToCcgs,
  feiCurrentOwnerRole,
  intermediaireEntityType,
  intermediaire,
}: Props) {
  const Component = canEdit ? Input : InputNotEditable;

  const prochainsDetenteursOptions = useMemo(() => {
    return prochainsDetenteurs.map((entity) => ({
      label: getEntityDisplay(entity),
      value: entity.id,
    }));
  }, [prochainsDetenteurs]);

  const canTransmitCarcassesToEntities = useMemo(() => {
    return prochainsDetenteurs.filter(
      (entity) =>
        entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY ||
        entity.relation === EntityRelationType.WORKING_FOR_ENTITY_RELATED_WITH,
    );
  }, [prochainsDetenteurs]);

  const prochainDetenteur = data.recipientId ? entities[data.recipientId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;

  const needTransport = useMemo(() => {
    if (sousTraite) return false;
    if (premierDetenteurEntity || premierDetenteurUser) {
      if (
        prochainDetenteurType === EntityTypes.CONSOMMATEUR_FINAL ||
        prochainDetenteurType === EntityTypes.COMMERCE_DE_DETAIL ||
        prochainDetenteurType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF
      ) {
        return false;
      }
      return prochainDetenteurType !== EntityTypes.COLLECTEUR_PRO;
    }
    return false;
  }, [sousTraite, premierDetenteurEntity, premierDetenteurUser, prochainDetenteurType]);

  const needDepot = useMemo(() => {
    if (sousTraite) return false;
    if (premierDetenteurEntity) return true;
    if (intermediaireEntityType === EntityTypes.ETG) return false;
    return true;
  }, [sousTraite, premierDetenteurEntity, intermediaireEntityType]);

  const updateData = (updates: Partial<DestinataireGroupData>) => {
    onChange({ ...data, ...updates });
  };

  return (
    <div className={`space-y-6 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
      <SelectCustom
        label="Prochain détenteur des carcasses *"
        isDisabled={disabled}
        hint={
          <>
            <span>
              Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en charge
              le gibier.
            </span>
            {!data.recipientId && !disabled && (
              <div>
                {canTransmitCarcassesToEntities.map((entity) => {
                  return (
                    <Tag
                      key={entity.id}
                      iconId="fr-icon-checkbox-circle-line"
                      className="mr-2"
                      nativeButtonProps={{
                        onClick: () => updateData({ recipientId: entity.id }),
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
          prochainsDetenteursOptions.find((option) => option.value === data.recipientId) ?? null
        }
        getOptionLabel={(f) => f.label!}
        getOptionValue={(f) => f.value}
        onChange={(f) => updateData({ recipientId: f ? f.value : null })}
        isClearable={!!data.recipientId}
        inputId={`recipient-${index}`}
        classNamePrefix={`select-prochain-detenteur`}
        required
        creatable
        // @ts-expect-error - onCreateOption is not typed
        onCreateOption={(newOption) => onAddNewEntity(newOption)}
        isReadOnly={!canEdit}
        name={`recipient-${index}`}
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
            disabled={!data.recipientId}
            options={[
              {
                label: <span className="inline-block">Pas de stockage</span>,
                hintText:
                  feiCurrentOwnerRole === FeiOwnerRole.PREMIER_DETENTEUR ? (
                    <span>
                      Sans stockage en chambre froide, les carcasses doivent être transportées{' '}
                      <b>le jour-même du tir</b>
                    </span>
                  ) : (
                    <span>Les carcasses sont livrées chez le destinataire</span>
                  ),
                nativeInputProps: {
                  checked: data.depotType === DepotType.AUCUN,
                  readOnly: !canEdit,
                  onChange: () => {
                    updateData({
                      depotType: DepotType.AUCUN,
                      depotDate: undefined,
                      depotEntityId: null,
                    });
                  },
                },
              },
              {
                label:
                  "J'ai déposé mes carcasses dans un Centre de Collecte du Gibier sauvage (chambre froide)",
                nativeInputProps: {
                  checked: data.depotType === DepotType.CCG,
                  readOnly: !canEdit,
                  onChange: () => {
                    updateData({ depotType: DepotType.CCG });
                  },
                },
              },
            ]}
          />
          {data.depotType === DepotType.CCG &&
            (ccgsWorkingWith.length > 0 ? (
              <>
                <SelectCustom
                  label="Chambre froide (centre de collecte du gibier sauvage) *"
                  isDisabled={data.depotType !== DepotType.CCG}
                  isReadOnly={!canEdit}
                  hint={
                    <>
                      {!data.depotEntityId && data.depotType === DepotType.CCG ? (
                        <div>
                          {ccgsWorkingWith.map((entity) => {
                            return (
                              <Tag
                                key={entity.id}
                                iconId="fr-icon-checkbox-circle-line"
                                className="mr-2"
                                nativeButtonProps={{
                                  onClick: () => {
                                    updateData({ depotEntityId: entity.id });
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
                  value={ccgsOptions.find((option) => option.value === data.depotEntityId) ?? null}
                  getOptionLabel={(f) => f.label!}
                  getOptionValue={(f) => f.value}
                  onChange={(f) => {
                    if (f?.value === 'add_new') {
                      onNavigateToCcgs();
                      return;
                    }
                    updateData({ depotEntityId: f?.value ?? null });
                  }}
                  isClearable={!!data.depotEntityId}
                  inputId={`depot-entity-${index}`}
                  classNamePrefix={`select-ccg`}
                  required
                  name={`depot-entity-${index}`}
                />
                {feiCurrentOwnerRole === FeiOwnerRole.PREMIER_DETENTEUR && (
                  <Component
                    label="Date de dépôt dans le Centre de Collecte du Gibier sauvage *"
                    disabled={data.depotType !== DepotType.CCG}
                    hintText={
                      canEdit ? (
                        <button
                          className="inline-block text-left"
                          type="button"
                          disabled={data.depotType !== DepotType.CCG}
                          onClick={() => {
                            updateData({ depotDate: dayjs().format('YYYY-MM-DDTHH:mm') });
                          }}
                        >
                          <u className="inline">Cliquez ici</u> pour définir la date du jour et maintenant
                        </button>
                      ) : null
                    }
                    nativeInputProps={{
                      id: `depot-date-${index}`,
                      name: `depot-date-${index}`,
                      type: 'datetime-local',
                      required: true,
                      autoComplete: 'off',
                      suppressHydrationWarning: true,
                      disabled: data.depotType !== DepotType.CCG,
                      value: data.depotDate,
                      onChange: (e) => {
                        updateData({ depotDate: dayjs(e.target.value).format('YYYY-MM-DDTHH:mm') });
                      },
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <label>Chambre froide (centre de collecte du gibier sauvage) *</label>
                <Button
                  priority="tertiary no outline"
                  nativeButtonProps={{
                      onClick:  (e) => {
                          e.preventDefault();
                          onNavigateToCcgs();
                      }
                  }}
                >
                  Renseigner ma chambre froide (CCG)
                </Button>
              </div>
            ))}
        </>
      )}
      {needTransport && (
        <>
          <RadioButtons
            legend="Transport des carcasses jusqu’au destinataire *"
            className={canEdit ? '' : 'radio-black'}
            disabled={!data.recipientId}
            options={[
              {
                label: <span className="inline-block">Je transporte les carcasses moi-même</span>,
                hintText: (
                  <span>
                    N'oubliez pas de notifier le prochain détenteur des carcasses de votre dépôt.{' '}
                    {data.depotType === DepotType.AUCUN ? (
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
                  checked: data.transportType === TransportType.PREMIER_DETENTEUR,
                  readOnly: !canEdit,
                  onChange: () => {
                    updateData({ transportType: TransportType.PREMIER_DETENTEUR });
                  },
                },
              },
              {
                label: 'Le transport est réalisé par un collecteur professionnel',
                hintText: 'La gestion du transport est sous la responsabilité du prochain détenteur.',
                nativeInputProps: {
                  checked: data.transportType === TransportType.COLLECTEUR_PRO,
                  readOnly: !canEdit,
                  onChange: () => {
                     updateData({
                        transportType: TransportType.COLLECTEUR_PRO,
                        transportDate: undefined
                     })
                  },
                },
              },
            ]}
          />
          {data.transportType === TransportType.PREMIER_DETENTEUR && data.depotType === DepotType.CCG && (
            <Component
              label="Date à laquelle je transporte les carcasses"
              disabled={data.transportType !== TransportType.PREMIER_DETENTEUR || data.depotType !== DepotType.CCG}
              hintText={
                canEdit ? (
                  <>
                    <button
                      className="mr-1 inline-block text-left"
                      type="button"
                      disabled={
                        data.transportType !== TransportType.PREMIER_DETENTEUR || data.depotType !== DepotType.CCG
                      }
                      onClick={() => {
                        updateData({ transportDate: dayjs().format('YYYY-MM-DDTHH:mm') });
                      }}
                    >
                      <u className="inline">Cliquez ici</u> pour définir la date du jour et maintenant.
                    </button>
                    À ne remplir que si vous êtes le transporteur et que vous stockez les carcasses dans un
                    CCG. Indiquer une date permettra au prochain détenteur de s'organiser.
                  </>
                ) : null
              }
              nativeInputProps={{
                id: `transport-date-${index}`,
                name: `transport-date-${index}`,
                type: 'datetime-local',
                required: true,
                autoComplete: 'off',
                suppressHydrationWarning: true,
                value: data.transportDate,
                onChange: (e) => {
                  updateData({ transportDate: dayjs(e.target.value).format('YYYY-MM-DDTHH:mm') });
                },
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
