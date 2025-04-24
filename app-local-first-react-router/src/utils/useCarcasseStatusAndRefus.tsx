import { Carcasse, CarcasseStatus, CarcasseType, Fei, UserRoles } from '@prisma/client';
import { useMemo } from 'react';
import useZustandStore from '@app/zustand/store';
import { getVulgarisationSaisie } from '@app/utils/get-vulgarisation-saisie';
import { getSimplifiedCarcasseStatus } from '@app/utils/get-carcasse-status';

export function useCarcasseStatusAndRefus(carcasse: Carcasse, fei: Fei) {
  const entities = useZustandStore((state) => state.entities);
  const feisIntermediaires = useZustandStore((state) => state.feisIntermediaires);

  const status: 'en cours' | 'refusé' | 'accepté' | null = useMemo(() => {
    if (
      fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL ||
      fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR
    ) {
      if (!fei.fei_next_owner_role) {
        return null;
      }
    }
    return getSimplifiedCarcasseStatus(carcasse);
  }, [carcasse, fei.fei_current_owner_role, fei.fei_next_owner_role]);

  const motifRefus: string = useMemo(() => {
    switch (carcasse.svi_carcasse_status) {
      default:
        return '';
      case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR: {
        const carcasseIntermediaire =
          feisIntermediaires[carcasse.intermediaire_carcasse_refus_intermediaire_id!];
        const entity = entities[carcasseIntermediaire.fei_intermediaire_entity_id!];
        const manquant = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Manquant' : 'Manquante';
        return `${manquant} au moment de la collecte par ${entity?.nom_d_usage}`;
      }
      case CarcasseStatus.MANQUANTE_SVI:
        return "Manquant(e) au moment de l'inspection par le service vétérinaire";
      case CarcasseStatus.REFUS_ETG_COLLECTEUR: {
        const carcasseIntermediaire =
          feisIntermediaires[carcasse.intermediaire_carcasse_refus_intermediaire_id!];
        const entity = entities[carcasseIntermediaire.fei_intermediaire_entity_id!];
        const refusé = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Refusé' : 'Refusée';
        let refus = `${refusé} par ${entity.nom_d_usage}`;
        if (carcasse.intermediaire_carcasse_refus_motif) {
          refus += ` : ${carcasse.intermediaire_carcasse_refus_motif}`;
        }
        return refus;
      }
      case CarcasseStatus.SAISIE_TOTALE:
      case CarcasseStatus.SAISIE_PARTIELLE: {
        const refusé = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Refusé' : 'Refusée';
        return `${refusé} par le service vétérinaire : ${carcasse.svi_ipm2_lesions_ou_motifs
          .map((motif) => getVulgarisationSaisie(motif, carcasse.type!))
          .join(', ')}`;
      }
    }
  }, [
    carcasse.svi_carcasse_status,
    carcasse.svi_ipm2_lesions_ou_motifs,
    carcasse.type,
    carcasse.intermediaire_carcasse_refus_motif,
    carcasse.intermediaire_carcasse_refus_intermediaire_id,
    entities,
    feisIntermediaires,
  ]);

  return { status, motifRefus };
}
