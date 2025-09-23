import express from 'express';
import passport from 'passport';
import { z } from 'zod';
import { catchErrors } from '~/middlewares/errors.ts';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { ApiKeyApprovalStatus, ApiKeyScope } from '@prisma/client';
import { RequestWithApiKey } from '~/types/request';
import { checkApiKeyIsValidMiddleware } from '~/utils/api';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

export type ApprovalRequestForApi = {
  ok: boolean;
  data: {
    approvalStatus: ApiKeyApprovalStatus;
  };
  error?: string;
  message?: string;
};

router.post(
  '/user',
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.CARCASSE_READ_FOR_USER, ApiKeyScope.FEI_READ_FOR_USER]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<ApprovalRequestForApi>,
      next: express.NextFunction,
    ) => {
      const bodySchema = z.object({
        email: z.string().email("Format d'email invalide"),
      });

      const bodyResult = bodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        const errors = bodyResult.error.issues.map((i) => i.message).join('. ');
        const error = new Error(
          `${errors}. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const { email } = bodyResult.data;

      const user = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      if (!user) {
        const error = new Error(
          `L'email ${email} n'est pas trouvé dans la base de données. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const approval = await prisma.apiKeyApprovalByUserOrEntity.upsert({
        where: {
          api_key_id_user_id: {
            api_key_id: req.apiKey.id,
            user_id: user.id,
          },
        },
        update: {},
        create: {
          api_key_id: req.apiKey.id,
          user_id: user.id,
          status: ApiKeyApprovalStatus.PENDING,
        },
      });

      res.status(200).send({
        ok: true,
        data: {
          approvalStatus: approval.status,
        },
        message:
          "La demande d'approbation a été envoyée. Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
      });
    },
  ),
);

router.post(
  '/entite',
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.FEI_READ_FOR_ENTITY, ApiKeyScope.CARCASSE_READ_FOR_ENTITY]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<ApprovalRequestForApi>,
      next: express.NextFunction,
    ) => {
      const bodySchema = z.object({
        // 14 numbers
        siret: z.string().regex(/^\d{14}$/, 'Format de SIRET invalide'),
      });

      const bodyResult = bodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        const errors = bodyResult.error.issues.map((i) => i.message).join('. ');
        const error = new Error(
          `${errors}. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const { siret } = bodyResult.data;

      const entity = await prisma.entity.findFirst({
        where: {
          siret,
        },
      });

      if (!entity) {
        const error = new Error(
          `Le SIRET ${siret} n'est pas trouvé dans la base de données. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const approval = await prisma.apiKeyApprovalByUserOrEntity.upsert({
        where: {
          api_key_id_entity_id: {
            api_key_id: req.apiKey.id,
            entity_id: entity.id,
          },
        },
        update: {},
        create: {
          api_key_id: req.apiKey.id,
          entity_id: entity.id,
          status: ApiKeyApprovalStatus.PENDING,
        },
      });

      res.status(200).send({
        ok: true,
        data: {
          approvalStatus: approval.status,
        },
        message:
          "La demande d'approbation a été envoyée. Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
      });
    },
  ),
);

export default router;
