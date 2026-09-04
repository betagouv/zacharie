import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import { analyserEmailEntrant, analyserEmailsEntrantsEnAttente } from '~/utils/trichine-inbound-ocr';
import { ocrDocument } from '~/third-parties/albert';
import { applyPoolResult } from '~/utils/trichine-result';
import { getFromCellar } from '~/third-parties/cellar';

// Deuxième passe sur les rapports scannés : OCR Albert, puis même chemin que pour un PDF natif.
// Le contrat épinglé ici : le texte lu est conservé, il prime sur le rattachement fait d'après
// le sujet du message, et un document illisible sort de la file au lieu d'y tourner.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));
vi.mock('~/third-parties/albert', () => ({
  IS_ALBERT_CONFIGURED: true,
  ocrDocument: vi.fn(),
}));
vi.mock('~/third-parties/cellar', () => ({
  IS_CELLAR_CONFIGURED: true,
  getFromCellar: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 scan')),
  getCellarSignedUrl: vi.fn(),
  uploadToCellar: vi.fn(),
  trichineDocumentKey: vi.fn(),
}));
vi.mock('~/utils/trichine-result', () => ({
  applyPoolResult: vi.fn().mockResolvedValue({ kind: 'ok', pool: null }),
}));

const emailEntrant = {
  id: 'log-1',
  message_id: '<rapport-1@lvd.fr>',
  expediteur: 'labo@lvd.fr',
  detail: { stored: 1 },
} as never;

const documentScanne = {
  id: 'doc-1',
  nom_fichier: 'rapport.pdf',
  fichier_url: 'trichine/RAPPORT_COFRAC/2026/doc-1.pdf',
  pool_id: null as string | null,
  rattachement_source: 'EMAIL' as string | null,
};

function poolFixture(reference: string) {
  return {
    id: `pool-${reference}`,
    reference_pool: reference,
    resultat_analyse: null as string | null,
    date_debut_analyse: null as Date | null,
    commentaire: null as string | null,
    deleted_at: null as Date | null,
    TrichineEchantillons: [] as unknown[],
    TrichinePoolFTPs: [
      {
        id: `link-${reference}`,
        TrichineFTP: {
          id: 'ftp-1',
          deleted_at: null as Date | null,
          statut_logistique: 'RECUE',
          destinataire_entity_id: 'entity-lvd',
          ftp_parent_id: null as string | null,
          expediteur_user_id: 'user-chasseur',
          expediteur_entity_id: 'entity-chasseur',
        },
      },
    ],
  };
}

function expediteurEstUnLabo() {
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { owner_id: 'user-labo', entity_id: 'entity-lvd', EntityRelatedWithUser: { is_lnr: false } },
  ] as never);
  vi.mocked(prisma.trichinePool.findMany).mockImplementation((async (args: any) =>
    (args.where.reference_pool.in as string[]).map(poolFixture)) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.trichineDocument.findMany).mockResolvedValue([documentScanne] as never);
  vi.mocked(prisma.trichineDocument.update).mockResolvedValue(documentScanne as never);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.trichineFTP.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.emailEntrant.update).mockResolvedValue({ id: 'log-1' } as never);
  vi.mocked(applyPoolResult).mockResolvedValue({ kind: 'ok', pool: null } as never);
  vi.mocked(getFromCellar).mockResolvedValue(Buffer.from('%PDF-1.4 scan'));
});

describe('analyserEmailEntrant', () => {
  test('lit le scan, conserve le texte, rattache et applique le résultat', async () => {
    expediteurEstUnLabo();
    vi.mocked(ocrDocument).mockResolvedValue(
      'Rapport pool P-26-000045\nCommentaires : analyse libératoire négative.'
    );

    const [resultat] = await analyserEmailEntrant(emailEntrant);

    expect(resultat).toMatchObject({
      texte_lu: true,
      pool_reference: 'P-26-000045',
      resultat_lu: 'NEGATIF',
      resultat_applique: true,
    });
    expect(prisma.trichineDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({ texte_source: 'OCR_ALBERT' }),
    });
    expect(prisma.trichineDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({
        pool_id: 'pool-P-26-000045',
        rattachement_source: 'CONTENU_OCR',
      }),
    });
  });

  test('le contenu océrisé corrige un rattachement fait d’après le sujet', async () => {
    expediteurEstUnLabo();
    // Le document était rattaché au pool du sujet ; le rapport, lui, parle d'un autre pool
    vi.mocked(ocrDocument).mockResolvedValue('Rapport pool P-26-000099 — résultat : négatif');

    await analyserEmailEntrant(emailEntrant);

    expect(prisma.trichineDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({ pool_id: 'pool-P-26-000099' }),
    });
  });

  test('sans laboratoire reconnu, le texte est conservé mais rien n’est rattaché', async () => {
    vi.mocked(ocrDocument).mockResolvedValue('Rapport pool P-26-000045 — résultat : négatif');

    const [resultat] = await analyserEmailEntrant(emailEntrant);

    expect(resultat.texte_lu).toBe(true);
    expect(resultat.pool_reference).toBeUndefined();
    expect(applyPoolResult).not.toHaveBeenCalled();
    expect(prisma.trichineDocument.update).toHaveBeenCalledTimes(1);
  });

  test('un document illisible même après OCR sort de la file en ERREUR', async () => {
    expediteurEstUnLabo();
    vi.mocked(ocrDocument).mockResolvedValue(null);

    const [resultat] = await analyserEmailEntrant(emailEntrant);

    expect(resultat.texte_lu).toBe(false);
    expect(prisma.emailEntrant.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({ statut: 'ERREUR' }),
    });
  });

  test('le journal passe à TRAITE et garde le détail de l’OCR à côté de l’existant', async () => {
    expediteurEstUnLabo();
    vi.mocked(ocrDocument).mockResolvedValue('Rapport pool P-26-000045 — résultat : négatif');

    await analyserEmailEntrant(emailEntrant);

    const call = vi.mocked(prisma.emailEntrant.update).mock.calls[0][0] as any;
    expect(call.data.statut).toBe('TRAITE');
    expect(call.data.detail.stored).toBe(1);
    expect(call.data.detail.ocr).toHaveLength(1);
  });

  test('un rapport ambigu est lu mais aucun résultat n’est appliqué', async () => {
    expediteurEstUnLabo();
    vi.mocked(ocrDocument).mockResolvedValue(
      'Rapport pool P-26-000045. Codes : "neg" = négatif "NON_NEG" = non négatif "QI" = quantité insuffisante'
    );

    const [resultat] = await analyserEmailEntrant(emailEntrant);

    expect(resultat.pool_reference).toBe('P-26-000045');
    expect(resultat.rapport_ambigu).toBe(true);
    expect(applyPoolResult).not.toHaveBeenCalled();
  });
});

describe('analyserEmailsEntrantsEnAttente', () => {
  test('ne reprend que les messages en attente d’analyse, du plus ancien au plus récent', async () => {
    vi.mocked(prisma.emailEntrant.findMany).mockResolvedValue([emailEntrant] as never);
    vi.mocked(prisma.trichineDocument.findMany).mockResolvedValue([] as never);

    const traites = await analyserEmailsEntrantsEnAttente();

    expect(traites).toBe(1);
    expect(prisma.emailEntrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { statut: 'A_ANALYSER' },
        orderBy: { recu_at: 'asc' },
        take: 20,
      })
    );
  });
});
