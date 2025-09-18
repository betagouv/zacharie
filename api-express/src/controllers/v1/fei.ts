import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors.ts';
import type { FeiResponse, FeisResponse, FeisDoneResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import {
  ApiKeyApprovalStatus,
  ApiKeyScope,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  Prisma,
  UserRoles,
} from '@prisma/client';
import { RequestWithApiKeyLog } from '~/types/request';
import { carcasseForApiSelect } from '~/types/carcasse';
import { getDedicatedEntityLinkedToApiKey, mapFeiForApi } from '~/utils/api';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { feiForApiSelect } from '~/types/fei';
dayjs.extend(utc);

export type FeiGetForApi = {
  ok: boolean;
  data: {
    feis: Array<ReturnType<typeof mapFeiForApi>>;
  };
  error?: string;
  message?: string;
};

router.get(
  '/',
  passport.authenticate('apiKeyLog', { session: false }),
  catchErrors(
    async (req: RequestWithApiKeyLog, res: express.Response<FeiGetForApi>, next: express.NextFunction) => {
      const dateFrom = req.query.date_from as string; // format: 2025-09-17
      const dateTo = req.query.date_to as string; // format: 2025-09-17

      const apiKeyLog = req.apiKeyLog;
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: apiKeyLog?.api_key_id },
      });
      if (!apiKey.active || (apiKey.expires_at && apiKey.expires_at < new Date())) {
        res.status(403).send({
          ok: false,
          data: { feis: [] },
          error:
            "Votre clé n'est pas active. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
        });
        return;
      }
      if (
        !apiKey.scopes.includes(ApiKeyScope.FEI_READ_FOR_USER) &&
        !apiKey.scopes.includes(ApiKeyScope.CARCASSE_READ_FOR_ENTITY)
      ) {
        res.status(403).send({
          ok: false,
          data: { feis: [] },
          error:
            "Votre clé n'est pas autorisée à accéder aux fiches d'examen initial. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
        });
        return;
      }
      const entity = await getDedicatedEntityLinkedToApiKey(apiKey);
      if (!entity) {
        res.status(403).send({
          ok: false,
          data: { feis: [] },
          error: `Votre clé n'est pas autorisée à accéder à des fiches d'examen initial par cette requête. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        });
        return;
      }

      const feiQuery: Prisma.FeiFindManyArgs = {
        where: {
          date_mise_a_mort: {
            gte: dayjs(dateFrom).utc(true).toISOString(),
            lte: dayjs(dateTo).utc(true).toISOString(),
          },
        },
      };
      if (entity.type === EntityTypes.PREMIER_DETENTEUR) {
        feiQuery.where.premier_detenteur_entity_id = entity.id;
      } else if (entity.type === EntityTypes.SVI) {
        feiQuery.where.svi_entity_id = entity.id;
      } else {
        feiQuery.where.CarcasseIntermediaire = {
          some: {
            intermediaire_entity_id: entity.id,
          },
        };
      }

      const feis = await prisma.fei.findMany({
        where: {
          date_mise_a_mort: {
            gte: dayjs(dateFrom).utc(true).toISOString(),
            lte: dayjs(dateTo).utc(true).toISOString(),
          },
        },
        select: feiForApiSelect,
      });

      res.status(200).send({
        ok: true,
        data: { feis: feis.map(mapFeiForApi) },
        message:
          'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.',
      });
    },
  ),
);

export default router;
