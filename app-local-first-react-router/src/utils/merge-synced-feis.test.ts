import { describe, it, expect } from 'vitest';
import type { Fei } from '@prisma/client';
import { mergeSyncedFeis } from './merge-synced-feis';

function makeFei(numero: string, overrides: Partial<Fei> = {}): Fei {
  return {
    numero,
    commune_mise_a_mort: 'CHASSENARD',
    is_synced: false,
    updated_at: '2026-10-02T10:00:00.000Z',
    ...overrides,
  } as unknown as Fei;
}

describe('mergeSyncedFeis', () => {
  it('marque synchronisée une fiche confirmée par le serveur et non modifiée depuis l’envoi', () => {
    const pushed = makeFei('ZACH-1');
    const saved = makeFei('ZACH-1', { is_synced: true, updated_at: '2026-10-02T10:00:01.000Z' as never });
    const result = mergeSyncedFeis({ 'ZACH-1': pushed }, [pushed], [saved]);
    expect(result['ZACH-1'].is_synced).toBe(true);
    expect(result['ZACH-1'].updated_at).toBe('2026-10-02T10:00:01.000Z');
  });

  it('garde la modification locale faite pendant la synchro', () => {
    const pushed = makeFei('ZACH-1');
    const editedSincePush = makeFei('ZACH-1', {
      commune_mise_a_mort: 'MOULINS',
      updated_at: '2026-10-02T10:00:02.000Z' as never,
    });
    const saved = makeFei('ZACH-1', { is_synced: true, updated_at: '2026-10-02T10:00:01.000Z' as never });
    const result = mergeSyncedFeis({ 'ZACH-1': editedSincePush }, [pushed], [saved]);
    expect(result['ZACH-1']).toBe(editedSincePush);
    expect(result['ZACH-1'].is_synced).toBe(false);
  });

  it('ne touche pas aux fiches que le serveur ne renvoie pas', () => {
    const pushed = makeFei('ZACH-1');
    const other = makeFei('ZACH-2');
    const result = mergeSyncedFeis({ 'ZACH-1': pushed, 'ZACH-2': other }, [pushed, other], []);
    expect(result['ZACH-1']).toBe(pushed);
    expect(result['ZACH-2']).toBe(other);
  });

  it("n'ajoute pas une fiche supprimée localement entre-temps", () => {
    const pushed = makeFei('ZACH-1');
    const saved = makeFei('ZACH-1', { is_synced: true });
    const result = mergeSyncedFeis({}, [pushed], [saved]);
    expect(result['ZACH-1']).toBeUndefined();
  });
});
