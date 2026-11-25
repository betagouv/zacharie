import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { filterEntitiesWorkingDirectlyForObj } from '@app/utils/get-entity-relations';
import {
  isCarcasseDone,
  isCarcasseToTake,
  isCarcasseUnderMyResponsability,
} from '@app/utils/is-carcasse-done';
import {
  CarcasseType,
  Fei,
  UserRoles,
  CarcasseIntermediaire,
  Carcasse,
  FeiOwnerRole,
  User,
} from '@prisma/client';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import { checkCarcasseAgainstTransmission, getCarcasseTransmission } from './get-carcasses-transmission';
import { CarcasseTransmission, CarcasseTransmissionWihMetadata } from '@app/types/carcasse';
import { abbreviations } from './count-carcasses';
import { getTransmissionLabels } from './transmission-labels';
import { useMemo } from 'react';
import { buildTransmissionId, getTransmissionId } from './get-transmission-id';
import { useParams } from 'react-router';
import { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import { TransmissionSimpleStatus } from '@app/types/transmission-steps';
import { mapFeiFieldsToCarcasse } from './map-fei-fields-to-carcasse';

type TransmissionSorted = {
  transmissionsEnCours: Array<CarcasseTransmissionWihMetadata>;
  transmissionsACompleter: Array<CarcasseTransmissionWihMetadata>;
  transmissionsCloturees: Array<CarcasseTransmissionWihMetadata>;
};

export function useTransmissions(): Record<
  NonNullable<CarcasseTransmissionWihMetadata['fei']['numero']>,
  CarcasseTransmissionWihMetadata
> {
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const entities = useZustandStore((state) => state.entities);
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);

  return getTransmissionsShared({ carcasses, carcassesIntermediaireById, feis, user, entities });
}

type SharedTransmissionsInputs = {
  carcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse>;
  carcassesIntermediaireById: Record<string, CarcasseIntermediaire>;
  feis: Record<Fei['numero'], Fei>;
  user: User;
  entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>;
};

let sharedTransmissions: {
  inputs: SharedTransmissionsInputs;
  result: ReturnType<typeof computeTransmissions>;
} | null = null;

export function getTransmissionsShared(inputs: SharedTransmissionsInputs) {
  const previous = sharedTransmissions?.inputs;
  if (
    previous &&
    previous.carcasses === inputs.carcasses &&
    previous.carcassesIntermediaireById === inputs.carcassesIntermediaireById &&
    previous.feis === inputs.feis &&
    previous.user === inputs.user &&
    previous.entities === inputs.entities
  ) {
    return sharedTransmissions!.result;
  }
  const result = computeTransmissions({
    carcasses: inputs.carcasses,
    carcassesIntermediaireById: inputs.carcassesIntermediaireById,
    feis: inputs.feis,
    user: inputs.user,
    entitiesWorkingDirectlyFor: filterEntitiesWorkingDirectlyForObj(inputs.entities),
  });
  if (previous?.carcasses !== inputs.carcasses) {
    reportTransmissionsInconsistencies(previous?.carcasses, inputs.carcasses, result);
  }
  sharedTransmissions = { inputs, result };
  return result;
}

export function reportTransmissionsInconsistencies(
  previousCarcasses: SharedTransmissionsInputs['carcasses'] | undefined,
  carcasses: SharedTransmissionsInputs['carcasses'],
  transmissions: ReturnType<typeof computeTransmissions>
) {
  const changedTransmissionIds = new Set<string>();
  for (const carcasse of Object.values(carcasses)) {
    if (previousCarcasses?.[carcasse.zacharie_carcasse_id] === carcasse) continue;
    changedTransmissionIds.add(getTransmissionId(carcasse));
  }
  for (const transmissionId of changedTransmissionIds) {
    const transmission = transmissions[transmissionId];
    if (!transmission?.carcasses.length) continue;
    const transmissionKeys = Object.keys(transmission.content) as Array<keyof CarcasseTransmission>;
    const carcasseRef = transmission.carcasses[0];
    for (const carcasse of transmission.carcasses) {
      checkCarcasseAgainstTransmission(transmissionKeys, transmission.content, carcasse, carcasseRef);
    }
  }
}

function insertByCreatedAtDesc(list: Array<CarcassesIntermediaire>, item: CarcassesIntermediaire) {
  const t = new Date(item.created_at).getTime();
  let i = list.length;
  while (i > 0 && new Date(list[i - 1].created_at).getTime() < t) i--;
  list.splice(i, 0, item);
}

export function computeTransmissions({
  carcasses: allCarcasses,
  carcassesIntermediaireById,
  feis,
  user,
  entitiesWorkingDirectlyFor,
}: {
  carcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse>;
  carcassesIntermediaireById: Record<string, CarcasseIntermediaire>;
  feis: Record<Fei['numero'], Fei>;
  user: User;
  entitiesWorkingDirectlyFor: Record<EntityWithUserRelation['id'], EntityWithUserRelation>;
}): Record<NonNullable<CarcasseTransmissionWihMetadata['fei']['numero']>, CarcasseTransmissionWihMetadata> {
  const role = user.roles[0];
  const meIsSvi = user.roles.includes(UserRoles.SVI);
  const meIsChassseur = user.roles.includes(UserRoles.CHASSEUR);

  const transmissionIdsByFeiNumero: Record<Fei['numero'], Array<string>> = {};
  const feiDispatches: Record<Fei['numero'], number> = {};

  const transmissions: Record<string, CarcasseTransmissionWihMetadata> = {};

  const dernierAccepteParCarcasse = new Map<string, CarcasseIntermediaire>();
  const intermediairesByCarcasseId: Record<string, Array<CarcassesIntermediaire>> = {};
  for (const ci of Object.values(carcassesIntermediaireById)) {
    const list =
      intermediairesByCarcasseId[ci.zacharie_carcasse_id] ??
      (intermediairesByCarcasseId[ci.zacharie_carcasse_id] = []);
    insertByCreatedAtDesc(list, {
      id: ci.intermediaire_id,
      fei_numero: ci.fei_numero,
      intermediaire_user_id: ci.intermediaire_user_id,
      intermediaire_entity_id: ci.intermediaire_entity_id,
      intermediaire_role: ci.intermediaire_role,
      created_at: ci.created_at,
      prise_en_charge_at: ci.prise_en_charge_at,
      numero_bon_reception: ci.numero_bon_reception,
      intermediaire_depot_type: ci.intermediaire_depot_type,
      intermediaire_depot_entity_id: ci.intermediaire_depot_entity_id,
      intermediaire_prochain_detenteur_role_cache: ci.intermediaire_prochain_detenteur_role_cache,
      intermediaire_prochain_detenteur_id_cache: ci.intermediaire_prochain_detenteur_id_cache,
    });
    if (ci.deleted_at || !ci.prise_en_charge_at) continue;
    const prev = dernierAccepteParCarcasse.get(ci.zacharie_carcasse_id);
    if (!prev || new Date(ci.prise_en_charge_at) > new Date(prev.prise_en_charge_at!)) {
      dernierAccepteParCarcasse.set(ci.zacharie_carcasse_id, ci);
    }
  }

  const intermediaireByIdByTransmission: Record<string, Record<string, CarcassesIntermediaire>> = {};
  const mergeIntermediaires = (
    list: Array<CarcassesIntermediaire>,
    into: Record<string, CarcassesIntermediaire>,
    from: Array<CarcassesIntermediaire>
  ) => {
    for (const src of from) {
      const dst = into[src.id];
      if (!dst) {
        const added = { ...src };
        into[src.id] = added;
        insertByCreatedAtDesc(list, added);
        continue;
      }
      if (src.intermediaire_prochain_detenteur_id_cache != null) {
        dst.intermediaire_prochain_detenteur_id_cache = src.intermediaire_prochain_detenteur_id_cache;
        dst.intermediaire_prochain_detenteur_role_cache = src.intermediaire_prochain_detenteur_role_cache;
      }
      if (src.intermediaire_depot_type != null) {
        dst.intermediaire_depot_type = src.intermediaire_depot_type;
        dst.intermediaire_depot_entity_id = src.intermediaire_depot_entity_id;
      }
      if (src.numero_bon_reception != null) {
        dst.numero_bon_reception = src.numero_bon_reception;
      }
    }
  };

  for (const carcasse of Object.values(allCarcasses)) {
    if (carcasse.deleted_at) continue;
    const transmissionId = getTransmissionId(carcasse);
    if (transmissions[transmissionId]) {
      transmissions[transmissionId].carcasses.push(carcasse);
      mergeIntermediaires(
        transmissions[transmissionId].intermediaires,
        intermediaireByIdByTransmission[transmissionId],
        intermediairesByCarcasseId[carcasse.zacharie_carcasse_id] || []
      );
    } else {
      const transmission = getCarcasseTransmission(carcasse);
      const fei = feis[transmission.fei_numero!];
      if (!fei || fei.deleted_at) continue;
      if (!feiDispatches[transmission.fei_numero!]) feiDispatches[transmission.fei_numero!] = 0;
      feiDispatches[transmission.fei_numero!]++;
      if (!transmissionIdsByFeiNumero[fei.numero]) transmissionIdsByFeiNumero[fei.numero] = [];
      transmissionIdsByFeiNumero[fei.numero].push(transmissionId);
      const intermediaires = (intermediairesByCarcasseId[carcasse.zacharie_carcasse_id] || []).map((i) => ({
        ...i,
      }));
      const intermediaireById: Record<string, CarcassesIntermediaire> = {};
      for (const i of intermediaires) intermediaireById[i.id] = i;
      intermediaireByIdByTransmission[transmissionId] = intermediaireById;
      const transmissionWithIntermediaires: CarcasseTransmissionWihMetadata = {
        content: transmission,
        labels: getTransmissionLabels(
          'Clôturée',
          transmission,
          role,
          entitiesWorkingDirectlyFor,
          user.etg_role
        ),
        fei: {
          numero: fei.numero,
          commune_mise_a_mort: fei.commune_mise_a_mort,
          date_mise_a_mort: fei.date_mise_a_mort,
          numberOfPremierDetenteurProchainDetenteur: feiDispatches[transmission.fei_numero!],
        },
        carcasses: [carcasse],
        intermediaires,
        partialRefusals: [],
        allCarcassesDone: true,
      };
      transmissions[transmissionId] = transmissionWithIntermediaires;
    }
    const partialRefusal = getCarcassePartialRefusal(carcasse, dernierAccepteParCarcasse);
    if (partialRefusal) transmissions[transmissionId].partialRefusals.push(partialRefusal);
    const carcasseDone = isCarcasseDone(carcasse);
    if (!carcasseDone) transmissions[transmissionId].allCarcassesDone = false;
    if (transmissions[transmissionId].labels.simpleStatus !== 'Clôturée') continue;
    if (carcasseDone) continue;

    const isUnderMyResponsability = isCarcasseUnderMyResponsability(
      carcasse,
      user,
      entitiesWorkingDirectlyFor
    );

    if (isUnderMyResponsability) {
      transmissions[transmissionId].labels = getTransmissionLabels(
        'À compléter',
        transmissions[transmissionId].content,
        role,
        entitiesWorkingDirectlyFor,
        user.etg_role
      );
      continue;
    }

    if (!meIsSvi) {
      const isToTake = isCarcasseToTake(carcasse, user, entitiesWorkingDirectlyFor);
      if (isToTake) {
        transmissions[transmissionId].labels = getTransmissionLabels(
          'À compléter',
          transmissions[transmissionId].content,
          role,
          entitiesWorkingDirectlyFor,
          user.etg_role
        );
        continue;
      }
    }

    if (!carcasse.svi_assigned_at && !carcasse.intermediaire_closed_at) {
      if (carcasse.examinateur_initial_user_id === user.id) {
        transmissions[transmissionId].labels = getTransmissionLabels(
          'En cours',
          transmissions[transmissionId].content,
          role,
          entitiesWorkingDirectlyFor,
          user.etg_role
        );
        continue;
      }
      if (carcasse.premier_detenteur_user_id === user.id) {
        transmissions[transmissionId].labels = getTransmissionLabels(
          'En cours',
          transmissions[transmissionId].content,
          role,
          entitiesWorkingDirectlyFor,
          user.etg_role
        );
        continue;
      }
      if (carcasse.premier_detenteur_entity_id) {
        if (entitiesWorkingDirectlyFor[carcasse.premier_detenteur_entity_id]) {
          transmissions[transmissionId].labels = getTransmissionLabels(
            'En cours',
            transmissions[transmissionId].content,
            role,
            entitiesWorkingDirectlyFor,
            user.etg_role
          );
          continue;
        }
      }
      const hasSousTraite =
        carcasse.next_owner_sous_traite_by_entity_id &&
        entitiesWorkingDirectlyFor[carcasse.next_owner_sous_traite_by_entity_id];
      if (hasSousTraite) {
        transmissions[transmissionId].labels = getTransmissionLabels(
          'En cours',
          transmissions[transmissionId].content,
          role,
          entitiesWorkingDirectlyFor,
          user.etg_role
        );
        continue;
      }
      let isIntermediaire = false;
      for (const intermediaire of transmissions[transmissionId].intermediaires) {
        if (intermediaire.intermediaire_user_id === user.id) {
          transmissions[transmissionId].labels = getTransmissionLabels(
            'En cours',
            transmissions[transmissionId].content,
            role,
            entitiesWorkingDirectlyFor,
            user.etg_role
          );
          isIntermediaire = true;
          break;
        }
        if (intermediaire.intermediaire_entity_id) {
          if (entitiesWorkingDirectlyFor[intermediaire.intermediaire_entity_id]) {
            transmissions[transmissionId].labels = getTransmissionLabels(
              'En cours',
              transmissions[transmissionId].content,
              role,
              entitiesWorkingDirectlyFor,
              user.etg_role
            );
            isIntermediaire = true;
            break;
          }
        }
      }
      if (isIntermediaire) {
        continue;
      }
    }
    if (carcasse.svi_assigned_at) {
      if (meIsSvi) {
        if (!carcasse.svi_closed_at && !carcasse.svi_automatic_closed_at) {
          transmissions[transmissionId].labels = getTransmissionLabels(
            'À compléter',
            transmissions[transmissionId].content,
            role,
            entitiesWorkingDirectlyFor,
            user.etg_role
          );
        }
        continue;
      }
      transmissions[transmissionId].labels = getTransmissionLabels(
        'En cours',
        transmissions[transmissionId].content,
        role,
        entitiesWorkingDirectlyFor,
        user.etg_role
      );
      continue;
    }
  }
  if (meIsChassseur) {
    for (const fei of Object.values(feis)) {
      if (fei.deleted_at) continue;
      if (transmissionIdsByFeiNumero[fei.numero]) continue;
      const tempTransmissionId = buildTransmissionId(fei.numero);
      /* v8 ignore next */
      if (transmissions[tempTransmissionId]) continue;
      const transmission: CarcasseTransmissionWihMetadata = {
        content: {
          ...mapFeiFieldsToCarcasse(fei),
          current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
          current_owner_user_id: user.id,
        },
        labels: getTransmissionLabels('À compléter', fei, role, entitiesWorkingDirectlyFor, user.etg_role),
        fei: {
          numero: fei.numero,
          commune_mise_a_mort: fei.commune_mise_a_mort,
          date_mise_a_mort: fei.date_mise_a_mort,
          numberOfPremierDetenteurProchainDetenteur: 1,
        },
        carcasses: [],
        intermediaires: [],
        partialRefusals: [],
        allCarcassesDone: false,
      };
      transmissions[tempTransmissionId] = transmission;
    }
  }
  for (const [feiNumero, numberOfPremierDetenteurProchainDetenteur] of Object.entries(feiDispatches)) {
    for (const transmissionId of transmissionIdsByFeiNumero[feiNumero]) {
      transmissions[transmissionId].fei.numberOfPremierDetenteurProchainDetenteur =
        numberOfPremierDetenteurProchainDetenteur;
    }
  }
  return transmissions;
}

function getCarcassePartialRefusal(
  carcasse: {
    type: string | null;
    espece: string | null;
    nombre_d_animaux: number | null;
    zacharie_carcasse_id: string;
  },
  dernierAccepteParCarcasse: Map<string, CarcasseIntermediaire>
): string | null {
  if (carcasse.type !== CarcasseType.PETIT_GIBIER) return null;
  const abbreviation = abbreviations[carcasse.espece as keyof typeof abbreviations];
  if (!abbreviation) return null;
  const dernierAccepte = dernierAccepteParCarcasse.get(carcasse.zacharie_carcasse_id);
  if (dernierAccepte?.nombre_d_animaux_acceptes == null) return null;
  const total = carcasse.nombre_d_animaux ?? 0;
  const acceptes = dernierAccepte.nombre_d_animaux_acceptes;
  if (acceptes < total) return `${total - acceptes} ${abbreviation}`;
  return null;
}

export function useTransmissionsSorted(): TransmissionSorted {
  const transmissions = useTransmissions();
  const user = useUser((state) => state.user)!;

  const transmissionsSorted: TransmissionSorted = {
    transmissionsEnCours: [],
    transmissionsACompleter: [],
    transmissionsCloturees: [],
  };

  if (!user) return transmissionsSorted;

  for (const transmission of Object.values(transmissions)) {
    if (transmission.labels.simpleStatus === 'À compléter') {
      transmissionsSorted.transmissionsACompleter.push(transmission);
    }
    if (transmission.labels.simpleStatus === 'En cours') {
      transmissionsSorted.transmissionsEnCours.push(transmission);
    }
    if (transmission.labels.simpleStatus === 'Clôturée') {
      transmissionsSorted.transmissionsCloturees.push(transmission);
    }
  }
  return {
    transmissionsACompleter: [...transmissionsSorted.transmissionsACompleter].sort((a, b) =>
      b.content.updated_at! < a.content.updated_at! ? -1 : 1
    ),
    transmissionsEnCours: [...transmissionsSorted.transmissionsEnCours].sort(sortTransmissions),
    transmissionsCloturees: [...transmissionsSorted.transmissionsCloturees].sort(sortTransmissions),
  };
}

export function sortTransmissions(a: CarcasseTransmissionWihMetadata, b: CarcasseTransmissionWihMetadata) {
  const aDate = a.content.examinateur_initial_date_approbation_mise_sur_le_marche || a.content.created_at!;
  const bDate = b.content.examinateur_initial_date_approbation_mise_sur_le_marche || b.content.created_at!;
  return bDate < aDate ? -1 : 1;
}

export function useGetTransmissionFromURLParams() {
  const params = useParams();
  const fei_numero = params.fei_numero!;
  const premier_detenteur_prochain_detenteur_id_cache = params.premier_detenteur_prochain_detenteur_id_cache;
  const transmissionId = buildTransmissionId(fei_numero, premier_detenteur_prochain_detenteur_id_cache);
  const transmission = useGetTransmissionFromTransmissionId(transmissionId);
  return transmission;
}

export function useGetTransmissionFromCarcasse(carcasse: Carcasse) {
  const fei_numero = carcasse.fei_numero!;
  const premier_detenteur_prochain_detenteur_id_cache =
    carcasse.premier_detenteur_prochain_detenteur_id_cache!;
  const transmissionId = buildTransmissionId(fei_numero, premier_detenteur_prochain_detenteur_id_cache);
  const transmission = useGetTransmissionFromTransmissionId(transmissionId);
  return transmission;
}

export function useGetTransmissionFromTransmissionId(transmissionId: string) {
  const transmissions = useTransmissions();
  return transmissions[transmissionId];
}

export function useGetTransmissionsForFei(fei_numero: string) {
  const transmissions = useTransmissions();
  const currentTransmissions = useMemo(() => {
    const _currentTransmissions = [];
    for (const transmissionId of Object.keys(transmissions)) {
      if (transmissionId.startsWith(fei_numero)) _currentTransmissions.push(transmissions[transmissionId]);
    }
    return _currentTransmissions;
  }, [transmissions, fei_numero]);
  return currentTransmissions;
}

export function useGetChasseurStatusAndLabel(fei_numero: string): [TransmissionSimpleStatus, string] {
  const transmissions = useGetTransmissionsForFei(fei_numero);
  const [simpleStatus, currentStepLabelForChasseur] = useMemo(
    () => getWorseLabelsOfTransmissions(transmissions),
    [transmissions]
  );
  return [simpleStatus, currentStepLabelForChasseur];
}

export function getWorseLabelsOfTransmissions(
  transmissions: Array<CarcasseTransmissionWihMetadata>
): [TransmissionSimpleStatus, string] {
  let _simpleStatus: TransmissionSimpleStatus = 'Clôturée';
  let _currentStepLabelForChasseur = '';
  for (const transmission of transmissions) {
    if (transmission.labels.simpleStatus === 'À compléter') {
      _simpleStatus = transmission.labels.simpleStatus;
      _currentStepLabelForChasseur = transmission.labels.currentStepLabel;
      break;
    }
    if (transmission.labels.simpleStatus === 'En cours') {
      _simpleStatus = transmission.labels.simpleStatus;
      _currentStepLabelForChasseur = transmission.labels.currentStepLabel;
      continue;
    }
    if (_simpleStatus === 'En cours') continue;
    _simpleStatus = transmission.labels.simpleStatus;
    _currentStepLabelForChasseur = transmission.labels.currentStepLabel;
  }
  return [_simpleStatus, _currentStepLabelForChasseur];
}
