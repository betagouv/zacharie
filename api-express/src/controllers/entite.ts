import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { RequestWithUser } from '~/types/request';
import type { EntitiesWorkingForResponse } from '~/types/responses';
const router = express.Router();
import prisma from '~/prisma';
import { EntityRelationType, EntityTypes, Prisma, UserRoles } from '@prisma/client';
import {
  sortEntitiesByTypeAndId,
  sortEntitiesRelationsByTypeAndId,
} from '~/utils/sort-things-by-type-and-id.server';

router.get(
  '/fei/:entity_id/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.params.fei_numero) {
      res.status(400).send({ ok: false, data: null, error: 'Missing fei_numero' });
      return;
    }
    if (!req.params.entity_id) {
      res.status(400).send({ ok: false, data: null, error: 'Missing entity_id' });
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
    const entity = await prisma.entity.findUnique({
      where: {
        id: req.params.entity_id,
      },
    });

    if (!entity) {
      res.status(401).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    res.status(200).send({
      ok: true,
      data: {
        entity,
      },
      error: '',
    });
  }),
);

router.get(
  '/working-for',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;

    const allEntities = await prisma.entity.findMany({
      where: {
        type: { not: EntityTypes.CCG },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });
    const userEntitiesRelationsWorkingFor = await prisma.entityAndUserRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_FOR,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    const [allEntitiesIds, allEntitiesByTypeAndId] = sortEntitiesByTypeAndId(allEntities);
    const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(
      userEntitiesRelationsWorkingFor,
      allEntitiesIds,
    );

    res.status(200).send({
      ok: true,
      data: {
        allEntitiesByTypeAndId,
        userEntitiesByTypeAndId,
      },
      error: '',
    } satisfies EntitiesWorkingForResponse);
  }),
);

router.get(
  '/my-ccgs',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    const userCCGs = (
      await prisma.entityAndUserRelations.findMany({
        where: {
          owner_id: user.id,
          relation: EntityRelationType.WORKING_WITH,
          EntityRelatedWithUser: {
            type: EntityTypes.CCG,
          },
        },
        include: {
          EntityRelatedWithUser: true,
        },
      })
    ).map((relation) => relation.EntityRelatedWithUser);

    res.status(200).send({
      ok: true,
      data: {
        userCCGs,
      },
      error: '',
    });
  }),
);

export default router;
