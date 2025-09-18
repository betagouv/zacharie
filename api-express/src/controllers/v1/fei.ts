import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors.ts';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { ApiKeyScope, EntityTypes, Prisma } from '@prisma/client';
import { RequestWithApiKey } from '~/types/request';
import { checkApiKeyIsValidMiddleware, getDedicatedEntityLinkedToApiKey, mapFeiForApi } from '~/utils/api';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { feiForApiSelect } from '~/types/fei';
import { carcasseForApiSelect } from '~/types/carcasse';
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
  checkApiKeyIsValidMiddleware([ApiKeyScope.FEI_READ_FOR_ENTITY]),
  catchErrors(
    async (req: RequestWithApiKey, res: express.Response<FeiGetForApi>, next: express.NextFunction) => {
      const dateFrom = req.query.date_from as string; // format: 2025-09-17
      const dateTo = req.query.date_to as string; // format: 2025-09-17
      const apiKey = req.apiKey;

      const entity = await getDedicatedEntityLinkedToApiKey(apiKey);
      if (!entity) {
        const error = new Error(
          `Votre clé n'est pas autorisée à accéder à des fiches d'examen initial par cette requête. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(403);
        return next(error);
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

      const carcasses = await prisma.carcasse.findMany({
        where: {
          fei_numero: {
            in: feis.map((fei) => fei.numero),
          },
        },
        select: carcasseForApiSelect,
      });

      res.status(200).send({
        ok: true,
        data: {
          feis: feis.map((fei) =>
            mapFeiForApi(
              fei,
              carcasses.filter((carcasse) => carcasse.fei_numero === fei.numero),
            ),
          ),
        },
        message:
          'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.',
      });
    },
  ),
);

export default router;
