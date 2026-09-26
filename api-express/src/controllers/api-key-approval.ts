import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { ApiKeyApprovalStatus, EntityRelationStatus, EntityRelationType } from '@prisma/client';
import { z } from 'zod';
import { sendWebhook, WebhookEvent } from '~/utils/api';
import { apiKeySafeSelect } from '~/types/api-key';

const approvalBodySchema = z.object({
  status: z.enum(Object.values(ApiKeyApprovalStatus) as [ApiKeyApprovalStatus, ...ApiKeyApprovalStatus[]]),
});

router.post(
  '/:id',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    const bodyResult = approvalBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).send({ ok: false, data: null, error: 'Invalid status' });
      return;
    }
    const { status } = bodyResult.data;
    const approval = await prisma.apiKeyApprovalByUserOrEntity.findUnique({
      where: {
        id: req.params.id,
      },
    });
    if (!approval) {
      res.status(404).send({ ok: false, data: null, error: 'Approval not found' });
      return;
    }
    if (!!approval.user_id && approval.user_id !== user.id) {
      res
        .status(403)
        .send({ ok: false, data: null, error: 'You are not authorized to update this approval' });
      return;
    }
    if (approval.entity_id) {
      const entityRelatedToUser = await prisma.entityAndUserRelations.findFirst({
        where: {
          owner_id: user.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          entity_id: approval.entity_id,
          status: { in: [EntityRelationStatus.MEMBER, EntityRelationStatus.ADMIN] },
          deleted_at: null,
        },
      });
      if (!entityRelatedToUser) {
        res
          .status(403)
          .send({ ok: false, data: null, error: 'You are not authorized to update this approval' });
        return;
      }
    }

    const updatedApproval = await prisma.apiKeyApprovalByUserOrEntity.update({
      where: {
        id: req.params.id,
      },
      data: {
        status,
      },
      include: {
        ApiKey: {
          select: apiKeySafeSelect,
        },
      },
    });

    let event: WebhookEvent | undefined = undefined;
    if (status === ApiKeyApprovalStatus.APPROVED) event = 'USER_APPROVED_ACCESS';
    if (status === ApiKeyApprovalStatus.REJECTED) event = 'USER_REJECTED_ACCESS';

    if (event) {
      // le webhook a besoin de la clé complète (private_key pour l'en-tête Authorization), jamais renvoyée au client
      const approvalWithFullApiKey = await prisma.apiKeyApprovalByUserOrEntity.findUniqueOrThrow({
        where: { id: updatedApproval.id },
        include: { ApiKey: true },
      });
      await sendWebhook(user.id, event, { userApprovals: [approvalWithFullApiKey] });
    }

    res.status(200).send({ ok: true, data: { apiKeyApproval: updatedApproval }, error: null });
  })
);
export default router;
