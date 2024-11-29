import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { RequestWithUser } from '~/types/request';
const router = express.Router();
import prisma from '~/prisma';
import jwt from 'jsonwebtoken';
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
import { cookieOptions, JWT_MAX_AGE } from '~/utils/cookie';
import { SECRET } from '~/config';

router.post(
  '/user/connect-as',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body;
    const email = body['email-utilisateur'] as string;
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
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body;

    const createdUser = await prisma.user.create({
      data: {
        id: await createUserId(),
        email: body[Prisma.UserScalarFieldEnum.email],
        roles: body[Prisma.UserScalarFieldEnum.roles] as UserRoles[],
      },
    });

    res.status(200).send({ ok: true, data: { user: createdUser }, error: null });
  }),
);

router.get(
  '/user/:user_id',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.params.user_id;
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      res.status(401).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }
    const allEntities = await prisma.entity.findMany({
      orderBy: {
        updated_at: 'desc',
      },
    });
    const userEntitiesRelations = await prisma.entityAndUserRelations.findMany({
      where: {
        owner_id: user.id,
      },
      orderBy: {
        updated_at: 'desc',
      },
      include: {
        EntityRelatedWithUser: true,
      },
    });

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
    });
  }),
);

router.get(
  '/users',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const users = await prisma.user.findMany({
      orderBy: {
        updated_at: 'desc',
      },
    });
    res.status(200).send({
      ok: true,
      data: users,
      error: '',
    });
  }),
);

router.get(
  '/entite/:entity_id',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const entity = await prisma.entity.findUnique({
      where: {
        id: req.params.entity_id,
      },
      include: {
        EntityRelatedWithUser: {
          select: {
            relation: true,
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
    });
    if (!entity) {
      res.status(401).send({ ok: false, data: null, error: 'Unauthorized' });
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
      select: {
        id: true,
        email: true,
        nom_de_famille: true,
        prenom: true,
        code_postal: true,
        ville: true,
        roles: true,
      },
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
      select: {
        id: true,
        email: true,
        nom_de_famille: true,
        prenom: true,
        code_postal: true,
        ville: true,
        roles: true,
      },
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
    });
  }),
);

router.get(
  '/entites',
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
    });
  }),
);

router.get(
  '/feis',
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
