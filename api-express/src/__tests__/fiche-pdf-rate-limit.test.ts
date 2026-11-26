import express from 'express';
import request from 'supertest';
import { test, expect, vi, afterAll } from 'vitest';
import { UserRoles } from '@prisma/client';
import prisma from '~/prisma';
import fichePdfRouter from '~/controllers/fiche-pdf';

// En production, le téléchargement de l'extrait PDF est limité à 10 par minute et par utilisateur
// (le rendu bloque le serveur). La limite est désactivée en NODE_ENV=test : on simule la production
// avant l'import du limiteur (sa limite est lue au chargement).
const initialNodeEnv = vi.hoisted(() => {
  const valeur = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  return valeur;
});
afterAll(() => {
  process.env.NODE_ENV = initialNodeEnv;
});

vi.mock('~/templates/get-fiche-extrait-pdf', () => ({
  getFicheExtraitPdfBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')),
}));
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

test('production : 10 téléchargements par minute et par utilisateur, 429 au-delà', async () => {
  const app = express();
  app.use('/fiche-pdf', fichePdfRouter);

  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-1' } as any]);
  vi.mocked(prisma.carcasse.count).mockResolvedValue(1);
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
    { zacharie_carcasse_id: 'c-1', numero_bracelet: 'B-1', svi_entity_id: null } as any,
  ]);
  vi.mocked(prisma.fei.findFirst).mockResolvedValue({
    numero: 'F',
    examinateur_initial_user_id: null,
  } as any);
  vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
  const user = (id: string) => JSON.stringify({ id, roles: [UserRoles.SVI], activated: true });

  const statuts: Array<number> = [];
  for (let i = 0; i < 10; i++) {
    statuts.push((await request(app).get('/fiche-pdf/F/T').set('x-test-user', user('a'))).status);
  }
  expect(statuts).toEqual(Array(10).fill(200));
  const refus = await request(app).get('/fiche-pdf/F/T').set('x-test-user', user('a'));
  expect(refus.status).toBe(429);
  expect(refus.body.error).toBe('Trop de téléchargements, veuillez réessayer dans une minute.');
  // la limite est par utilisateur : un autre compte n'est pas bloqué
  expect((await request(app).get('/fiche-pdf/F/T').set('x-test-user', user('b'))).status).toBe(200);
});
