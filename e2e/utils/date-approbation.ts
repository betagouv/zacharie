import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

// Le raccourci « date du jour » de la validation de l'examen initial affiche la date et l'heure
// courantes (ex. « vendredi 14 août, 09:51 »). On matche la date suivie de n'importe quelle heure,
// pour ne pas dépendre de la minute exacte au moment du rendu.
export function dateApprobationDuJour() {
  return new RegExp(`${dayjs().format('dddd DD MMMM')}, \\d{2}:\\d{2}`);
}
