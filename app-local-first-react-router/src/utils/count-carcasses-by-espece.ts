import { type Carcasse } from '@prisma/client';

import petitGibier from '@app/data/petit-gibier.json';

type CountCarcassesByEspece = Record<string, { carcasses: number; nombre_d_animaux: number }>;

export function getCountCarcassesByEspece(carcasses: Array<Carcasse>): CountCarcassesByEspece {
  return carcasses.reduce((acc, carcasse) => {
    if (carcasse.deleted_at) {
      return acc;
    }
    if (carcasse.intermediaire_carcasse_manquante) {
      return acc;
    }
    if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
      return acc;
    }
    acc[carcasse.espece!] = {
      carcasses: (acc[carcasse.espece!]?.carcasses || 0) + 1,
      nombre_d_animaux: (acc[carcasse.espece!]?.nombre_d_animaux || 1) + (carcasse?.nombre_d_animaux || 1),
    };
    return acc;
  }, {} as CountCarcassesByEspece);
}

export function formatCountCarcasseByEspece(carcasses: Array<Carcasse>) {
  const countCarcassesByEspece = getCountCarcassesByEspece(carcasses);

  if (!Object.keys(countCarcassesByEspece).length) {
    return ['Pas de carcasse acceptée'];
  }

  return Object.entries(countCarcassesByEspece).map(([espece, { carcasses, nombre_d_animaux }]) => {
    const isLot = petitGibier.especes.includes(espece);
    const withS = carcasses === 1 ? '' : 's';
    return `${espece}\u00A0:\u00A0${carcasses}\u00A0${isLot ? `lot${withS} (${nombre_d_animaux} carcasses)` : `carcasse${withS}`}`;
  });
}
