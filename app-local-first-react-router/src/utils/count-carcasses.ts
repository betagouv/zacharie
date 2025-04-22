import { CarcasseStatus, CarcasseType, type Carcasse } from '@prisma/client';
import { getSimplifiedCarcasseStatus } from './get-carcasse-status';

export function formatSummaryCount(carcasses: Array<Carcasse>) {
  let summary = '';
  let carcassesRefusées = 0;
  let carcassesAcceptées = 0;
  let carcassesEnCours = 0;
  for (const carcasse of carcasses) {
    const simplifiedStatus = getSimplifiedCarcasseStatus(carcasse);
    if (simplifiedStatus === 'refusé') {
      carcassesRefusées++;
    } else if (simplifiedStatus === 'accepté') {
      carcassesAcceptées++;
    } else {
      carcassesEnCours++;
    }
  }
  if (carcassesRefusées > 0) {
    summary += `${carcassesRefusées} carcasses/lots refusés. `;
  }
  if (carcassesAcceptées > 0) {
    summary += `${carcassesAcceptées} carcasses/lots acceptés. `;
  }
  if (carcassesEnCours > 0) {
    if (carcassesRefusées > 0 || carcassesAcceptées > 0) {
      summary += `${carcassesEnCours} carcasses/lots en cours.`;
    } else {
      summary += carcassesEnCours;
    }
  }
  return summary;
}

type CountCarcassesByEspece = Record<string, { carcasses: number; nombre_d_animaux: number; lots: number }>;

export function getCountCarcassesByEspece(carcasses: Array<Carcasse>): CountCarcassesByEspece {
  return carcasses.reduce(
    (acc, carcasse) => {
      if (carcasse.deleted_at) {
        return acc;
      }
      if (
        (
          [
            CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
            CarcasseStatus.REFUS_ETG_COLLECTEUR,
            CarcasseStatus.MANQUANTE_SVI,
            CarcasseStatus.SAISIE_TOTALE,
            CarcasseStatus.SAISIE_PARTIELLE,
          ] as Array<CarcasseStatus>
        ).includes(carcasse.svi_carcasse_status!)
      ) {
        if (carcasse.type === CarcasseType.PETIT_GIBIER) {
          acc.refus_lots.lots++;
          acc.refus_lots.nombre_d_animaux +=
            carcasse.svi_ipm2_nombre_animaux || carcasse.nombre_d_animaux || 0;
        } else {
          acc.refus_carcasses.carcasses++;
        }
        return acc;
      }
      acc[carcasse.espece!] = {
        carcasses:
          carcasse.type === CarcasseType.PETIT_GIBIER ? 0 : (acc[carcasse.espece!]?.carcasses || 0) + 1,
        nombre_d_animaux: (acc[carcasse.espece!]?.nombre_d_animaux || 1) + (carcasse?.nombre_d_animaux || 1),
        lots: carcasse.type === CarcasseType.PETIT_GIBIER ? (acc[carcasse.espece!]?.lots || 0) + 1 : 0,
      };
      return acc;
    },
    {
      refus_lots: {
        carcasses: 0,
        lots: 0,
        nombre_d_animaux: 0,
      },
      refus_carcasses: {
        carcasses: 0,
        lots: 0,
        nombre_d_animaux: 0,
      },
    } as CountCarcassesByEspece,
  );
}

export function formatCountCarcasseByEspece(carcasses: Array<Carcasse>) {
  const countCarcassesByEspece = getCountCarcassesByEspece(carcasses);

  if (!Object.keys(countCarcassesByEspece).length) {
    return ['Pas de carcasse acceptée'];
  }

  const formatted = Object.entries(countCarcassesByEspece)
    .sort(([especeA], [especeB]) => {
      if (especeA.includes('refus')) {
        return 1;
      }
      if (especeB.includes('refus')) {
        return -1;
      }
      return 0;
    })
    .map(([espece, { carcasses, nombre_d_animaux, lots }]) => {
      if (espece === 'refus_carcasses') {
        if (carcasses === 0) return null;
        const withS = carcasses <= 1 ? '' : 's';
        return `${carcasses}\u00A0carcasse${withS} refusée${withS}`;
      }
      if (espece === 'refus_lots') {
        if (lots === 0) return null;
        const withS = lots <= 1 ? '' : 's';
        return `${lots}\u00A0lot${withS} refusé${withS} (${nombre_d_animaux} carcasses)`;
      }
      if (lots) {
        return `${nombre_d_animaux} ${espece}`;
      }
      return `${nombre_d_animaux} ${espece}${nombre_d_animaux === 1 ? '' : 's'}`;
    })
    .filter(Boolean);
  return formatted;
}
