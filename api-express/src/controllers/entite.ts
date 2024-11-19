import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { RequestWithUser } from '~/types/request';
const router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import { sendEmail } from '~/third-parties/tipimail';
import { capture } from '~/third-parties/sentry';
import createUserId from '~/utils/createUserId';
import { comparePassword, hashPassword } from '~/service/crypto';
import validateUser from '~/middlewares/validateUser';
import {
  EntityRelationType,
  EntityTypes,
  Prisma,
  User,
  UserNotifications,
  UserRelationType,
  UserRoles,
} from '@prisma/client';
import { authorizeUserOrAdmin } from '~/utils/authorizeUserOrAdmin.server';
import {
  sortEntitiesByTypeAndId,
  sortEntitiesRelationsByTypeAndId,
} from '~/utils/sort-things-by-type-and-id.server';

router.post(
  '/nouvelle',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const body = req.body;

      const createdEntity = await prisma.entity.create({
        data: {
          raison_sociale: body[Prisma.EntityScalarFieldEnum.raison_sociale],
          nom_d_usage: body[Prisma.EntityScalarFieldEnum.raison_sociale],
          type: body[Prisma.EntityScalarFieldEnum.type],
        },
      });

      res
        .status(200)
        .send({ ok: true, data: { entity: createdEntity }, error: null });
    },
  ),
);

router.post(
  '/:entity_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const body = req.body;

      if (body._action === 'remove-etg-relation') {
        await prisma.eTGAndEntityRelations.delete({
          where: {
            etg_id_entity_id:
              body[
                Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id_entity_id
              ],
          },
        });
        res.status(200).send({ ok: true, error: null });
        return;
      }
      if (body._action === 'add-etg-relation') {
        const data: Prisma.ETGAndEntityRelationsUncheckedCreateInput = {
          etg_id_entity_id:
            body[Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id_entity_id],
          entity_id:
            body[Prisma.ETGAndEntityRelationsScalarFieldEnum.entity_id],
          etg_id: body[Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id],
          entity_type: body[
            Prisma.ETGAndEntityRelationsScalarFieldEnum.entity_type
          ] as EntityTypes,
        };
        const relation = await prisma.eTGAndEntityRelations.upsert({
          where: {
            etg_id_entity_id:
              body[
                Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id_entity_id
              ],
          },
          create: data,
          update: data,
        });
        res.status(200).send({ ok: true, data: { relation }, error: null });
        return;
      }

      const data: Prisma.EntityUncheckedUpdateInput = {
        raison_sociale: body[Prisma.EntityScalarFieldEnum.raison_sociale],
        nom_d_usage: body[Prisma.EntityScalarFieldEnum.nom_d_usage],
        address_ligne_1: body[Prisma.EntityScalarFieldEnum.address_ligne_1],
        address_ligne_2: body[Prisma.EntityScalarFieldEnum.address_ligne_2],
        code_postal: body[Prisma.EntityScalarFieldEnum.code_postal],
        ville: body[Prisma.EntityScalarFieldEnum.ville],
        siret: body[Prisma.EntityScalarFieldEnum.siret] || null,
        numero_ddecpp: body[Prisma.EntityScalarFieldEnum.numero_ddecpp] || null,
      };

      const updatedEntity = await prisma.entity.update({
        where: {
          id: req.params.entity_id,
        },
        data,
      });

      res
        .status(200)
        .send({ ok: true, data: { entity: updatedEntity }, error: null });
    },
  ),
);

router.get(
  '/fei/:entity_id/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (!req.params.fei_numero) {
        res
          .status(400)
          .send({ ok: false, data: null, error: 'Missing fei_numero' });
        return;
      }
      if (!req.params.entity_id) {
        res
          .status(400)
          .send({ ok: false, data: null, error: 'Missing entity_id' });
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
    },
  ),
);

router.get(
  '/working-for',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const user = req.user!;

      const allEntities = await prisma.entity.findMany({
        where: {
          type: { not: EntityTypes.CCG },
        },
        orderBy: {
          updated_at: 'desc',
        },
      });
      const userEntitiesRelationsWorkingFor =
        await prisma.entityAndUserRelations.findMany({
          where: {
            owner_id: user.id,
            relation: EntityRelationType.WORKING_FOR,
          },
          orderBy: {
            updated_at: 'desc',
          },
        });

      const [allEntitiesIds, allEntitiesByTypeAndId] =
        sortEntitiesByTypeAndId(allEntities);
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
      });
    },
  ),
);

router.get(
  '/my-ccgs',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response,
      next: express.NextFunction,
    ) => {
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
    },
  ),
);

export default router;
