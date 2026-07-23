import { useNavigate, useParams } from 'react-router';
import { useCallback, useMemo, useState, type MutableRefObject } from 'react';
import {
  UserRoles,
  Prisma,
  EntityTypes,
  DepotType,
  TransportType,
  EntityRelationType,
  FeiOwnerRole,
  CarcasseType,
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
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import AnnuaireCommerceSearch from '@app/components/AnnuaireCommerceSearch';
import CCGNouveau from '@app/components/CCGNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import type { EntityWithUserRelation } from '~/src/types/entity';
import { CarcasseTransmission } from '@app/types/carcasse';

export interface DestinatairePremierDetenteurHandle {
  validate: () => string | null;
  submit: () => void;
}

const partenaireModal = createModal({
  isOpenedByDefault: false,
  id: 'partenaire-modal-pd',
});

const annuaireModal = createModal({
  isOpenedByDefault: false,
  id: 'annuaire-modal-pd',
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
  fieldErrors,
  showErrors,
  onToggleCarcasse,
  onUpdateGroup,
  onRemoveGroup,
  onOpenPartenaireModal,
  onOpenAnnuaireModal,
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
  fieldErrors: GroupFieldErrors;
  showErrors: boolean;
  onToggleCarcasse: (carcasseId: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<DispatchGroup>) => void;
  onRemoveGroup: (groupId: string) => void;
  onOpenPartenaireModal: (groupId: string, nomDUsage?: string) => void;
  onOpenAnnuaireModal: (groupId: string) => void;
  onOpenCcgModal: (groupId: string) => void;
}) {
  const prochainDetenteur = group.recipientEntityId ? entities[group.recipientEntityId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;

  const groupCarcasses = useMemo(() => {
    const idSet = new Set(group.carcasseIds);
    return allCarcassesRestantes.filter((c) => idSet.has(c.zacharie_carcasse_id));
  }, [group.carcasseIds, allCarcassesRestantes]);

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

  // Progressive display: reveal each input only once the previous step is filled.
  // In read-only mode (!canEdit) everything is shown.
  const showDepot = !canEdit || !!group.recipientEntityId;
  const depotComplete =
    !canEdit ||
    group.depotType === DepotType.AUCUN ||
    (group.depotType === DepotType.CCG && !!group.depotEntityId && !!group.depotDate);
  const showTransport = needTransport && (!canEdit || (showDepot && depotComplete));

  // Only surface a field's error once the user has attempted to submit.
  const errorFor = (key: keyof GroupFieldErrors) => (showErrors ? fieldErrors[key] : undefined);

  return (
    <div className={totalGroups > 1 ? 'space-y-4 rounded border border-gray-300 bg-white p-4' : 'space-y-4'}>
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-lg font-bold">{totalGroups > 1 && <>Destinataire {groupIndex + 1} </>}</h4>
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

      {allCarcassesRestantes.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-bold">
            {totalGroups > 1
              ? 'Sélectionnez les carcasses pour ce destinataire'
              : 'Sélectionnez les carcasses à transmettre'}
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
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
          {allCarcassesRestantes.length > 1 && (
            <Badge
              severity={groupCarcasses.length > 0 ? 'info' : 'warning'}
              small
              noIcon
              as="span"
              className="mt-2"
            >
              {groupCarcasses.length > 0 ? formatCarcasseLotCount(groupCarcasses) : 'Aucune carcasse'}
            </Badge>
          )}
          {errorFor('carcasseIds') && <p className="fr-error-text mt-2">{errorFor('carcasseIds')}</p>}
        </div>
      )}

      <div>
        <SelectCustom
          label="Prochain détenteur des carcasses"
          isDisabled={disabled}
          hint={
            <>
              <span>
                Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en charge
                le gibier.
              </span>
              {!group.recipientEntityId && !disabled && (
                <div>
                  {canTransmitCarcassesToEntities.map((entity) => {
                    return (
                      <button
                        key={entity.id}
                        type="button"
                        className="mr-2 rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                        onClick={() => onUpdateGroup(group.id, { recipientEntityId: entity.id })}
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
            prochainsDetenteursOptions.find((option) => option.value === group.recipientEntityId) ?? null
          }
          getOptionLabel={(f) => f.label!}
          getOptionValue={(f) => f.value}
          onChange={(f) => onUpdateGroup(group.id, { recipientEntityId: f ? f.value : null })}
          isClearable={!!group.recipientEntityId}
          inputId={`${Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}_${group.id}`}
          classNamePrefix={`select-prochain-detenteur-${group.id}`}
          required
          creatable
          // @ts-expect-error - onCreateOption is not typed
          onCreateOption={(newOption: string) => {
            onOpenPartenaireModal(group.id, newOption);
          }}
          isReadOnly={!canEdit}
          name={`${Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}_${group.id}`}
        />
        {errorFor('recipientEntityId') && (
          <p className="fr-error-text mt-1">{errorFor('recipientEntityId')}</p>
        )}
        {!group.recipientEntityId && !disabled && canEdit && (
          <Button
            priority="tertiary no outline"
            type="button"
            size="small"
            iconId="fr-icon-search-line"
            className="mt-1"
            nativeButtonProps={{ onClick: () => onOpenAnnuaireModal(group.id) }}
          >
            Chercher un commerce de détail dans l’annuaire
          </Button>
        )}
      </div>
      {!!prochainDetenteur && !prochainDetenteur?.zacharie_compatible && (
        <Alert
          severity="warning"
          title="Attention"
          description={`${prochainDetenteur?.nom_d_usage} n'est pas prêt pour Zacharie. Vous pouvez contacter un représentant avant de leur envoyer leur première fiche.`}
        />
      )}
      {showDepot && (
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
                  onUpdateGroup(group.id, {
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
                  onUpdateGroup(group.id, { depotType: DepotType.CCG });
                },
              },
            },
          ]}
        />
      )}
      {showDepot &&
        group.depotType === DepotType.CCG &&
        (ccgsWorkingWith.length > 0 ? (
          <>
            <div>
              <SelectCustom
                label="Chambre froide (Centre de Collecte du Gibier sauvage)"
                isDisabled={group.depotType !== DepotType.CCG}
                isReadOnly={!canEdit}
                hint={
                  <>
                    {!group.depotEntityId && group.depotType === DepotType.CCG ? (
                      <div>
                        {ccgsWorkingWith.map((entity) => {
                          return (
                            <button
                              key={entity.id}
                              type="button"
                              className="mr-2 rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                              onClick={() => {
                                onUpdateGroup(group.id, { depotEntityId: entity.id });
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
                    onOpenCcgModal(group.id);
                    return;
                  }
                  onUpdateGroup(group.id, { depotEntityId: f?.value ?? null });
                }}
                isClearable={!!group.depotEntityId}
                inputId={`${Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_id}_${group.id}`}
                classNamePrefix={`select-ccg-${group.id}`}
                required
                name={`${Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_id}_${group.id}`}
              />
              {errorFor('depotEntityId') && <p className="fr-error-text mt-1">{errorFor('depotEntityId')}</p>}
            </div>
            <Component
              label="Date de dépôt dans la chambre froide"
              disabled={group.depotType !== DepotType.CCG}
              state={errorFor('depotDate') ? 'error' : 'default'}
              stateRelatedMessage={errorFor('depotDate')}
              hintText={
                canEdit ? (
                  <button
                    className="rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                    type="button"
                    disabled={group.depotType !== DepotType.CCG}
                    onClick={() => {
                      onUpdateGroup(group.id, {
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
            <label>Chambre froide (Centre de Collecte du Gibier sauvage)</label>
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
      {showTransport && (
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
                    onUpdateGroup(group.id, { transportType: TransportType.PREMIER_DETENTEUR });
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
              label="Date à laquelle je transporte les carcasses"
              disabled={
                group.transportType !== TransportType.PREMIER_DETENTEUR || group.depotType !== DepotType.CCG
              }
              state={errorFor('transportDate') ? 'error' : 'default'}
              stateRelatedMessage={errorFor('transportDate')}
              hintText={
                canEdit ? (
                  <>
                    <button
                      className="mr-1 rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
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
    errors.carcasseIds = 'Veuillez sélectionner au moins une carcasse pour ce destinataire';
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

  const isPartenaireModalOpen = useIsModalOpen(partenaireModal);
  const isAnnuaireModalOpen = useIsModalOpen(annuaireModal);
  const isCCGModalOpen = useIsModalOpen(ccgModal);
  const isTrichineModalOpen = useIsModalOpen(trichineModal);
  const [dontShowTrichineAgain, setDontShowTrichineAgain] = useState(false);
  // Field-level validation errors are only revealed after a submit attempt.
  const [showErrors, setShowErrors] = useState(false);

  const fei = feis[params.fei_numero!];
  const prefilledInfos = usePrefillPremierDétenteurInfos();

  const allCarcasses = useCarcassesForFei(params.fei_numero);

  const carcassesDejaEnvoyees = useMemo(
    () =>
      allCarcasses.filter(
        (c) =>
          c.next_owner_entity_id != null ||
          (c.current_owner_role != null &&
            c.current_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR &&
            c.current_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL)
      ),
    [allCarcasses]
  );

  const carcassesRestantes = useMemo(
    () =>
      allCarcasses.filter(
        (c) =>
          c.next_owner_entity_id == null &&
          (c.current_owner_role == null ||
            c.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR ||
            c.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL)
      ),
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

  // Multi-group dispatch state
  const [dispatchGroups, setDispatchGroups] = useState<DispatchGroup[]>(() => {
    const initialRecipient = (() => {
      if (prefilledInfos?.premier_detenteur_prochain_detenteur_id_cache) {
        return prefilledInfos.premier_detenteur_prochain_detenteur_id_cache;
      }
      return null;
    })();

    const initialDepotEntityId = (() => {
      if (prefilledInfos?.premier_detenteur_depot_entity_id) {
        return prefilledInfos.premier_detenteur_depot_entity_id;
      }
      return null;
    })();

    const initialDepotType = (() => {
      if (prefilledInfos?.premier_detenteur_depot_type) {
        return prefilledInfos.premier_detenteur_depot_type;
      }
      return DepotType.AUCUN;
    })();

    const initialTransportType = (() => {
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
        depotDate: undefined,
        transportType: initialTransportType,
        transportDate: undefined,
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
      // Don't allow removing the last group
      if (remaining.length === 0) return prev;
      // Put freed carcasses into the first remaining group
      remaining[0] = {
        ...remaining[0],
        carcasseIds: [...remaining[0].carcasseIds, ...removedGroup.carcasseIds],
      };
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

  // Unassigned carcasses (restantes not in any group)
  const unassignedCarcasses = useMemo(() => {
    const assignedIds = new Set(dispatchGroups.flatMap((g) => g.carcasseIds));
    return carcassesRestantes.filter((c) => !assignedIds.has(c.zacharie_carcasse_id));
  }, [dispatchGroups, carcassesRestantes]);

  // Validation
  const groupFieldErrors = useMemo(
    () => dispatchGroups.map((group) => getGroupFieldErrors(group, entities)),
    [dispatchGroups, entities]
  );

  const revealErrorsAndScroll = useCallback(() => {
    setShowErrors(true);
    // Wait for the error nodes to render before scrolling to the first one.
    requestAnimationFrame(() => {
      const firstError = document.querySelector('.fr-error-text, .fr-input-group--error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const globalValidationError = useMemo(() => {
    for (let i = 0; i < dispatchGroups.length; i++) {
      const error = getGroupValidationError(dispatchGroups[i], entities);
      if (error) {
        return dispatchGroups.length > 1 ? `Destinataire ${i + 1} : ${error}` : error;
      }
    }
    // if (unassignedCarcasses.length > 0) {
    //   return `${unassignedCarcasses.length} carcasse(s) ne sont attribuees a aucun destinataire`;
    // }
    return null;
  }, [dispatchGroups, entities]);

  const totalCarcassesToSend = useMemo(() => {
    return dispatchGroups.reduce((acc, g) => acc + g.carcasseIds.length, 0);
  }, [dispatchGroups]);

  const carcassesToSend = useMemo(() => {
    const idSet = new Set(dispatchGroups.flatMap((g) => g.carcasseIds));
    return allCarcasses.filter((c) => idSet.has(c.zacharie_carcasse_id));
  }, [dispatchGroups, allCarcasses]);

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
      updateCarcassesTransmission(group.carcasseIds, nextTransmission);
      addLog({
        user_id: user.id,
        user_role: UserRoles.CHASSEUR,
        action: 'premier-detenteur-need-select-next-select-destinataire',
        fei_numero: fei.numero,
        history: createHistoryInput({}, nextTransmission),
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
            {/* Dispatch groups */}
            {dispatchGroups.map((group, index) => {
              // Map each carcasse to the label of the OTHER group it belongs to
              const carcasseToGroupLabel: Record<string, string> = {};
              for (const g of dispatchGroups) {
                if (g.id === group.id) continue;
                const gIndex = dispatchGroups.indexOf(g);
                const label = g.recipientEntityId
                  ? (entities[g.recipientEntityId]?.nom_d_usage ?? `Dest. ${gIndex + 1}`)
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
                  fieldErrors={groupFieldErrors[index] ?? {}}
                  showErrors={showErrors}
                  onToggleCarcasse={(carcasseId) => onToggleCarcasse(group.id, carcasseId)}
                  onUpdateGroup={onUpdateGroup}
                  onRemoveGroup={onRemoveGroup}
                  onOpenPartenaireModal={(groupId, nomDUsage) => {
                    setActiveModalGroupId(groupId);
                    setNewEntityNomDUsage(nomDUsage ?? null);
                    partenaireModal.open();
                  }}
                  onOpenAnnuaireModal={(groupId) => {
                    setActiveModalGroupId(groupId);
                    annuaireModal.open();
                  }}
                  onOpenCcgModal={(groupId) => {
                    setActiveModalGroupId(groupId);
                    ccgModal.open();
                  }}
                />
              );
            })}

            {/* Unassigned carcasses warning */}
            {unassignedCarcasses.length > 0 &&
              (() => {
                const hasLot = unassignedCarcasses.some((c) => c.type === CarcasseType.PETIT_GIBIER);
                const hasCarcasse = unassignedCarcasses.some((c) => c.type !== CarcasseType.PETIT_GIBIER);
                const isPlural = unassignedCarcasses.length > 1;
                const isFeminine = hasCarcasse && !hasLot;
                const suffix = `${isFeminine ? 'e' : ''}${isPlural ? 's' : ''}`;
                return (
                  <Alert
                    severity="warning"
                    title={`${formatCarcasseLotCount(unassignedCarcasses)} non attribué${suffix}`}
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
                );
              })()}

            {canEdit && notActivated && <CompteEnAttenteValidationAlert className="mt-4" />}
            <div className="mt-4 flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
              {/* Submit button */}
              {canEdit && !hideSubmitButton && (
                <Button
                  className=""
                  type="submit"
                  iconId="fr-icon-send-plane-line"
                  disabled={disabled || totalCarcassesToSend === 0 || notActivated}
                  nativeButtonProps={{
                    onClick: async (event) => {
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
              )}
              {/* Add another recipient button — au plus un destinataire par carcasse/lot */}
              {canEdit &&
                carcassesRestantes.length > 1 &&
                dispatchGroups.length < carcassesRestantes.length && (
                  <Button
                    priority="secondary"
                    type="button"
                    iconId="fr-icon-add-line"
                    nativeButtonProps={{ onClick: addGroup }}
                  >
                    Ajouter un autre destinataire
                  </Button>
                )}
            </div>
          </>
        )}
      </div>
      <partenaireModal.Component title="Ajouter un destinataire">
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
      <annuaireModal.Component title="Chercher un commerce de détail">
        {isAnnuaireModalOpen && (
          <AnnuaireCommerceSearch
            onManualEntry={() => {
              annuaireModal.close();
              setNewEntityNomDUsage(null);
              partenaireModal.open();
            }}
            onFinish={(newEntity) => {
              annuaireModal.close();
              if (newEntity && activeModalGroupId) {
                onUpdateGroup(activeModalGroupId, { recipientEntityId: newEntity.id });
              }
            }}
          />
        )}
      </annuaireModal.Component>
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
