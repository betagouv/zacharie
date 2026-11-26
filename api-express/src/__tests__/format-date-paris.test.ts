import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { formatDateJour, formatDateTimeParis } from '~/utils/format-date-paris';

// Les dates du PDF sont lues à l'heure de Paris, pas dans le fuseau du serveur : on fait tourner la suite
// avec un serveur en UTC.
const initialTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'UTC';
});
afterAll(() => {
  process.env.TZ = initialTz;
});

describe('formatDateTimeParis', () => {
  test('prise en charge le 03/10 à 00:30 heure de Paris → 03/10, même si le serveur est en UTC', () => {
    // 2026-10-03 00:30 à Paris (UTC+2) = 2026-10-02 22:30 UTC
    expect(formatDateTimeParis(new Date('2026-10-02T22:30:00Z'))).toBe('03/10/2026');
  });

  test('heure de génération en heure de Paris', () => {
    // 10:15 à Paris en hiver (UTC+1) = 09:15 UTC
    expect(formatDateTimeParis(new Date('2026-12-01T09:15:00Z'), 'DD/MM/YYYY à HH:mm')).toBe(
      '01/12/2026 à 10:15'
    );
  });

  test('absente → tiret', () => {
    expect(formatDateTimeParis(null)).toBe('-');
  });
});

describe('formatDateJour', () => {
  test('date @db.Date (minuit UTC) → même jour', () => {
    expect(formatDateJour(new Date('2026-10-01T00:00:00Z'))).toBe('01/10/2026');
  });

  test('absente → tiret', () => {
    expect(formatDateJour(null)).toBe('-');
  });

  test('serveur à l’ouest de UTC → même jour (pas la veille)', () => {
    process.env.TZ = 'America/New_York';
    try {
      expect(formatDateJour(new Date('2026-10-01T00:00:00Z'))).toBe('01/10/2026');
    } finally {
      process.env.TZ = 'UTC';
    }
  });
});
