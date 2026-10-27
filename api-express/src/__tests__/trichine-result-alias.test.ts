import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineResultatAnalyse } from '@prisma/client';

// applyPoolResult — la référence labo saisie avec un résultat devient l'alias du pool. Refusée
// (format, déjà prise), elle bloque une saisie manuelle mais jamais un résultat lu automatiquement.

vi.mock('~/utils/trichine-status', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine-status')>()),
  recomputePoolAndLinkedFTPs: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/utils/trichine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine')>()),
  logTrichineStatutChange: vi.fn().mockResolvedValue(undefined),
  getFtpEmitterUsers: vi.fn().mockResolvedValue([]),
  notifyTrichineUsers: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '~/prisma';
import { applyPoolResult, type ApplyPoolResultOrigine } from '~/utils/trichine-result';

const pool = {
  id: 'pool-1',
  reference_pool: 'P-26-SVI01-0045',
  resultat_analyse: null as TrichineResultatAnalyse | null,
  nombre_larves_lvd: null as number | null,
  date_debut_analyse: null as Date | null,
  commentaire: null as string | null,
  TrichineEchantillons: [] as Array<never>,
};

const ftp = {
  id: 'ftp-1',
  numero_fiche: 'F-26-SVI01-0012',
  destinataire_entity_id: 'labo-1',
  ftp_parent_id: null as string | null,
  expediteur_user_id: 'user-svi',
  expediteur_entity_id: 'svi-1',
};

const appliquer = (reference_labo: string, origine: ApplyPoolResultOrigine) =>
  applyPoolResult({
    pool,
    ftp,
    body: { resultat_analyse: TrichineResultatAnalyse.NEGATIF, reference_labo },
    userId: 'user-labo',
    isLnr: false,
    origine,
  });

// La référence est déjà donnée par ce labo à un autre pool
const referenceDejaPrise = () =>
  vi.mocked(prisma.trichineAlias.findMany).mockResolvedValueOnce([
    {
      reference: 'DOSSIER-87',
      echantillon_id: null,
      pool_id: 'pool-2',
      ftp_id: null,
      TrichineEchantillon: null,
      TrichinePool: { reference_pool: 'P-26-SVI01-0046' },
      TrichineFTP: null,
    },
  ] as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.trichineAlias.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.trichinePool.update).mockResolvedValue({} as never);
});

describe('applyPoolResult — référence labo', () => {
  test('saisie manuelle : une référence déjà prise bloque, le résultat n’est pas enregistré', async () => {
    referenceDejaPrise();

    const outcome = await appliquer('DOSSIER-87', 'saisie');

    expect(outcome).toMatchObject({ kind: 'error', status: 400 });
    expect(prisma.trichinePool.update).not.toHaveBeenCalled();
  });

  test('import automatique : une référence déjà prise est ignorée, le résultat est enregistré', async () => {
    referenceDejaPrise();

    const outcome = await appliquer('DOSSIER-87', 'automatique');

    expect(outcome).toMatchObject({
      kind: 'ok',
      referenceIgnoree: expect.stringContaining('déjà utilisée pour le pool P-26-SVI01-0046'),
    });
    expect(prisma.trichinePool.update).toHaveBeenCalled();
    expect(prisma.trichineAlias.create).not.toHaveBeenCalled();
  });

  test('import automatique : une référence hors format est ignorée, le résultat est enregistré', async () => {
    const outcome = await appliquer('n° dossier : 87+88', 'automatique');

    expect(outcome).toMatchObject({
      kind: 'ok',
      referenceIgnoree: expect.stringContaining('Référence invalide'),
    });
    expect(prisma.trichineAlias.create).not.toHaveBeenCalled();
  });

  test('une référence libre devient l’alias du pool au nom du labo destinataire', async () => {
    const outcome = await appliquer('DOSSIER-87', 'automatique');

    expect(outcome.kind).toBe('ok');
    expect(prisma.trichineAlias.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { entity_id: 'labo-1', objet_type: 'POOL', pool_id: 'pool-1', reference: 'DOSSIER-87' },
      })
    );
  });

  test('saisie manuelle : un champ vidé retire la référence du labo', async () => {
    const outcome = await appliquer('', 'saisie');

    expect(outcome.kind).toBe('ok');
    expect(prisma.trichineAlias.deleteMany).toHaveBeenCalledWith({
      where: { entity_id: 'labo-1', pool_id: 'pool-1' },
    });
  });

  test('import automatique : une référence vide ne retire rien', async () => {
    await appliquer('', 'automatique');

    expect(prisma.trichineAlias.deleteMany).not.toHaveBeenCalled();
  });
});
