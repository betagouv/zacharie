import express from 'express';
import { catchErrors } from '../middlewares/errors';
const router = express.Router();
import prisma from '~/prisma';
import jwt from 'jsonwebtoken';
import createUserId from '~/utils/createUserId';
import { EntityRelationType, EntityTypes, Prisma, UserRoles } from '@prisma/client';
import { cookieOptions, JWT_MAX_AGE } from '~/utils/cookie';
import { SECRET } from '~/config';
import { userAdminSelect } from '~/types/user';
import type {
  AdminGetEntityResponse,
  AdminActionEntityResponse,
  AdminUsersResponse,
  AdminUserDataResponse,
  AdminEntitiesResponse,
  AdminNewEntityResponse,
  AdminNewUserDataResponse,
} from '~/types/responses';
import passport from 'passport';
import validateUser from '~/middlewares/validateUser';
import { entityAdminInclude } from '~/types/entity';

router.post(
  '/user/connect-as',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body;
    const email = body.email;
    console.log('body', body);
    console.log('Email:', email);
    if (!email) {
      res.status(400).send({
        ok: false,
        data: null,
        message: null,
        error: 'Veuillez renseigner votre email',
      });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(400).send({
        ok: false,
        data: null,
        message: null,
        error: "Cet utilisateur n'existe pas",
      });
      return;
    }
    const token = jwt.sign({ userId: user.id }, SECRET, {
      expiresIn: JWT_MAX_AGE,
    });
    res.cookie('zacharie_express_jwt', token, cookieOptions());
    res.status(200).send({ ok: true, data: { user }, error: null });
  }),
);

router.post(
  '/user/nouveau',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body;

    const createdUser = await prisma.user.create({
      data: {
        id: await createUserId(),
        email: body[Prisma.UserScalarFieldEnum.email],
        roles: body[Prisma.UserScalarFieldEnum.roles] as UserRoles[],
      },
    });

    res
      .status(200)
      .send({ ok: true, data: { user: createdUser }, error: '' } satisfies AdminNewUserDataResponse);
  }),
);

router.get(
  '/user/:user_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.params.user_id;
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      res.status(401).send({ ok: false, data: null, error: 'Unauthorized' } satisfies AdminUserDataResponse);
      return;
    }
    const allEntities = await prisma.entity.findMany({
      orderBy: {
        updated_at: 'desc',
      },
    });
    const userEntitiesRelations = await prisma.entityAndUserRelations
      .findMany({
        where: {
          owner_id: user.id,
        },
        orderBy: {
          updated_at: 'desc',
        },
        include: {
          EntityRelatedWithUser: true,
        },
      })
      .then((data) =>
        data.map((rel) => ({
          ...rel.EntityRelatedWithUser,
          relation: rel.relation,
        })),
      );

    res.status(200).send({
      ok: true,
      data: {
        user,
        identityDone:
          !!user.nom_de_famille &&
          !!user.prenom &&
          !!user.telephone &&
          !!user.addresse_ligne_1 &&
          !!user.code_postal &&
          !!user.ville,
        examinateurDone: !user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) ? true : !!user.numero_cfei,
        allEntities,
        userEntitiesRelations,
      },
      error: '',
    } satisfies AdminUserDataResponse);
  }),
);

router.get(
  '/users',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const users = await prisma.user.findMany({
      orderBy: {
        updated_at: 'desc',
      },
    });
    res.status(200).send({
      ok: true,
      data: { users },
      error: '',
    } satisfies AdminUsersResponse);
  }),
);

router.get(
  '/entities',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const entities = await prisma.entity.findMany({
      orderBy: {
        type: 'asc',
      },
    });
    res.status(200).send({
      ok: true,
      data: { entities },
      error: '',
    } satisfies AdminEntitiesResponse);
  }),
);

router.get(
  '/entity/:entity_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const entity = await prisma.entity.findUnique({
      where: {
        id: req.params.entity_id,
      },
      include: entityAdminInclude,
    });
    if (!entity) {
      res.status(401).send({ ok: false, data: null, error: 'Unauthorized' } satisfies AdminGetEntityResponse);
      return;
    }

    const usersWithEntityType = await prisma.user.findMany({
      where: {
        roles:
          entity.type === EntityTypes.PREMIER_DETENTEUR
            ? {
                hasSome: [UserRoles.PREMIER_DETENTEUR, UserRoles.EXAMINATEUR_INITIAL],
              }
            : {
                has: entity.type,
              },
        id: {
          notIn: entity.EntityRelatedWithUser.filter(
            (entityRelation) => entityRelation.relation === EntityRelationType.WORKING_FOR,
          ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
      select: userAdminSelect,
    });

    const potentialPartenaires = await prisma.user.findMany({
      where: {
        id: {
          notIn: entity.EntityRelatedWithUser.filter(
            (entityRelation) => entityRelation.relation === EntityRelationType.WORKING_WITH,
          ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
      select: userAdminSelect,
    });

    const collecteursRelatedToETG =
      entity.type !== EntityTypes.ETG
        ? []
        : await prisma.eTGAndEntityRelations
            .findMany({
              where: {
                etg_id: entity.id,
                entity_type: EntityTypes.COLLECTEUR_PRO,
              },
              orderBy: {
                updated_at: 'desc',
              },
              include: {
                EntityRelatedWithETG: true,
              },
            })
            .then((data) => data.map((rel) => rel.EntityRelatedWithETG));

    const potentialCollecteursRelatedToETG = await prisma.entity.findMany({
      where: {
        type: EntityTypes.COLLECTEUR_PRO,
        id: {
          notIn: collecteursRelatedToETG.map((entity) => entity.id),
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    const svisRelatedToETG =
      entity.type !== EntityTypes.ETG
        ? []
        : await prisma.eTGAndEntityRelations
            .findMany({
              where: {
                etg_id: entity.id,
                entity_type: EntityTypes.SVI,
              },
              orderBy: {
                updated_at: 'desc',
              },
              include: {
                EntityRelatedWithETG: true,
              },
            })
            .then((data) => data.map((rel) => rel.EntityRelatedWithETG));

    const potentialSvisRelatedToETG = await prisma.entity.findMany({
      where: {
        type: EntityTypes.SVI,
        id: {
          notIn: svisRelatedToETG.map((entity) => entity.id),
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    const etgsRelatedWithEntity =
      entity.type !== EntityTypes.COLLECTEUR_PRO && entity.type !== EntityTypes.SVI
        ? []
        : await prisma.eTGAndEntityRelations
            .findMany({
              where: {
                entity_id: entity.id,
              },
              orderBy: {
                updated_at: 'desc',
              },
              include: {
                ETGRelatedWithEntity: true,
              },
            })
            .then((data) => data.map((rel) => rel.ETGRelatedWithEntity));

    const potentialEtgsRelatedWithEntity =
      entity.type !== EntityTypes.COLLECTEUR_PRO && entity.type !== EntityTypes.SVI
        ? []
        : await prisma.entity.findMany({
            where: {
              type: EntityTypes.ETG,
              id: {
                notIn: etgsRelatedWithEntity.map((entity) => entity.id),
              },
            },
            orderBy: {
              updated_at: 'desc',
            },
          });

    res.status(200).send({
      ok: true,
      data: {
        entity,
        usersWithEntityType,
        potentialPartenaires,
        collecteursRelatedToETG,
        potentialCollecteursRelatedToETG,
        svisRelatedToETG,
        potentialSvisRelatedToETG,
        etgsRelatedWithEntity,
        potentialEtgsRelatedWithEntity,
      },
      error: '',
    } satisfies AdminGetEntityResponse);
  }),
);

router.post(
  '/entity/nouvelle',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body;

    const createdEntity = await prisma.entity.create({
      data: {
        raison_sociale: body[Prisma.EntityScalarFieldEnum.raison_sociale],
        nom_d_usage: body[Prisma.EntityScalarFieldEnum.raison_sociale],
        type: body[Prisma.EntityScalarFieldEnum.type],
      },
      include: entityAdminInclude,
    });

    res
      .status(200)
      .send({ ok: true, data: { entity: createdEntity }, error: '' } satisfies AdminNewEntityResponse);
  }),
);

router.post(
  '/entity/:entity_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body;

    if (body._action === 'remove-etg-relation') {
      await prisma.eTGAndEntityRelations.delete({
        where: {
          etg_id_entity_id: body[Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id_entity_id],
        },
      });
      const entity = await prisma.entity.findUnique({
        where: {
          id: req.params.entity_id,
        },
        include: entityAdminInclude,
      });

      res
        .status(200)
        .send({ ok: true, data: { entity: entity! }, error: '' } satisfies AdminActionEntityResponse);
      return;
    }
    if (body._action === 'add-etg-relation') {
      const data: Prisma.ETGAndEntityRelationsUncheckedCreateInput = {
        etg_id_entity_id: body[Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id_entity_id],
        entity_id: body[Prisma.ETGAndEntityRelationsScalarFieldEnum.entity_id],
        etg_id: body[Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id],
        entity_type: body[Prisma.ETGAndEntityRelationsScalarFieldEnum.entity_type] as EntityTypes,
      };
      await prisma.eTGAndEntityRelations.upsert({
        where: {
          etg_id_entity_id: body[Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id_entity_id],
        },
        create: data,
        update: data,
      });
      const entity = await prisma.entity.findUnique({
        where: {
          id: req.params.entity_id,
        },
        include: entityAdminInclude,
      });

      res
        .status(200)
        .send({ ok: true, data: { entity: entity! }, error: '' } satisfies AdminActionEntityResponse);
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
      include: entityAdminInclude,
    });

    res
      .status(200)
      .send({ ok: true, data: { entity: updatedEntity }, error: '' } satisfies AdminActionEntityResponse);
  }),
);

router.get(
  '/feis',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Fetch the fiche data along with the required intervenants
    const feis = await prisma.fei.findMany({
      where: { deleted_at: null },
      include: {
        FeiCurrentUser: { select: { email: true } }, // Fetching the current user's email
        FeiCurrentEntity: { select: { nom_d_usage: true } }, // Fetching the current entity's raison sociale
        FeiNextEntity: { select: { nom_d_usage: true } }, // Fetching the next entity's raison sociale
        FeiNextUser: { select: { email: true } }, // Fetching the next user's email
        FeiExaminateurInitialUser: { select: { email: true } }, // Fetching the examinateur's email
        FeiPremierDetenteurUser: { select: { email: true } }, // Fetching the premier detenteur's email
        FeiPremierDetenteurEntity: { select: { nom_d_usage: true } }, // Fetching the premier detenteur's raison sociale
        FeiIntermediaires: {
          include: {
            FeiIntermediaireEntity: {
              select: {
                nom_d_usage: true,
                type: true,
              },
            },
          },
        },
        FeiSviEntity: { select: { nom_d_usage: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).send({
      ok: true,
      data: {
        feis: feis.map((fei) => ({
          ...fei,
          responsabilites: [
            {
              type: 'Propriétaire actuel',
              role: fei.fei_current_owner_role,
              email: fei.FeiCurrentUser?.email,
              nom_d_usage: fei.FeiCurrentEntity?.nom_d_usage,
            },
            {
              type: 'Propriétaire suivant',
              role: fei.fei_next_owner_role,
              email: fei.FeiNextUser?.email,
              nom_d_usage: fei.FeiNextEntity?.nom_d_usage,
            },
          ],
          intervenants: [
            {
              type: 'Examinateur Initial',
              email: fei.FeiExaminateurInitialUser?.email,
              nom_d_usage: null,
            },
            {
              type: 'Premier Detenteur',
              email: fei.FeiPremierDetenteurUser?.email,
              nom_d_usage: null,
            },
            ...fei.FeiIntermediaires.map((inter) => ({
              type: inter.FeiIntermediaireEntity.type,
              email: null,
              nom_d_usage: inter.FeiIntermediaireEntity.nom_d_usage,
            })),
            {
              type: 'SVI',
              email: null,
              nom_d_usage: fei.FeiSviEntity?.nom_d_usage,
            },
          ],
        })),
      },
      error: '',
    });
  }),
);

export default router;