import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import userRouter from '~/controllers/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  createBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoChasseurDeal: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use('/user', userRouter);
app.use(sendError);

const chasseur = {
  id: 'user-chasseur',
  email: 'chasseur@example.fr',
  roles: [UserRoles.CHASSEUR],
  activated: true,
};

describe('GET /user/my-ccgs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('ne liste dans userCCGsAdminIds que les CCG dont le chasseur est le créateur (ADMIN)', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      {
        entity_id: 'ccg-cree',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        status: EntityRelationStatus.ADMIN,
        EntityRelatedWithUser: { id: 'ccg-cree', type: EntityTypes.CCG },
      },
      {
        entity_id: 'ccg-rattache',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        EntityRelatedWithUser: { id: 'ccg-rattache', type: EntityTypes.CCG },
      },
    ] as any);

    const res = await request(app).get('/user/my-ccgs').set('x-test-user', JSON.stringify(chasseur));

    expect(res.status).toBe(200);
    expect(res.body.data.userCCGs.map((ccg: { id: string }) => ccg.id)).toEqual(['ccg-cree', 'ccg-rattache']);
    expect(res.body.data.userCCGsAdminIds).toEqual(['ccg-cree']);
  });
});
