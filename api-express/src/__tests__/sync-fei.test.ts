import { describe, test, expect, vi, beforeEach } from 'vitest';
import { syncFei } from '~/utils/sync-fei';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

const examinateurInitial = {
  id: 'user-cfei',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-123',
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const chasseurNotCfei = {
  id: 'user-no-cfei',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: null,
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const platformAdmin = {
  id: 'user-admin',
  roles: [UserRoles.ADMIN],
  numero_cfei: null,
  activated: true,
  isZacharieAdmin: true,
} as unknown as User;

const otherChasseur = {
  id: 'user-other',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-OTHER',
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const baseFei = {
  numero: 'FEI-1',
  examinateur_initial_user_id: examinateurInitial.id,
  deleted_at: null,
  date_mise_a_mort: '2026-01-01',
  commune_mise_a_mort: 'Paris',
  // Side-effect-free populated relations stubbed as empty arrays/null
  Carcasses: [],
  CarcasseIntermediaire: [],
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncFei — create', () => {
  test('CHASSEUR with numero_cfei and activated → creates FEI', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.fei.create).mockResolvedValue({ ...baseFei, numero: 'FEI-NEW' } as any);

    const result = await syncFei(
      'FEI-NEW',
      { numero: 'FEI-NEW', date_mise_a_mort: '2026-01-01' } as any,
      examinateurInitial
    );

    expect(result.isDeleted).toBe(false);
    expect(prisma.fei.create).toHaveBeenCalledOnce();
    const createCall = vi.mocked(prisma.fei.create).mock.calls[0][0];
    expect(createCall.data.numero).toBe('FEI-NEW');
    expect(createCall.data.created_by_user_id).toBe(examinateurInitial.id);
    expect(createCall.data.is_synced).toBe(true);
  });

  test('non-examinateur-initial → throws and captures to Sentry', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(null);

    await expect(syncFei('FEI-NEW', { numero: 'FEI-NEW' } as any, chasseurNotCfei)).rejects.toThrow(
      'Seul un examinateur initial peut créer une fiche'
    );

    expect(capture).toHaveBeenCalledOnce();
    expect(prisma.fei.create).not.toHaveBeenCalled();
  });

  test('non-CHASSEUR user → throws even with platform admin (admin can only delete)', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(null);

    await expect(syncFei('FEI-NEW', { numero: 'FEI-NEW' } as any, platformAdmin)).rejects.toThrow(
      'Seul un examinateur initial peut créer une fiche'
    );
  });
});

describe('syncFei — update', () => {
  test('updates only fields present via hasOwnProperty', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.fei.update).mockResolvedValue(baseFei as any);

    await syncFei('FEI-1', { numero: 'FEI-1', commune_mise_a_mort: 'Lyon' } as any, examinateurInitial);

    const updateCall = vi.mocked(prisma.fei.update).mock.calls[0][0];
    expect(updateCall.data).toHaveProperty('commune_mise_a_mort', 'Lyon');
    // date_mise_a_mort was NOT in body → must not appear in update payload
    expect(updateCall.data).not.toHaveProperty('date_mise_a_mort');
    expect(updateCall.data).toHaveProperty('is_synced', true);
  });

  test('sanitizes string fields (xss)', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.fei.update).mockResolvedValue(baseFei as any);

    await syncFei(
      'FEI-1',
      { numero: 'FEI-1', commune_mise_a_mort: '<script>alert(1)</script>Lyon' } as any,
      examinateurInitial
    );

    const updateCall = vi.mocked(prisma.fei.update).mock.calls[0][0];
    expect(updateCall.data.commune_mise_a_mort).not.toContain('<script>');
  });
});

describe('syncFei — creation_context', () => {
  test("'zacharie' context bypasses apiKey lookup", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.fei.update).mockResolvedValue(baseFei as any);

    await syncFei('FEI-1', { numero: 'FEI-1', creation_context: 'zacharie' } as any, examinateurInitial);

    expect(prisma.apiKey.findFirst).not.toHaveBeenCalled();
  });

  test('unknown context slug → throws "Invalid context slug"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValueOnce(null);

    await expect(
      syncFei('FEI-1', { numero: 'FEI-1', creation_context: 'partner-x' } as any, examinateurInitial)
    ).rejects.toThrow('Invalid context slug');
  });

  test('known partner context slug → resolves via apiKey', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValueOnce({ id: 'k-1' } as any);
    vi.mocked(prisma.fei.update).mockResolvedValue(baseFei as any);

    await syncFei('FEI-1', { numero: 'FEI-1', creation_context: 'partner-x' } as any, examinateurInitial);

    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
      where: { slug_for_context: 'partner-x' },
    });
  });
});

describe('syncFei — deletion', () => {
  test('soft-delete by examinateur_initial → cascades to carcasses + intermediaires', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.fei.update).mockResolvedValue({
      ...baseFei,
      deleted_at: '2026-03-01T00:00:00Z',
    } as any);

    const result = await syncFei(
      'FEI-1',
      { numero: 'FEI-1', deleted_at: '2026-03-01T00:00:00Z' } as any,
      examinateurInitial
    );

    expect(result.isDeleted).toBe(true);
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: 'FEI-1' },
      data: { deleted_at: '2026-03-01T00:00:00Z' },
    });
    expect(prisma.carcasseIntermediaire.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: 'FEI-1' },
      data: { deleted_at: '2026-03-01T00:00:00Z' },
    });
  });

  test('soft-delete by isZacharieAdmin → allowed', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);
    vi.mocked(prisma.fei.update).mockResolvedValue(baseFei as any);

    await expect(
      syncFei('FEI-1', { numero: 'FEI-1', deleted_at: '2026-03-01T00:00:00Z' } as any, platformAdmin)
    ).resolves.toBeDefined();
    expect(prisma.fei.update).toHaveBeenCalledOnce();
  });

  test('soft-delete by unrelated user → throws "Unauthorized"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(baseFei);

    await expect(
      syncFei('FEI-1', { numero: 'FEI-1', deleted_at: '2026-03-01T00:00:00Z' } as any, otherChasseur)
    ).rejects.toThrow('Unauthorized');

    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(prisma.carcasse.updateMany).not.toHaveBeenCalled();
  });

  test('already-deleted FEI → returns {isDeleted: true} no-op', async () => {
    const deletedFei = { ...baseFei, deleted_at: '2026-02-15T00:00:00Z' };
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(deletedFei);

    const result = await syncFei(
      'FEI-1',
      { numero: 'FEI-1', commune_mise_a_mort: 'Should-be-ignored' } as any,
      examinateurInitial
    );

    expect(result.isDeleted).toBe(true);
    expect(result.savedFei).toBe(deletedFei);
    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(prisma.fei.create).not.toHaveBeenCalled();
  });

  test('delete request on missing FEI → throws "Fei not found"', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValueOnce(null);

    await expect(
      syncFei(
        'FEI-DOES-NOT-EXIST',
        { numero: 'FEI-DOES-NOT-EXIST', deleted_at: '2026-03-01' } as any,
        platformAdmin
      )
    ).rejects.toThrow();
  });
});

describe('syncFei — body validation', () => {
  test('rejects malformed body (boolean given for a string field)', async () => {
    await expect(
      syncFei(
        'FEI-1',
        // commune_mise_a_mort expects string|null
        { numero: 'FEI-1', commune_mise_a_mort: 42 } as any,
        examinateurInitial
      )
    ).rejects.toThrow();
  });
});
