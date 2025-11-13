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

router.get(
  '/access-token/:access_token',
  apiRateLimit,
  catchErrors(async (req: RequestWithApiKey, res: express.Response, next: express.NextFunction) => {
    const { access_token } = req.params;
    const apiKey = await prisma.apiKey.findUnique({
      where: { access_token: access_token },
    });
    if (!apiKey) {
      res
        .status(404)
        .send({ ok: false, data: null, error: 'Le lien est invalide. Veuillez nous contacter.' });
      return;
    }
    if (apiKey.access_token_read_at) {
      res.status(400).send({ ok: false, data: null, error: 'Le lien est expiré. Veuillez nous contacter.' });
      return;
    }
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { access_token_read_at: new Date() },
    });
    res.status(200).send({
      ok: true,
      data: { api_key: apiKey.private_key, context_creation: apiKey.slug_for_context },
      message: `Voici votre clé privée. Veuillez la conserver en toute sécurité. Une fois ouvert, ce lien ne sera plus valide. Si vous avez perdu votre clé et que vous avez besoin d'un nouveau lien, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact. Voici aussi la valeur du champ \`context_creation\` que vous retrouverez dans chaque fiche créée via cette clé API.`,
    });
  }),
);

export default router;
