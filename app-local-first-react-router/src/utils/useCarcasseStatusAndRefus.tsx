import { Carcasse, CarcasseStatus, CarcasseType, Fei, FeiOwnerRole } from '@prisma/client';
import { useMemo } from 'react';
import useZustandStore from '@app/zustand/store';
import { getVulgarisationSaisie } from '@app/utils/get-vulgarisation-saisie';
import { getSimplifiedCarcasseStatus } from '@app/utils/get-carcasse-status';
import { getFeiAndCarcasseAndIntermediaireIdsFromCarcasse } from './get-carcasse-intermediaire-id';

export function useCarcasseStatusAndRefus(carcasse: Carcasse, fei: Fei) {
  const entities = useZustandStore((state) => state.entities);
  const carcassesIntermediaires = useZustandStore((state) => state.carcassesIntermediaireById);

  const status: 'en cours de création' | 'en cours de traitement' | 'refusé' | 'accepté' = useMemo(() => {
    if (
      fei.fei_current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL ||
      fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR
    ) {
      if (!fei.fei_next_owner_role) {
        return 'en cours de création';
      }
    }
    return getSimplifiedCarcasseStatus(carcasse);
  }, [carcasse, fei.fei_current_owner_role, fei.fei_next_owner_role]);

  const motifRefus: string = useMemo(() => {
    switch (carcasse.svi_carcasse_status) {
      default:
        return '';
      case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR: {
        const id = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
          carcasse,
          carcasse.intermediaire_carcasse_refus_intermediaire_id!,
        );
        const carcasseIntermediaire = carcassesIntermediaires[id];
        const entity = entities[carcasseIntermediaire.intermediaire_entity_id!];
        const manquant = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Manquant' : 'Manquante';
        return `${manquant} au moment de la collecte par ${entity?.nom_d_usage}`;
      }
      case CarcasseStatus.MANQUANTE_SVI:
        return "Manquant(e) au moment de l'inspection par le service vétérinaire";
      case CarcasseStatus.REFUS_ETG_COLLECTEUR: {
        const id = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
          carcasse,
          carcasse.intermediaire_carcasse_refus_intermediaire_id!,
        );
        const carcasseIntermediaire = carcassesIntermediaires[id];
        const entity = entities[carcasseIntermediaire.intermediaire_entity_id!];
        const refusé = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Refusé' : 'Refusée';
        let refus = `${refusé} par ${entity.nom_d_usage}`;
        if (carcasse.intermediaire_carcasse_refus_motif) {
          refus += `\u00A0: ${carcasse.intermediaire_carcasse_refus_motif}`;
        }
        return refus;
      }
      case CarcasseStatus.SAISIE_TOTALE:
      case CarcasseStatus.SAISIE_PARTIELLE: {
        const refusé = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Refusé' : 'Refusée';
        return `${refusé} par le service vétérinaire\u00A0: ${carcasse.svi_ipm2_lesions_ou_motifs
          .map((motif) => getVulgarisationSaisie(motif, carcasse.type!))
          .join(', ')}`;
      }
    }
  }, [carcasse, carcassesIntermediaires, entities]);

  const statusNewCard: string = useMemo(() => {
    if (status !== 'refusé') {
      return status;
    }
    switch (carcasse.svi_carcasse_status) {
      default:
        return '';
      case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR: {
        const id = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
          carcasse,
          carcasse.intermediaire_carcasse_refus_intermediaire_id!,
        );
        const carcasseIntermediaire = carcassesIntermediaires[id];
        const entity = entities[carcasseIntermediaire.intermediaire_entity_id!];
        return `manquant pour ${entity?.nom_d_usage}`;
      }
      case CarcasseStatus.MANQUANTE_SVI:
        return 'manquant pour le service vétérinaire';
      case CarcasseStatus.REFUS_ETG_COLLECTEUR: {
        const id = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
          carcasse,
          carcasse.intermediaire_carcasse_refus_intermediaire_id!,
        );
        const carcasseIntermediaire = carcassesIntermediaires[id];
        const entity = entities[carcasseIntermediaire.intermediaire_entity_id!];
        return `refusé par ${entity.nom_d_usage}`;
      }
      case CarcasseStatus.SAISIE_TOTALE:
      case CarcasseStatus.SAISIE_PARTIELLE: {
        return 'refusé par le service vétérinaire';
      }
    }
  }, [status, carcasse, carcassesIntermediaires, entities]);

  return { status, motifRefus, statusNewCard };
}
