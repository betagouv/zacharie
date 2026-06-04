import dayjs from 'dayjs';

// Une saison de chasse va du 1er juin (année N) au 31 mai (année N+1).
// On identifie une saison par son année de début (N).

export function getSaisonStartYear(date: string | Date): number {
  const d = dayjs(date);
  // dayjs month() est indexé à partir de 0 : juin = 5
  return d.month() >= 5 ? d.year() : d.year() - 1;
}

export function getSaisonLabel(startYear: number): string {
  return `Juin ${startYear} - Mai ${startYear + 1}`;
}

export function isDateInSaison(date: string | Date, startYear: number): boolean {
  return getSaisonStartYear(date) === startYear;
}
