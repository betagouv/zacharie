import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import trichineAdminRouter from '~/controllers/admin/trichine';
import adminRouter from '~/controllers/admin';

// Section trichine de l'admin : les listes de diagnostic. Contrat épinglé ici : ces routes vivent
// derrière le garde admin, et les listes sont bornées.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

const app = express();
app.use(express.json());
app.use('/admin', trichineAdminRouter);

// Application réelle : le routeur admin applique son authentification avant de monter ses sous-routeurs
const appAvecGarde = express();
appAvecGarde.use(express.json());
appAvecGarde.use('/admin', adminRouter);

const document = {
  id: 'doc-1',
  type: 'RAPPORT_COFRAC',
  source: 'UPLOAD',
  nom_fichier: null as string | null,
  date_ajout: new Date('2026-09-04'),
  TrichinePool: { reference_pool: 'P-26-02-0045' },
  TrichineFTP: null as { numero_fiche: string } | null,
  AjouteParUser: { prenom: 'Lucie', nom_de_famille: 'Labo', email: 'labo@lvd.fr' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.trichineDocument.findMany).mockResolvedValue([document] as never);
});

describe('garde admin', () => {
  test('les listes ne sont pas accessibles sans authentification admin', async () => {
    const res = await request(appAvecGarde).get('/admin/trichine/documents');

    expect(res.status).toBe(401);
    expect(prisma.trichineDocument.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /admin/trichine/documents', () => {
  test('renvoie les documents du plus récent au plus ancien, avec leur auteur', async () => {
    const res = await request(app).get('/admin/trichine/documents');

    expect(res.status).toBe(200);
    expect(prisma.trichineDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { date_ajout: 'desc' }, take: 200 })
    );
    expect(res.body.data.documents[0]).toMatchObject({
      pool_reference: 'P-26-02-0045',
      depose_par: 'Lucie Labo',
    });
  });

  test('plafonne ce que le client peut demander', async () => {
    await request(app).get('/admin/trichine/documents?limit=5000');

    const args = vi.mocked(prisma.trichineDocument.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(500);
  });

  test('une limite négative ne renverse pas la requête', async () => {
    await request(app).get('/admin/trichine/documents?limit=-10');

    const args = vi.mocked(prisma.trichineDocument.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(1);
  });
});

describe('listes de diagnostic', () => {
  test('les pools listent leurs bracelets et leur laboratoire', async () => {
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([
      {
        id: 'pool-1',
        reference_pool: 'P-26-02-0045',
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
        Aliases: [{ reference: 'SVI-12' }, { reference: 'LVD-1' }],
        TrichinePoolFTPs: [
          {
            TrichineFTP: {
              numero_fiche: 'F-26-02-0012',
              DestinataireEntity: { nom_d_usage: 'LVD 44', raison_sociale: null, is_lnr: false },
            },
          },
        ],
      },
    ] as never);

    const res = await request(app).get('/admin/trichine/pools');

    expect(res.body.data.pools[0]).toMatchObject({
      reference_pool: 'P-26-02-0045',
      nb_echantillons: 2,
      bracelets: '6940, 7542',
      especes: 'Sanglier',
      laboratoire: 'LVD 44',
      ftp_numero: 'F-26-02-0012',
      aliases: 'SVI-12, LVD-1',
    });
  });
});
