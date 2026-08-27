import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors.ts';
import { apiRateLimit } from '~/middlewares/rate-limit.ts';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { ApiKeyScope, Prisma } from '@prisma/client';
import { z } from 'zod';
import { RequestWithApiKey } from '~/types/request';
import { carcasseForApiSelect, CarcasseGetForApi } from '~/types/carcasse';
import {
  checkApiKeyIsValidMiddleware,
  getDedicatedEntityLinkedToApiKey,
  getRequestedUser,
  mapCarcasseForApi,
} from '~/utils/api';
import { getCarcasseAccessWhere, getCarcasseAccessWhereForEntity } from '~/utils/carcasse-access';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { feiForApiSelect } from '~/types/fei';
dayjs.extend(utc);

export type CarcasseForResponseForApi = {
  ok: boolean;
  data: {
    carcasse: ReturnType<typeof mapCarcasseForApi> | null;
  };
  error?: string;
  message?: string;
};

export type CarcassesForResponseForApi = {
  ok: boolean;
  data: {
    carcasses: Array<ReturnType<typeof mapCarcasseForApi>>;
  };
  error?: string;
  message?: string;
};

const CONTACT_SUFFIX =
  "Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.";
const CONTACT_MESSAGE =
  'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.';

// Charge les FEI (en-tête + relations noms) des carcasses données, puis mappe chaque carcasse
// avec sa FEI. La FEI ne sert qu'aux noms examinateur / premier détenteur.
async function mapCarcassesWithFeis(carcasses: CarcasseGetForApi[]) {
  const feiNumeros = [...new Set(carcasses.map((c) => c.fei_numero))];
  const feis = await prisma.fei.findMany({
    where: { numero: { in: feiNumeros } },
    select: feiForApiSelect,
  });
  const feiByNumero = new Map(feis.map((fei) => [fei.numero, fei]));
  return carcasses.map((carcasse) =>
    mapCarcasseForApi(carcasse, feiByNumero.get(carcasse.fei_numero) ?? null)
  );
}

router.get(
  '/user/:date_mise_a_mort/:numero_bracelet',
  apiRateLimit,
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.CARCASSE_READ_FOR_USER]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<CarcasseForResponseForApi>,
      next: express.NextFunction
    ) => {
      const paramsSchema = z.object({
        date_mise_a_mort: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        numero_bracelet: z.string(),
      });
      const paramsResult = paramsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        res.status(400);
        return next(
          new Error(`${paramsResult.error.issues.map((i) => i.message).join('. ')}. ${CONTACT_SUFFIX}`)
        );
      }

      const querySchema = z.object({ email: z.string().email("Format d'email invalide") });
      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400);
        return next(
          new Error(`${queryResult.error.issues.map((i) => i.message).join('. ')}. ${CONTACT_SUFFIX}`)
        );
      }

      const { user, error } = await getRequestedUser(req.apiKey, queryResult.data.email);
      if (error) {
        res.status(403);
        return next(new Error(error));
      }

      const accessWhere = await getCarcasseAccessWhere(user!);
      if (!accessWhere) {
        res.status(403);
        return next(new Error(`Votre rôle ne permet pas d'accéder à des carcasses. ${CONTACT_SUFFIX}`));
      }

      const carcasse = await prisma.carcasse.findFirst({
        where: {
          AND: [
            accessWhere,
            {
              numero_bracelet: req.params.numero_bracelet,
              date_mise_a_mort: dayjs(req.params.date_mise_a_mort).utc(true).toISOString(),
              deleted_at: null,
            },
          ],
        },
        select: carcasseForApiSelect,
      });

      if (!carcasse) {
        res.status(404);
        return next(new Error('Carcasse non trouvée'));
      }

      const [mapped] = await mapCarcassesWithFeis([carcasse]);
      res.status(200).send({ ok: true, data: { carcasse: mapped }, message: CONTACT_MESSAGE });
    }
  )
);

router.get(
  '/:date_mise_a_mort/:numero_bracelet',
  apiRateLimit,
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.CARCASSE_READ_FOR_ENTITY]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<CarcasseForResponseForApi>,
      next: express.NextFunction
    ) => {
      const paramsSchema = z.object({
        date_mise_a_mort: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        numero_bracelet: z.string(),
      });
      const paramsResult = paramsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        res.status(400);
        return next(
          new Error(`${paramsResult.error.issues.map((i) => i.message).join('. ')}. ${CONTACT_SUFFIX}`)
        );
      }

      const entity = await getDedicatedEntityLinkedToApiKey(req.apiKey);
      if (!entity) {
        res.status(403);
        return next(
          new Error(
            `Votre clé n'est pas autorisée à accéder à des carcasses par cette requête. ${CONTACT_SUFFIX}`
          )
        );
      }

      const carcasse = await prisma.carcasse.findFirst({
        where: {
          AND: [
            getCarcasseAccessWhereForEntity(entity),
            {
              numero_bracelet: req.params.numero_bracelet,
              date_mise_a_mort: dayjs(req.params.date_mise_a_mort).utc(true).toISOString(),
              deleted_at: null,
            },
          ],
        },
        select: carcasseForApiSelect,
      });

      if (!carcasse) {
        res.status(404);
        return next(new Error('Carcasse non trouvée'));
      }

      const [mapped] = await mapCarcassesWithFeis([carcasse]);
      res.status(200).send({ ok: true, data: { carcasse: mapped }, message: CONTACT_MESSAGE });
    }
  )
);

router.get(
  '/user',
  apiRateLimit,
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.CARCASSE_READ_FOR_USER]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<CarcassesForResponseForApi>,
      next: express.NextFunction
    ) => {
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

      const accessWhere = await getCarcasseAccessWhere(user!);
      if (!accessWhere) {
        res.status(403);
        return next(new Error(`Votre rôle ne permet pas d'accéder à des carcasses. ${CONTACT_SUFFIX}`));
      }

      const carcasses = await prisma.carcasse.findMany({
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
        select: carcasseForApiSelect,
      });

      res.status(200).send({
        ok: true,
        data: { carcasses: await mapCarcassesWithFeis(carcasses) },
        message: CONTACT_MESSAGE,
      });
    }
  )
);

router.get(
  '/',
  apiRateLimit,
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.CARCASSE_READ_FOR_ENTITY]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<CarcassesForResponseForApi>,
      next: express.NextFunction
    ) => {
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
            `Votre clé n'est pas autorisée à accéder à des carcasses par cette requête. ${CONTACT_SUFFIX}`
          )
        );
      }

      const carcasses = await prisma.carcasse.findMany({
        where: {
          AND: [
            getCarcasseAccessWhereForEntity(entity),
            {
              date_mise_a_mort: {
                gte: dayjs(dateFrom).utc(true).toISOString(),
                lte: dayjs(dateTo).utc(true).toISOString(),
              },
              deleted_at: null,
            },
          ] as Prisma.CarcasseWhereInput['AND'],
        },
        select: carcasseForApiSelect,
      });

      res.status(200).send({
        ok: true,
        data: { carcasses: await mapCarcassesWithFeis(carcasses) },
        message: CONTACT_MESSAGE,
      });
    }
  )
);

export default router;
