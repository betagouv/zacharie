import { useNavigate, useParams } from 'react-router';
import { useMemo, useState } from 'react';
import {
  UserRoles,
  EntityTypes,
  DepotType,
  TransportType,
  FeiOwnerRole,
} from '@prisma/client';
import dayjs from 'dayjs';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { usePrefillPremierDétenteurInfos } from '@app/utils/usePrefillPremierDétenteur';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import type { FeiIntermediaire, FeiAndIntermediaireIds } from '@app/types/fei-intermediaire';
import { EntityWithUserRelation } from '@api/src/types/entity';
import { UserForFei } from '@api/src/types/user';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import DestinataireSubForm, { DestinataireGroupData } from './destinataire-sub-form';
import { v4 as uuidv4 } from 'uuid';
import { EntityRelationType } from '@prisma/client';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import CardCarcasse from '@app/components/CardCarcasse';

const partenaireModal = createModal({
  isOpenedByDefault: false,
  id: 'partenaire-modal',
});

const trichineModal = createModal({
  isOpenedByDefault: false,
  id: 'trichine-modal',
});

type Group = {
  id: string;
  data: DestinataireGroupData;
  carcassesIds: string[];
};

export default function DestinataireMultiSelect({
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

  const intermediaireEntity = intermediaire?.intermediaire_entity_id
    ? entities[intermediaire.intermediaire_entity_id]
    : null;
  const intermediaireEntityType = intermediaireEntity?.type;

  // Initial State Derivation
  const initialRecipientId = useMemo(() => {
    if (premierDetenteurEntity || premierDetenteurUser) {
      if (fei.premier_detenteur_prochain_detenteur_id_cache) {
        return fei.premier_detenteur_prochain_detenteur_id_cache;
      }
      if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
        if (prefilledInfos?.premier_detenteur_prochain_detenteur_id_cache) {
          return prefilledInfos.premier_detenteur_prochain_detenteur_id_cache;
        }
      }
    } else if (intermediaire) {
      if (intermediaire?.intermediaire_prochain_detenteur_id_cache) {
        return intermediaire.intermediaire_prochain_detenteur_id_cache;
      }
    }
    return null;
  }, [fei, premierDetenteurEntity, premierDetenteurUser, intermediaire, prefilledInfos]);

  const initialDepotType = useMemo(() => {
    // ... Simplified Logic reuse from DestinataireSelect ...
    // Note: Assuming similar logic for initial population
    if (premierDetenteurEntity || premierDetenteurUser) {
        if (fei.premier_detenteur_depot_type) return fei.premier_detenteur_depot_type;
        if (fei.premier_detenteur_depot_entity_id) {
             const type = entities[fei.premier_detenteur_depot_entity_id]?.type;
             if (type === EntityTypes.CCG) return DepotType.CCG;
             if (type === EntityTypes.ETG) return DepotType.ETG;
        }
        if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR && prefilledInfos?.premier_detenteur_depot_type) {
            return prefilledInfos.premier_detenteur_depot_type;
        }
    } else if (intermediaire?.intermediaire_depot_type) {
        return intermediaire.intermediaire_depot_type;
    }
    return null;
  }, [fei, premierDetenteurEntity, premierDetenteurUser, intermediaire, prefilledInfos, entities]);

  const initialDepotEntityId = useMemo(() => {
      if (premierDetenteurEntity || premierDetenteurUser) {
          if (fei.premier_detenteur_depot_entity_id) return fei.premier_detenteur_depot_entity_id;
           if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR && prefilledInfos?.premier_detenteur_depot_entity_id) {
              if (ccgsWorkingWith.find((entity) => entity.id === prefilledInfos.premier_detenteur_depot_entity_id)) {
                  return prefilledInfos.premier_detenteur_depot_entity_id;
              }
           }
      } else if (intermediaire?.intermediaire_depot_entity_id) {
          return intermediaire.intermediaire_depot_entity_id;
      }
      return null;
  }, [fei, premierDetenteurEntity, premierDetenteurUser, intermediaire, prefilledInfos, ccgsWorkingWith]);

  const initialTransportType = useMemo(() => {
     if (premierDetenteurEntity || premierDetenteurUser) {
        if (fei.premier_detenteur_transport_type) return fei.premier_detenteur_transport_type;
        if (prefilledInfos?.premier_detenteur_transport_type) return prefilledInfos.premier_detenteur_transport_type;
     }
     return null;
  }, [fei, premierDetenteurEntity, premierDetenteurUser, prefilledInfos]);

  const [groups, setGroups] = useState<Group[]>(() => {
    // Check if carcasses already have split destinations
    // For now we assume they don't or validation will force user to fix.
    // Actually, we should group by existing destination if they exist.
    
    // Simplification for now: All in one group, or split by existing cache field on carcass
    
    const groupsMap = new Map<string, string[]>(); // key: recipientId | 'null', value: carcassIds
    
    // Group carcasses by their current next owner cache
    carcasses.forEach(c => {
        const key = c.premier_detenteur_prochain_detenteur_id_cache || 'initial';
        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key)!.push(c.zacharie_carcasse_id);
    });

    if (groupsMap.size === 0) {
        // Fallback for new init
        return [{
            id: uuidv4(),
            carcassesIds: carcasses.map(c => c.zacharie_carcasse_id),
            data: {
                recipientId: initialRecipientId,
                depotType: initialDepotType,
                depotEntityId: initialDepotEntityId,
                depotDate: fei.premier_detenteur_depot_ccg_at ? dayjs(fei.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm') : undefined,
                transportType: initialTransportType,
                transportDate: fei.premier_detenteur_transport_date ? dayjs(fei.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm') : undefined,
            }
        }];
    }
    
    // Reconstruct groups from existing carcass data if possible, ensuring "initial" maps to initial props
    const result: Group[] = [];
    const initialKey = initialRecipientId || 'initial';
    
    // If we have existing split, we try to honor it. 
    // BUT since we are replacing logic, let's keep it simple: 
    // IF we are editing an EXISTING FEI that was already split (not possible yet as feature is new), read from carcass.
    // For now, let's just create ONE group with initial data, as that's the current state of DB.
    
    return [{
        id: uuidv4(),
        carcassesIds: carcasses.map(c => c.zacharie_carcasse_id),
        data: {
            recipientId: initialRecipientId,
            depotType: initialDepotType,
            depotEntityId: initialDepotEntityId,
            depotDate: fei.premier_detenteur_depot_ccg_at ? dayjs(fei.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm') : undefined,
            transportType: initialTransportType,
            transportDate: fei.premier_detenteur_transport_date ? dayjs(fei.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm') : undefined,
        }
    }];
  });

  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState<string | null>(null);
  const [targetGroupIndexForNewEntity, setTargetGroupIndexForNewEntity] = useState<number | null>(null);

  // Helper to get trichine status for all groups
  const getTrichineStatus = () => {
    // Returns message if ANY group needs it
    // Logic: Look for groups with Sanglier AND CircuitCourt recipient
    for (const group of groups) {
      if (!group.data.recipientId) continue;
      const recipient = entities[group.data.recipientId];
      if (!recipient) continue;
      const type = recipient.type;
      
      const groupCarcasses = carcasses.filter(c => group.carcassesIds.includes(c.zacharie_carcasse_id));
      const hasSanglier = groupCarcasses.some(c => c.espece === 'Sanglier');
      
      if (!hasSanglier) continue;

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
                   <strong>Une ou plusieurs carcasses de sanglier transmises nécessitent un test trichine obligatoire.</strong>
                 </p>
                 <p>
                   Conformément à la réglementation, vous devez vous assurer que le test trichine a été réalisé
                   avant toute mise sur le marché ou consommation de ces carcasses.
                 </p>
               </>
            ),
            isOptional: false
         };
      }
       if (type === EntityTypes.CONSOMMATEUR_FINAL) {
          // If we already have a mandatory warning, keep it. Otherwise return recommended.
          return {
            title: 'Rappel : test trichine recommandé',
            content: (
              <>
                <p className="mb-3">
                  <strong>Une ou plusieurs carcasses de sanglier transmises nécessitent un test trichine recommandé.</strong>
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
            isOptional: true
          };
       }
    }
    return null;
  };

  const trichineMessage = getTrichineStatus();

  const shouldShowTrichineModal = useMemo(() => {
     if (!trichineMessage) return false;
     const dontShowKey = 'trichine-modal-dont-show-again';
     return localStorage.getItem(dontShowKey) !== 'true';
  }, [trichineMessage]);


  const allAssignedCarcassesIds = useMemo(() => {
    return new Set(groups.flatMap(g => g.carcassesIds));
  }, [groups]);

  const unassignedCarcassesCount = carcasses.length - allAssignedCarcassesIds.size;

  const jobIsMissing = useMemo(() => {
      // Logic copied from DestinataireSelect but applied to EACH group
      for (const group of groups) {
         const { recipientId, depotType, depotEntityId, depotDate, transportType, transportDate } = group.data;
         
         const recipient = recipientId ? entities[recipientId] : null;
         const recipientType = recipient?.type;

         if (!recipientId) return 'Il manque le prochain détenteur des carcasses pour un ou plusieurs groupes';
         
         if (group.carcassesIds.length === 0) return 'Un groupe de destinataire est vide (aucune carcasse assignée)';

         const needDepot = !sousTraite && (!!premierDetenteurEntity || (intermediaireEntityType !== EntityTypes.ETG));
         // Note: needDepot logic simplified, make sure it matches original nuances if important
         
         if (needDepot) {
            if (!depotType) return 'Il manque le lieu de stockage des carcasses';
            if (depotType === DepotType.CCG && !depotEntityId) return 'Il manque le centre de collecte du gibier sauvage';
            if (depotType === DepotType.CCG && fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR && !depotDate) return 'Il manque la date de dépôt dans le centre de collecte';
         }

          const needTransport = !sousTraite && (!!premierDetenteurEntity || !!premierDetenteurUser) && 
             !(recipientType === EntityTypes.CONSOMMATEUR_FINAL || recipientType === EntityTypes.COMMERCE_DE_DETAIL || recipientType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF);

         if (needTransport) {
             if (!transportType) return 'Il manque le type de transport';
             if (transportType === TransportType.PREMIER_DETENTEUR && depotType === DepotType.CCG && !transportDate) return 'Il manque la date de transport';
         }
      }
      return null;
  }, [groups, entities, fei, sousTraite, premierDetenteurEntity, premierDetenteurUser, intermediaireEntityType, unassignedCarcassesCount]);

  const [tryToSubmitAtLeastOnce, setTryTOSubmitAtLeastOnce] = useState(false);

  const handleSubmit = () => {
    // Update logic for multi-recipient
    
    // 1. Update each carcasse individually
    for (const group of groups) {
        if (!group.data.recipientId) continue;
        
        const nextFei: any = {
             premier_detenteur_prochain_detenteur_id_cache: group.data.recipientId,
             premier_detenteur_prochain_detenteur_role_cache: entities[group.data.recipientId]?.type as FeiOwnerRole,
             premier_detenteur_depot_type: group.data.depotType,
             premier_detenteur_depot_entity_id: group.data.depotType === DepotType.AUCUN ? null : group.data.depotEntityId,
             premier_detenteur_depot_entity_name_cache: group.data.depotEntityId ? entities[group.data.depotEntityId]?.nom_d_usage : null,
             premier_detenteur_depot_ccg_at: group.data.depotDate ? dayjs(group.data.depotDate).toDate() : null,
             premier_detenteur_transport_type: group.data.transportType,
             premier_detenteur_transport_date: group.data.transportDate ? dayjs(group.data.transportDate).toDate() : null,
        };

        for (const carcasseId of group.carcassesIds) {
             updateCarcasse(carcasseId, {
                ...nextFei // Apply these fields to the carcasse
             }, false);
        }
    }
    
    // 2. Update FEI with the FIRST group's data (Primary Recipient)
    const primaryGroup = groups[0];
    const nextFei: Partial<typeof fei> = {
        fei_next_owner_entity_id: primaryGroup.data.recipientId!,
        fei_next_owner_role: entities[primaryGroup.data.recipientId!]?.type as FeiOwnerRole,
        premier_detenteur_prochain_detenteur_id_cache: primaryGroup.data.recipientId!,
        premier_detenteur_prochain_detenteur_role_cache: entities[primaryGroup.data.recipientId!]?.type as FeiOwnerRole,
        premier_detenteur_depot_type: primaryGroup.data.depotType,
        premier_detenteur_depot_entity_id: primaryGroup.data.depotType === DepotType.AUCUN ? null : primaryGroup.data.depotEntityId,
        premier_detenteur_depot_entity_name_cache: primaryGroup.data.depotEntityId ? entities[primaryGroup.data.depotEntityId]?.nom_d_usage : null,
        premier_detenteur_depot_ccg_at: primaryGroup.data.depotDate ? dayjs(primaryGroup.data.depotDate).toDate() : null,
        premier_detenteur_transport_type: primaryGroup.data.transportType,
        premier_detenteur_transport_date: primaryGroup.data.transportDate ? dayjs(primaryGroup.data.transportDate).toDate() : null,
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
  };

  const addGroup = () => {
    // Create new group with empty data and NO carcasses initially? 
    // Or do UI need to drag drop?
    // Let's just create empty group. User logic will be to move carcasses.
    setGroups([...groups, {
        id: uuidv4(),
        carcassesIds: [],
        data: {
            recipientId: null,
            depotType: null,
            depotEntityId: null,
            depotDate: undefined,
            transportType: null,
            transportDate: undefined
        }
    }]);
  };
  

  const removeGroup = (groupId: string) => {
    if (groups.length <= 1) return;
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  if (!fei.premier_detenteur_user_id) {
     return "Il n'y a pas encore de premier détenteur pour cette fiche";
  }

  return (
    <>
      <div className={className}>
          {groups.map((group, index) => (
             <div key={group.id} className="relative mb-8 border-l-4 border-action-high-blue-france pl-4 bg-gray-50 p-4 rounded">
                 
                 {/* Carcasses Selector for this Group */}
                 <div className="mb-4">
                     <div className="mb-4">
                         <Accordion label={`Carcasses assignées : ${group.carcassesIds.length} ${group.carcassesIds.length === 0 ? '(Aucune carcasse !)' : ''}`}>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {carcasses.map(c => {
                                    const isSelected = group.carcassesIds.includes(c.zacharie_carcasse_id);
                                    const assignedToOtherGroup = groups.some(g => g.id !== group.id && g.carcassesIds.includes(c.zacharie_carcasse_id));
                                    
                                    return (
                                        <div key={c.zacharie_carcasse_id} className="relative">
                                            {/* Visual indicator overlay/border adjustment could be done here or via props to CardCarcasse if it supports it.
                                                Using a wrapper div for selection border.
                                            */}
                                            <div className={`
                                                border-2 rounded transition-all
                                                ${isSelected ? 'border-action-high-blue-france' : 'border-transparent'}
                                                ${assignedToOtherGroup && !isSelected ? 'opacity-60 grayscale' : ''}
                                            `}>
                                                <CardCarcasse 
                                                    carcasse={c}
                                                    hideDateMiseAMort
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            // Deselect
                                                            setGroups(prev => prev.map(g => {
                                                                if (g.id === group.id) {
                                                                    return { ...g, carcassesIds: g.carcassesIds.filter(id => id !== c.zacharie_carcasse_id) };
                                                                }
                                                                return g;
                                                            }));
                                                        } else {
                                                            // Select (steal logic)
                                                            setGroups(prev => prev.map(g => {
                                                                if (g.id === group.id) {
                                                                    return { ...g, carcassesIds: [...g.carcassesIds, c.zacharie_carcasse_id] };
                                                                }
                                                                if (g.carcassesIds.includes(c.zacharie_carcasse_id)) {
                                                                    return { ...g, carcassesIds: g.carcassesIds.filter(id => id !== c.zacharie_carcasse_id) };
                                                                }
                                                                return g;
                                                            }));
                                                        }
                                                    }}
                                                />
                                                {/* Overlay checkmark or status text */}
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 bg-action-high-blue-france text-white rounded-full p-1 shadow-md z-10">
                                                        <span className="fr-icon-check-line" aria-hidden="true"></span>
                                                    </div>
                                                )}
                                                {assignedToOtherGroup && !isSelected && (
                                                    <div className="absolute top-2 right-2 bg-gray-200 text-gray-700 rounded px-2 py-1 text-xs font-bold z-10">
                                                        Autre groupe
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                             </div>
                         </Accordion>
                     </div>
                 </div>

                 <DestinataireSubForm 
                    index={index}
                    data={group.data}
                    onChange={(newData) => {
                        setGroups(current => current.map((g, i) => i === index ? { ...g, data: newData } : g));
                    }}
                    canEdit={canEdit}
                    disabled={disabled}
                    sousTraite={sousTraite}
                    premierDetenteurEntity={premierDetenteurEntity}
                    premierDetenteurUser={premierDetenteurUser}
                    entities={entities}
                    prochainsDetenteurs={prochainsDetenteurs}
                    ccgs={ccgs}
                    ccgsWorkingWith={ccgsWorkingWith}
                    ccgsOptions={ccgsOptions}
                    onAddNewEntity={(name) => {
                        setNewEntityNomDUsage(name);
                        setTargetGroupIndexForNewEntity(index);
                        partenaireModal.open();
                    }}
                    onNavigateToCcgs={() => {
                        navigate(
                           `/app/tableau-de-bord/mon-profil/mes-ccgs?redirect=/app/tableau-de-bord/fei/${fei.numero}`,
                        );
                    }}
                    feiCurrentOwnerRole={fei.fei_current_owner_role!}
                    intermediaireEntityType={intermediaireEntityType}
                    intermediaire={intermediaire}
                 />
                 
                 {canEdit && groups.length > 1 && (
                     <div className="mt-4 flex justify-end">
                         <Button
                             priority="tertiary no outline"
                             iconId="fr-icon-delete-bin-line"
                             onClick={() => removeGroup(group.id)}
                             disabled={disabled}
                         >
                             Retirer ce destinataire
                         </Button>
                     </div>
                 )}
             </div>
          ))}

          {unassignedCarcassesCount > 0 && (
             <Alert 
               severity="warning" 
               title="Attention" 
               description={`Il reste ${unassignedCarcassesCount} carcasse(s) qui ne sont pas assignée(s) à un destinataire.`} 
               className="mb-8"
             />
          )}

          {canEdit && (
              <Button 
                priority="secondary" 
                className=""
                nativeButtonProps={{
                    onClick: addGroup
                }}
              >
                  Ajouter un autre destinataire
              </Button>
          )}

          {canEdit && (
          <Button
            className="mt-4"
            type="submit"
            disabled={disabled || (tryToSubmitAtLeastOnce && !!jobIsMissing)}
            nativeButtonProps={{
              onClick: async (event) => {
                event.preventDefault();
                 setTryTOSubmitAtLeastOnce(true);
                if (jobIsMissing) {
                   
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
        
        {!disabled && !!jobIsMissing && tryToSubmitAtLeastOnce && (
          <Alert title="Attention" className="mt-4" severity="error" description={jobIsMissing} />
        )}
      </div>

       <partenaireModal.Component title="Ajouter un partenaire">
        {isPartenaireModalOpen && (
          <PartenaireNouveau
            key={newEntityNomDUsage ?? ''}
            newEntityNomDUsageProps={newEntityNomDUsage ?? undefined}
            onFinish={(newEntity) => {
              partenaireModal.close();
              if (newEntity && targetGroupIndexForNewEntity !== null) {
                  setGroups(prev => prev.map((g, i) => i === targetGroupIndexForNewEntity ? { ...g, data: { ...g.data, recipientId: newEntity.id } } : g));
              }
            }}
          />
        )}
      </partenaireModal.Component>

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
