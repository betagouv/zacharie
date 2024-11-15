import { type Carcasse } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";

type CountCarcassesByEspece = Record<string, { carcasses: number; nombre_d_animaux: number }>;

export function getCountCarcassesByEspece(carcasses: Array<SerializeFrom<Carcasse>>): CountCarcassesByEspece {
  return carcasses.reduce((acc, carcasse) => {
    if (carcasse.intermediaire_carcasse_manquante) {
      return acc;
    }
    if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
      return acc;
    }
    acc[carcasse.espece!] = {
      carcasses: (acc[carcasse.espece!]?.carcasses || 0) + 1,
      nombre_d_animaux: (acc[carcasse.espece!]?.nombre_d_animaux || 0) + (carcasse?.nombre_d_animaux || 0),
    };
    return acc;
  }, {} as CountCarcassesByEspece);
}

export function formatCountCarcasseByEspece(carcasses: Array<SerializeFrom<Carcasse>>) {
  const countCarcassesByEspece = getCountCarcassesByEspece(carcasses);

  return Object.entries(countCarcassesByEspece).map(([espece, { carcasses, nombre_d_animaux }]) => {
    const isLot = nombre_d_animaux >= carcasses; // look at the code above to understand this
    return `${espece} : ${carcasses} ${isLot ? `lots (${nombre_d_animaux} carcasses)` : "carcasses"}`;
  });
}
