import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineResultatAnalyse, TrichineStatutLogistiqueFTP } from '@prisma/client';

// applyPoolResult — un non négatif saisi par un LVD génère la FTP de confirmation vers le LNR,
// envoyée d'office, avec la date d'envoi, les modalités de transmission et les conditions de
// conservation saisies par le laboratoire.

vi.mock('~/utils/trichine-status', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine-status')>()),
  recomputePoolAndLinkedFTPs: vi.fn().mockResolvedValue(undefined),
  recomputeFTPTrichine: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/utils/trichine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine')>()),
  logTrichineStatutChange: vi.fn().mockResolvedValue(undefined),
  getFtpEmitterUsers: vi.fn().mockResolvedValue([]),
  getUsersWorkingForEntity: vi.fn().mockResolvedValue([]),
  notifyTrichineUsers: vi.fn().mockResolvedValue(undefined),
  referenceCodeForEntity: vi.fn().mockResolvedValue('LV01'),
  nextFTPReference: vi.fn().mockResolvedValue('F-26-LV01-0001'),
  withReferenceRetry: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock('~/utils/trichine-ftp-document', () => ({ archiveFtpPdf: vi.fn().mockResolvedValue(null) }));

import prisma from '~/prisma';
import { applyPoolResult, type ApplyPoolResultBody } from '~/utils/trichine-result';

const pool = {
  id: 'pool-1',
  reference_pool: 'P-26-SVI01-0045',
  resultat_analyse: null as TrichineResultatAnalyse | null,
  nombre_larves_lvd: null as number | null,
  nombre_larves_lnr: null as number | null,
  date_debut_analyse: null as Date | null,
  commentaire: null as string | null,
  TrichineEchantillons: [] as Array<never>,
};

const ftp = {
  id: 'ftp-1',
  numero_fiche: 'F-26-SVI01-0012',
  destinataire_entity_id: 'lvd-1',
  ftp_parent_id: null as string | null,
  expediteur_user_id: 'user-svi',
  expediteur_entity_id: 'svi-1',
};

const douteux = (body: Partial<ApplyPoolResultBody>, origine: 'saisie' | 'automatique' = 'saisie') =>
  applyPoolResult({
    pool,
    ftp,
    body: { resultat_analyse: TrichineResultatAnalyse.DOUTEUX, ...body },
    userId: 'user-labo',
    isLnr: false,
    origine,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.trichinePool.update).mockResolvedValue({} as never);
  vi.mocked(prisma.entity.findFirst).mockResolvedValue({ id: 'lnr-1' } as never);
  vi.mocked(prisma.trichineFTP.create).mockImplementation((async ({ data }: { data: object }) => ({
    id: 'ftp-lnr',
    ...data,
  })) as never);
});

describe('applyPoolResult — FTP de confirmation vers le LNR', () => {
  test('saisie manuelle sans nombre de larves → refusée', async () => {
    const outcome = await douteux({ conditions_conservation_lnr: 'Éthanol 70 %' });

    expect(outcome).toMatchObject({ kind: 'error', status: 400 });
    expect(prisma.trichinePool.update).not.toHaveBeenCalled();
    expect(prisma.trichineFTP.create).not.toHaveBeenCalled();
  });

  test('saisie manuelle sans conditions de conservation → refusée', async () => {
    const outcome = await douteux({ nombre_larves: 3, conditions_conservation_lnr: '  ' });

    expect(outcome).toMatchObject({ kind: 'error', status: 400 });
    expect(prisma.trichineFTP.create).not.toHaveBeenCalled();
  });

  test('la FTP part envoyée, avec la date, le transport et la conservation saisis', async () => {
    const dateEnvoi = new Date('2026-10-28T00:00:00Z');

    const outcome = await douteux({
      nombre_larves: 3,
      date_envoi_lnr: dateEnvoi,
      mode_transport_lnr: ' Chronopost ',
      conditions_conservation_lnr: 'Éthanol 70 %, froid positif',
    });

    expect(outcome).toMatchObject({ kind: 'ok', ftpConfirmation: { id: 'ftp-lnr' } });
    expect(prisma.trichineFTP.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        destinataire_entity_id: 'lnr-1',
        statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
        date_envoi: dateEnvoi,
        mode_transport: 'Chronopost',
        conditions_conservation: 'Éthanol 70 %, froid positif',
      }),
    });
  });

  test('import automatique : la FTP part sans ces informations, envoyée à la date du jour', async () => {
    const outcome = await douteux({}, 'automatique');

    expect(outcome.kind).toBe('ok');
    expect(prisma.trichineFTP.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
        date_envoi: expect.any(Date),
        mode_transport: null,
        conditions_conservation: null,
      }),
    });
  });
});
