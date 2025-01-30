import { Carcasse } from '@prisma/client';

type CarcasseSaisie = {
  totale: boolean;
  partielle: boolean;
  partie: string[]; // Nombre d'animaux || Coffre Collier Cuisse Cuissot Épaule Gigot Filet Filet mignon Poitrine Quartier arrière Quartier avant
};

export default function getCarcasseSaisie(carcasse: Carcasse): CarcasseSaisie {
  const saisie = carcasse.svi_carcasse_saisie;
  const [type, ...partie] = saisie;
  if (!type) {
    return {
      totale: false,
      partielle: false,
      partie: [],
    };
  }
  if (type === 'Saisie partielle') {
    return {
      totale: false,
      partielle: true,
      partie,
    };
  }
  return {
    totale: true,
    partielle: false,
    partie: [],
  };
}
