import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const PARIS_TIMEZONE = 'Europe/Paris';

// Horodatage (DateTime) affiché à l'heure de Paris, quel que soit le fuseau du serveur
export function formatDateTimeParis(date: Date | null, format = 'DD/MM/YYYY') {
  return date ? dayjs(date).tz(PARIS_TIMEZONE).format(format) : '-';
}

// Date calendaire (@db.Date) : Prisma la renvoie à minuit UTC, on la lit en UTC pour garder le jour saisi
export function formatDateJour(date: Date | null) {
  return date ? dayjs.utc(date).format('DD/MM/YYYY') : '-';
}
