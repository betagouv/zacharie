import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import webhooksRouter from '~/controllers/webhooks';
import { ingestInboundEmails } from '~/utils/trichine-inbound-email';

// POST /webhooks/brevo-inbound — porte d'entrée des rapports COFRAC envoyés par email.
// Contrat épinglé ici : rien n'est ingéré sans le Bearer, et Brevo reçoit toujours un 2xx
// dès lors qu'il est authentifié (sinon il rejoue indéfiniment le même message).

vi.mock('~/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/config')>()),
  BREVO_BEARER: 'bearer-de-test',
}));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));
vi.mock('~/utils/trichine-inbound-email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine-inbound-email')>()),
  ingestInboundEmails: vi.fn().mockResolvedValue([]),
}));

const app = express();
app.use(express.json());
app.use('/webhooks', webhooksRouter);

const payload = {
  items: [
    {
      MessageId: '<rapport-1@lvd.fr>',
      From: { Name: 'LVD 44', Address: 'labo@lvd.fr' },
      Subject: 'Rapport pool P-26-000045',
      Attachments: [{ Name: 'rapport.pdf', ContentType: 'application/pdf', DownloadToken: 'token-1' }],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ingestInboundEmails).mockResolvedValue([]);
});

describe('POST /webhooks/brevo-inbound', () => {
  test('sans Authorization → 401, rien n’est ingéré', async () => {
    const response = await request(app).post('/webhooks/brevo-inbound').send(payload);

    expect(response.status).toBe(401);
    expect(ingestInboundEmails).not.toHaveBeenCalled();
  });

  test('avec un mauvais token → 403, rien n’est ingéré', async () => {
    const response = await request(app)
      .post('/webhooks/brevo-inbound')
      .set('Authorization', 'Bearer mauvais-token')
      .send(payload);

    expect(response.status).toBe(403);
    expect(ingestInboundEmails).not.toHaveBeenCalled();
  });

  test('authentifié → 200 et ingestion des messages', async () => {
    vi.mocked(ingestInboundEmails).mockResolvedValue([
      { message_id: '<rapport-1@lvd.fr>', stored: 1, skipped: 0, failed: 0, pool_reference: 'P-26-000045' },
    ]);

    const response = await request(app)
      .post('/webhooks/brevo-inbound')
      .set('Authorization', 'Bearer bearer-de-test')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.data.results[0]).toMatchObject({ stored: 1, pool_reference: 'P-26-000045' });
    expect(ingestInboundEmails).toHaveBeenCalledWith(payload.items);
  });

  test('payload inattendu → 200 quand même (Brevo rejouerait un message illisible)', async () => {
    const response = await request(app)
      .post('/webhooks/brevo-inbound')
      .set('Authorization', 'Bearer bearer-de-test')
      .send({ MessageId: '<sans-items@lvd.fr>' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(false);
    expect(ingestInboundEmails).not.toHaveBeenCalled();
  });
});
