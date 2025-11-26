import express from 'express';
import passport from 'passport';
import { z } from 'zod';
import { catchErrors } from '~/middlewares/errors.ts';
import crypto from 'crypto';
import { apiRateLimit } from '~/middlewares/rate-limit.ts';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { ApiKeyApprovalStatus, ApiKeyScope } from '@prisma/client';
import { RequestWithApiKey } from '~/types/request';
import { checkApiKeyIsValidMiddleware } from '~/utils/api';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

export type AccessTokenForApi = {
  ok: boolean;
  data: {
    accessToken: string;
  };
  error?: string;
  message?: string;
};

router.post(
  '/user',
  apiRateLimit,
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.CARCASSE_READ_FOR_USER, ApiKeyScope.FEI_READ_FOR_USER]),
  catchErrors(
    async (req: RequestWithApiKey, res: express.Response<AccessTokenForApi>, next: express.NextFunction) => {
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

      const user = await prisma.user.findFirst({
        where: {
          email: email,
          deleted_at: null,
        },
      });

      if (!user) {
        const error = new Error(
          `L'email ${email} n'est pas trouvé dans la base de données. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const approval = await prisma.apiKeyApprovalByUserOrEntity.findUnique({
        where: {
          api_key_id_user_id: {
            api_key_id: req.apiKey.id,
            user_id: user.id,
          },
        },
      });

      if (!approval) {
        const error = new Error(
          `Vous n'avez pas fait de demande d'accès pour cet email. Faites un appel POST /approval-request/user avec l'email de l'utilisateur auparavant. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      if (approval.status !== ApiKeyApprovalStatus.APPROVED) {
        const error = new Error(
          `Votre demande d'accès n'a pas été approuvée. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const accessToken = crypto.randomBytes(32).toString('hex');
      await prisma.apiKeyApprovalByUserOrEntity.update({
        where: { id: approval.id },
        data: { access_token: accessToken, access_token_created_at: new Date() },
      });

      res.status(200).send({
        ok: true,
        data: {
          accessToken: accessToken,
        },
        message:
          "L'access token a été créé. Vous pouvez l'utiliser en paramètre d'URL pour connecter l'utilisateur à son compte Zacharie. Par exemple https://zacharie.beta.gouv.fr/app/nouvelle-fiche?access_token={accessToken}&date_mise_a_mort=2025-01-01&commune_mise_a_mort=Paris&heure_mise_a_mort_premiere_carcasse=10:00&heure_evisceration_derniere_carcasse=12:00",
      });
    },
  ),
);

export default router;
