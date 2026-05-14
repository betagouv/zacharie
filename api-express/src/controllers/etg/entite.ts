import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
import type { EntitiesWorkingForResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { sortEntitiesRelationsByTypeAndId } from '~/utils/sort-things-by-type-and-id.server';
import type { UserMyRelationsResponse } from '~/types/responses';
import type { EntityWithUserRelation } from '~/types/entity';
import { EntityRelationType, EntityTypes, User, EntityRelationStatus } from '@prisma/client';

router.get(
  '/working-for',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response<EntitiesWorkingForResponse>,
      next: express.NextFunction
    ) => {
      const user = req.user!;

      const entitiesUserCanHandleOnBehalf = await prisma.entity.findMany({
        where: {
          deleted_at: null,
          EntityRelationsWithUsers: {
            some: {
              owner_id: user.id,
              relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
              deleted_at: null,
            },
          },
        },
        include: {
          EntityRelationsWithUsers: {
            where: !user.activated ? { owner_id: user.id } : undefined,
            select: {
              id: true,
              relation: true,
              status: true,
              owner_id: true,
              entity_id: true,
              UserRelatedWithEntity: {
                select: {
                  id: true,
                  email: true,
                  nom_de_famille: true,
                  prenom: true,
                  code_postal: true,
                  ville: true,
                  roles: true,
                },
              },
            },
          },
        },
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

      const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(entitiesUserCanHandleOnBehalf);

      res.status(200).send({
        ok: true,
        data: {
          userEntitiesByTypeAndId,
        },
        error: '',
      });
    }
  )
);

router.get(
  '/my-relations',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response<UserMyRelationsResponse>,
      next: express.NextFunction
    ) => {
      const user = req.user!;
      /*
      I need to fetch
      - the entities the user can handle carcasses on behalf of (salarié, dirigeant, etc.)
      - the SVI linked to the ETGs the user can handle carcasses on behalf of
      - the entities the user can transmit carcasses to (ETG, SVI, etc.)

      I need to return
      - the entities I can handle carcasses on behalf of
      - the entities I can transmit carcasses to
      - the other entities I could work with (partnership not confirmed), which are all the rest
      */

      const entitiesICanHandleCarcassOnBehalf = await prisma.entityAndUserRelations
        .findMany({
          where: {
            owner_id: user.id,
            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            deleted_at: null,
          },
          include: {
            EntityRelatedWithUser: true,
          },
          orderBy: {
            updated_at: 'desc',
          },
        })
        .then((entityRelations) =>
          entityRelations.map(
            (rel): EntityWithUserRelation => ({
              ...rel.EntityRelatedWithUser,
              relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
              relationStatus: rel.status,
            })
          )
        );

      const svisICanTransmitCarcassesTo = await prisma.entity
        .findMany({
          where: {
            type: EntityTypes.SVI,
            id: {
              in: entitiesICanHandleCarcassOnBehalf
                .map((entity) => entity.etg_linked_to_svi_id)
                .filter(Boolean),
            },
            deleted_at: null,
          },
        })
        .then((entities) =>
          entities.map(
            (entity): EntityWithUserRelation => ({
              ...entity,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
              relationStatus: EntityRelationStatus.MEMBER,
            })
          )
        );

      const entitiesICanTransmitCarcasseTo = await prisma.entityAndUserRelations
        .findMany({
          where: {
            owner_id: user.id,
            relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            deleted_at: null,
          },
          include: {
            EntityRelatedWithUser: true,
          },
          orderBy: {
            updated_at: 'desc',
          },
        })
        .then((entityRelations) =>
          entityRelations.map(
            (rel): EntityWithUserRelation => ({
              ...rel.EntityRelatedWithUser,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
              relationStatus: undefined,
            })
          )
        );

      const allOtherEntities = await prisma.entity
        .findMany({
          where: {
            for_testing: user.isZacharieAdmin ? undefined : false,
            type: {
              in: [EntityTypes.COLLECTEUR_PRO, EntityTypes.ETG],
            },
            id: {
              notIn: [
                ...entitiesICanHandleCarcassOnBehalf.map((entity) => entity.id),
                ...entitiesICanTransmitCarcasseTo.map((entity) => entity.id),
                ...svisICanTransmitCarcassesTo.map((entity) => entity.id),
              ],
            },
          },
          orderBy: {
            updated_at: 'desc',
          },
        })
        .then((entities) =>
          entities.map(
            (entity): EntityWithUserRelation => ({
              ...entity,
              relation: EntityRelationType.NONE,
              relationStatus: undefined as EntityRelationStatus,
            })
          )
        );

      const allEntities = [
        ...entitiesICanHandleCarcassOnBehalf,
        ...entitiesICanTransmitCarcasseTo,
        ...svisICanTransmitCarcassesTo,
        ...allOtherEntities,
      ].filter((entity, index, array) => array.findIndex((e) => e.id === entity.id) === index); // remove duplicates

      const collecteursPro = allEntities.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);

      const etgs = allEntities.filter((entity) => entity.type === EntityTypes.ETG);

      const svis = allEntities.filter(
        (entity) =>
          entity.type === EntityTypes.SVI &&
          entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY
      );

      res.status(200).send({
        ok: true,
        data: {
          user: user satisfies User,
          detenteursInitiaux: [],
          associationsDeChasse: [],
          ccgs: [],
          collecteursPro: collecteursPro satisfies Array<EntityWithUserRelation>,
          etgs: etgs satisfies Array<EntityWithUserRelation>,
          svis: svis satisfies Array<EntityWithUserRelation>,
          entitiesICanHandleCarcassOnBehalf:
            entitiesICanHandleCarcassOnBehalf satisfies Array<EntityWithUserRelation>,
          circuitCourt: [],
        },
        error: '',
      });
    }
  )
);

export default router;
