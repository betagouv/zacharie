import { useNavigate, useParams } from 'react-router';
import { useMemo, useState } from 'react';
import {
  UserRoles,
  EntityTypes,
  DepotType,
  TransportType,
  CarcasseIntermediaire,
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
import type { FeiIntermediaire, FeiAndIntermediaireIds } from '@app/types/fei-intermediaire';
import { EntityWithUserRelation } from '@api/src/types/entity';
import { UserForFei } from '@api/src/types/user';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import CardCarcasse from '@app/components/CardCarcasse';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';

const partenaireModal = createModal({
  isOpenedByDefault: false,
  id: 'partenaire-modal',
});

type DestinataireAvecCarcasses = {
  entityId: string;
  carcasseIds: string[];
  depotType?: DepotType | null;
  depotEntityId?: string | null;
  transportType?: TransportType | null;
  depotDate?: string;
  transportDate?: string;
};

export default function DestinataireSelect({
  className = '',
  canEdit,
  sousTraite,
  disabled,
  calledFrom,
  feiAndIntermediaireIds,
  intermediaire,
  premierDetenteurEntity,
  premierDetenteurUser,
}: {
  className?: string;
  canEdit: boolean;
  sousTraite?: boolean;
  disabled?: boolean;
  calledFrom: 'premier-detenteur-need-select-next' | 'current-owner-sous-traite' | 'intermediaire-next-owner';
  feiAndIntermediaireIds?: FeiAndIntermediaireIds;
  intermediaire?: FeiIntermediaire;
  premierDetenteurEntity?: EntityWithUserRelation | null;
  premierDetenteurUser?: UserForFei | null;
}) {
  const params = useParams();
  const navigate = useNavigate();
  const user = useUser((state) => state.user)!;
  const isOnline = useIsOnline();
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const updateAllCarcasseIntermediaire = useZustandStore((state) => state.updateAllCarcasseIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const ccgsIds = useZustandStore((state) => state.ccgsIds);
  const etgsIds = useZustandStore((state) => state.etgsIds);
  const svisIds = useZustandStore((state) => state.svisIds);
  const collecteursProIds = useZustandStore((state) => state.collecteursProIds);
  const circuitCourtIds = useZustandStore((state) => state.circuitCourtIds);

  const isPartenaireModalOpen = useIsModalOpen(partenaireModal);

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
  const svis = svisIds.map((id) => entities[id]);

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
        entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY ||
        entity.relation === EntityRelationType.WORKING_FOR_ENTITY_RELATED_WITH,
    );
  }, [prochainsDetenteurs]);

  const ccgsOptions = useMemo(() => {
    return [
      ...ccgs.map((entity) => ({
        label: getEntityDisplay(entity as any),
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
      label: getEntityDisplay(entity as any),
      value: entity.id,
    }));
  }, [prochainsDetenteurs]);

  const intermediaireEntity = intermediaire?.intermediaire_entity_id
    ? entities[intermediaire.intermediaire_entity_id]
    : null;
  const intermediaireEntityType = intermediaireEntity?.type;

  // Initialiser les destinataires avec leurs carcasses
  const [destinataires, setDestinataires] = useState<DestinataireAvecCarcasses[]>(() => {
    // Récupérer les carcasses actuelles
    const currentCarcassesIds = carcasses.map((c) => c.zacharie_carcasse_id);

    // Grouper les carcasses par leur détenteur actuel
    const carcassesByDetenteur = new Map<string, string[]>();

    for (const carcasse of carcasses) {
      const detenteurId = carcasse.premier_detenteur_prochain_detenteur_id_cache;
      if (detenteurId) {
        if (!carcassesByDetenteur.has(detenteurId)) {
          carcassesByDetenteur.set(detenteurId, []);
        }
        carcassesByDetenteur.get(detenteurId)!.push(carcasse.zacharie_carcasse_id);
      }
    }

    // Si des carcasses ont déjà des détenteurs assignés, créer la structure
    if (carcassesByDetenteur.size > 0) {
      return Array.from(carcassesByDetenteur.entries()).map(([entityId, carcasseIds]) => {
        const firstCarcasse = carcasses.find((c) => c.zacharie_carcasse_id === carcasseIds[0]);
        return {
          entityId,
          carcasseIds,
          depotType: firstCarcasse?.premier_detenteur_depot_type ?? null,
          depotEntityId: firstCarcasse?.premier_detenteur_depot_entity_id ?? null,
          transportType: firstCarcasse?.premier_detenteur_transport_type ?? null,
          depotDate: firstCarcasse?.premier_detenteur_depot_ccg_at
            ? dayjs(firstCarcasse.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm')
            : undefined,
          transportDate: firstCarcasse?.premier_detenteur_transport_date
            ? dayjs(firstCarcasse.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm')
            : undefined,
        };
      });
    }

    // Sinon, créer un détenteur par défaut si on a une valeur dans le FEI
    if (premierDetenteurEntity || premierDetenteurUser) {
      if (fei.premier_detenteur_prochain_detenteur_id_cache) {
        return [
          {
            entityId: fei.premier_detenteur_prochain_detenteur_id_cache,
            carcasseIds: currentCarcassesIds,
            depotType: fei.premier_detenteur_depot_type ?? null,
            depotEntityId: fei.premier_detenteur_depot_entity_id ?? null,
            transportType: fei.premier_detenteur_transport_type ?? null,
            depotDate: fei.premier_detenteur_depot_ccg_at
              ? dayjs(fei.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm')
              : undefined,
            transportDate: fei.premier_detenteur_transport_date
              ? dayjs(fei.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm')
              : undefined,
          },
        ];
      }
      if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
        if (prefilledInfos?.premier_detenteur_prochain_detenteur_id_cache) {
          return [
            {
              entityId: prefilledInfos.premier_detenteur_prochain_detenteur_id_cache,
              carcasseIds: currentCarcassesIds,
              depotType: prefilledInfos.premier_detenteur_depot_type ?? null,
              depotEntityId: prefilledInfos.premier_detenteur_depot_entity_id ?? null,
              transportType: prefilledInfos.premier_detenteur_transport_type ?? null,
            },
          ];
        }
      }
    } else if (intermediaire?.intermediaire_prochain_detenteur_id_cache) {
      return [
        {
          entityId: intermediaire.intermediaire_prochain_detenteur_id_cache,
          carcasseIds: currentCarcassesIds,
          depotType: intermediaire.intermediaire_depot_type ?? null,
          depotEntityId: intermediaire.intermediaire_depot_entity_id ?? null,
        },
      ];
    }

    // Par défaut, retourner un tableau vide (l'utilisateur devra ajouter des détenteurs)
    return [];
  });

  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState<string | null>(null);
  const [editingDetenteurIndex, setEditingDetenteurIndex] = useState<number | null>(null);
  const [expandedCarcassesSections, setExpandedCarcassesSections] = useState<Set<number>>(new Set());

  // Pour la rétrocompatibilité, on garde une référence au premier détenteur si un seul existe
  // const prochainDetenteurEntityId = destinataires.length === 1 ? destinataires[0].entityId : null;
  const needTransportForDetenteur = (entityId: string) => {
    if (sousTraite) return false;
    if (premierDetenteurEntity || premierDetenteurUser) {
      const detenteurType = entities[entityId]?.type;
      return detenteurType !== EntityTypes.COLLECTEUR_PRO;
    }
    return false;
  };

  const needDepot = useMemo(() => {
    if (sousTraite) return false;
    if (premierDetenteurEntity) return true;
    if (intermediaireEntityType === EntityTypes.ETG) return false;
    return true;
  }, [sousTraite, premierDetenteurEntity, intermediaireEntityType]);

  // Fonctions helper pour gérer les destinataires
  const addDestinataire = () => {
    setDestinataires([
      ...destinataires,
      {
        entityId: '',
        carcasseIds: [],
        depotType: null,
        depotEntityId: null,
        transportType: null,
      },
    ]);
    setEditingDetenteurIndex(destinataires.length);
    setExpandedCarcassesSections((prev) => {
      const next = new Set(prev);
      next.add(destinataires.length);
      return next;
    });
  };

  const removeDestinataire = (index: number) => {
    const newDestinataires = destinataires.filter((_, i) => i !== index);
    setDestinataires(newDestinataires);
    if (editingDetenteurIndex === index) {
      setEditingDetenteurIndex(null);
    }
  };

  const updateDestinataire = (index: number, updates: Partial<DestinataireAvecCarcasses>) => {
    const newDestinataires = [...destinataires];
    newDestinataires[index] = { ...newDestinataires[index], ...updates };
    setDestinataires(newDestinataires);
  };

  const assignCarcassesToDestinataire = (detenteurIndex: number, carcasseIds: string[]) => {
    // Retirer ces carcasses des autres détenteurs
    const newDestinataires = destinataires.map((dest, idx) => {
      if (idx === detenteurIndex) {
        return { ...dest, carcasseIds };
      }
      return {
        ...dest,
        carcasseIds: dest.carcasseIds.filter((id) => !carcasseIds.includes(id)),
      };
    });
    setDestinataires(newDestinataires);
  };

  // Validation : vérifier que toutes les carcasses sont assignées et que chaque détenteur a toutes les infos nécessaires
  const needToSubmit = useMemo(() => {
    // Vérifier que toutes les carcasses sont assignées
    const allCarcasseIds = carcasses.map((c) => c.zacharie_carcasse_id);
    const assignedCarcasseIds = destinataires.flatMap((d) => d.carcasseIds);
    const allAssigned = allCarcasseIds.every((id) => assignedCarcasseIds.includes(id));

    if (!allAssigned || destinataires.length === 0) {
      return true;
    }

    // Vérifier que chaque détenteur est valide
    for (const dest of destinataires) {
      if (!dest.entityId) return true;
      if (dest.carcasseIds.length === 0) return true;

      if (fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
        const detenteurType = entities[dest.entityId]?.type;
        if (detenteurType === EntityTypes.SVI) {
          continue; // pas de détail pour les SVI
        }

        const needsTransport = needTransportForDetenteur(dest.entityId);
        if (needsTransport && !dest.transportType) return true;
        if (needDepot) {
          if (!dest.depotType) return true;
          if (dest.depotType === DepotType.CCG && !dest.depotEntityId) return true;
          if (
            dest.transportType === TransportType.PREMIER_DETENTEUR &&
            dest.depotType === DepotType.CCG &&
            !dest.depotDate
          ) {
            return true;
          }
        }
      }
    }

    // Comparer avec l'état actuel du FEI (simplifié - on considère qu'il faut soumettre si on a plusieurs détenteurs)
    if (destinataires.length > 1) {
      return true; // Toujours soumettre si on a plusieurs détenteurs (nouvelle fonctionnalité)
    }

    // Pour un seul détenteur, vérifier les différences avec l'état actuel
    if (destinataires.length === 1) {
      const dest = destinataires[0];
      if (dest.entityId !== fei.fei_next_owner_entity_id) return true;
      if (dest.depotType !== fei.premier_detenteur_depot_type) return true;
      if (dest.depotEntityId !== fei.premier_detenteur_depot_entity_id) return true;
      if (dest.transportType !== fei.premier_detenteur_transport_type) return true;
      // ... autres vérifications si nécessaire
    }

    return false;
  }, [destinataires, carcasses, fei, entities, needDepot]);

  const [tryToSubmitAtLeastOnce, setTryTOSubmitAtLeastOnce] = useState(false);
  const alertMessage = useMemo(() => {
    // Vérifier que toutes les carcasses sont assignées
    const allCarcasseIds = carcasses.map((c) => c.zacharie_carcasse_id);
    const assignedCarcasseIds = destinataires.flatMap((d) => d.carcasseIds);
    const allAssigned = allCarcasseIds.every((id) => assignedCarcasseIds.includes(id));

    if (!allAssigned) {
      const unassignedCount = allCarcasseIds.length - assignedCarcasseIds.length;
      return `Il manque ${unassignedCount} carcasse${unassignedCount > 1 ? 's' : ''} non assignée${unassignedCount > 1 ? 's' : ''} à un détenteur`;
    }

    if (destinataires.length === 0) {
      return 'Vous devez ajouter au moins un prochain détenteur';
    }

    // Vérifier chaque détenteur
    for (let i = 0; i < destinataires.length; i++) {
      const dest = destinataires[i];

      if (!dest.entityId) {
        return `Le détenteur ${i + 1} n'a pas d'entité sélectionnée`;
      }

      if (dest.carcasseIds.length === 0) {
        return `Le détenteur ${i + 1} n'a aucune carcasse assignée`;
      }

      if (fei.fei_next_owner_wants_to_sous_traite) {
        const detenteurType = entities[dest.entityId]?.type;
        if (detenteurType === EntityTypes.SVI) {
          if (intermediaire?.intermediaire_role !== FeiOwnerRole.ETG) {
            return 'Attention, devez cliquer sur "Je prends en charge cette fiche" avant de transmettre la fiche au Service Vétérinaire';
          }
        }
      }

      if (needDepot) {
        if (!dest.depotType) {
          return `Il manque le lieu de stockage pour le détenteur ${i + 1}`;
        }
        if (dest.depotType === DepotType.CCG && !dest.depotEntityId) {
          return `Il manque le centre de collecte du gibier sauvage pour le détenteur ${i + 1}`;
        }
        if (
          dest.depotType === DepotType.CCG &&
          fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR &&
          !dest.depotDate
        ) {
          return `Il manque la date de dépôt dans le centre de collecte pour le détenteur ${i + 1}`;
        }
      }

      const needsTransport = needTransportForDetenteur(dest.entityId);
      if (needsTransport) {
        if (!dest.transportType) {
          return `Il manque le type de transport pour le détenteur ${i + 1}`;
        }
        if (
          dest.transportType === TransportType.PREMIER_DETENTEUR &&
          dest.depotType === DepotType.CCG &&
          !dest.transportDate
        ) {
          return `Il manque la date de transport pour le détenteur ${i + 1}`;
        }
      }
    }

    return null;
  }, [
    destinataires,
    carcasses,
    fei.fei_next_owner_wants_to_sous_traite,
    fei.fei_current_owner_role,
    needDepot,
    entities,
    intermediaire?.intermediaire_role,
  ]);

  const Component = canEdit ? Input : InputNotEditable;

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
          'space-y-8',
          '',
        ].join(' ')}
      >
        <div className="mb-8">
          {destinataires.map((dest, index) => {
            const detenteurEntity = dest.entityId ? entities[dest.entityId] : null;
            const needsTransport = dest.entityId ? needTransportForDetenteur(dest.entityId) : false;

            return (
              <div
                key={index}
                className="mb-8 rounded-xl border border-gray-200 p-5 shadow-md transition-shadow hover:shadow-md"
              >
                <div className="space-y-8">
                  <div className="rounded-lg bg-white p-2">
                    <SelectCustom
                      label="Prochain détenteur des carcasses *"
                      isDisabled={disabled}
                      hint={
                        <>
                          <span className="text-gray-700">
                            Indiquez ici la personne ou la structure avec qui vous êtes en contact pour
                            prendre en charge le gibier.
                          </span>
                          {!dest.entityId && !disabled && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {canTransmitCarcassesToEntities.map((entity) => {
                                return (
                                  <Tag
                                    key={entity.id}
                                    iconId="fr-icon-checkbox-circle-line"
                                    className="mr-2"
                                    nativeButtonProps={{
                                      onClick: () => updateDestinataire(index, { entityId: entity.id }),
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
                        prochainsDetenteursOptions.find((option) => option.value === dest.entityId) ?? null
                      }
                      getOptionLabel={(f) => f.label!}
                      getOptionValue={(f) => f.value}
                      onChange={(f) => updateDestinataire(index, { entityId: f?.value ?? '' })}
                      isClearable={!!dest.entityId}
                      inputId={`select-prochain-detenteur-${index}`}
                      classNamePrefix={`select-prochain-detenteur-${index}`}
                      required
                      creatable
                      // @ts-expect-error - onCreateOption is not typed
                      onCreateOption={(newOption) => {
                        setEditingDetenteurIndex(index);
                        setNewEntityNomDUsage(newOption);
                        partenaireModal.open();
                      }}
                      isReadOnly={!canEdit}
                      name={`prochain_detenteur_${index}`}
                    />
                  </div>

                  {detenteurEntity && !detenteurEntity?.zacharie_compatible && (
                    <Alert
                      severity="warning"
                      title="Attention"
                      description={`${detenteurEntity?.nom_d_usage} n'est pas prêt pour Zacharie. Vous pouvez contacter un représentant avant de leur envoyer leur première fiche.`}
                    />
                  )}

                  {dest.entityId && (
                    <div className="space-y-4">
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedCarcassesSections((prev) => {
                              const next = new Set(prev);
                              if (next.has(index)) {
                                next.delete(index);
                              } else {
                                next.add(index);
                              }
                              return next;
                            });
                          }}
                          className="hover:text-action-high-blue-france mb-2 flex w-full items-center justify-between text-left text-sm font-medium"
                        >
                          <span>
                            {dest.carcasseIds.length} carcasse{dest.carcasseIds.length > 1 ? 's' : ''}{' '}
                            assignée
                            {dest.carcasseIds.length > 1 ? 's' : ''} à ce détenteur *
                          </span>
                          <span
                            className={`fr-icon-arrow-down-s-line transition-transform duration-300 ${expandedCarcassesSections.has(index) ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                          />
                        </button>
                        <div
                          className={`grid grid-cols-1 gap-4 overflow-hidden transition-all duration-500 ease-in-out sm:grid-cols-2 md:grid-cols-3 ${
                            expandedCarcassesSections.has(index)
                              ? 'max-h-[5000px] opacity-100'
                              : 'max-h-0 opacity-0'
                          }`}
                        >
                          {carcasses.map((carcasse, carcasseIndex) => {
                            const isAssigned = dest.carcasseIds.includes(carcasse.zacharie_carcasse_id);
                            const isAssignedToOther = Boolean(
                              destinataires.find(
                                (d, idx) =>
                                  idx !== index && d.carcasseIds.includes(carcasse.zacharie_carcasse_id),
                              ),
                            );
                            return (
                              <div
                                key={carcasse.zacharie_carcasse_id}
                                className={`transition-all duration-300 ease-out ${
                                  expandedCarcassesSections.has(index)
                                    ? 'translate-y-0 opacity-100'
                                    : '-translate-y-4 opacity-0'
                                }`}
                                style={{
                                  transitionDelay: expandedCarcassesSections.has(index)
                                    ? `${carcasseIndex * 50}ms`
                                    : '0ms',
                                }}
                              >
                                <div className={`relative`}>
                                  <CardCarcasseSelectionItem
                                    carcasse={carcasse}
                                    onClick={() => {
                                      if (isAssigned) {
                                        updateDestinataire(index, {
                                          carcasseIds: dest.carcasseIds.filter(
                                            (id) => id !== carcasse.zacharie_carcasse_id,
                                          ),
                                        });
                                      } else {
                                        assignCarcassesToDestinataire(index, [
                                          ...dest.carcasseIds,
                                          carcasse.zacharie_carcasse_id,
                                        ]);
                                      }
                                    }}
                                    isAssigned={isAssigned}
                                    isAssignedToOther={isAssignedToOther}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {needDepot && (
                        <div className="bg-[#eee] p-6">
                          <RadioButtons
                            legend="Lieu de stockage des carcasses *"
                            className={canEdit ? '' : 'radio-black'}
                            disabled={!dest.entityId}
                            options={[
                              {
                                label: <span className="inline-block">Pas de stockage</span>,
                                hintText:
                                  fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR ? (
                                    <span>
                                      Sans stockage en chambre froide, les carcasses doivent être transportées{' '}
                                      <b>le jour-même du tir</b>
                                    </span>
                                  ) : (
                                    <span>Les carcasses sont livrées chez le destinataire</span>
                                  ),
                                nativeInputProps: {
                                  checked: dest.depotType === DepotType.AUCUN,
                                  readOnly: !canEdit,
                                  onChange: () => {
                                    updateDestinataire(index, {
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
                                  checked: dest.depotType === DepotType.CCG,
                                  readOnly: !canEdit,
                                  onChange: () => {
                                    updateDestinataire(index, { depotType: DepotType.CCG });
                                  },
                                },
                              },
                            ]}
                          />
                          {dest.depotType === DepotType.CCG &&
                            (ccgsWorkingWith.length > 0 ? (
                              <div className="mt-6 space-y-6">
                                <SelectCustom
                                  label="Chambre froide (centre de collecte du gibier sauvage) *"
                                  isDisabled={dest.depotType !== DepotType.CCG}
                                  isReadOnly={!canEdit}
                                  hint={
                                    <>
                                      {!dest.depotEntityId && dest.depotType === DepotType.CCG ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {ccgsWorkingWith.map((entity) => {
                                            return (
                                              <Tag
                                                key={entity.id}
                                                iconId="fr-icon-checkbox-circle-line"
                                                className="mr-2"
                                                nativeButtonProps={{
                                                  onClick: () => {
                                                    updateDestinataire(index, { depotEntityId: entity.id });
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
                                  value={
                                    ccgsOptions.find((option) => option.value === dest.depotEntityId) ?? null
                                  }
                                  getOptionLabel={(f) => f.label!}
                                  getOptionValue={(f) => f.value}
                                  onChange={(f) => {
                                    if (f?.value === 'add_new') {
                                      navigate(
                                        `/app/tableau-de-bord/mon-profil/mes-ccgs?redirect=/app/tableau-de-bord/fei/${fei.numero}`,
                                      );
                                    }
                                    updateDestinataire(index, { depotEntityId: f?.value ?? null });
                                  }}
                                  isClearable={!!dest.depotEntityId}
                                  inputId={`select-ccg-${index}`}
                                  classNamePrefix={`select-ccg-${index}`}
                                  required
                                  name={`depot_entity_id_${index}`}
                                />
                                {fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR && (
                                  <Component
                                    label="Date de dépôt dans le Centre de Collecte du Gibier sauvage *"
                                    disabled={dest.depotType !== DepotType.CCG}
                                    hintText={
                                      canEdit ? (
                                        <button
                                          className="inline-block text-left"
                                          type="button"
                                          disabled={dest.depotType !== DepotType.CCG}
                                          onClick={() => {
                                            updateDestinataire(index, {
                                              depotDate: dayjs().format('YYYY-MM-DDTHH:mm'),
                                            });
                                          }}
                                        >
                                          <u className="inline">Cliquez ici</u> pour définir la date du jour
                                          et maintenant
                                        </button>
                                      ) : null
                                    }
                                    nativeInputProps={{
                                      id: `depot-date-${index}`,
                                      name: `depot_date_${index}`,
                                      type: 'datetime-local',
                                      required: true,
                                      autoComplete: 'off',
                                      suppressHydrationWarning: true,
                                      disabled: dest.depotType !== DepotType.CCG,
                                      value: dest.depotDate,
                                      onChange: (e) => {
                                        updateDestinataire(index, {
                                          depotDate: dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'),
                                        });
                                      },
                                    }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="mt-6 flex flex-col items-start gap-3">
                                <label className="text-base font-medium text-gray-900">
                                  Chambre froide (centre de collecte du gibier sauvage) *
                                </label>
                                <Button
                                  linkProps={{
                                    to: `/app/tableau-de-bord/mon-profil/mes-ccgs?redirect=/app/tableau-de-bord/fei/${fei.numero}`,
                                  }}
                                >
                                  Renseigner ma chambre froide (CCG)
                                </Button>
                              </div>
                            ))}
                        </div>
                      )}

                      {needsTransport && (
                        <div className="bg-[#eee] p-6">
                          <RadioButtons
                            legend="Transport des carcasses jusqu'au destinataire *"
                            className={canEdit ? '' : 'radio-black'}
                            disabled={!dest.entityId}
                            options={[
                              {
                                label: (
                                  <span className="inline-block">Je transporte les carcasses moi-même</span>
                                ),
                                hintText: (
                                  <span>
                                    N'oubliez pas de notifier le prochain détenteur des carcasses de votre
                                    dépôt.{' '}
                                    {dest.depotType === DepotType.AUCUN ? (
                                      <>
                                        Sans stockage en chambre froide, les carcasses doivent être
                                        transportées <b>le jour-même du tir</b>
                                      </>
                                    ) : (
                                      ''
                                    )}
                                  </span>
                                ),
                                nativeInputProps: {
                                  checked: dest.transportType === TransportType.PREMIER_DETENTEUR,
                                  readOnly: !canEdit,
                                  onChange: () => {
                                    updateDestinataire(index, {
                                      transportType: TransportType.PREMIER_DETENTEUR,
                                    });
                                  },
                                },
                              },
                              {
                                label: 'Le transport est réalisé par un collecteur professionnel',
                                hintText:
                                  'La gestion du transport est sous la responsabilité du prochain détenteur.',
                                nativeInputProps: {
                                  checked: dest.transportType === TransportType.COLLECTEUR_PRO,
                                  readOnly: !canEdit,
                                  onChange: () => {
                                    updateDestinataire(index, {
                                      transportType: TransportType.COLLECTEUR_PRO,
                                      transportDate: undefined,
                                    });
                                  },
                                },
                              },
                            ]}
                          />
                          {dest.transportType === TransportType.PREMIER_DETENTEUR &&
                            dest.depotType === DepotType.CCG && (
                              <div className="mt-6">
                                <Component
                                  label="Date à laquelle je transporte les carcasses"
                                  disabled={
                                    dest.transportType !== TransportType.PREMIER_DETENTEUR ||
                                    dest.depotType !== DepotType.CCG
                                  }
                                  hintText={
                                    canEdit ? (
                                      <>
                                        <button
                                          className="mr-1 inline-block text-left"
                                          type="button"
                                          disabled={
                                            dest.transportType !== TransportType.PREMIER_DETENTEUR ||
                                            dest.depotType !== DepotType.CCG
                                          }
                                          onClick={() => {
                                            updateDestinataire(index, {
                                              transportDate: dayjs().format('YYYY-MM-DDTHH:mm'),
                                            });
                                          }}
                                        >
                                          <u className="inline">Cliquez ici</u> pour définir la date du jour
                                          et maintenant.
                                        </button>
                                        À ne remplir que si vous êtes le transporteur et que vous stockez les
                                        carcasses dans un CCG. Indiquer une date permettra au prochain
                                        détenteur de s'organiser.
                                      </>
                                    ) : null
                                  }
                                  nativeInputProps={{
                                    id: `transport-date-${index}`,
                                    name: `transport_date_${index}`,
                                    type: 'datetime-local',
                                    required: true,
                                    autoComplete: 'off',
                                    suppressHydrationWarning: true,
                                    value: dest.transportDate,
                                    onChange: (e) => {
                                      updateDestinataire(index, {
                                        transportDate: dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'),
                                      });
                                    },
                                  }}
                                />
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end">
                    {canEdit && destinataires.length > 1 && (
                      <Button
                        priority="tertiary"
                        iconId="fr-icon-delete-line"
                        nativeButtonProps={{
                          onClick: () => removeDestinataire(index),
                        }}
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {canEdit && (
            <div className="mt-8 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 p-6">
              <Button
                priority="secondary"
                iconId="fr-icon-add-line"
                nativeButtonProps={{
                  onClick: addDestinataire,
                }}
              >
                Ajouter un autre détenteur
              </Button>
            </div>
          )}
        </div>
        {canEdit && (
          <div className="mt-8 rounded-lg bg-blue-50/50 p-6">
            <Button
              className="w-full sm:w-auto"
              type="submit"
              disabled={disabled || !needToSubmit}
              nativeButtonProps={{
                onClick: async (event) => {
                  event.preventDefault();
                  if (!tryToSubmitAtLeastOnce) {
                    setTryTOSubmitAtLeastOnce(true);
                  }
                  if (alertMessage) {
                    alert(alertMessage);
                    return;
                  }

                  if (destinataires.length === 0) return;

                  // Pour la rétrocompatibilité, utiliser le premier détenteur pour le FEI principal
                  const firstDest = destinataires[0];
                  const firstDetenteurEntity = entities[firstDest.entityId];
                  const firstDetenteurType = firstDetenteurEntity?.type as FeiOwnerRole;

                  if (sousTraite) {
                    // Cas sous-traite : traiter uniquement le premier détenteur pour la compatibilité
                    let nextFei: Partial<typeof fei> = {
                      fei_next_owner_entity_id: firstDest.entityId,
                      fei_next_owner_role: firstDetenteurType,
                      fei_next_owner_wants_to_sous_traite: false,
                      fei_next_owner_sous_traite_at: dayjs().toDate(),
                      fei_next_owner_sous_traite_by_user_id: user.id,
                      fei_next_owner_sous_traite_by_entity_id: fei.fei_next_owner_entity_id,
                      fei_current_owner_entity_id: fei.fei_prev_owner_entity_id,
                      fei_current_owner_role: fei.fei_prev_owner_role,
                      fei_current_owner_user_id: fei.fei_prev_owner_user_id,
                      svi_assigned_at: firstDetenteurType === EntityTypes.SVI ? dayjs().toDate() : null,
                      svi_entity_id: firstDetenteurType === EntityTypes.SVI ? firstDest.entityId : null,
                    };
                    if (feiAndIntermediaireIds && intermediaire) {
                      let nextCarcasseIntermediaire: Partial<CarcasseIntermediaire> = {
                        intermediaire_prochain_detenteur_id_cache: firstDest.entityId,
                        intermediaire_prochain_detenteur_role_cache: firstDetenteurType,
                        intermediaire_depot_type: firstDest.depotType ?? null,
                        intermediaire_depot_entity_id:
                          firstDest.depotType === DepotType.AUCUN ? null : (firstDest.depotEntityId ?? null),
                      };
                      updateAllCarcasseIntermediaire(
                        fei.numero,
                        feiAndIntermediaireIds!,
                        nextCarcasseIntermediaire,
                      );
                    }
                    updateFei(fei.numero, nextFei);
                    addLog({
                      user_id: user.id,
                      user_role:
                        fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR ||
                        fei.fei_current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL
                          ? UserRoles.CHASSEUR
                          : fei.fei_current_owner_role!,
                      action: `${calledFrom}-select-destinataire-sous-traite`,
                      fei_numero: fei.numero,
                      history: createHistoryInput(fei, nextFei),
                      entity_id: fei.premier_detenteur_entity_id,
                      zacharie_carcasse_id: null,
                      carcasse_intermediaire_id: null,
                      intermediaire_id: null,
                    });
                    return;
                  }

                  if (fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
                    // Mettre à jour chaque carcasse avec son détenteur assigné
                    for (const dest of destinataires) {
                      const detenteurEntity = entities[dest.entityId];
                      if (!detenteurEntity) continue;

                      const nextDepotEntityId =
                        dest.depotType === DepotType.AUCUN ? null : dest.depotEntityId;
                      const nextDepotDate = dest.depotDate ? dayjs(dest.depotDate).toDate() : null;
                      const nextTransportType = needTransportForDetenteur(dest.entityId)
                        ? dest.transportType
                        : null;
                      const nextTransportDate =
                        nextTransportType && dest.transportDate ? dayjs(dest.transportDate).toDate() : null;

                      // Mettre à jour chaque carcasse assignée à ce détenteur
                      for (const carcasseId of dest.carcasseIds) {
                        const carcasse = carcasses.find((c) => c.zacharie_carcasse_id === carcasseId);
                        if (!carcasse) continue;

                        updateCarcasse(
                          carcasse.zacharie_carcasse_id,
                          {
                            premier_detenteur_prochain_detenteur_role_cache:
                              detenteurEntity.type as FeiOwnerRole,
                            premier_detenteur_prochain_detenteur_id_cache: dest.entityId,
                            premier_detenteur_depot_type: dest.depotType ?? null,
                            premier_detenteur_depot_entity_id: nextDepotEntityId,
                            premier_detenteur_depot_entity_name_cache: nextDepotEntityId
                              ? (entities[nextDepotEntityId]?.nom_d_usage ?? null)
                              : null,
                            premier_detenteur_depot_ccg_at: nextDepotDate,
                            premier_detenteur_transport_type: nextTransportType,
                            premier_detenteur_transport_date: nextTransportDate,
                          },
                          false,
                        );
                      }
                    }

                    // Mettre à jour le FEI avec les infos du premier détenteur (rétrocompatibilité)
                    const firstDest = destinataires[0];
                    const firstDetenteurEntity = entities[firstDest.entityId];
                    const nextDepotEntityId =
                      firstDest.depotType === DepotType.AUCUN ? null : firstDest.depotEntityId;
                    const nextDepotDate = firstDest.depotDate ? dayjs(firstDest.depotDate).toDate() : null;
                    const nextTransportType = needTransportForDetenteur(firstDest.entityId)
                      ? firstDest.transportType
                      : null;
                    const nextTransportDate =
                      nextTransportType && firstDest.transportDate
                        ? dayjs(firstDest.transportDate).toDate()
                        : null;

                    let nextFei: Partial<typeof fei> = {
                      fei_next_owner_entity_id: firstDest.entityId,
                      fei_next_owner_role: firstDetenteurEntity?.type as FeiOwnerRole,
                      premier_detenteur_prochain_detenteur_id_cache: firstDest.entityId,
                      premier_detenteur_prochain_detenteur_role_cache:
                        firstDetenteurEntity?.type as FeiOwnerRole,
                      premier_detenteur_depot_type: firstDest.depotType ?? null,
                      premier_detenteur_depot_entity_id: nextDepotEntityId,
                      premier_detenteur_depot_entity_name_cache: nextDepotEntityId
                        ? entities[nextDepotEntityId!]?.nom_d_usage
                        : null,
                      premier_detenteur_depot_ccg_at: nextDepotDate,
                      premier_detenteur_transport_type: nextTransportType,
                      premier_detenteur_transport_date: nextTransportDate,
                    };
                    updateFei(fei.numero, nextFei);
                    addLog({
                      user_id: user.id,
                      user_role: UserRoles.CHASSEUR,
                      action: `${calledFrom}-select-destinataire`,
                      fei_numero: fei.numero,
                      history: createHistoryInput(fei, nextFei),
                      entity_id: fei.premier_detenteur_entity_id,
                      zacharie_carcasse_id: null,
                      carcasse_intermediaire_id: null,
                      intermediaire_id: null,
                    });
                    navigate(`/app/tableau-de-bord/fei/${fei.numero}/envoyée`);
                  } else {
                    if (!feiAndIntermediaireIds) return;
                    // Pour les intermédiaires, on utilise aussi le premier détenteur
                    const firstDest = destinataires[0];
                    const firstDetenteurEntity = entities[firstDest.entityId];
                    const firstDetenteurType = firstDetenteurEntity?.type as FeiOwnerRole;

                    let nextFei: Partial<typeof fei> = {
                      fei_next_owner_entity_id: firstDest.entityId,
                      fei_next_owner_role: firstDetenteurType,
                      svi_assigned_at: firstDetenteurType === EntityTypes.SVI ? dayjs().toDate() : null,
                      svi_entity_id: firstDetenteurType === EntityTypes.SVI ? firstDest.entityId : null,
                    };
                    if (firstDetenteurType === EntityTypes.SVI) {
                      // Mettre à jour toutes les carcasses pour le SVI
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
                      intermediaire_prochain_detenteur_id_cache: firstDest.entityId,
                      intermediaire_prochain_detenteur_role_cache: firstDetenteurType,
                      intermediaire_depot_type: firstDest.depotType ?? null,
                      intermediaire_depot_entity_id:
                        firstDest.depotType === DepotType.AUCUN ? null : (firstDest.depotEntityId ?? null),
                    };
                    updateAllCarcasseIntermediaire(
                      fei.numero,
                      feiAndIntermediaireIds,
                      nextCarcasseIntermediaire,
                    );
                    updateFei(fei.numero, nextFei);
                    addLog({
                      user_id: user.id,
                      user_role:
                        fei.fei_current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL
                          ? UserRoles.CHASSEUR
                          : fei.fei_current_owner_role!,
                      action: `${calledFrom}-select-destinataire`,
                      fei_numero: fei.numero,
                      history: createHistoryInput(fei, nextFei),
                      entity_id: fei.fei_current_owner_entity_id,
                      zacharie_carcasse_id: null,
                      carcasse_intermediaire_id: null,
                      intermediaire_id: feiAndIntermediaireIds.split('_')[1],
                    });
                  }
                },
              }}
            >
              Transmettre la fiche
            </Button>
          </div>
        )}
        {/* {!disabled && !!alertMessage?.length && tryToSubmitAtLeastOnce && ( */}
        {!disabled && alertMessage && (
          <Alert title="Attention" className="mt-4" severity="error" description={alertMessage || ''} />
        )}
        {canEdit &&
          !needToSubmit &&
          fei.fei_next_owner_entity_id &&
          (() => {
            const ownerId = fei.fei_next_owner_entity_id;
            if (!ownerId) return null;
            const owner = entities[ownerId];
            if (!owner) return null;
            return (
              <Alert
                className="mt-6"
                severity="success"
                description={`${owner.nom_d_usage} ${fei.is_synced ? 'a été notifié' : !isOnline ? 'sera notifié dès que vous aurez retrouvé du réseau' : 'va être notifié'}.`}
                title="Attribution effectuée"
              />
            );
          })()}
      </div>
      <partenaireModal.Component title="Ajouter un partenaire">
        <PartenaireNouveau
          key={newEntityNomDUsage ?? ''}
          newEntityNomDUsageProps={newEntityNomDUsage ?? undefined}
          onFinish={(newEntity) => {
            partenaireModal.close();
            if (newEntity && editingDetenteurIndex !== null) {
              updateDestinataire(editingDetenteurIndex, { entityId: newEntity.id });
              setEditingDetenteurIndex(null);
            } else if (newEntity) {
              // Si aucun index n'est défini, créer un nouveau détenteur
              addDestinataire();
              const newIndex = destinataires.length;
              updateDestinataire(newIndex, { entityId: newEntity.id });
            }
          }}
        />
      </partenaireModal.Component>
    </>
  );
}

type CardCarcasseSelectionItemProps = React.ComponentProps<typeof CardCarcasse> & {
  isAssigned: boolean;
  isAssignedToOther: boolean;
};

const CardCarcasseSelectionItem = (props: CardCarcasseSelectionItemProps) => {
  return (
    <div className="relative">
      {/* Badge "Déjà assignée" - positioned at top-left to avoid overlap */}
      {props.isAssignedToOther && (
        <div className="absolute bottom-1 left-2 z-10">
          <div className="bg-warning-main-525 rounded-md px-3 py-1.5 shadow-md">
            <p className="text-xs font-semibold text-white">Déjà assignée</p>
          </div>
        </div>
      )}

      {/* Checkbox button - positioned at top-right with better visibility */}
      <div className="absolute top-2 right-2 z-10">
        <Button
          type="button"
          iconId={props.isAssigned ? 'fr-icon-checkbox-circle-fill' : 'fr-icon-checkbox-circle-line'}
          onClick={props.onClick}
          title={props.isAssigned ? 'Désassigner la carcasse' : 'Assigner la carcasse'}
          priority="tertiary no outline"
        />
      </div>

      {/* Card with visual state indication */}
      <CardCarcasse
        {...props}
        className={
          props.isAssigned
            ? 'border-action-high-blue-france !bg-action-high-blue-france/10 border-l-4 border-solid'
            : props.isAssignedToOther
              ? 'border-warning-main-525 border-l-4 border-solid'
              : 'border-l-4 border-solid border-gray-300'
        }
      />
    </div>
  );
};
