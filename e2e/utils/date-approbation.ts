import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

export function dateApprobationDuJour() {
  return new RegExp(`${dayjs().format('dddd DD MMMM')}, \\d{2}:\\d{2}`);
}
