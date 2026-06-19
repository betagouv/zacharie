import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { useEntitiesIdsWorkingDirectlyForObj } from '@app/utils/get-entity-relations';
import {
  isCarcasseDone,
  isCarcasseToTake,
  isCarcasseUnderMyResponsability,
} from '@app/utils/is-carcasse-done';
import { CarcasseType, Fei, UserRoles, type CarcasseIntermediaire } from '@prisma/client';
import { checkCarcasseAgainstTransmission, getCarcasseTransmission } from './get-carcasses-transmission';
import { CarcasseTransmission, CarcasseTransmissionWihMetadata } from '@app/types/carcasse';
import { filterFeiIntermediaires } from './get-carcasses-intermediaires';
import { abbreviations } from './count-carcasses';
import { getTransmissionLabels } from './transmission-labels';
import { useEffect, useMemo, useState } from 'react';
import { buildTransmissionId, getTransmissionId } from './get-transmission-id';
import { useParams } from 'react-router';

type TransmissionSorted = {
  transmissionsEnCours: Array<CarcasseTransmissionWihMetadata>;
  transmissionsACompleter: Array<CarcasseTransmissionWihMetadata>;
  transmissionsCloturees: Array<CarcasseTransmissionWihMetadata>;
};

export function useTransmissions(): Record<
  NonNullable<CarcasseTransmissionWihMetadata['fei']['numero']>,
  CarcasseTransmissionWihMetadata
> {
  const allCarcasses = useZustandStore((state) => state.carcasses);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const entitiesWorkingDirectlyFor = useEntitiesIdsWorkingDirectlyForObj();
  const user = useUser((state) => state.user)!;
  const role = user.roles[0]; // only one role anyway
  const meIsSvi = user.roles.includes(UserRoles.SVI);
  const meIsChassseur = user.roles.includes(UserRoles.CHASSEUR);
  const feis = useZustandStore((state) => state.feis);

  return useMemo(() => {
    const transmissionIdsByFeiNumero: Record<Fei['numero'], Array<string>> = {};
    const feiDispatches: Record<Fei['numero'], number> = {};
    if (!user) {
      return {};
    }

    const transmissions: Record<string, CarcasseTransmissionWihMetadata> = {};

    // Dernière prise en charge de chaque carcasse, en une seule passe sur tous les intermédiaires.
    // Sert à calculer les refus partiels (lots de petit gibier dont une partie a été refusée).
    const dernierAccepteParCarcasse = new Map<string, CarcasseIntermediaire>();
    for (const ci of Object.values(carcassesIntermediaireById)) {
      if (ci.deleted_at || !ci.prise_en_charge_at) continue;
      const prev = dernierAccepteParCarcasse.get(ci.zacharie_carcasse_id);
      if (!prev || new Date(ci.prise_en_charge_at) > new Date(prev.prise_en_charge_at!)) {
        dernierAccepteParCarcasse.set(ci.zacharie_carcasse_id, ci);
      }
    }

    // Objectif : UN SEUL LOOP sur toutes les carcasses
    // pourquoi on regarde les "transmissions" et pas les "feis" ?
    // parce que le dispatch fait que des carcasses d'un même examen initial n'ont pas les mêmes vies par la suite
    // Défi du tri : chaque carcasse porte ses informations exhaustives + un array de CarcasseIntermédiaire
    // mais les carcasses ne possèdent pas les infos des autres carcasses, notamment pour savoir si toutes les autres ont été "clôturées" d'une manière ou d'une autre (svi, automatic, manuel, etc.)
    // donc sans multiplier les loop, pour des raisons de perf, comment faire pour vérifier les autres carcasses
    // EN NE MAINTENANT QU'UNE SEULE LECTURE
    // Solution: on va dire que, par défaut, un groupement de carcasse est `done`

    for (const carcasse of Object.values(allCarcasses)) {
      if (carcasse.deleted_at) continue;
      const transmissionId = getTransmissionId(carcasse);
      if (transmissions[transmissionId]) {
        transmissions[transmissionId].carcasses.push(carcasse);
      } else {
        const transmission = getCarcasseTransmission(carcasse);
        const fei = feis[transmission.fei_numero!];
        if (!feiDispatches[transmission.fei_numero!]) feiDispatches[transmission.fei_numero!] = 0;
        feiDispatches[transmission.fei_numero!]++;
        if (!transmissionIdsByFeiNumero[fei.numero]) transmissionIdsByFeiNumero[fei.numero] = [];
        transmissionIdsByFeiNumero[fei.numero].push(transmissionId);
        // ordre chronologique décroissant, du plus récent au plus ancien
        const intermediaires = filterFeiIntermediaires(carcassesIntermediaireById, fei.numero!);
        const transmissionWithIntermediaires: CarcasseTransmissionWihMetadata = {
          content: transmission,
          labels: getTransmissionLabels('Clôturée', transmission, role, entitiesWorkingDirectlyFor),
          fei: {
            numero: fei.numero,
            commune_mise_a_mort: fei.commune_mise_a_mort,
            date_mise_a_mort: fei.date_mise_a_mort,
            numberOfPremierDetenteurProchainDetenteur: feiDispatches[transmission.fei_numero!],
          },
          carcasses: [carcasse],
          intermediaires,
          partialRefusals: [],
        };
        transmissions[transmissionId] = transmissionWithIntermediaires;
      }
      const partialRefusal = getCarcassePartialRefusal(carcasse, dernierAccepteParCarcasse);
      if (partialRefusal) transmissions[transmissionId].partialRefusals.push(partialRefusal);
      // une fois la transmission marquée non-clôturée, inutile de réévaluer son statut
      if (transmissions[transmissionId].labels.simpleStatus !== 'Clôturée') continue;
      if (
        transmissions[transmissionId].content.consommateur_final_usage_domestique &&
        transmissions[transmissionId].content.premier_detenteur_user_id
      ) {
        continue;
      }

      // rejected, svi accepted
      if (isCarcasseDone(carcasse)) continue;

      // FEI UNDER MY RESPONSABILITY
      // At least one carcasse where current_owner is me/my entity AND no next_owner
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
          entitiesWorkingDirectlyFor
        );
        continue;
      }

      // FEI TO TAKE
      if (!meIsSvi) {
        // At least one carcasse where next_owner is me/my entity
        const isToTake = isCarcasseToTake(carcasse, user, entitiesWorkingDirectlyFor);
        if (isToTake) {
          transmissions[transmissionId].labels = getTransmissionLabels(
            'À compléter',
            transmissions[transmissionId].content,
            role,
            entitiesWorkingDirectlyFor
          );
          continue;
        }
      }

      // FEI ONGOING
      if (!carcasse.svi_assigned_at && !carcasse.intermediaire_closed_at) {
        if (carcasse.examinateur_initial_user_id === user.id) {
          transmissions[transmissionId].labels = getTransmissionLabels(
            'En cours',
            transmissions[transmissionId].content,
            role,
            entitiesWorkingDirectlyFor
          );
          continue;
        }
        if (carcasse.premier_detenteur_user_id === user.id) {
          transmissions[transmissionId].labels = getTransmissionLabels(
            'En cours',
            transmissions[transmissionId].content,
            role,
            entitiesWorkingDirectlyFor
          );
          continue;
        }
        if (carcasse.premier_detenteur_entity_id) {
          if (entitiesWorkingDirectlyFor[carcasse.premier_detenteur_entity_id]) {
            transmissions[transmissionId].labels = getTransmissionLabels(
              'En cours',
              transmissions[transmissionId].content,
              role,
              entitiesWorkingDirectlyFor
            );
            continue;
          }
        }
        // Check sous-traite at carcasse level
        const hasSousTraite =
          carcasse.next_owner_sous_traite_by_entity_id &&
          entitiesWorkingDirectlyFor[carcasse.next_owner_sous_traite_by_entity_id];
        if (hasSousTraite) {
          transmissions[transmissionId].labels = getTransmissionLabels(
            'En cours',
            transmissions[transmissionId].content,
            role,
            entitiesWorkingDirectlyFor
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
              entitiesWorkingDirectlyFor
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
                entitiesWorkingDirectlyFor
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
              entitiesWorkingDirectlyFor
            );
          }
          continue;
        }
        transmissions[transmissionId].labels = getTransmissionLabels(
          'En cours',
          transmissions[transmissionId].content,
          role,
          entitiesWorkingDirectlyFor
        );
        continue;
      }
    }
    if (meIsChassseur) {
      for (const fei of Object.values(feis)) {
        // la fei vient juste d'être créée, il n'y a pas encore de transmission
        // ni de prochain détenteur
        // on simule la transmissionId par fei.numero : aucun risque de conflit encore
        if (transmissionIdsByFeiNumero[fei.numero]) continue;
        const tempTransmissionId = buildTransmissionId(fei.numero);
        if (transmissions[tempTransmissionId]) continue;
        const transmission: CarcasseTransmissionWihMetadata = {
          content: { ...fei }, // fields like examinateur_initial, etc. that will also exists in carcasses (when they will be created)
          labels: getTransmissionLabels('À compléter', fei, role, entitiesWorkingDirectlyFor),
          fei: {
            numero: fei.numero,
            commune_mise_a_mort: fei.commune_mise_a_mort,
            date_mise_a_mort: fei.date_mise_a_mort,
            numberOfPremierDetenteurProchainDetenteur: 1,
          },
          carcasses: [],
          intermediaires: [],
          partialRefusals: [],
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
  }, [
    allCarcasses,
    carcassesIntermediaireById,
    entitiesWorkingDirectlyFor,
    feis,
    meIsChassseur,
    meIsSvi,
    role,
    user,
  ]);
}

// Refus partiel d'un lot de petit gibier : nombre d'animaux refusés par le dernier détenteur (ex: "3 perdrix")
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

function sortTransmissions(a: CarcasseTransmissionWihMetadata, b: CarcasseTransmissionWihMetadata) {
  const aDate = a.content.examinateur_initial_date_approbation_mise_sur_le_marche || a.content.created_at!;
  const bDate = b.content.examinateur_initial_date_approbation_mise_sur_le_marche || b.content.created_at!;
  return bDate < aDate ? -1 : 1;
}

export function useGetTransmissionFromURLParams() {
  const params = useParams();
  const fei_numero = params.fei_numero!;
  const premier_detenteur_prochain_detenteur_id_cache = params.premier_detenteur_prochain_detenteur_id_cache;
  const transmissionId = buildTransmissionId(fei_numero, premier_detenteur_prochain_detenteur_id_cache);
  const transmissions = useTransmissions();
  const [transmission, setTransmission] = useState<CarcasseTransmissionWihMetadata>(
    transmissions[transmissionId]
  );

  useEffect(() => {
    const transmission = transmissions[transmissionId].content;
    const transmissionKeys = Object.keys(transmission) as Array<keyof CarcasseTransmission>;
    let allCarcassesDone = true;
    const carcasseRef = transmissions[transmissionId].carcasses[0]!;
    for (const carcasse of transmissions[transmissionId].carcasses) {
      checkCarcasseAgainstTransmission(transmissionKeys, transmission, carcasse, carcasseRef);
      if (!isCarcasseDone(carcasse)) allCarcassesDone = false;
    }
    setTransmission({ ...transmissions[transmissionId], allCarcassesDone });
  }, [transmissions, transmissionId]);

  return transmission;
}
