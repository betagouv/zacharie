import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import {
  createBrevoContact,
  linkBrevoCompanyToContact,
  sendEmail,
  unlinkBrevoCompanyToContact,
  updateBrevoChasseurDeal,
  updateBrevoContact,
} from '~/third-parties/brevo';
import { capture } from '~/third-parties/sentry';
import createUserId from '~/utils/createUserId';
import { comparePassword, hashPassword } from '~/service/crypto';
import { userFeiSelect, type UserForFei } from '~/types/user';
import type {
  UserConnexionResponse,
  UserMyRelationsResponse,
  UserForFeiResponse,
  UserEntityResponse,
} from '~/types/responses';
import type { EntityWithUserRelation } from '~/types/entity';
import {
  EntityRelationType,
  EntityTypes,
  Prisma,
  Entity,
  ETGAndEntityRelations,
  User,
  UserNotifications,
  UserRelationType,
  UserRoles,
  FeiOwnerRole,
  UserEtgRoles,
  EntityRelationStatus,
} from '@prisma/client';
import { authorizeUserOrAdmin } from '~/utils/authorizeUserOrAdmin.server';
import { cookieOptions, JWT_MAX_AGE, logoutCookieOptions } from '~/utils/cookie';
import sendNotificationToUser from '~/service/notifications';
import { SECRET } from '~/config';
import { autoActivatePremierDetenteur, hasAllRequiredFields } from '~/utils/user';
// import { refreshMaterializedViews } from '~/utils/refreshMaterializedViews';

router.post(
  '/:id',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
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
    if (!!approval.entity_id) {
      const entityRelatedToUser = await prisma.entityAndUserRelations.findFirst({
        where: {
          owner_id: user.id,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          entity_id: approval.entity_id,
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
        status: req.body.status,
      },
    });

    res.status(200).send({ ok: true, data: { apiKeyApproval: updatedApproval }, error: null });
  }),
);
export default router;
