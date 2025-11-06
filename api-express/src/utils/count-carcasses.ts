import { CarcasseStatus, CarcasseType, type Carcasse } from '@prisma/client';

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
      }
      acc[carcasse.espece!] = {
        carcasses:
          carcasse.type === CarcasseType.PETIT_GIBIER ? 0 : (acc[carcasse.espece!]?.carcasses || 0) + 1,
        nombre_d_animaux: (acc[carcasse.espece!]?.nombre_d_animaux || 0) + (carcasse?.nombre_d_animaux || 1),
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
    .sort(([especeA, countA], [especeB, countB]) => {
      // Put refus entries at the end
      if (especeA.includes('refus') && !especeB.includes('refus')) {
        return 1;
      }
      if (!especeA.includes('refus') && especeB.includes('refus')) {
        return -1;
      }
      // For non-refus entries, sort by nombre_d_animaux in descending order
      if (!especeA.includes('refus') && !especeB.includes('refus')) {
        return countB.nombre_d_animaux - countA.nombre_d_animaux;
      }
      // Keep the original order for refus entries relative to each other
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
      return `${nombre_d_animaux} ${abbreviations[espece]
        .split(' ')
        .map((e) => addAnSToWord(e, nombre_d_animaux))
        .join(' ')}`;
    })
    .filter(Boolean);
  return formatted;
}

export function addAnSToWord(word: string, count: number) {
  if (count === 1 || word.endsWith('s') || word.endsWith('x') || word.endsWith('z') || word.endsWith('.')) {
    return word;
  }
  return `${word}s`;
}

export const abbreviations: Record<NonNullable<Carcasse['espece']>, string> = {
  'Cerf élaphe': 'cerf ela.',
  'Cerf sika': 'cerf sika',
  Chevreuil: 'chevreuil',
  Daim: 'daim',
  Sanglier: 'sanglier',
  Chamois: 'chamois',
  Isard: 'isard',
  'Mouflon méditerranéen': 'mouflon',
  Cailles: 'cailles',
  Canards: 'canard',
  Oies: 'oie',
  'Faisans de chasse': 'faisan',
  Perdrix: 'perdrix',
  Pigeons: 'pigeon',
  'Autres oiseaux': 'aut. ois.',
  Lapins: 'lapin',
  Lièvres: 'lièvre',
  'Autres petits gibiers à poils': 'pt. gib.',
};
