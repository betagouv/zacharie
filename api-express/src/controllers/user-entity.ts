import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { linkBrevoCompanyToContact, unlinkBrevoCompanyToContact } from '~/third-parties/brevo';
import type { UserEntityResponse } from '~/types/responses';
import {
  EntityRelationType,
  EntityTypes,
  Prisma,
  UserRoles,
  EntityRelationStatus,
  Entity,
  User,
} from '@prisma/client';
import sendNotificationToUser from '~/service/notifications';
import { FEDERATION_ENTITY_TYPES } from '~/utils/federation-stats';
import { z } from 'zod';

export const userEntitySchema = z.object({
  owner_id: z.string(),
  entity_id: z.string().optional(),
  numero_ddecpp: z.string().optional(),
  type: z.enum(Object.values(EntityTypes) as [EntityTypes, ...EntityTypes[]]).optional(),
  relation: z
    .enum(Object.values(EntityRelationType) as [EntityRelationType, ...EntityRelationType[]])
    .optional(),
  status: z
    .enum(Object.values(EntityRelationStatus) as [EntityRelationStatus, ...EntityRelationStatus[]])
    .optional(),
});

export async function getEntity(body: z.infer<typeof userEntitySchema>) {
  let entityId: string = body.entity_id;
  if (body.numero_ddecpp && body.type === EntityTypes.CCG) {
    const sanitizedNumeroDdecpp = body.numero_ddecpp.toLowerCase().includes('ccg')
      ? body.numero_ddecpp
          .split('-')
          .map((part: string, index: number) => {
            if (index === 2) {
              return part.replace(/^0+/, '');
            }
            if (index === 1) {
              return part.toLocaleUpperCase();
            }
            return part;
          })
          .join('-')
      : body.numero_ddecpp;
    const entity = await prisma.entity.findFirst({
      where: {
        deleted_at: null,
        numero_ddecpp: sanitizedNumeroDdecpp,
        type: body.type as EntityTypes,
      },
    });
    if (!entity) {
      return null;
    }
    return entity;
  }

  if (entityId) {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId, deleted_at: null },
    });
    return entity;
  }

  return null;
}

async function checkIfUserIsAdmin(body: z.infer<typeof userEntitySchema>, user: User, entity: Entity) {
  if (!body.owner_id) {
    return false;
  }

  const isCurrentUserAdminOfEntity = await prisma.entityAndUserRelations.findFirst({
    where: {
      owner_id: user.id,
      entity_id: entity.id,
      status: EntityRelationStatus.ADMIN,
    },
  });
  if (isCurrentUserAdminOfEntity) {
    return true;
  }

  return false;
}

// une entité doit toujours garder un admin pour gérer ses utilisateurs
async function getLastAdminSituation(relation: {
  id: string;
  entity_id: string;
  relation: EntityRelationType;
  status: EntityRelationStatus;
}): Promise<'NOT_LAST_ADMIN' | 'LAST_ADMIN_WITH_OTHER_USERS' | 'SOLE_USER'> {
  if (
    relation.relation !== EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY ||
    relation.status !== EntityRelationStatus.ADMIN
  ) {
    return 'NOT_LAST_ADMIN';
  }
  const otherRelations = await prisma.entityAndUserRelations.findMany({
    where: {
      entity_id: relation.entity_id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      deleted_at: null,
      id: { not: relation.id },
      // les admins Zacharie rattachés à une entité (support, tests) n'en sont pas membres
      UserRelatedWithEntity: { isZacharieAdmin: false },
    },
    select: { status: true },
  });
  if (otherRelations.some((other) => other.status === EntityRelationStatus.ADMIN)) return 'NOT_LAST_ADMIN';
  if (otherRelations.length > 0) return 'LAST_ADMIN_WITH_OTHER_USERS';
  return 'SOLE_USER';
}

async function checkIfUserCanCrudEntityRelation(
  body: z.infer<typeof userEntitySchema>,
  user: User,
  isAdmin: boolean
) {
  if (body.owner_id !== user.id) {
    if (!isAdmin) {
      return false;
    }
  }

  return true;
}

router.post(
  '/',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<UserEntityResponse>, next: express.NextFunction) => {
      let result = userEntitySchema.safeParse(req.body);
      if (!result.success) {
        const error = new Error(result.error.message);
        res.status(406);
        return next(error);
      }
      let body = result.data;

      if (!body.owner_id) {
        res
          .status(400)
          .send({ ok: false, data: { relation: null, entity: null }, error: 'Missing owner_id' });
        return;
      }

      if (!body.relation) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Missing relation',
        });
        return;
      }

      const entity = await getEntity(body);
      if (!entity) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: body.numero_ddecpp ? "Ce Centre de Collecte n'existe pas" : 'Missing entity_id',
        });
        return;
      }

      let isAdmin = await checkIfUserIsAdmin(body, req.user, entity);

      if (!(await checkIfUserCanCrudEntityRelation(body, req.user, isAdmin))) {
        res.status(403).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Unauthorized',
        });
        return;
      }

      // on ne demande pas à rejoindre une fédération : l'équipe Zacharie ou un admin de la fédération rattache ses membres
      if (FEDERATION_ENTITY_TYPES.includes(entity.type) && !isAdmin) {
        res.status(403).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Unauthorized',
        });
        return;
      }

      const nextEntityRelation: Prisma.EntityAndUserRelationsUncheckedCreateInput = {
        owner_id: body.owner_id,
        entity_id: entity.id,
        relation: body.relation,
        deleted_at: null,
      };

      const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
        where: nextEntityRelation,
      });

      if (existingEntityRelation) {
        res.status(409).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Vous avez déjà ajouté cette entité',
        });
        return;
      }

      if (body.hasOwnProperty(Prisma.EntityAndUserRelationsScalarFieldEnum.status)) {
        if (isAdmin) {
          nextEntityRelation.status = body.status;
        }
      }

      // rattachement direct par un admin : le premier utilisateur de l'entité en devient l'admin
      if (
        nextEntityRelation.status === EntityRelationStatus.MEMBER &&
        body.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
      ) {
        const entityHasUsers = await prisma.entityAndUserRelations.findFirst({
          where: {
            entity_id: entity.id,
            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            status: { in: [EntityRelationStatus.MEMBER, EntityRelationStatus.ADMIN] },
            deleted_at: null,
          },
        });
        if (!entityHasUsers) nextEntityRelation.status = EntityRelationStatus.ADMIN;
      }

      const relation = await prisma.entityAndUserRelations.create({
        data: nextEntityRelation,
      });

      if (relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
        await linkBrevoCompanyToContact(entity, req.user);
        if (relation.status === EntityRelationStatus.REQUESTED) {
          if (req.user.roles[0] !== UserRoles.CHASSEUR) {
            throw new Error('Forbidden role in notifying entity admin: ' + req.user.roles[0]);
          }
          const entityAdmins = await prisma.entityAndUserRelations.findMany({
            where: {
              entity_id: entity.id,
              relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
              status: EntityRelationStatus.ADMIN,
              deleted_at: null,
            },
            include: {
              UserRelatedWithEntity: true,
            },
          });
          for (const entityAdminRelation of entityAdmins) {
            const email = [
              'Bonjour,',
              `${req.user.prenom} ${req.user.nom_de_famille} (${req.user.email}) vient de s'inscrire sur Zacharie au sein de ${entity.nom_d_usage}.`,
              `Pour l'autoriser à traiter des fiches au nom de ${entity.nom_d_usage}, veuillez cliquer sur le lien suivant : https://zacharie.beta.gouv.fr/app/chasseur/profil/coordonnees?open-entity=${entity.id}`,
              `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
            ].join('\n\n');
            await sendNotificationToUser({
              user: entityAdminRelation.UserRelatedWithEntity,
              title: "Un nouvel utilisateur s'est inscrit sur Zacharie au sein de votre entité",
              email: email,
              push: {
                title: "Nouvelle demande d'accès",
                body: `${req.user.prenom} ${req.user.nom_de_famille} souhaite traiter des fiches au nom de ${entity.nom_d_usage}.`,
              },
              notificationLogAction: `NEW_USER_IN_ENTITY_${entity.id}`,
            });
          }
        }
      }

      res.status(200).send({ ok: true, data: { relation, entity }, error: '' });
      return;
    }
  )
);

router.put(
  '/',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<UserEntityResponse>, next: express.NextFunction) => {
      let result = userEntitySchema.safeParse(req.body);
      if (!result.success) {
        const error = new Error(result.error.message);
        res.status(406);
        return next(error);
      }

      let body = result.data;
      if (!body.owner_id) {
        res
          .status(400)
          .send({ ok: false, data: { relation: null, entity: null }, error: 'Missing owner_id' });
        return;
      }

      if (!body.relation) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Missing relation',
        });
        return;
      }

      const entity = await getEntity(body);
      if (!entity) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: body.numero_ddecpp ? "Ce Centre de Collecte n'existe pas" : 'Missing entity_id',
        });
        return;
      }

      let isAdmin = await checkIfUserIsAdmin(body, req.user, entity);

      if (!(await checkIfUserCanCrudEntityRelation(body, req.user, isAdmin))) {
        res.status(403).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Unauthorized',
        });
        return;
      }

      const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
        where: {
          owner_id: body.owner_id,
          entity_id: entity.id,
          relation: body.relation,
          deleted_at: null,
        },
      });

      if (!existingEntityRelation) {
        res.status(404).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Relation non trouvée',
        });
        return;
      }

      const nextEntityRelation: Prisma.EntityAndUserRelationsUncheckedUpdateInput = {
        owner_id: body.owner_id,
        entity_id: entity.id,
        relation: body.relation,
        deleted_at: null,
      };

      if (body.hasOwnProperty(Prisma.EntityAndUserRelationsScalarFieldEnum.status)) {
        if (isAdmin) {
          nextEntityRelation.status = body.status;
        }
      }

      if (nextEntityRelation.status && nextEntityRelation.status !== EntityRelationStatus.ADMIN) {
        if ((await getLastAdminSituation(existingEntityRelation)) !== 'NOT_LAST_ADMIN') {
          res.status(409).send({
            ok: false,
            data: { relation: null, entity: null },
            error:
              'Vous êtes le seul administrateur de cette entité. Nommez un autre administrateur avant de retirer vos droits.',
          });
          return;
        }
      }

      const relation = await prisma.entityAndUserRelations.update({
        where: {
          id: existingEntityRelation.id,
        },
        data: nextEntityRelation,
      });

      if (relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
        await linkBrevoCompanyToContact(entity, req.user);
      }

      res.status(200).send({ ok: true, data: { relation, entity }, error: '' });
      return;
    }
  )
);

router.delete(
  '/',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<UserEntityResponse>, next: express.NextFunction) => {
      let result = userEntitySchema.safeParse(req.body);
      if (!result.success) {
        const error = new Error(result.error.message);
        res.status(406);
        return next(error);
      }
      let body = result.data;

      if (!body.owner_id) {
        res
          .status(400)
          .send({ ok: false, data: { relation: null, entity: null }, error: 'Missing owner_id' });
        return;
      }

      if (!body.relation) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Missing relation',
        });
        return;
      }

      const entity = await getEntity(body);
      if (!entity) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: body.numero_ddecpp ? "Ce Centre de Collecte n'existe pas" : 'Missing entity_id',
        });
        return;
      }

      let isAdmin = await checkIfUserIsAdmin(body, req.user, entity);
      if (!(await checkIfUserCanCrudEntityRelation(body, req.user, isAdmin))) {
        res.status(403).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Unauthorized',
        });
        return;
      }

      const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
        where: {
          deleted_at: null,
          owner_id: body.owner_id,
          relation: body.relation as EntityRelationType,
          entity_id: entity.id,
        },
      });

      if (existingEntityRelation) {
        const lastAdminSituation = await getLastAdminSituation(existingEntityRelation);
        if (lastAdminSituation === 'LAST_ADMIN_WITH_OTHER_USERS') {
          res.status(409).send({
            ok: false,
            data: { relation: null, entity: null },
            error:
              'Vous êtes le seul administrateur de cette entité. Nommez un autre administrateur avant de la quitter.',
          });
          return;
        }
        // seul utilisateur d'une association de chasse : la quitter la supprime.
        // les autres entités (ETG, SVI...) sont gérées par l'équipe Zacharie
        const softDeleteEntity =
          lastAdminSituation === 'SOLE_USER' && entity.type === EntityTypes.PREMIER_DETENTEUR;
        if (lastAdminSituation === 'SOLE_USER' && !softDeleteEntity) {
          res.status(409).send({
            ok: false,
            data: { relation: null, entity: null },
            error:
              "Vous êtes le seul utilisateur de cette entité. Contactez l'équipe Zacharie pour la quitter.",
          });
          return;
        }
        await prisma.entityAndUserRelations.delete({
          where: {
            id: existingEntityRelation.id,
          },
        });
        if (softDeleteEntity) {
          await prisma.entity.update({
            where: { id: entity.id },
            data: { deleted_at: new Date() },
          });
        }
        if (existingEntityRelation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          await unlinkBrevoCompanyToContact(entity, req.user);
        }
      }

      res.status(200).send({ ok: true, data: { relation: null, entity: null }, error: '' });
      return;
    }
  )
);

export default router;
