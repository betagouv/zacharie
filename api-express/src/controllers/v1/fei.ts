import express from 'express';
import passport from 'passport';
import { z } from 'zod';
import { catchErrors } from '~/middlewares/errors.ts';
import { apiRateLimit } from '~/middlewares/rate-limit.ts';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { ApiKeyScope, Prisma } from '@prisma/client';
import { RequestWithApiKey } from '~/types/request';
import {
  checkApiKeyIsValidMiddleware,
  getDedicatedEntityLinkedToApiKey,
  getRequestedUser,
  mapFeiForApi,
} from '~/utils/api';
import { getCarcasseAccessWhereForEntity, getCarcasseAccessWhereForUser } from '~/utils/carcasse-access';
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

export type FeiGetByNumeroForApi = {
  ok: boolean;
  data: {
    fei: ReturnType<typeof mapFeiForApi>;
  };
  error?: string;
  message?: string;
};

const CONTACT_SUFFIX =
  "Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.";
const CONTACT_MESSAGE =
  'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.';

// À partir d'un périmètre d'accès carcasse (role/entity-aware) et d'une plage de dates, retourne
// les FEI accessibles (en-tête + carcasses mappées). L'ownership vit sur les carcasses : on part
// donc des carcasses accessibles, on remonte à leurs FEI, puis on reccharge toutes les carcasses
// de ces FEI pour un rendu complet.
async function buildFeisResponse(accessWhere: Prisma.CarcasseWhereInput, dateFrom: string, dateTo: string) {
  const accessibleCarcasses = await prisma.carcasse.findMany({
    where: {
      AND: [
        accessWhere,
        {
          date_mise_a_mort: {
            gte: dayjs(dateFrom).utc(true).toISOString(),
            lte: dayjs(dateTo).utc(true).toISOString(),
          },
          deleted_at: null,
        },
      ],
    },
    select: { fei_numero: true },
  });

  const feiNumeros = [...new Set(accessibleCarcasses.map((c) => c.fei_numero))];
  if (feiNumeros.length === 0) return [];

  const [feis, carcasses] = await Promise.all([
    prisma.fei.findMany({
      where: { numero: { in: feiNumeros }, deleted_at: null },
      select: feiForApiSelect,
    }),
    prisma.carcasse.findMany({
      where: { fei_numero: { in: feiNumeros }, deleted_at: null },
      select: carcasseForApiSelect,
    }),
  ]);

  return feis.map((fei) =>
    mapFeiForApi(
      fei,
      carcasses.filter((carcasse) => carcasse.fei_numero === fei.numero)
    )
  );
}

router.get(
  '/user',
  apiRateLimit,
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.FEI_READ_FOR_USER]),
  catchErrors(
    async (req: RequestWithApiKey, res: express.Response<FeiGetForApi>, next: express.NextFunction) => {
      const querySchema = z.object({
        date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        email: z.string().email("Format d'email invalide"),
      });
      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400);
        return next(
          new Error(`${queryResult.error.issues.map((i) => i.message).join('. ')}. ${CONTACT_SUFFIX}`)
        );
      }

      const { date_from: dateFrom, date_to: dateTo, email } = queryResult.data;
      const { user, error } = await getRequestedUser(req.apiKey, email);
      if (error) {
        res.status(403);
        return next(new Error(error));
      }

      const accessWhere = await getCarcasseAccessWhereForUser(user!);
      if (!accessWhere) {
        res.status(403);
        return next(new Error(`Votre rôle ne permet pas d'accéder à des fiches. ${CONTACT_SUFFIX}`));
      }

      const feis = await buildFeisResponse(accessWhere, dateFrom, dateTo);
      res.status(200).send({ ok: true, data: { feis }, message: CONTACT_MESSAGE });
    }
  )
);

router.get(
  '/user/:fei_numero',
  apiRateLimit,
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.FEI_READ_FOR_USER]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<FeiGetByNumeroForApi>,
      next: express.NextFunction
    ) => {
      const querySchema = z.object({ email: z.string().email("Format d'email invalide") });
      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400);
        return next(
          new Error(`${queryResult.error.issues.map((i) => i.message).join('. ')}. ${CONTACT_SUFFIX}`)
        );
      }

      const paramsSchema = z.object({ fei_numero: z.string() });
      const paramsResult = paramsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        res.status(400);
        return next(
          new Error(`${paramsResult.error.issues.map((i) => i.message).join('. ')}. ${CONTACT_SUFFIX}`)
        );
      }

      const { fei_numero } = paramsResult.data;
      const { user, error } = await getRequestedUser(req.apiKey, queryResult.data.email);
      if (error) {
        res.status(403);
        return next(new Error(error));
      }

      const accessWhere = await getCarcasseAccessWhereForUser(user!);
      if (!accessWhere) {
        res.status(403);
        return next(new Error(`Votre rôle ne permet pas d'accéder à des fiches. ${CONTACT_SUFFIX}`));
      }

      // Accès autorisé si au moins une carcasse de la fiche est dans le périmètre du user.
      const accessibleCarcasse = await prisma.carcasse.findFirst({
        where: { AND: [accessWhere, { fei_numero, deleted_at: null }] },
        select: { zacharie_carcasse_id: true },
      });
      if (!accessibleCarcasse) {
        res.status(404);
        return next(new Error("Fiche d'examen initial non trouvée"));
      }

      const [fei, carcasses] = await Promise.all([
        prisma.fei.findFirst({ where: { numero: fei_numero, deleted_at: null }, select: feiForApiSelect }),
        prisma.carcasse.findMany({
          where: { fei_numero, deleted_at: null },
          select: carcasseForApiSelect,
        }),
      ]);

      if (!fei) {
        res.status(404);
        return next(new Error("Fiche d'examen initial non trouvée"));
      }

      res.status(200).send({
        ok: true,
        data: { fei: mapFeiForApi(fei, carcasses) },
        message: CONTACT_MESSAGE,
      });
    }
  )
);

router.get(
  '/',
  apiRateLimit,
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.FEI_READ_FOR_ENTITY, ApiKeyScope.FEI_READ_FOR_USER]),
  catchErrors(
    async (req: RequestWithApiKey, res: express.Response<FeiGetForApi>, next: express.NextFunction) => {
      const querySchema = z.object({
        date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
      });
      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400);
        return next(
          new Error(`${queryResult.error.issues.map((i) => i.message).join('. ')}. ${CONTACT_SUFFIX}`)
        );
      }

      const { date_from: dateFrom, date_to: dateTo } = queryResult.data;
      const entity = await getDedicatedEntityLinkedToApiKey(req.apiKey);
      if (!entity) {
        res.status(403);
        return next(
          new Error(
            `Votre clé n'est pas autorisée à accéder à des fiches d'examen initial par cette requête. ${CONTACT_SUFFIX}`
          )
        );
      }

      const feis = await buildFeisResponse(getCarcasseAccessWhereForEntity(entity), dateFrom, dateTo);
      res.status(200).send({ ok: true, data: { feis }, message: CONTACT_MESSAGE });
    }
  )
);

export default router;
