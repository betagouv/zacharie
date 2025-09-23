import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors.ts';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { ApiKeyScope, EntityTypes, Prisma, UserRoles } from '@prisma/client';
import { z } from 'zod';
import { RequestWithApiKey } from '~/types/request';
import { carcasseForApiSelect } from '~/types/carcasse';
import {
  checkApiKeyIsValidMiddleware,
  getDedicatedEntityLinkedToApiKey,
  getRequestedUser,
  mapCarcasseForApi,
} from '~/utils/api';
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

router.get(
  '/user/:date_mise_a_mort/:numero_bracelet',
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.CARCASSE_READ_FOR_USER]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<CarcasseForResponseForApi>,
      next: express.NextFunction,
    ) => {
      const paramsSchema = z.object({
        date_mise_a_mort: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        numero_bracelet: z.string(),
      });

      const paramsResult = paramsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        const errors = paramsResult.error.issues.map((i) => i.message).join('. ');
        const error = new Error(
          `${errors}. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const querySchema = z.object({
        // simple regex, just check the @
        email: z.string().email("Format d'email invalide"),
      });

      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success) {
        const errors = queryResult.error.issues.map((i) => i.message).join('. ');
        const error = new Error(
          `${errors}. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const apiKey = req.apiKey;
      const { user, error } = await getRequestedUser(apiKey, queryResult.data.email);
      if (error) {
        res.status(403);
        return next(error);
      }
      const carcasse = await prisma.carcasse.findFirst({
        where: {
          numero_bracelet: req.params.numero_bracelet,
          // input: 2025-09-17, output: 2025-09-17T00:00:00.000Z
          date_mise_a_mort: dayjs(req.params.date_mise_a_mort).utc(true).toISOString(),
          deleted_at: null,
        },
        select: carcasseForApiSelect,
      });

      if (!carcasse) {
        const error = new Error('Carcasse non trouvée');
        res.status(404);
        return next(error);
      }

      const fei = await prisma.fei.findUnique({
        where: {
          numero: carcasse.fei_numero,
        },
        select: feiForApiSelect,
      });

      let canAccess = false;

      const role = user.roles.find((role) => role !== UserRoles.ADMIN);
      switch (role) {
        case UserRoles.CHASSEUR:
          if (fei.examinateur_initial_user_id === user.id) {
            canAccess = true;
            break;
          }
          if (fei.premier_detenteur_user_id === user.id) {
            canAccess = true;
            break;
          }
          break;
        default:
          break;
      }

      if (!canAccess) {
        const error = new Error(
          "Vous n'avez pas les permissions pour accéder à cette carcasse. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
        );
        res.status(403);
        return next(error);
      }

      res.status(200).send({
        ok: true,
        data: { carcasse: mapCarcasseForApi(carcasse, fei) },
        message:
          'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.',
      });
    },
  ),
);

router.get(
  '/:date_mise_a_mort/:numero_bracelet',
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.CARCASSE_READ_FOR_ENTITY]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<CarcasseForResponseForApi>,
      next: express.NextFunction,
    ) => {
      const paramsSchema = z.object({
        date_mise_a_mort: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        numero_bracelet: z.string(),
      });

      const paramsResult = paramsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        const errors = paramsResult.error.issues.map((i) => i.message).join('. ');
        const error = new Error(
          `${errors}. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const apiKey = req.apiKey;
      const entity = await getDedicatedEntityLinkedToApiKey(apiKey);
      if (!entity) {
        const error = new Error(
          `Votre clé n'est pas autorisée à accéder à des carcasses par cette requête. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(403);
        return next(error);
      }

      const carcasse = await prisma.carcasse.findFirst({
        where: {
          numero_bracelet: req.params.numero_bracelet,
          // input: 2025-09-17, output: 2025-09-17T00:00:00.000Z
          date_mise_a_mort: dayjs(req.params.date_mise_a_mort).utc(true).toISOString(),
          deleted_at: null,
        },
        select: carcasseForApiSelect,
      });

      if (!carcasse) {
        const error = new Error('Carcasse non trouvée');
        res.status(404);
        return next(error);
      }

      const fei = await prisma.fei.findUnique({
        where: {
          numero: carcasse.fei_numero,
        },
        select: feiForApiSelect,
      });

      let canAccess = false;

      console.log('entity', entity.type);
      switch (entity.type) {
        case EntityTypes.PREMIER_DETENTEUR:
          console.log('fei.premier_detenteur_entity_id', fei.premier_detenteur_entity_id, entity.id);
          if (fei.premier_detenteur_entity_id === entity.id) {
            canAccess = true;
            break;
          }
          break;
        case EntityTypes.ETG:
        case EntityTypes.COLLECTEUR_PRO:
          const carcasseIntermediaires = fei.CarcasseIntermediaire.filter(
            (c) => c.numero_bracelet === carcasse.numero_bracelet,
          );
          console.log('carcasseIntermediaires', carcasseIntermediaires.length);
          const intermediaires = carcasseIntermediaires.filter((c) => c.intermediaire_role === entity.type);
          console.log('intermediaires', intermediaires.length);
          if (!intermediaires.length) {
            break;
          }
          for (const intermediaire of intermediaires) {
            console.log('intermediaire', intermediaire.intermediaire_entity_id, entity.id);
            if (intermediaire.intermediaire_entity_id === entity.id) {
              canAccess = true;
              break;
            }
          }
          break;
        case EntityTypes.SVI:
          if (fei.svi_entity_id === entity.id) {
            canAccess = true;
            break;
          }
          break;
        default:
          break;
      }

      if (!canAccess) {
        const error = new Error(
          "Vous n'avez pas les permissions pour accéder à cette carcasse. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
        );
        res.status(403);
        return next(error);
      }

      res.status(200).send({
        ok: true,
        data: { carcasse: mapCarcasseForApi(carcasse, fei) },
        message:
          'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.',
      });
    },
  ),
);

router.get(
  '/user',
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.FEI_READ_FOR_ENTITY]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<CarcassesForResponseForApi>,
      next: express.NextFunction,
    ) => {
      // Validate query params inline
      const querySchema = z.object({
        date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        email: z.string().email("Format d'email invalide"),
      });

      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success) {
        const errors = queryResult.error.issues.map((i) => i.message).join('. ');
        const error = new Error(
          `${errors}. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const { date_from: dateFrom, date_to: dateTo, email } = queryResult.data;
      const apiKey = req.apiKey;

      const { user, error } = await getRequestedUser(apiKey, email);
      if (error) {
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

      const role = user.roles.find((role) => role !== UserRoles.ADMIN);
      if (role === UserRoles.CHASSEUR) {
        feiQuery.where.OR = [
          {
            examinateur_initial_user_id: user.id,
          },
          {
            premier_detenteur_user_id: user.id,
          },
        ];
      } else if (role === UserRoles.ETG || role === UserRoles.COLLECTEUR_PRO) {
        feiQuery.where.CarcasseIntermediaire = {
          some: {
            intermediaire_user_id: user.id,
          },
        };
      } else if (role === UserRoles.SVI) {
        feiQuery.where.svi_user_id = user.id;
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
          carcasses: carcasses.map((carcasse) =>
            mapCarcasseForApi(carcasse, feis.find((fei) => fei.numero === carcasse.fei_numero)!),
          ),
        },
        message:
          'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.',
      });
    },
  ),
);

router.get(
  '/',
  passport.authenticate('apiKey', { session: false }),
  checkApiKeyIsValidMiddleware([ApiKeyScope.FEI_READ_FOR_ENTITY]),
  catchErrors(
    async (
      req: RequestWithApiKey,
      res: express.Response<CarcassesForResponseForApi>,
      next: express.NextFunction,
    ) => {
      // Validate query params inline
      const querySchema = z.object({
        date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
        date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu: YYYY-MM-DD'),
      });

      const queryResult = querySchema.safeParse(req.query);
      if (!queryResult.success) {
        const error = new Error(
          `${queryResult.error.issues
            .map((i) => i.message)
            .join(
              '. ',
            )}. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        );
        res.status(400);
        return next(error);
      }

      const { date_from: dateFrom, date_to: dateTo } = queryResult.data;
      const apiKey = req.apiKey;

      const entity = await getDedicatedEntityLinkedToApiKey(apiKey);
      if (!entity) {
        const error = new Error(
          `Votre clé n'est pas autorisée à accéder à des carcasses par cette requête. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
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

      if (entity?.type === EntityTypes.PREMIER_DETENTEUR) {
        feiQuery.where.premier_detenteur_entity_id = entity.id;
      } else if (entity?.type === EntityTypes.SVI) {
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
          carcasses: carcasses.map((carcasse) =>
            mapCarcasseForApi(carcasse, feis.find((fei) => fei.numero === carcasse.fei_numero)!),
          ),
        },
        message:
          'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.',
      });
    },
  ),
);

export default router;
