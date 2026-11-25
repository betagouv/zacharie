import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import utilsRouter from '~/controllers/utils';
import { createBrevoContactFromContactForm, sendEmail } from '~/third-parties/brevo';

vi.mock('~/third-parties/brevo', () => ({
  createBrevoContactFromContactForm: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// POST /contact — formulaire de contact public (sans authentification)

const app = express();
app.use(express.json());
app.use('/', utilsRouter);

const validBody = {
  nom_de_famille: 'Dupont',
  prenom: 'Jean',
  email: 'jean.dupont@example.fr',
  telephone: '0612345678',
  object: 'Question',
  message: 'Bonjour',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /contact', () => {
  test('body valide → 200, contact Brevo créé et email envoyé à contact@ uniquement', async () => {
    const res = await request(app).post('/contact').send(validBody);
    expect(res.status).toBe(200);
    expect(createBrevoContactFromContactForm).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0].emails).toEqual(['contact@zacharie.beta.gouv.fr']);
  });

  test('honeypot rempli → 200 sans rien envoyer', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ ...validBody, job: 'bot' });
    expect(res.status).toBe(200);
    expect(createBrevoContactFromContactForm).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test.each([
    ['email invalide', { ...validBody, email: 'pas-un-email' }],
    ['email manquant', { ...validBody, email: undefined }],
    ['message vide', { ...validBody, message: '   ' }],
    ['message trop long', { ...validBody, message: 'a'.repeat(5001) }],
    ['nom trop long', { ...validBody, nom_de_famille: 'a'.repeat(101) }],
    ['champ non textuel', { ...validBody, prenom: { $gt: '' } }],
  ])('%s → 400 sans rien envoyer', async (_label, body) => {
    const res = await request(app).post('/contact').send(body);
    expect(res.status).toBe(400);
    expect(createBrevoContactFromContactForm).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('au-delà de 5 envois par heure depuis la même IP → 429', async () => {
    // le limiteur est désactivé en NODE_ENV=test
    vi.stubEnv('NODE_ENV', 'development');
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/contact').send(validBody);
      expect(res.status).toBe(200);
    }
    const res = await request(app).post('/contact').send(validBody);
    expect(res.status).toBe(429);
    expect(sendEmail).toHaveBeenCalledTimes(5);
  });
});
