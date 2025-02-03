import { Carcasse, CarcasseStatus, CarcasseType } from '@prisma/client';
import dayjs from 'dayjs';
import { CarcasseForResponseForRegistry, CarcasseGetForRegistry } from '~/types/carcasse';

export default function updateCarcasseStatus<T extends Carcasse | CarcasseGetForRegistry>(carcasse: T) {
  if (carcasse.svi_carcasse_manquante) {
    return CarcasseStatus.MANQUANTE;
  }
  if (carcasse.svi_carcasse_traitement_assainissant?.length > 0) {
    return CarcasseStatus.TRAITEMENT_ASSAINISSANT;
  }
  const carcasseSaisie = getCarcasseSaisie<T>(carcasse);
  if (carcasseSaisie.totale) {
    return CarcasseStatus.SAISIE_TOTALE;
  }
  if (carcasseSaisie.partielle) {
    return CarcasseStatus.SAISIE_PARTIELLE;
  }
  if (carcasse.svi_carcasse_consigne) {
    if (carcasse.svi_carcasse_consigne_levee) {
      return CarcasseStatus.LEVEE_DE_CONSIGNE;
    }
    return CarcasseStatus.CONSIGNE;
  }
  if (dayjs().diff(dayjs(carcasse.svi_assigned_to_fei_at), 'day') > 10) {
    return CarcasseStatus.ACCEPTE;
  }
  return CarcasseStatus.SANS_DECISION;
}

// export function getCarcasseStatusLabel<T extends Carcasse | CarcasseForResponseForRegistry>(carcasse: T) {
//   switch (carcasse.svi_carcasse_status) {
//     case CarcasseStatus.MANQUANTE:
//       if (carcasse.type === CarcasseType.PETIT_GIBIER) {
//         return 'Manquant';
//       }
//       return 'Manquante';
//     case CarcasseStatus.TRAITEMENT_ASSAINISSANT:
//       return 'En traitement assainissant';
//     case CarcasseStatus.SAISIE_TOTALE:
//       return 'Saisie totale';
//     case CarcasseStatus.SAISIE_PARTIELLE:
//       return 'Saisie partielle';
//     case CarcasseStatus.LEVEE_DE_CONSIGNE:
//       return 'Levée de consigne';
//     case CarcasseStatus.CONSIGNE:
//       if (carcasse.type === CarcasseType.PETIT_GIBIER) {
//         return 'Consigné';
//       }
//       return 'Consignée';
//     case CarcasseStatus.SANS_DECISION:
//       if (carcasse.svi_carcasse_status_set_at) {
//         if (carcasse.type === CarcasseType.PETIT_GIBIER) {
//           return 'Accepté';
//         }
//         return 'Acceptée';
//       }
//       return 'Sans décision';
//     default:
//       return 'Inconnu';
//   }
// }

type CarcasseSaisie = {
  totale: boolean;
  partielle: boolean;
  partie: string[]; // Nombre d'animaux || Coffre Collier Cuisse Cuissot Épaule Gigot Filet Filet mignon Poitrine Quartier arrière Quartier avant
};

function getCarcasseSaisie<T extends Carcasse | CarcasseGetForRegistry>(carcasse: T): CarcasseSaisie {
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
