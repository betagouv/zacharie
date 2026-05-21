import express from 'express';
const router: express.Router = express.Router();
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { CarcassesGetResponse } from '~/types/responses';
import prisma from '~/prisma';
import {
  CarcasseModificationRequest,
  EntityRelationStatus,
  EntityRelationType,
  Prisma,
  UserRoles,
} from '@prisma/client';
import { RequestWithUser } from '~/types/request';
import z from 'zod';
import { capture } from '~/third-parties/sentry';
import { userFeiSelect } from '~/types/user';

const zodQuerySchema = z.object({
  page: z.string(),
  after: z.string(),
  limit: z.string(),
  withDeleted: z.string(),
});

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetResponse>) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }

    // Parse and validate query parameters
    const queryResult = zodQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).send({ ok: false, data: null, error: 'Invalid query parameters' });
      return;
    }
    const { page, after, limit, withDeleted } = queryResult.data;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const includeDeleted = withDeleted === 'true';
    const afterDate = Number(after) ? new Date(Number(after)) : undefined;

    // Base query conditions
    let where: Prisma.CarcasseWhereInput = {};

    // Pre-fetch entity IDs the user works for (used in carcasse-level queries)
    const userEntityRelations = await prisma.entityAndUserRelations.findMany({
      where: {
        owner_id: req.user.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      },
      select: { entity_id: true },
    });
    const userEntityIds = userEntityRelations.map((r) => r.entity_id);

    if (req.user.roles.includes(UserRoles.SVI)) {
      where = {
        svi_assigned_at: { not: null },
        OR: [
          {
            svi_entity_id: { in: userEntityIds },
          },
          {
            next_owner_entity_id: { in: userEntityIds },
          },
        ],
      };
    } else if (req.user.roles.includes(UserRoles.CHASSEUR)) {
      where = {
        OR: [
          {
            premier_detenteur_user_id: req.user.id,
          },
          {
            examinateur_initial_user_id: req.user.id,
          },
          {
            premier_detenteur_entity_id: { in: userEntityIds },
          },
          {
            next_owner_entity_id: { in: userEntityIds },
          },
          {
            prev_owner_entity_id: { in: userEntityIds },
          },
          {
            current_owner_entity_id: { in: userEntityIds },
          },
          {
            next_owner_user_id: req.user.id,
          },
          {
            prev_owner_user_id: req.user.id,
          },
          {
            current_owner_user_id: req.user.id,
          },
        ],
      };
    } else if (
      req.user.roles.includes(UserRoles.ETG) ||
      req.user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
      req.user.roles.includes(UserRoles.COMMERCE_DE_DETAIL) ||
      req.user.roles.includes(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE) ||
      req.user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE) ||
      req.user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF) ||
      req.user.roles.includes(UserRoles.CONSOMMATEUR_FINAL)
    ) {
      where = {
        OR: [
          {
            CarcasseIntermediaire: {
              some: {
                intermediaire_entity_id: { in: userEntityIds },
              },
            },
          },
          {
            next_owner_entity_id: { in: userEntityIds },
          },
          {
            current_owner_entity_id: { in: userEntityIds },
          },
        ],
      };
    } else {
      capture(`User role not supported: ${req.user.roles.join(', ')}`, { user: req.user });
      res.status(403).send({
        ok: false,
        data: null,
        error: "Vous n'avez pas les permissions.",
      });
      return;
    }

    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      where.updated_at = { gte: afterDate };
    }

    // Execute count and findMany in parallel
    const [total, carcasses] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        include: {
          CarcasseModificationRequests: true,
        },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    const feiNumeros = new Set<string>();
    const carcassesIds = new Set<string>();
    const userIds = new Set<string>();
    const carcasseModifRequests: Array<CarcasseModificationRequest> = [];

    for (const carcasse of carcasses) {
      userIds.add(carcasse.examinateur_initial_user_id);
      userIds.add(carcasse.premier_detenteur_user_id);
      userIds.add(carcasse.current_owner_user_id);
      userIds.add(carcasse.next_owner_user_id);
      userIds.add(carcasse.prev_owner_user_id);
      userIds.add(carcasse.svi_user_id);
      userIds.add(carcasse.created_by_user_id);
      carcassesIds.add(carcasse.zacharie_carcasse_id);
      feiNumeros.add(carcasse.fei_numero);
      for (const modifRequest of carcasse.CarcasseModificationRequests) {
        carcasseModifRequests.push(modifRequest);
      }
    }

    const [users, feis, carcassesIntermediaires] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: [...userIds].filter(Boolean) } }, select: userFeiSelect }),
      prisma.fei.findMany({ where: { numero: { in: [...feiNumeros].filter(Boolean) } } }),
      prisma.carcasseIntermediaire.findMany({
        where: { zacharie_carcasse_id: { in: [...carcassesIds].filter(Boolean) } },
      }),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        carcasses,
        feis,
        users,
        carcassesIntermediaires,
        carcasseModifRequests,
        hasMore: carcasses.length === parsedLimit,
        total,
      },
      error: '',
    });
  })
);

export default router;
