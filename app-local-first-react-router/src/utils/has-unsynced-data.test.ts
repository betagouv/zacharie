import { describe, expect, it } from 'vitest';
import type { Carcasse, CarcasseIntermediaire, CarcasseModificationRequest, Fei, Log } from '@prisma/client';
import { hasUnsyncedData } from './has-unsynced-data';

function emptyState() {
  return {
    feis: {} as Record<string, Fei>,
    carcasses: {} as Record<string, Carcasse>,
    carcassesIntermediaireById: {} as Record<string, CarcasseIntermediaire>,
    modifRequestsByCarcasseId: {} as Record<string, Array<CarcasseModificationRequest>>,
    logs: [] as Array<Log>,
  };
}

describe('hasUnsyncedData', () => {
  it('returns false for an empty store', () => {
    expect(hasUnsyncedData(emptyState())).toBe(false);
  });

  it('returns false when every item is synced', () => {
    const state = emptyState();
    state.feis.a = { numero: 'a', is_synced: true } as Fei;
    state.carcasses.c = { zacharie_carcasse_id: 'c', is_synced: true } as Carcasse;
    state.modifRequestsByCarcasseId.c = [{ id: 'm', is_synced: true } as CarcasseModificationRequest];
    state.logs = [{ id: 'l', is_synced: true } as Log];
    expect(hasUnsyncedData(state)).toBe(false);
  });

  it('returns true when a fei is not synced', () => {
    const state = emptyState();
    state.feis.a = { numero: 'a', is_synced: false } as Fei;
    expect(hasUnsyncedData(state)).toBe(true);
  });

  it('returns true when a carcasse is not synced', () => {
    const state = emptyState();
    state.carcasses.c = { zacharie_carcasse_id: 'c', is_synced: false } as Carcasse;
    expect(hasUnsyncedData(state)).toBe(true);
  });

  it('returns true when a carcasse intermediaire is not synced', () => {
    const state = emptyState();
    state.carcassesIntermediaireById.x = { is_synced: false } as CarcasseIntermediaire;
    expect(hasUnsyncedData(state)).toBe(true);
  });

  it('returns true when a modif request is not synced', () => {
    const state = emptyState();
    state.modifRequestsByCarcasseId.c = [
      { id: 'm1', is_synced: true } as CarcasseModificationRequest,
      { id: 'm2', is_synced: false } as CarcasseModificationRequest,
    ];
    expect(hasUnsyncedData(state)).toBe(true);
  });

  it('returns true when a log is not synced', () => {
    const state = emptyState();
    state.logs = [{ id: 'l', is_synced: false } as Log];
    expect(hasUnsyncedData(state)).toBe(true);
  });
});
