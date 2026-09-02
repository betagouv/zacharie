import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  CarcasseModificationRequestStatus,
  IPM1Decision,
  Prisma,
  TrichineResultatAnalyse,
  UserRoles,
} from '@prisma/client';
import type { User } from '@prisma/client';

// Les deux garde-fous ne s'activent qu'avec la feature trichine posée dans l'env
vi.mock('~/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/config')>()),
  TRICHINE_FEATURE_ENABLED: true,
}));
vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/utils/formatCarcasseEmail', () => ({
  formatAutomaticClosingEmailForChasseur: vi.fn().mockResolvedValue(['object', 'body']),
  formatCarcasseChasseurEmail: vi.fn(),
}));
vi.mock('~/utils/api', () => ({
  sendWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

import prisma from '~/prisma';
import { syncCarcasse } from '~/utils/sync-carcasse';
import type { SyncScope } from '~/utils/sync-scope';
import { automaticClosingOfFeis } from '~/cronjobs/feis';

// Ces tests portent sur les garde-fous trichine, pas sur le périmètre d'écriture : on passe un
// scope qui autorise tout pour que la carcasse arrive jusqu'aux vérifications testées.
const allowAllScope: SyncScope = {
  entityIds: [],
  prefetch: async () => {},
  canWriteCarcasse: async () => true,
  grant: () => {},
  isFeiOwner: () => true,
  canWriteFei: async () => true,
};

const sviUser = {
  id: 'user-svi',
  roles: [UserRoles.SVI],
  activated: true,
  isZacharieAdmin: false,
} as unknown as User;

const baseFei = { numero: 'FEI-1', deleted_at: null } as any;

const makeExistingCarcasse = (espece: string) =>
  ({
    zacharie_carcasse_id: 'ZC-1',
    fei_numero: 'FEI-1',
    numero_bracelet: 'BR-1',
    espece,
    svi_ipm1_decision: null,
  }) as any;

const acceptBody = {
  [Prisma.CarcasseScalarFieldEnum.svi_ipm1_decision]: IPM1Decision.ACCEPTE,
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.fei.findUnique).mockResolvedValue(baseFei);
});

describe('syncCarcasse — acceptation SVI d’un sanglier (trichine §9)', () => {
  test('sanglier sans résultat négatif → rejet', async () => {
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(makeExistingCarcasse('Sanglier'));
    vi.mocked(prisma.trichineEchantillon.findFirst).mockResolvedValueOnce(null);

    await expect(syncCarcasse('FEI-1', 'ZC-1', acceptBody, sviUser, allowAllScope)).rejects.toThrow(
      /Recherche de trichine obligatoire/
    );
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });

  test('sanglier avec un pool négatif → acceptation enregistrée', async () => {
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(makeExistingCarcasse('Sanglier'));
    vi.mocked(prisma.trichineEchantillon.findFirst).mockResolvedValueOnce({ id: 'ech-1' } as any);
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce({} as any);

    await syncCarcasse('FEI-1', 'ZC-1', acceptBody, sviUser, allowAllScope);

    const updateCall = vi.mocked(prisma.carcasse.update).mock.calls[0][0] as any;
    expect(updateCall.data.svi_ipm1_decision).toBe(IPM1Decision.ACCEPTE);
  });

  test('autre espèce → aucune vérification trichine', async () => {
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(makeExistingCarcasse('Chevreuil'));
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce({} as any);

    await syncCarcasse('FEI-1', 'ZC-1', acceptBody, sviUser, allowAllScope);

    expect(prisma.trichineEchantillon.findFirst).not.toHaveBeenCalled();
  });

  test('sanglier déjà accepté → pas de re-vérification (sync idempotent)', async () => {
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce({
      ...makeExistingCarcasse('Sanglier'),
      svi_ipm1_decision: IPM1Decision.ACCEPTE,
    });
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce({} as any);

    await syncCarcasse('FEI-1', 'ZC-1', acceptBody, sviUser, allowAllScope);

    expect(prisma.trichineEchantillon.findFirst).not.toHaveBeenCalled();
  });

  test('mise en consigne d’un sanglier → pas de vérification', async () => {
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValueOnce(makeExistingCarcasse('Sanglier'));
    vi.mocked(prisma.carcasse.update).mockResolvedValueOnce({} as any);

    await syncCarcasse(
      'FEI-1',
      'ZC-1',
      { [Prisma.CarcasseScalarFieldEnum.svi_ipm1_decision]: IPM1Decision.MISE_EN_CONSIGNE } as any,
      sviUser,
      allowAllScope
    );

    expect(prisma.trichineEchantillon.findFirst).not.toHaveBeenCalled();
  });
});

describe('automaticClosingOfFeis — sanglier auto-clôturé seulement sur résultat négatif (trichine §6.2)', () => {
  test('la requête n’auto-clôture un sanglier qu’avec un pool négatif', async () => {
    await automaticClosingOfFeis();

    const where = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where as any;
    expect(where.OR).toEqual([
      { espece: null },
      { espece: { not: 'Sanglier' } },
      {
        TrichineEchantillons: {
          some: {
            deleted_at: null,
            TrichinePool: { deleted_at: null, resultat_analyse: TrichineResultatAnalyse.NEGATIF },
          },
        },
      },
    ]);
    // les autres critères restent intacts
    expect(where.svi_closed_at).toBeNull();
    expect(where.CarcasseModificationRequests.none.status).toBe(CarcasseModificationRequestStatus.PENDING);
  });
});
