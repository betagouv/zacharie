import { describe, it, expect } from 'vitest';
import type { Carcasse } from '@prisma/client';
import { getLatestSviDates } from './get-latest-svi-dates';

const c = (overrides: Partial<Carcasse> = {}): Carcasse =>
  ({
    svi_assigned_at: null,
    svi_closed_at: null,
    svi_automatic_closed_at: null,
    ...overrides,
  }) as unknown as Carcasse;

describe('getLatestSviDates', () => {
  it('returns nulls when no carcasse carries any SVI date', () => {
    expect(getLatestSviDates([c(), c()])).toEqual({
      sviAssignedAt: null,
      sviClosedAt: null,
      sviAutomaticClosedAt: null,
    });
  });

  it('picks the latest date of each type across the lot', () => {
    const res = getLatestSviDates([
      c({
        svi_assigned_at: new Date('2026-05-01T08:00:00Z'),
        svi_closed_at: new Date('2026-05-10T08:00:00Z'),
      }),
      c({
        svi_assigned_at: new Date('2026-05-03T08:00:00Z'),
        svi_closed_at: new Date('2026-05-09T08:00:00Z'),
      }),
    ]);
    expect(res.sviAssignedAt).toEqual(new Date('2026-05-03T08:00:00Z'));
    expect(res.sviClosedAt).toEqual(new Date('2026-05-10T08:00:00Z'));
  });

  // Régression : la clôture automatique doit lire svi_automatic_closed_at, PAS svi_closed_at.
  it('reads automatic close from svi_automatic_closed_at, independently of svi_closed_at', () => {
    const res = getLatestSviDates([c({ svi_automatic_closed_at: new Date('2026-06-01T12:00:00Z') })]);
    expect(res.sviAutomaticClosedAt).toEqual(new Date('2026-06-01T12:00:00Z'));
    expect(res.sviClosedAt).toBeNull();
  });

  it('does not surface an automatic close when only a manual close is set', () => {
    const res = getLatestSviDates([c({ svi_closed_at: new Date('2026-06-01T12:00:00Z') })]);
    expect(res.sviClosedAt).toEqual(new Date('2026-06-01T12:00:00Z'));
    expect(res.sviAutomaticClosedAt).toBeNull();
  });
});
