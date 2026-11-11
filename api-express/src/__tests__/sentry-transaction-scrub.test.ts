import express from 'express';
import request from 'supertest';
import { describe, test, expect } from 'vitest';
import * as Sentry from '@sentry/node';
import { SENTRY_SCRUB_OPTIONS } from '~/third-parties/sentry';

// Les transactions de performance (tracesSampleRate) joignent le body et les en-têtes de la requête,
// et `beforeSend` ne s'applique qu'aux erreurs : sans `beforeSendTransaction`, un fichier déposé
// partirait en entier chez Sentry.

describe('Sentry — transactions de performance', () => {
  test("n'envoient ni le contenu d'un fichier déposé ni l'en-tête Authorization", async () => {
    const envelopes: string[] = [];
    const app = express();
    Sentry.init({
      dsn: 'https://public@o0.ingest.sentry.io/0',
      transport: () => ({
        send: async (envelope) => {
          envelopes.push(JSON.stringify(envelope));
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
      ],
      tracesSampleRate: 1,
      ...SENTRY_SCRUB_OPTIONS,
    });
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
    app.use(express.json());
    app.post('/laboratoire/pool/pool-1/documents', (_req, res) => {
      res.send({ ok: true });
    });

    await request(app)
      .post('/laboratoire/pool/pool-1/documents')
      .set('Authorization', 'Bearer jeton-secret')
      .send({ file: { content_type: 'application/pdf', content: 'CONTENU-SECRET-BASE64' } });
    await Sentry.flush(2000);
    await Sentry.close();

    const transactions = envelopes.filter((envelope) => envelope.includes('"type":"transaction"'));
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).not.toContain('CONTENU-SECRET-BASE64');
    expect(transactions[0]).toContain('[contenu masqué : 21 caractères]');
    expect(transactions[0]).not.toContain('jeton-secret');
  });
});
