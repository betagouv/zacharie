import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
import type { EntitiesWorkingForResponse, PartenairesResponse, UserEntityResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  Prisma,
  User,
  UserRoles,
} from '@prisma/client';
import {
  sortEntitiesByTypeAndId,
  sortEntitiesRelationsByTypeAndId,
} from '~/utils/sort-things-by-type-and-id.server';
import {
  createBrevoContact,
  linkBrevoCompanyToContact,
  sendEmail,
  updateBrevoContact,
  updateOrCreateBrevoCompany,
} from '~/third-parties/brevo';
import { EntitiesById, entityAdminInclude } from '~/types/entity';
import { sanitize } from '~/utils/sanitize';
import { z } from 'zod';
import createUserId from '~/utils/createUserId';

router.get(
  '/fei/:entity_id/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    if (!user.activated) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }
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
        deleted_at: null,
      },
    });

    if (!entity) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
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
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response<EntitiesWorkingForResponse>,
      next: express.NextFunction,
    ) => {
      const user = req.user!;

      const entityOnboardingInclude = {
        EntityRelationsWithUsers: {
          where: { owner_id: user.id },
          select: {
            id: true,
            relation: true,
            status: true,
            owner_id: true,
            entity_id: true,
          },
        },
      } as unknown as typeof entityAdminInclude;

      const include = user.activated ? entityAdminInclude : entityOnboardingInclude;

      const allEntities = await prisma.entity.findMany({
        where: {
          deleted_at: null,
          type: { not: EntityTypes.CCG },
          ...(user.roles.includes(UserRoles.ADMIN) ? {} : { for_testing: false }),
        },
        include,
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

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
        include,
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

      const [allEntitiesIds, allEntitiesByTypeAndId] = sortEntitiesByTypeAndId(allEntities);
      const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(
        entitiesUserCanHandleOnBehalf,
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
  '/partenaires',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<PartenairesResponse>, next: express.NextFunction) => {
      const user = req.user!;

      const entityOnboardingInclude = {
        EntityRelationsWithUsers: {
          where: { owner_id: user.id },
          select: {
            id: true,
            relation: true,
            status: true,
            owner_id: true,
            entity_id: true,
          },
        },
      } as unknown as typeof entityAdminInclude;

      const include = user.activated ? entityAdminInclude : entityOnboardingInclude;

      const allEntities = await prisma.entity.findMany({
        where: {
          deleted_at: null,
          type: {
            in: [
              EntityTypes.COMMERCE_DE_DETAIL,
              EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
              EntityTypes.ASSOCIATION_CARITATIVE,
              EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
              EntityTypes.CONSOMMATEUR_FINAL,
            ],
          },
          ...(user.roles.includes(UserRoles.ADMIN) ? {} : { for_testing: false }),
        },
        include,
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

      const entitiesUserCanHandleOnBehalf = await prisma.entity.findMany({
        where: {
          deleted_at: null,
          EntityRelationsWithUsers: {
            some: {
              owner_id: user.id,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
              deleted_at: null,
              EntityRelatedWithUser: {
                type: {
                  in: [
                    EntityTypes.COMMERCE_DE_DETAIL,
                    EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
                    EntityTypes.CONSOMMATEUR_FINAL,
                  ],
                },
              },
            },
          },
        },
        include,
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

      const allEntitiesById: EntitiesById = {};
      for (const entity of allEntities) {
        allEntitiesById[entity.id] = entity;
      }
      const userEntitiesById: EntitiesById = {};
      for (const entity of entitiesUserCanHandleOnBehalf) {
        userEntitiesById[entity.id] = entity;
      }
      res.status(200).send({
        ok: true,
        data: {
          allEntitiesById,
          userEntitiesById,
        },
        error: '',
      });
    },
  ),
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
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          EntityRelatedWithUser: {
            type: EntityTypes.CCG,
          },
          deleted_at: null,
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

const associationDeChasseSchema = z.object({
  raison_sociale: z.string(),
  address_ligne_1: z.string(),
  address_ligne_2: z.string(),
  code_postal: z.string(),
  ville: z.string(),
  siret: z.string().optional(),
  zacharie_compatible: z.boolean().optional(),
});

router.post(
  '/association-de-chasse',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;

    const result = associationDeChasseSchema.safeParse(req.body);
    if (!result.success) {
      const error = new Error(result.error.message);
      res.status(406);
      return next(error);
    }
    const body = result.data;

    const data: Prisma.EntityUncheckedCreateInput = {
      raison_sociale: sanitize(body[Prisma.EntityScalarFieldEnum.raison_sociale]),
      nom_d_usage: sanitize(body[Prisma.EntityScalarFieldEnum.raison_sociale]),
      type: EntityTypes.PREMIER_DETENTEUR,
      address_ligne_1: sanitize(body[Prisma.EntityScalarFieldEnum.address_ligne_1]),
      address_ligne_2: sanitize(body[Prisma.EntityScalarFieldEnum.address_ligne_2]),
      code_postal: sanitize(body[Prisma.EntityScalarFieldEnum.code_postal]),
      ville: sanitize(body[Prisma.EntityScalarFieldEnum.ville]),
      siret: sanitize(body[Prisma.EntityScalarFieldEnum.siret]) || null,
      zacharie_compatible: true,
    };

    let createdEntity = await prisma.entity.create({
      data,
    });

    createdEntity = await updateOrCreateBrevoCompany(createdEntity);

    const createdEntityRelation = await prisma.entityAndUserRelations.create({
      data: {
        owner_id: user.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        entity_id: createdEntity.id,
        status: EntityRelationStatus.ADMIN,
      },
    });

    await sendEmail({
      emails: ['contact@zacharie.beta.gouv.fr'],
      subject: `Nouvelle association de chasse pré-enregistrée dans Zacharie`,
      text: `Une nouvelle association de chasse a été pré-enregistrée dans Zacharie\u00A0: ${createdEntity.nom_d_usage}`,
    });

    await linkBrevoCompanyToContact(createdEntity, user);

    res.status(200).send({ ok: true, error: '', data: { createdEntity, createdEntityRelation } });
  }),
);

const partenaireSchema = z.object({
  raison_sociale: z.string(),
  address_ligne_1: z.string(),
  address_ligne_2: z.string(),
  code_postal: z.string(),
  email: z.string(),
  nom_de_famille: z.string(),
  prenom: z.string(),
  ville: z.string(),
  siret: z.string().optional(),
  zacharie_compatible: z.boolean().optional(),
  type: z.enum([
    EntityTypes.COMMERCE_DE_DETAIL,
    EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
    EntityTypes.ASSOCIATION_CARITATIVE,
    EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
    EntityTypes.CONSOMMATEUR_FINAL,
  ]),
});

router.post(
  '/partenaire',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<UserEntityResponse>, next: express.NextFunction) => {
      const user = req.user!;

      const result = partenaireSchema.safeParse(req.body);
      if (!result.success) {
        const error = new Error(result.error.message);
        res.status(406);
        return next(error);
      }
      const body = result.data;

      const data: Prisma.EntityUncheckedCreateInput = {
        raison_sociale: sanitize(body[Prisma.EntityScalarFieldEnum.raison_sociale]),
        nom_d_usage: sanitize(body[Prisma.EntityScalarFieldEnum.raison_sociale]),
        type: body[Prisma.EntityScalarFieldEnum.type] as EntityTypes,
        address_ligne_1: sanitize(body[Prisma.EntityScalarFieldEnum.address_ligne_1]),
        address_ligne_2: sanitize(body[Prisma.EntityScalarFieldEnum.address_ligne_2]),
        code_postal: sanitize(body[Prisma.EntityScalarFieldEnum.code_postal]),
        ville: sanitize(body[Prisma.EntityScalarFieldEnum.ville]),
        siret: sanitize(body[Prisma.EntityScalarFieldEnum.siret]) || null,
        zacharie_compatible: true,
      };

      const existingEntity = await prisma.entity.findFirst({
        where: {
          raison_sociale: data.raison_sociale,
          type: data.type,
          code_postal: data.code_postal,
          ville: data.ville,
          siret: data.siret,
        },
      });

      if (existingEntity) {
        const error = new Error('Entité déjà existante');
        res.status(406);
        return next(error);
      }

      // Vérifier si l'email est déjà utilisé par un compte existant AVANT de créer l'entité
      const existingUser = await prisma.user.findUnique({
        where: {
          email: body[Prisma.UserScalarFieldEnum.email],
        },
      });

      if (existingUser && existingUser.roles.length > 0) {
        const error = new Error(
          "Cette adresse email est déjà associée à un compte Zacharie existant. Veuillez utiliser une autre adresse email ou contacter l'utilisateur pour qu'il ajoute lui-même cette entité à son compte.",
        );
        res.status(409);
        return next(error);
      }

      let createdEntity = await prisma.entity.create({ data });

      createdEntity = await updateOrCreateBrevoCompany(createdEntity);

      let ownerUser: User;
      if (!existingUser) {
        ownerUser = await prisma.user.create({
          data: {
            id: await createUserId(),
            email: body[Prisma.UserScalarFieldEnum.email],
            nom_de_famille: body[Prisma.UserScalarFieldEnum.nom_de_famille],
            prenom: body[Prisma.UserScalarFieldEnum.prenom],
            roles: [body[Prisma.EntityScalarFieldEnum.type] as UserRoles],
          },
        });
      } else {
        // L'utilisateur existe mais n'a pas de rôles (compte vide)
        ownerUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            roles: [body[Prisma.EntityScalarFieldEnum.type] as UserRoles],
            nom_de_famille: body[Prisma.UserScalarFieldEnum.nom_de_famille],
            prenom: body[Prisma.UserScalarFieldEnum.prenom],
          },
        });
      }

      await prisma.entityAndUserRelations.create({
        data: {
          owner_id: ownerUser.id,
          entity_id: createdEntity.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.ADMIN,
        },
      });

      const createdEntityRelation = await prisma.entityAndUserRelations.create({
        data: {
          owner_id: user.id,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          entity_id: createdEntity.id,
          status: EntityRelationStatus.MEMBER,
        },
      });

      await sendEmail({
        emails: ['contact@zacharie.beta.gouv.fr'],
        subject: `Nouveau partenaire pré-enregistré dans Zacharie`,
        text: `Un nouveau partenaire a été pré-enregistré dans Zacharie\u00A0: ${createdEntity.nom_d_usage}`,
      });

      ownerUser = await createBrevoContact(ownerUser, 'USER');
      await linkBrevoCompanyToContact(createdEntity, ownerUser);

      res
        .status(200)
        .send({ ok: true, error: '', data: { entity: createdEntity, relation: createdEntityRelation } });
    },
  ),
);

const ccgSchema = z.object({
  nom_d_usage: z.string(),
  address_ligne_1: z.string(),
  address_ligne_2: z.string(),
  code_postal: z.string(),
  ville: z.string(),
  siret: z.string().optional(),
  numero_ddecpp: z.string().optional(),
  zacharie_compatible: z.boolean().optional(),
});

router.post(
  '/ccg',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;

    const result = ccgSchema.safeParse(req.body);
    if (!result.success) {
      const error = new Error(result.error.message);
      res.status(406);
      return next(error);
    }
    const body = result.data;

    const data: Prisma.EntityUncheckedCreateInput = {
      raison_sociale: sanitize(body[Prisma.EntityScalarFieldEnum.nom_d_usage]),
      nom_d_usage: sanitize(body[Prisma.EntityScalarFieldEnum.nom_d_usage]),
      type: EntityTypes.CCG,
      ccg_status: 'Pré-enregistré dans Zacharie',
      address_ligne_1: sanitize(body[Prisma.EntityScalarFieldEnum.address_ligne_1]),
      address_ligne_2: sanitize(body[Prisma.EntityScalarFieldEnum.address_ligne_2]),
      code_postal: sanitize(body[Prisma.EntityScalarFieldEnum.code_postal]),
      ville: sanitize(body[Prisma.EntityScalarFieldEnum.ville]),
      siret: sanitize(body[Prisma.EntityScalarFieldEnum.siret]) || null,
      numero_ddecpp: sanitize(body[Prisma.EntityScalarFieldEnum.numero_ddecpp]) || null,
      zacharie_compatible: true,
    };

    const createdEntity = await prisma.entity.create({
      data,
    });

    const createdEntityRelation = await prisma.entityAndUserRelations.create({
      data: {
        owner_id: user.id,
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        status: EntityRelationStatus.ADMIN,
        entity_id: createdEntity.id,
      },
    });

    await sendEmail({
      emails: ['contact@zacharie.beta.gouv.fr'],
      subject: `Nouveau CCG pré-enregistré dans Zacharie`,
      text: `Un nouveau CCG a été pré-enregistré dans Zacharie\u00A0: ${createdEntity.nom_d_usage}`,
    });

    res.status(200).send({ ok: true, error: '', data: { createdEntity, createdEntityRelation } });
  }),
);

export default router;
