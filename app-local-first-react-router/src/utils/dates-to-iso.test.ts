import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { Carcasse, Fei } from '@prisma/client';
import { datesToIso } from './dates-to-iso';
import useZustandStore from '@app/zustand/store';

vi.mock('@app/services/sentry', () => ({ capture: vi.fn() }));

describe('datesToIso', () => {
  it('converts Date values to ISO strings, keeps strings, null and other values', () => {
    const record = {
      created_at: new Date('2026-09-23T08:00:00.000Z'),
      updated_at: '2026-09-22T08:00:00.000Z',
      deleted_at: null,
      numero: 'ZACH-1',
      nombre: 3,
      is_synced: false,
      nested: { date: new Date('2026-01-01T00:00:00.000Z'), label: 'x', empty: null },
      list: [new Date('2026-02-01T00:00:00.000Z'), 'y', null],
    };
    expect(datesToIso(record)).toEqual({
      created_at: '2026-09-23T08:00:00.000Z',
      updated_at: '2026-09-22T08:00:00.000Z',
      deleted_at: null,
      numero: 'ZACH-1',
      nombre: 3,
      is_synced: false,
      nested: { date: '2026-01-01T00:00:00.000Z', label: 'x', empty: null },
      list: ['2026-02-01T00:00:00.000Z', 'y', null],
    });
  });

  it('does not mutate the input', () => {
    const date = new Date('2026-09-23T08:00:00.000Z');
    const record = { created_at: date };
    datesToIso(record);
    expect(record.created_at).toBe(date);
  });
});

describe('store — dates are stored as ISO strings, like server data', () => {
  it('createFei, updateFei, createCarcasse and updateCarcasse store strings', () => {
    const store = useZustandStore.getState();
    store.createFei({
      numero: 'ZACH-TEST',
      created_at: new Date('2026-09-23T08:00:00.000Z'),
      date_mise_a_mort: new Date('2026-09-23T00:00:00.000Z'),
      deleted_at: null,
    } as unknown as Fei);
    store.updateFei('ZACH-TEST', {
      examinateur_initial_date_approbation_mise_sur_le_marche: new Date('2026-09-23T09:00:00.000Z'),
    });
    store.createCarcasse({
      zacharie_carcasse_id: 'ZACH-TEST_1',
      fei_numero: 'ZACH-TEST',
      created_at: new Date('2026-09-23T08:30:00.000Z'),
      deleted_at: null,
    } as unknown as Carcasse);
    store.updateCarcasse('ZACH-TEST_1', { svi_assigned_at: new Date('2026-09-23T10:00:00.000Z') });

    const { feis, carcasses } = useZustandStore.getState();
    const fei = feis['ZACH-TEST'];
    expect(fei.created_at).toBe('2026-09-23T08:00:00.000Z');
    expect(fei.date_mise_a_mort).toBe('2026-09-23T00:00:00.000Z');
    expect(fei.examinateur_initial_date_approbation_mise_sur_le_marche).toBe('2026-09-23T09:00:00.000Z');
    expect(typeof fei.updated_at).toBe('string');
    expect(fei.deleted_at).toBeNull();
    const carcasse = carcasses['ZACH-TEST_1'];
    expect(carcasse.created_at).toBe('2026-09-23T08:30:00.000Z');
    expect(carcasse.svi_assigned_at).toBe('2026-09-23T10:00:00.000Z');
    expect(typeof carcasse.updated_at).toBe('string');
    expect(carcasse.deleted_at).toBeNull();
  });
});
