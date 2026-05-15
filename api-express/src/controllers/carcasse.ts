import express from 'express';
const router: express.Router = express.Router();
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { CarcasseResponse, CarcassesGetForRegistryResponse } from '~/types/responses';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import { RequestWithUser } from '~/types/request';
import { carcasseForRegistrySelect } from '~/types/carcasse';
import { mapCarcasseForRegistry } from '~/utils/carcasse-for-registry';

router.get(
  '/svi',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetForRegistryResponse>) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }
    const userIsSvi = req.user?.roles.includes(UserRoles.SVI);
    if (!userIsSvi) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    // Parse and validate query parameters
    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      svi_assigned_at: { not: null },
      deleted_at: null,
      CarcasseSviEntity: {
        EntityRelationsWithUsers: {
          some: {
            owner_id: req.user!.id,
            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            status: {
              in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
            },
          },
        },
      },
    };
    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      if (includeDeleted) {
        where.OR = [
          // If we include deleted, we want to get all the carcasses updated after the date
          { updated_at: { gte: afterDate } },
          // And all the carcasses deleted after the date
          { deleted_at: { gte: afterDate } },
        ];
      } else {
        where.updated_at = { gte: afterDate };
      }
    }

    // Execute count and findMany in parallel
    const [total, data] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        select: carcasseForRegistrySelect,
        orderBy: { created_at: 'desc' },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        carcasses: data.map(mapCarcasseForRegistry),
        hasMore: data.length === parsedLimit,
        total,
      },
      error: '',
    });
  })
);

router.get(
  '/etg',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetForRegistryResponse>) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }
    const userIsEtg = req.user?.roles.includes(UserRoles.ETG);
    if (!userIsEtg) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      CarcasseIntermediaire: {
        some: {
          CarcasseIntermediaireEntity: {
            EntityRelationsWithUsers: {
              some: {
                owner_id: req.user.id,
                relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                status: {
                  in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                },
              },
            },
          },
        },
      },
    };
    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      if (includeDeleted) {
        where.OR = [
          // If we include deleted, we want to get all the carcasses updated after the date
          { updated_at: { gte: afterDate } },
          // And all the carcasses deleted after the date
          { deleted_at: { gte: afterDate } },
        ];
      } else {
        where.updated_at = { gte: afterDate };
      }
    }

    // Execute count and findMany in parallel
    const [total, data] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        select: carcasseForRegistrySelect,
        orderBy: { created_at: 'desc' },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        carcasses: data.map(mapCarcasseForRegistry),
        hasMore: data.length === parsedLimit,
        total,
      },
      error: '',
    });
  })
);

router.get(
  '/collecteur_pro',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetForRegistryResponse>) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }
    const userIsCollecteurPro = req.user?.roles.includes(UserRoles.COLLECTEUR_PRO);
    if (!userIsCollecteurPro) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      CarcasseIntermediaire: {
        some: {
          intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
          CarcasseIntermediaireEntity: {
            EntityRelationsWithUsers: {
              some: {
                owner_id: req.user.id,
                relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                status: {
                  in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                },
              },
            },
          },
        },
      },
    };
    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      if (includeDeleted) {
        where.OR = [
          // If we include deleted, we want to get all the carcasses updated after the date
          { updated_at: { gte: afterDate } },
          // And all the carcasses deleted after the date
          { deleted_at: { gte: afterDate } },
        ];
      } else {
        where.updated_at = { gte: afterDate };
      }
    }

    // Execute count and findMany in parallel
    const [total, data] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        select: carcasseForRegistrySelect,
        orderBy: { created_at: 'desc' },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        carcasses: data.map(mapCarcasseForRegistry),
        hasMore: data.length === parsedLimit,
        total,
      },
      error: '',
    });
  })
);

router.get(
  '/:fei_numero/:numero_bracelet',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }
    if (!req.params.fei_numero) {
      res.status(400).send({ ok: false, data: null, error: 'Missing fei_numero' });
      return;
    }
    const fei = await prisma.fei.findUnique({
      where: {
        numero: req.params.fei_numero as string,
      },
    });
    if (!fei) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const carcasse = await prisma.carcasse.findFirst({
      where: {
        numero_bracelet: req.params.numero_bracelet,
        fei_numero: req.params.fei_numero,
      },
    });
    if (!carcasse) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    res.status(200).send({
      ok: true,
      data: { carcasse },
      error: '',
    });
  })
);

router.get(
  '/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: express.Request, res: express.Response<CarcasseResponse>, next: express.NextFunction) => {
      if (!req.user.activated) {
        res.status(400).send({
          ok: false,
          data: null,
          error: "Le compte n'est pas activé",
        });
        return;
      }

      const carcasse = await prisma.carcasse.findUnique({
        where: {
          zacharie_carcasse_id: req.params.zacharie_carcasse_id,
        },
        include: {
          Fei: true,
        },
      });
      if (!carcasse) {
        res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }

      res.status(200).send({
        ok: true,
        data: { carcasse },
        error: '',
      });
    }
  )
);

export default router;
