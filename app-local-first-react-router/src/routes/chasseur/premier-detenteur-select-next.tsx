import { useNavigate, useParams } from 'react-router';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
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
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { CompteEnAttenteValidationAlert } from '@app/components/CompteEnAttenteValidation';
import { formatCarcasseLotCount } from '@app/utils/count-carcasses';
import {
  useCcgIds,
  useEtgIds,
  useCollecteursProIds,
  useCircuitCourtIds,
} from '@app/utils/get-entity-relations';
import { usePrefillPremierDétenteurInfos } from '@app/utils/usePrefillPremierDétenteur';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { getCarcasseTransmission } from '@app/utils/get-carcasses-transmission';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import CCGNouveau from '@app/components/CCGNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import type { EntityWithUserRelation } from '~/src/types/entity';
import { CarcasseTransmission } from '@app/types/carcasse';
import { isCarcasseDejaEnvoyee } from '@app/utils/carcasse-deja-envoyee';

export interface DestinatairePremierDetenteurHandle {
  validate: () => string | null;
  submit: () => void;
}

// Une vente / un don = un prochain détenteur + son stockage + son transport + les carcasses concernées.
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

const dispatchModal = createModal({
  isOpenedByDefault: false,
  id: 'dispatch-modal-pd',
});

const trichineModal = createModal({
  isOpenedByDefault: false,
  id: 'trichine-modal-pd',
});

// Le transport est à renseigner par le premier détenteur sauf quand le prochain détenteur
// vient chercher les carcasses lui-même (collecteur) ou est en bout de chaîne (conso final, circuit court).
function needTransportForType(type?: EntityTypes | null): boolean {
  if (
    type === EntityTypes.CONSOMMATEUR_FINAL ||
    type === EntityTypes.COMMERCE_DE_DETAIL ||
    type === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF
  ) {
    return false;
  }
  return type !== EntityTypes.COLLECTEUR_PRO;
}

function getDepotLabel(group: DispatchGroup, entities: Record<string, EntityWithUserRelation>): string {
  if (group.depotType === DepotType.CCG) {
    const name = group.depotEntityId ? entities[group.depotEntityId]?.nom_d_usage : null;
    return name ? `Chambre froide ${name}` : 'Chambre froide (CCG)';
  }
  return 'Pas de stockage';
}

function getTransportLabel(
  group: DispatchGroup,
  entities: Record<string, EntityWithUserRelation>
): string | null {
  const type = group.recipientEntityId ? entities[group.recipientEntityId]?.type : null;
  if (!needTransportForType(type)) return null;
  if (group.transportType === TransportType.PREMIER_DETENTEUR) return 'Je transporte moi-même';
  if (group.transportType === TransportType.COLLECTEUR_PRO)
    return 'Transporté par un collecteur professionnel';
  return '—';
}

interface GroupFieldErrors {
  recipientEntityId?: string;
  carcasseIds?: string;
  depotType?: string;
  depotEntityId?: string;
  depotDate?: string;
  transportType?: string;
  transportDate?: string;
}

function getGroupFieldErrors(
  group: DispatchGroup,
  entities: Record<string, EntityWithUserRelation>
): GroupFieldErrors {
  const errors: GroupFieldErrors = {};
  if (!group.recipientEntityId) {
    errors.recipientEntityId = 'Veuillez sélectionner le prochain détenteur des carcasses';
  }
  if (group.carcasseIds.length === 0) {
    errors.carcasseIds = 'Veuillez sélectionner au moins une carcasse pour cette vente ou ce don';
  }
  if (!group.depotType) {
    errors.depotType = 'Veuillez indiquer le lieu de stockage des carcasses';
  }
  if (group.depotType === DepotType.CCG && !group.depotEntityId) {
    errors.depotEntityId = 'Veuillez sélectionner la chambre froide';
  }
  if (group.depotType === DepotType.CCG && !group.depotDate) {
    errors.depotDate = 'Veuillez indiquer la date de dépôt dans la chambre froide';
  }
  const prochainDetenteurType = group.recipientEntityId ? entities[group.recipientEntityId]?.type : null;
  if (needTransportForType(prochainDetenteurType)) {
    if (!group.transportType) {
      errors.transportType = 'Veuillez indiquer le mode de transport des carcasses';
    }
    if (
      group.transportType === TransportType.PREMIER_DETENTEUR &&
      group.depotType === DepotType.CCG &&
      !group.transportDate
    ) {
      errors.transportDate = 'Veuillez indiquer la date de transport des carcasses';
    }
  }
  return errors;
}

// Champs validés à chaque étape de la modale, avant de pouvoir passer à la suivante.
const STEP_FIELDS: Record<string, Array<keyof GroupFieldErrors>> = {
  Destinataire: ['recipientEntityId'],
  Carcasses: ['carcasseIds'],
  Stockage: ['depotType', 'depotEntityId', 'depotDate'],
  Transport: ['transportType', 'transportDate'],
};

// Priority order used to surface a single message for the global validation string.
const GROUP_FIELD_ERROR_ORDER: Array<keyof GroupFieldErrors> = [
  'recipientEntityId',
  'carcasseIds',
  'depotType',
  'depotEntityId',
  'depotDate',
  'transportType',
  'transportDate',
];

function getGroupValidationError(
  group: DispatchGroup,
  entities: Record<string, EntityWithUserRelation>
): string | null {
  const errors = getGroupFieldErrors(group, entities);
  for (const key of GROUP_FIELD_ERROR_ORDER) {
    if (errors[key]) {
      return errors[key]!;
    }
  }
  return null;
}

// === Carte résumé d'une vente / d'un don (formulaire refermé) ===
function DispatchGroupCard({
  group,
  index,
  totalGroups,
  entities,
  groupCarcasses,
  canEdit,
  onEdit,
  onDelete,
}: {
  group: DispatchGroup;
  index: number;
  totalGroups: number;
  entities: Record<string, EntityWithUserRelation>;
  groupCarcasses: Carcasse[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const recipient = group.recipientEntityId ? entities[group.recipientEntityId] : null;
  const title = recipient?.nom_d_usage ?? `Vente / don ${index + 1}`;
  const transportLabel = getTransportLabel(group, entities);
  return (
    <div className="bg-contrast-grey flex basis-full flex-row items-center justify-between text-left">
      <button
        className="flex flex-1 flex-row items-center gap-3 border-none p-4 text-left hover:bg-transparent"
        type="button"
        onClick={onEdit}
      >
        <div className="flex flex-1 flex-col">
          {totalGroups > 1 && <span className="text-xs text-gray-500">Vente / don {index + 1}</span>}
          <p className="text-base font-bold">{title}</p>
          <p className="text-sm/4">{formatCarcasseLotCount(groupCarcasses)}</p>
          <p className="text-sm/4">{getDepotLabel(group, entities)}</p>
          {transportLabel && <p className="text-sm/4">{transportLabel}</p>}
        </div>
      </button>
      {canEdit && (
        <div className="flex shrink-0 flex-row gap-2 pr-4">
          <Button
            type="button"
            iconId="fr-icon-pencil-line"
            onClick={onEdit}
            title="Modifier"
            priority="tertiary no outline"
          />
          {totalGroups > 1 && (
            <Button
              type="button"
              iconId="fr-icon-delete-bin-line"
              onClick={onDelete}
              title="Supprimer"
              priority="tertiary no outline"
            />
          )}
        </div>
      )}
    </div>
  );
}

// === Formulaire d'une vente / d'un don (contenu de la modale, en étapes) ===
function DispatchGroupForm({
  group,
  canEdit,
  showCarcasseSelector,
  currentStep,
  steps,
  entities,
  prochainsDetenteursOptions,
  canTransmitCarcassesToEntities,
  ccgsOptions,
  ccgsWorkingWith,
  allCarcassesRestantes,
  carcasseToGroupLabel,
  fieldErrors,
  showErrors,
  onToggleCarcasse,
  onChange,
}: {
  group: DispatchGroup;
  canEdit: boolean;
  showCarcasseSelector: boolean;
  currentStep: number;
  steps: string[];
  entities: Record<string, EntityWithUserRelation>;
  prochainsDetenteursOptions: Array<{ label: string | null; value: string }>;
  canTransmitCarcassesToEntities: EntityWithUserRelation[];
  ccgsOptions: Array<{ label: string | null; value: string; isLink?: boolean }>;
  ccgsWorkingWith: EntityWithUserRelation[];
  allCarcassesRestantes: Carcasse[];
  carcasseToGroupLabel: Record<string, string>;
  fieldErrors: GroupFieldErrors;
  showErrors: boolean;
  onToggleCarcasse: (carcasseId: string) => void;
  onChange: (updates: Partial<DispatchGroup>) => void;
}) {
  const prochainDetenteur = group.recipientEntityId ? entities[group.recipientEntityId] : null;

  // Création inline (pas de modale imbriquée dans la modale de vente / don).
  const [creatingPartenaire, setCreatingPartenaire] = useState<string | null>(null);
  const [creatingCcg, setCreatingCcg] = useState(false);

  const groupCarcasses = useMemo(() => {
    const idSet = new Set(group.carcasseIds);
    return allCarcassesRestantes.filter((c) => idSet.has(c.zacharie_carcasse_id));
  }, [group.carcasseIds, allCarcassesRestantes]);

  const Component = canEdit ? Input : InputNotEditable;

  const errorFor = (key: keyof GroupFieldErrors) => (showErrors ? fieldErrors[key] : undefined);

  // En édition on n'affiche que l'étape courante ; en lecture seule on empile tout.
  const currentStepName = steps[currentStep - 1];
  const showStep = (name: string) => !canEdit || currentStepName === name;

  return (
    <div className="space-y-4">
      {canEdit && (
        <Stepper
          currentStep={currentStep}
          stepCount={steps.length}
          title={currentStepName}
          nextTitle={steps[currentStep]}
        />
      )}

      {/* Étape 1 — Destinataire */}
      {showStep('Destinataire') && (
        <>
          {creatingPartenaire !== null ? (
            <div className="rounded border border-gray-300 p-3">
              <p className="mb-2 text-sm font-bold">Ajouter un destinataire</p>
              <PartenaireNouveau
                key={creatingPartenaire}
                newEntityNomDUsageProps={creatingPartenaire || undefined}
                onFinish={(newEntity) => {
                  if (newEntity) {
                    onChange({ recipientEntityId: newEntity.id });
                  }
                  setCreatingPartenaire(null);
                }}
              />
            </div>
          ) : (
            <div>
              <SelectCustom
                label="Prochain détenteur des carcasses"
                hint={
                  <>
                    <span>
                      Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en
                      charge le gibier.
                    </span>
                    {!group.recipientEntityId && canEdit && (
                      <div>
                        {canTransmitCarcassesToEntities.map((entity) => {
                          return (
                            <button
                              key={entity.id}
                              type="button"
                              className="mr-2 rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                              onClick={() => onChange({ recipientEntityId: entity.id })}
                            >
                              {entity.nom_d_usage}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                }
                options={prochainsDetenteursOptions}
                placeholder="Sélectionnez le prochain détenteur des carcasses"
                value={
                  prochainsDetenteursOptions.find((option) => option.value === group.recipientEntityId) ??
                  null
                }
                getOptionLabel={(f) => f.label!}
                getOptionValue={(f) => f.value}
                onChange={(f) => onChange({ recipientEntityId: f ? f.value : null })}
                isClearable={!!group.recipientEntityId}
                inputId={`${Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}_${group.id}`}
                classNamePrefix={`select-prochain-detenteur-${group.id}`}
                required
                creatable
                // @ts-expect-error - onCreateOption is not typed
                onCreateOption={(newOption: string) => {
                  setCreatingPartenaire(newOption ?? '');
                }}
                isReadOnly={!canEdit}
                name={`${Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}_${group.id}`}
              />
              {errorFor('recipientEntityId') && (
                <p className="fr-error-text mt-1">{errorFor('recipientEntityId')}</p>
              )}
            </div>
          )}

          {!!prochainDetenteur && !prochainDetenteur?.zacharie_compatible && (
            <Alert
              severity="warning"
              title="Attention"
              description={`${prochainDetenteur?.nom_d_usage} n'est pas prêt pour Zacharie. Vous pouvez contacter un représentant avant de leur envoyer leur première fiche.`}
            />
          )}
        </>
      )}

      {/* Étape 2 — Carcasses concernées */}
      {showCarcasseSelector && showStep('Carcasses') && (
        <div>
          <p className="mb-2 text-sm font-bold">Sélectionnez les carcasses pour cette vente / ce don</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {allCarcassesRestantes.map((carcasse) => {
              const isInGroup = group.carcasseIds.includes(carcasse.zacharie_carcasse_id);
              const otherGroupLabel = !isInGroup ? carcasseToGroupLabel[carcasse.zacharie_carcasse_id] : null;
              return (
                <button
                  key={carcasse.zacharie_carcasse_id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onToggleCarcasse(carcasse.zacharie_carcasse_id)}
                  className={[
                    'flex items-start gap-1.5 border-0 border-l-3 border-solid px-2 py-1.5 text-left transition-all duration-150',
                    isInGroup
                      ? 'border-action-high-blue-france cursor-pointer bg-blue-100 opacity-100'
                      : otherGroupLabel
                        ? 'bg-contrast-grey border-transparent opacity-80'
                        : 'bg-contrast-grey cursor-pointer border-transparent opacity-80 hover:bg-blue-50 hover:shadow-sm',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'mt-0.5 shrink-0',
                      isInGroup
                        ? 'fr-icon-checkbox-fill text-action-high-blue-france'
                        : otherGroupLabel
                          ? 'fr-icon-checkbox-line text-gray-400'
                          : 'fr-icon-checkbox-line',
                    ].join(' ')}
                    aria-hidden="true"
                    style={{ fontSize: '1rem' }}
                  />
                  <span className="flex flex-col">
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
                  </span>
                </button>
              );
            })}
          </div>
          <Badge
            severity={groupCarcasses.length > 0 ? 'info' : 'warning'}
            small
            noIcon
            as="span"
            className="mt-2"
          >
            {groupCarcasses.length > 0 ? formatCarcasseLotCount(groupCarcasses) : 'Aucune carcasse'}
          </Badge>
          {errorFor('carcasseIds') && <p className="fr-error-text mt-2">{errorFor('carcasseIds')}</p>}
        </div>
      )}

      {/* Étape 3 — Stockage */}
      {showStep('Stockage') && (
        <>
          <RadioButtons
            legend="Lieu de stockage des carcasses"
            className={canEdit ? '' : 'radio-black'}
            state={errorFor('depotType') ? 'error' : 'default'}
            stateRelatedMessage={errorFor('depotType')}
            options={[
              {
                label: <span className="inline-block">Pas de stockage</span>,
                hintText: (
                  <span>
                    Sans stockage en chambre froide, les carcasses doivent être transportées{' '}
                    <b>le jour-même du tir</b>
                  </span>
                ),
                nativeInputProps: {
                  checked: group.depotType === DepotType.AUCUN,
                  readOnly: !canEdit,
                  onChange: () => {
                    onChange({
                      depotType: DepotType.AUCUN,
                      depotDate: undefined,
                      depotEntityId: null,
                    });
                  },
                },
              },
              {
                label: 'Carcasses déposées dans une chambre froide (Centre de Collecte du Gibier sauvage)',
                hintText:
                  'Toute chambre froide où vous entreposez le gibier avant de le céder ou le vendre est un Centre de Collecte du Gibier sauvage (CCG).',
                nativeInputProps: {
                  checked: group.depotType === DepotType.CCG,
                  readOnly: !canEdit,
                  onChange: () => {
                    onChange({ depotType: DepotType.CCG });
                  },
                },
              },
            ]}
          />
          {group.depotType === DepotType.CCG &&
            (creatingCcg ? (
              <div className="rounded border border-gray-300 p-3">
                <p className="mb-2 text-sm font-bold">Ajouter une chambre froide (CCG)</p>
                <CCGNouveau
                  onFinish={(newEntity) => {
                    if (newEntity) {
                      onChange({ depotEntityId: newEntity.id });
                    }
                    setCreatingCcg(false);
                  }}
                />
              </div>
            ) : ccgsWorkingWith.length > 0 ? (
              <>
                <div>
                  <SelectCustom
                    label="Chambre froide (Centre de Collecte du Gibier sauvage)"
                    isReadOnly={!canEdit}
                    hint={
                      <>
                        {!group.depotEntityId ? (
                          <div>
                            {ccgsWorkingWith.map((entity) => {
                              return (
                                <button
                                  key={entity.id}
                                  type="button"
                                  className="mr-2 rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                                  onClick={() => {
                                    onChange({ depotEntityId: entity.id });
                                  }}
                                >
                                  {entity.nom_d_usage}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </>
                    }
                    options={ccgsOptions}
                    placeholder="Sélectionnez la chambre froide"
                    value={ccgsOptions.find((option) => option.value === group.depotEntityId) ?? null}
                    getOptionLabel={(f) => f.label!}
                    getOptionValue={(f) => f.value}
                    onChange={(f) => {
                      if (f?.value === 'add_new') {
                        setCreatingCcg(true);
                        return;
                      }
                      onChange({ depotEntityId: f?.value ?? null });
                    }}
                    isClearable={!!group.depotEntityId}
                    inputId={`${Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_id}_${group.id}`}
                    classNamePrefix={`select-ccg-${group.id}`}
                    required
                    name={`${Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_id}_${group.id}`}
                  />
                  {errorFor('depotEntityId') && (
                    <p className="fr-error-text mt-1">{errorFor('depotEntityId')}</p>
                  )}
                </div>
                <Component
                  label="Date de dépôt dans la chambre froide"
                  state={errorFor('depotDate') ? 'error' : 'default'}
                  stateRelatedMessage={errorFor('depotDate')}
                  hintText={
                    canEdit ? (
                      <button
                        className="rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                        type="button"
                        onClick={() => {
                          onChange({
                            depotDate: dayjs().format('YYYY-MM-DDTHH:mm'),
                          });
                        }}
                      >
                        Date du jour et maintenant
                      </button>
                    ) : null
                  }
                  nativeInputProps={{
                    id: `${Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_ccg_at}_${group.id}`,
                    name: `${Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_ccg_at}_${group.id}`,
                    type: 'datetime-local',
                    required: true,
                    autoComplete: 'off',
                    suppressHydrationWarning: true,
                    value: group.depotDate,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      onChange({
                        depotDate: dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'),
                      });
                    },
                  }}
                />
              </>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <label>Chambre froide (Centre de Collecte du Gibier sauvage)</label>
                <Button
                  type="button"
                  nativeButtonProps={{
                    onClick: () => setCreatingCcg(true),
                  }}
                >
                  Renseigner ma chambre froide (CCG)
                </Button>
              </div>
            ))}
        </>
      )}

      {/* Étape 4 — Transport */}
      {showStep('Transport') && (
        <>
          <RadioButtons
            legend="Transport des carcasses jusqu'au destinataire"
            className={canEdit ? '' : 'radio-black'}
            state={errorFor('transportType') ? 'error' : 'default'}
            stateRelatedMessage={errorFor('transportType')}
            options={[
              {
                label: <span className="inline-block">Je transporte les carcasses moi-même</span>,
                hintText: (
                  <span>
                    N'oubliez pas de notifier le prochain détenteur des carcasses de votre dépôt.{' '}
                    {group.depotType === DepotType.AUCUN ? (
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
                  checked: group.transportType === TransportType.PREMIER_DETENTEUR,
                  readOnly: !canEdit,
                  onChange: () => {
                    onChange({ transportType: TransportType.PREMIER_DETENTEUR });
                  },
                },
              },
              {
                label: 'Le transport est réalisé par un collecteur professionnel',
                hintText: 'La gestion du transport est sous la responsabilité du prochain détenteur.',
                nativeInputProps: {
                  checked: group.transportType === TransportType.COLLECTEUR_PRO,
                  readOnly: !canEdit,
                  onChange: () => {
                    onChange({
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
              label="Date à laquelle je transporte les carcasses"
              state={errorFor('transportDate') ? 'error' : 'default'}
              stateRelatedMessage={errorFor('transportDate')}
              hintText={
                canEdit ? (
                  <>
                    <button
                      className="mr-1 rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                      type="button"
                      onClick={() => {
                        onChange({
                          transportDate: dayjs().format('YYYY-MM-DDTHH:mm'),
                        });
                      }}
                    >
                      Date du jour et maintenant.
                    </button>
                    À ne remplir que si vous êtes le transporteur et que vous stockez les carcasses dans un
                    CCG. Indiquer une date permettra au prochain détenteur de s'organiser.
                  </>
                ) : null
              }
              nativeInputProps={{
                id: `${Prisma.CarcasseScalarFieldEnum.premier_detenteur_transport_date}_${group.id}`,
                name: `${Prisma.CarcasseScalarFieldEnum.premier_detenteur_transport_date}_${group.id}`,
                type: 'datetime-local',
                required: true,
                autoComplete: 'off',
                suppressHydrationWarning: true,
                value: group.transportDate,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  onChange({
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

export default function DestinataireSelectPremierDetenteur({
  className = '',
  canEdit,
  disabled,
  submitRef,
  hideSubmitButton,
}: {
  className?: string;
  canEdit: boolean;
  disabled?: boolean;
  submitRef?: MutableRefObject<DestinatairePremierDetenteurHandle | null>;
  hideSubmitButton?: boolean;
}) {
  const params = useParams();
  const navigate = useNavigate();
  const user = useUser((state) => state.user)!;
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const ccgsIds = useCcgIds();
  const etgsIds = useEtgIds();
  const collecteursProIds = useCollecteursProIds();
  const circuitCourtIds = useCircuitCourtIds();

  const isDispatchModalOpen = useIsModalOpen(dispatchModal);
  const isTrichineModalOpen = useIsModalOpen(trichineModal);
  const [dontShowTrichineAgain, setDontShowTrichineAgain] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const fei = feis[params.fei_numero!];
  const prefilledInfos = usePrefillPremierDétenteurInfos();

  const allCarcasses = useCarcassesForFei(params.fei_numero);

  const carcassesDejaEnvoyees = useMemo(() => allCarcasses.filter(isCarcasseDejaEnvoyee), [allCarcasses]);

  const carcassesRestantes = useMemo(
    () => allCarcasses.filter((c) => !isCarcasseDejaEnvoyee(c)),
    [allCarcasses]
  );

  const carcassesRestantesIds = useMemo(
    () => carcassesRestantes.map((c) => c.zacharie_carcasse_id),
    [carcassesRestantes]
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

  // Ventes / dons validés (une carte chacun). Vides au départ : le premier détenteur les crée via la modale.
  const [dispatchGroups, setDispatchGroups] = useState<DispatchGroup[]>([]);

  // Brouillon en cours d'édition dans la modale (add = nouveau, edit = carte existante).
  const [draft, setDraft] = useState<DispatchGroup | null>(null);
  const [draftMode, setDraftMode] = useState<'add' | 'edit'>('add');
  const [showModalErrors, setShowModalErrors] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Carcasses attribuées à une vente / un don, ou restant à attribuer.
  const assignedCarcasseIds = useMemo(() => {
    const set = new Set<string>();
    for (const group of dispatchGroups) {
      for (const id of group.carcasseIds) set.add(id);
    }
    return set;
  }, [dispatchGroups]);

  const unassignedCarcasses = useMemo(
    () => carcassesRestantes.filter((c) => !assignedCarcasseIds.has(c.zacharie_carcasse_id)),
    [carcassesRestantes, assignedCarcasseIds]
  );

  const openAddDispatchGroup = useCallback(() => {
    const isFirst = dispatchGroups.length === 0;
    const nextDraft: DispatchGroup = {
      id: `group-${Date.now()}`,
      recipientEntityId:
        isFirst && prefilledInfos?.premier_detenteur_prochain_detenteur_id_cache
          ? prefilledInfos.premier_detenteur_prochain_detenteur_id_cache
          : null,
      // Première vente / premier don : toutes les carcasses restantes par défaut.
      // Suivants : l'utilisateur choisit lesquelles déplacer.
      carcasseIds: isFirst ? carcassesRestantesIds : [],
      depotType:
        isFirst && prefilledInfos?.premier_detenteur_depot_type
          ? prefilledInfos.premier_detenteur_depot_type
          : DepotType.AUCUN,
      depotEntityId:
        isFirst && prefilledInfos?.premier_detenteur_depot_entity_id
          ? prefilledInfos.premier_detenteur_depot_entity_id
          : null,
      depotDate: undefined,
      transportType:
        isFirst && prefilledInfos?.premier_detenteur_transport_type
          ? prefilledInfos.premier_detenteur_transport_type
          : null,
      transportDate: undefined,
    };
    setDraft(nextDraft);
    setDraftMode('add');
    setShowModalErrors(false);
    setCurrentStep(1);
    dispatchModal.open();
  }, [dispatchGroups.length, prefilledInfos, carcassesRestantesIds]);

  // L'état initial des lots est figé au montage. Une carcasse créée après coup rejoint donc le lot
  // par défaut, sinon elle reste en arrière : la fiche part sans elle et elle devient orpheline,
  // impossible à transmettre comme à clôturer. Symétriquement on retire des lots les carcasses qui
  // ne sont plus à envoyer (supprimées, ou parties dans un autre lot).
  const knownCarcasseIdsRef = useRef<Set<string>>(new Set(carcassesRestantesIds));
  useEffect(() => {
    const restantes = new Set(carcassesRestantesIds);
    const nouvelles = carcassesRestantesIds.filter((id) => !knownCarcasseIdsRef.current.has(id));
    knownCarcasseIdsRef.current = restantes;
    setDispatchGroups((prev) => {
      const nettoyes = prev.map((group) => ({
        ...group,
        carcasseIds: group.carcasseIds.filter((id) => restantes.has(id)),
      }));
      const aChange =
        nouvelles.length > 0 ||
        nettoyes.some((group, index) => group.carcasseIds.length !== prev[index].carcasseIds.length);
      if (!aChange) {
        return prev;
      }
      nettoyes[0] = { ...nettoyes[0], carcasseIds: [...nettoyes[0].carcasseIds, ...nouvelles] };
      return nettoyes;
    });
  }, [carcassesRestantesIds]);

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

  const openEditAcheminement = useCallback((group: DispatchGroup) => {
    setDraft({ ...group });
    setDraftMode('edit');
    setShowModalErrors(false);
    setCurrentStep(1);
    dispatchModal.open();
  }, []);

  const onChangeDraft = useCallback((updates: Partial<DispatchGroup>) => {
    setDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const onToggleDraftCarcasse = useCallback((carcasseId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const isIn = prev.carcasseIds.includes(carcasseId);
      return {
        ...prev,
        carcasseIds: isIn
          ? prev.carcasseIds.filter((id) => id !== carcasseId)
          : [...prev.carcasseIds, carcasseId],
      };
    });
  }, []);

  const otherGroups = useMemo(
    () => dispatchGroups.filter((g) => g.id !== draft?.id),
    [dispatchGroups, draft?.id]
  );

  // Étape de sélection des carcasses uniquement s'il y a plusieurs carcasses à répartir.
  const showCarcasseSelector = carcassesRestantes.length > 1;

  const draftCarcasseToGroupLabel = useMemo(() => {
    const map: Record<string, string> = {};
    otherGroups.forEach((g, i) => {
      const label = g.recipientEntityId
        ? (entities[g.recipientEntityId]?.nom_d_usage ?? `Vente / don ${i + 1}`)
        : `Vente / don ${i + 1}`;
      for (const cId of g.carcasseIds) {
        map[cId] = label;
      }
    });
    return map;
  }, [otherGroups, entities]);

  const draftFieldErrors = useMemo(
    () => (draft ? getGroupFieldErrors(draft, entities) : {}),
    [draft, entities]
  );

  // Étapes de la modale : le transport n'existe que si le premier détenteur doit l'organiser.
  const draftNeedTransport = draft
    ? needTransportForType(draft.recipientEntityId ? entities[draft.recipientEntityId]?.type : null)
    : false;
  const steps = useMemo(() => {
    const nextSteps = ['Destinataire'];
    if (showCarcasseSelector) nextSteps.push('Carcasses');
    nextSteps.push('Stockage');
    if (draftNeedTransport) nextSteps.push('Transport');
    return nextSteps;
  }, [showCarcasseSelector, draftNeedTransport]);
  // Le nombre d'étapes peut diminuer (ex : passage ETG → collecteur) ; on borne l'étape courante.
  const boundedStep = Math.min(currentStep, steps.length);

  const currentStepValid = !(STEP_FIELDS[steps[boundedStep - 1]] ?? []).some((f) => draftFieldErrors[f]);

  const goToNextStep = useCallback(() => {
    if (!currentStepValid) {
      setShowModalErrors(true);
      return;
    }
    setShowModalErrors(false);
    setCurrentStep((s) => s + 1);
  }, [currentStepValid]);

  const goToPrevStep = useCallback(() => {
    setShowModalErrors(false);
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft) return;
    // Vente / don unique sans étape de sélection : elle embarque toutes les carcasses non attribuées.
    const finalDraft: DispatchGroup = showCarcasseSelector
      ? draft
      : { ...draft, carcasseIds: carcassesRestantesIds };
    if (getGroupValidationError(finalDraft, entities)) {
      setShowModalErrors(true);
      return;
    }
    setDispatchGroups((prev) => {
      // Exclusivité : les carcasses de cette vente / ce don quittent les autres.
      const claimed = new Set(finalDraft.carcasseIds);
      const others = prev
        .filter((g) => g.id !== finalDraft.id)
        .map((g) => ({ ...g, carcasseIds: g.carcasseIds.filter((id) => !claimed.has(id)) }))
        // Une vente / un don vidé de toutes ses carcasses disparaît.
        .filter((g) => g.carcasseIds.length > 0);
      return [...others, finalDraft];
    });
    setDraft(null);
    dispatchModal.close();
  }, [draft, showCarcasseSelector, carcassesRestantesIds, entities]);

  const removeGroup = useCallback((groupId: string) => {
    setDispatchGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  // Trichine : au moins une vente / un don vers du circuit court avec du sanglier.
  const hasSanglier = useMemo(
    () => carcassesRestantes.some((carcasse) => carcasse.espece === 'Sanglier'),
    [carcassesRestantes]
  );

  const trichineMessage = useMemo(() => {
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
                <strong>
                  Les carcasses de sanglier transmises nécessitent un test trichine obligatoire.
                </strong>
              </p>
              <p>
                Conformément à la réglementation, vous devez vous assurer que le test trichine a été réalisé
                avant toute mise sur le marché ou consommation de ces carcasses.
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
    }
    return null;
  }, [dispatchGroups, entities]);

  const shouldShowTrichineModal = useMemo(() => {
    if (!hasSanglier || !trichineMessage) return false;
    return localStorage.getItem('trichine-modal-dont-show-again') !== 'true';
  }, [hasSanglier, trichineMessage]);

  const revealErrorsAndScroll = useCallback(() => {
    setShowErrors(true);
    requestAnimationFrame(() => {
      const firstError = document.querySelector('.fr-error-text, .fr-alert--error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  // Les ventes / dons validés sont toujours complets (validés à l'enregistrement).
  // Il reste à vérifier qu'il y en a au moins un et que toutes les carcasses sont attribuées.
  const globalValidationError = useMemo(() => {
    if (dispatchGroups.length === 0) {
      return 'Veuillez ajouter au moins une vente ou un don';
    }
    if (unassignedCarcasses.length > 0) {
      return `${formatCarcasseLotCount(unassignedCarcasses)} ${unassignedCarcasses.length > 1 ? 'ne sont attribuées' : "n'est attribuée"
        } à aucune vente ni aucun don`;
    }
    return null;
  }, [dispatchGroups.length, unassignedCarcasses]);

  const totalCarcassesToSend = assignedCarcasseIds.size;

  const carcassesToSend = useMemo(
    () => allCarcasses.filter((c) => assignedCarcasseIds.has(c.zacharie_carcasse_id)),
    [allCarcasses, assignedCarcasseIds]
  );

  const submitLabel = useMemo(() => {
    if (carcassesDejaEnvoyees.length === 0 && totalCarcassesToSend === allCarcasses.length) {
      return 'Transmettre la fiche';
    }
    return `Transmettre ${formatCarcasseLotCount(carcassesToSend)} sur ${formatCarcasseLotCount(allCarcasses)}`;
  }, [carcassesDejaEnvoyees.length, totalCarcassesToSend, allCarcasses, carcassesToSend]);

  const notActivated = !user.activated;

  const handleSubmit = () => {
    // Compte pas encore activé (CFEI non validé) : préparation autorisée, transmission bloquée.
    if (notActivated) {
      return;
    }
    for (const group of dispatchGroups) {
      if (!group.recipientEntityId) continue;
      const prochainDetenteurType = entities[group.recipientEntityId]?.type;
      const needTransport = needTransportForType(prochainDetenteurType);
      const nextDepotEntityId = group.depotType === DepotType.AUCUN ? null : group.depotEntityId;
      const nextDepotDate = group.depotDate ? dayjs(group.depotDate).toDate() : null;
      const nextTransportType = needTransport ? group.transportType : null;
      const nextTransportDate = nextTransportType
        ? group.transportDate
          ? dayjs(group.transportDate).toDate()
          : null
        : null;

      const nextTransmission: CarcasseTransmission = {
        next_owner_entity_id: group.recipientEntityId,
        next_owner_role: entities[group.recipientEntityId]?.type as FeiOwnerRole,
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
      };
      // une carcasse du groupe sert de référence pour l'état avant transmission :
      // toutes les carcasses du groupe partagent les mêmes champs de transmission.
      const carcasseRef = allCarcasses.find((c) => c.zacharie_carcasse_id === group.carcasseIds[0]);
      updateCarcassesTransmission(group.carcasseIds, nextTransmission);
      addLog({
        user_id: user.id,
        user_role: UserRoles.CHASSEUR,
        action: 'premier-detenteur-need-select-next-select-destinataire',
        fei_numero: fei.numero,
        history: createHistoryInput(
          carcasseRef ? getCarcasseTransmission(carcasseRef) : null,
          nextTransmission
        ),
        entity_id: fei.premier_detenteur_entity_id,
        zacharie_carcasse_id: null,
        carcasse_intermediaire_id: null,
        intermediaire_id: null,
      });
    }

    syncData('premier-detenteur-need-select-next-select-destinataire');
    navigate(`/app/chasseur/fei/${fei.numero}/envoyée`);
  };

  if (submitRef) {
    submitRef.current = {
      validate: () => {
        if (globalValidationError) {
          revealErrorsAndScroll();
        }
        return globalValidationError;
      },
      submit: () => {
        if (shouldShowTrichineModal) {
          trichineModal.open();
          return;
        }
        handleSubmit();
      },
    };
  }

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y a pas encore de propriétaire initial pour cette fiche";
  }

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
        {carcassesRestantes.length === 0 && carcassesDejaEnvoyees.length > 0 && (
          <Alert
            severity="info"
            title="Toutes les carcasses ont été attribuées"
            description="Il n'y a plus de carcasses à envoyer."
          />
        )}

        {carcassesRestantes.length > 0 && (
          <>
            {/* Cartes des ventes / dons déjà renseignés */}
            {dispatchGroups.length > 0 && (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {dispatchGroups.map((group, index) => (
                  <DispatchGroupCard
                    key={group.id}
                    group={group}
                    index={index}
                    totalGroups={dispatchGroups.length}
                    entities={entities}
                    groupCarcasses={allCarcasses.filter((c) =>
                      group.carcasseIds.includes(c.zacharie_carcasse_id)
                    )}
                    canEdit={canEdit && !disabled}
                    onEdit={() => openEditDispatchGroup(group)}
                    onDelete={() => removeGroup(group.id)}
                  />
                ))}
              </div>
            )}

            {/* Carcasses non attribuées */}
            {dispatchGroups.length > 0 && unassignedCarcasses.length > 0 && (
              <Alert
                severity="warning"
                title={`${formatCarcasseLotCount(unassignedCarcasses)} non attribué${unassignedCarcasses.length > 1 ? 's' : ''
                  }`}
                description={
                  <div className="mt-1 flex flex-wrap gap-1">
                    {unassignedCarcasses.map((c) => (
                      <Tag
                        key={c.zacharie_carcasse_id}
                        small
                      >
                        {c.numero_bracelet} - {c.espece}
                      </Tag>
                    ))}
                  </div>
                }
              />
            )}

            {/* Ajouter une vente / un don — possible tant qu'il reste des carcasses à répartir
                (la 1re prend toutes les carcasses ; les suivantes en récupèrent une partie). */}
            {canEdit &&
              (dispatchGroups.length === 0 ||
                (carcassesRestantes.length > 1 && dispatchGroups.length < carcassesRestantes.length)) && (
                <Button
                  type="button"
                  priority="secondary"
                  iconId="fr-icon-add-line"
                  disabled={disabled}
                  nativeButtonProps={{ onClick: openAddDispatchGroup }}
                >
                  {dispatchGroups.length === 0
                    ? 'Ajouter une vente ou un don'
                    : 'Ajouter une autre vente ou un autre don'}
                </Button>
              )}

            {showErrors && globalValidationError && (
              <Alert
                severity="error"
                title={globalValidationError}
                small
                description=""
              />
            )}

            {canEdit && notActivated && <CompteEnAttenteValidationAlert className="mt-4" />}

            {/* Bouton de transmission (mode premier détenteur autonome) */}
            {canEdit && !hideSubmitButton && (
              <div className="mt-4">
                <Button
                  type="submit"
                  iconId="fr-icon-send-plane-line"
                  disabled={disabled || totalCarcassesToSend === 0 || notActivated}
                  nativeButtonProps={{
                    onClick: (event) => {
                      event.preventDefault();
                      if (globalValidationError) {
                        revealErrorsAndScroll();
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
              </div>
            )}
          </>
        )}
      </div>

      <dispatchModal.Component
        size="large"
        title={draftMode === 'add' ? 'Ajouter une vente ou un don' : 'Modifier'}
        buttons={
          !canEdit
            ? [{ children: 'Fermer' }]
            : [
              boundedStep > 1
                ? {
                  children: 'Précédent',
                  priority: 'secondary',
                  doClosesModal: false,
                  nativeButtonProps: { onClick: goToPrevStep },
                }
                : {
                  children: 'Annuler',
                  priority: 'secondary',
                  onClick: () => setDraft(null),
                },
              boundedStep < steps.length
                ? {
                  children: 'Suivant',
                  doClosesModal: false,
                  nativeButtonProps: { onClick: goToNextStep },
                }
                : {
                  children: 'Enregistrer',
                  doClosesModal: false,
                  nativeButtonProps: { onClick: () => saveDraft() },
                },
            ]
        }
      >
        {isDispatchModalOpen && draft && (
          <DispatchGroupForm
            group={draft}
            canEdit={canEdit && !disabled}
            showCarcasseSelector={showCarcasseSelector}
            currentStep={boundedStep}
            steps={steps}
            entities={entities}
            prochainsDetenteursOptions={prochainsDetenteursOptions}
            canTransmitCarcassesToEntities={canTransmitCarcassesToEntities}
            ccgsOptions={ccgsOptions}
            ccgsWorkingWith={ccgsWorkingWith}
            allCarcassesRestantes={carcassesRestantes}
            carcasseToGroupLabel={draftCarcasseToGroupLabel}
            fieldErrors={draftFieldErrors}
            showErrors={showModalErrors}
            onToggleCarcasse={onToggleDraftCarcasse}
            onChange={onChangeDraft}
          />
        )}
      </dispatchModal.Component>

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
