import express from 'express';
import request from 'supertest';
import { describe, test, expect } from 'vitest';
import { authRateLimit, createAuthIpRateLimit } from '~/middlewares/auth-rate-limit';

const LIMIT = 3;

function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/user/login', createAuthIpRateLimit({ limit: LIMIT, skip: () => false }), authRateLimit);
  app.post('/user/login', (_req, res) => {
    res.status(400).send({ ok: false, error: 'Email ou mot de passe incorrect' });
  });
  return app;
}

function login(app: express.Express, ip: string, email: string) {
  return request(app)
    .post('/user/login')
    .set('X-Forwarded-For', ip)
    .send({ email, passwordUser: 'motdepasse-courant' });
}

describe('limiteur des routes d’authentification par IP', () => {
  test('une même IP qui change d’email à chaque essai est bloquée au-delà de la limite', async () => {
    const app = buildApp();
    for (let i = 0; i < LIMIT; i++) {
      const res = await login(app, '203.0.113.10', `victime-${i}@example.fr`);
      expect(res.status).toBe(400);
    }
    const res = await login(app, '203.0.113.10', 'victime-suivante@example.fr');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Trop de tentatives, veuillez réessayer dans 15 minutes.');
  });

  test('une autre IP n’est pas freinée par les essais de la première', async () => {
    const app = buildApp();
    for (let i = 0; i <= LIMIT; i++) {
      await login(app, '203.0.113.20', `victime-${i}@example.fr`);
    }
    const res = await login(app, '198.51.100.7', 'utilisateur@example.fr');
    expect(res.status).toBe(400);
  });

  test('les connexions réussies ne comptent pas quand skipSuccessfulRequests est posé', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use(
      '/user/login',
      createAuthIpRateLimit({ limit: LIMIT, skip: () => false, skipSuccessfulRequests: true })
    );
    app.post('/user/login', (_req, res) => {
      res.status(200).send({ ok: true });
    });
    for (let i = 0; i <= LIMIT; i++) {
      const res = await login(app, '203.0.113.30', `utilisateur-${i}@example.fr`);
      expect(res.status).toBe(200);
    }
  });

  test('chaque route a son propre compteur', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use('/user/signup', createAuthIpRateLimit({ limit: LIMIT, skip: () => false }));
    app.use('/user/login', createAuthIpRateLimit({ limit: LIMIT, skip: () => false }));
    app.post(['/user/signup', '/user/login'], (_req, res) => {
      res.status(400).send({ ok: false });
    });
    for (let i = 0; i <= LIMIT; i++) {
      await request(app).post('/user/signup').set('X-Forwarded-For', '203.0.113.40').send({});
    }
    const res = await login(app, '203.0.113.40', 'utilisateur@example.fr');
    expect(res.status).toBe(400);
  });
});
