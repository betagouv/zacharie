import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import trichineAdminRouter from '~/controllers/admin/trichine';
import adminRouter from '~/controllers/admin';
import { analyserEmailEntrant } from '~/utils/trichine-inbound-ocr';

// Section trichine de l'admin : journal des emails entrants, relance d'analyse, changement de
// statut, et les listes de diagnostic. Contrat épinglé ici : ces routes vivent derrière le garde
// admin, les listes sont bornées, et un statut inventé est refusé.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));
vi.mock('~/utils/trichine-inbound-ocr', () => ({
  analyserEmailEntrant: vi.fn().mockResolvedValue([]),
}));

const app = express();
app.use(express.json());
app.use('/admin', trichineAdminRouter);

// Application réelle : le routeur admin applique son authentification avant de monter ses sous-routeurs
const appAvecGarde = express();
appAvecGarde.use(express.json());
appAvecGarde.use('/admin', adminRouter);

const emailEntrant = {
  id: 'log-1',
  message_id: '<rapport-1@lvd.fr>',
  expediteur: 'labo@lvd.fr',
  statut: 'ERREUR',
  detail: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.emailEntrant.findMany).mockResolvedValue([emailEntrant] as never);
  vi.mocked(prisma.emailEntrant.count).mockResolvedValue(1 as never);
  vi.mocked(prisma.emailEntrant.findUnique).mockResolvedValue(emailEntrant as never);
  vi.mocked(prisma.emailEntrant.update).mockResolvedValue({ ...emailEntrant, statut: 'A_ANALYSER' } as never);
  vi.mocked(analyserEmailEntrant).mockResolvedValue([]);
});

describe('garde admin', () => {
  test('le journal n’est pas accessible sans authentification admin', async () => {
    const res = await request(appAvecGarde).get('/admin/trichine/emails-entrants');

    expect(res.status).toBe(401);
    expect(prisma.emailEntrant.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /admin/trichine/emails-entrants', () => {
  test('renvoie les messages du plus récent au plus ancien', async () => {
    const res = await request(app).get('/admin/trichine/emails-entrants');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(prisma.emailEntrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { recu_at: 'desc' }, take: 200 })
    );
  });

  test('plafonne ce que le client peut demander', async () => {
    await request(app).get('/admin/trichine/emails-entrants?limit=5000');

    const args = vi.mocked(prisma.emailEntrant.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(500);
  });

  test('une limite négative ne renverse pas la requête', async () => {
    await request(app).get('/admin/trichine/emails-entrants?limit=-10');

    const args = vi.mocked(prisma.emailEntrant.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(1);
  });
});

describe('listes de diagnostic', () => {
  test('les documents portent leur rattachement et leur provenance', async () => {
    vi.mocked(prisma.trichineDocument.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        type: 'RAPPORT_COFRAC',
        source: 'EMAIL',
        nom_fichier: 'rapport.pdf',
        date_ajout: new Date('2026-09-04'),
        rattachement_source: 'CONTENU_OCR',
        rattachement_indice: 'NUMEROS_BRACELET',
        texte_source: 'OCR_ALBERT',
        texte_extrait: 'texte lu',
        email_expediteur: 'labo@lvd.fr',
        email_sujet: 'Rapport',
        TrichinePool: { reference_pool: 'P-26-000045' },
        TrichineFTP: null,
        AjouteParUser: null,
      },
    ] as never);

    const res = await request(app).get('/admin/trichine/documents');

    expect(res.status).toBe(200);
    expect(res.body.data.documents[0]).toMatchObject({
      pool_reference: 'P-26-000045',
      rattachement_indice: 'NUMEROS_BRACELET',
      longueur_texte: 8,
      depose_par: null,
    });
  });

  test('le texte lu d’un document est servi à part, et 404 s’il n’existe pas', async () => {
    vi.mocked(prisma.trichineDocument.findUnique).mockResolvedValue(null as never);

    const res = await request(app).get('/admin/trichine/document/inconnu/texte');

    expect(res.status).toBe(404);
  });

  test('les pools listent leurs bracelets et leur laboratoire', async () => {
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([
      {
        id: 'pool-1',
        reference_pool: 'P-26-000045',
        type: 'INITIAL',
        statut: 'A_COMPLETER',
        resultat_analyse: null,
        parasite_identifie: null,
        date_constitution: new Date('2026-09-01'),
        date_fin_analyse: null,
        TrichineEchantillons: [
          { Carcasse: { numero_bracelet: '6940', espece: 'Sanglier' } },
          { Carcasse: { numero_bracelet: '7542', espece: 'Sanglier' } },
        ],
        TrichinePoolFTPs: [
          {
            reference_labo: 'LVD-1',
            TrichineFTP: {
              numero_fiche: 'F-26-000012',
              DestinataireEntity: { nom_d_usage: 'LVD 44', raison_sociale: null, is_lnr: false },
            },
          },
        ],
      },
    ] as never);

    const res = await request(app).get('/admin/trichine/pools');

    expect(res.body.data.pools[0]).toMatchObject({
      reference_pool: 'P-26-000045',
      nb_echantillons: 2,
      bracelets: '6940, 7542',
      especes: 'Sanglier',
      laboratoire: 'LVD 44',
      ftp_numero: 'F-26-000012',
    });
  });
});

describe('POST /admin/trichine/emails-entrants/:id/analyser', () => {
  test('relance l’analyse du message', async () => {
    vi.mocked(analyserEmailEntrant).mockResolvedValue([
      { document_id: 'doc-1', nom_fichier: 'rapport.pdf', texte_lu: true, pool_reference: 'P-26-000045' },
    ]);

    const res = await request(app).post('/admin/trichine/emails-entrants/log-1/analyser');

    expect(res.status).toBe(200);
    expect(res.body.data.ocr[0].pool_reference).toBe('P-26-000045');
    expect(analyserEmailEntrant).toHaveBeenCalledWith(expect.objectContaining({ id: 'log-1' }));
  });

  test('404 sur un message inconnu, sans rien analyser', async () => {
    vi.mocked(prisma.emailEntrant.findUnique).mockResolvedValue(null as never);

    const res = await request(app).post('/admin/trichine/emails-entrants/inconnu/analyser');

    expect(res.status).toBe(404);
    expect(analyserEmailEntrant).not.toHaveBeenCalled();
  });
});

describe('PUT /admin/trichine/emails-entrants/:id/statut', () => {
  test('remet un message dans la file d’analyse', async () => {
    const res = await request(app)
      .put('/admin/trichine/emails-entrants/log-1/statut')
      .send({ statut: 'A_ANALYSER' });

    expect(res.status).toBe(200);
    expect(prisma.emailEntrant.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: { statut: 'A_ANALYSER' },
    });
  });

  test('refuse un statut inventé', async () => {
    const res = await request(app)
      .put('/admin/trichine/emails-entrants/log-1/statut')
      .send({ statut: 'PEUT_ETRE' });

    expect(res.status).toBe(400);
    expect(prisma.emailEntrant.update).not.toHaveBeenCalled();
  });
});
