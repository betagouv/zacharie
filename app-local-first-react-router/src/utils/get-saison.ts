import dayjs from 'dayjs';

export function getSaisonStartYear(date: string | Date): number {
  const d = dayjs(date);
  return d.month() >= 5 ? d.year() : d.year() - 1;
}

export function getSaisonLabel(startYear: number): string {
  return `Juin ${startYear} - Mai ${startYear + 1}`;
}

export function isDateInSaison(date: string | Date, startYear: number): boolean {
  return getSaisonStartYear(date) === startYear;
}
