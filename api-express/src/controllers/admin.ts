import express from 'express';
import { catchErrors } from '~/middlewares/errors';
import crypto from 'crypto';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import jwt from 'jsonwebtoken';
import createUserId from '~/utils/createUserId';
import {
  ApiKeyApprovalStatus,
  ApiKeyScope,
  Entity,
  EntityRelationType,
  EntityTypes,
  Prisma,
  User,
  UserRoles,
} from '@prisma/client';
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
  AdminApiKeysResponse,
  AdminApiKeyResponse,
  AdminApiKeyAndApprovalsResponse,
  AdminOfficialCfeisResponse,
  AdminCarcassesIntermediairesResponse,
  AdminCarcassesResponse,
  AdminCarcasseDetailResponse,
  AdminCcgPreviewResponse,
  CcgPreviewRow,
  CcgPreviewModifiedRow,
  AdminCcgImportResponse,
  AdminDashboardResponse,
  AdminPartsDeMarcheResponse,
  UserConnexionResponse,
} from '~/types/responses';
import passport from 'passport';
import validateUser from '~/middlewares/validateUser';
import { entityAdminInclude } from '~/types/entity';
import { createBrevoContact, updateOrCreateBrevoCompany } from '~/third-parties/brevo';
import slugify from 'slugify';
import dayjs from 'dayjs';

router.post(
  '/user/connect-as',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction,
    ) => {
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
      res.cookie(
        'zacharie_express_jwt',
        token,
        cookieOptions(req.headers.platform === 'native' ? false : true),
      );
      res.status(200).send({
        ok: true,
        data: { user },
        error: null,
        message: '',
      });
    },
  ),
);

router.post(
  '/user/nouveau',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminNewUserDataResponse>,
      next: express.NextFunction,
    ) => {
      const body = req.body;

      const createdUser = await prisma.user.create({
        data: {
          id: await createUserId(),
          email: body[Prisma.UserScalarFieldEnum.email],
          roles: body[Prisma.UserScalarFieldEnum.roles] as UserRoles[],
        },
      });

      await createBrevoContact(createdUser, 'ADMIN');

      res.status(200).send({ ok: true, data: { user: createdUser }, error: '' });
    },
  ),
);

router.get(
  '/user/:user_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminUserDataResponse>,
      next: express.NextFunction,
    ) => {
      const userId = req.params.user_id;
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
      if (!user) {
        res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }
      const allEntities = await prisma.entity.findMany({
        where: {
          deleted_at: null,
        },
        orderBy: {
          updated_at: 'desc',
        },
      });
      const userEntitiesRelations = await prisma.entity.findMany({
        where: {
          EntityRelationsWithUsers: {
            some: {
              owner_id: user.id,
              deleted_at: null,
            },
          },
          deleted_at: null,
        },
        orderBy: {
          updated_at: 'desc',
        },
        include: entityAdminInclude,
      });

      let officialCfei = null;
      if (user.numero_cfei) {
        officialCfei = await prisma.officialCfei.findUnique({
          where: { numero_cfei: user.numero_cfei.toUpperCase() },
          select: {
            numero_cfei: true,
            nom: true,
            prenom: true,
            departement: true,
          },
        });
      }

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
          examinateurDone: !user.roles.includes(UserRoles.CHASSEUR)
            ? true
            : !!user.est_forme_a_l_examen_initial && !!user.numero_cfei,
          allEntities,
          userEntitiesRelations,
          officialCfei,
        },
        error: '',
      });
    },
  ),
);

router.get(
  '/users',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (req: express.Request, res: express.Response<AdminUsersResponse>, next: express.NextFunction) => {
      const users = await prisma.user.findMany({
        orderBy: {
          last_seen_at: { sort: 'desc', nulls: 'last' },
        },
      });
      res.status(200).send({
        ok: true,
        data: { users },
        error: '',
      });
    },
  ),
);

router.get(
  '/entities',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminEntitiesResponse>,
      next: express.NextFunction,
    ) => {
      const { search, type, zacharie_compatible } = req.query as Record<string, string | undefined>;
      const where: Prisma.EntityWhereInput = { deleted_at: null };
      if (type) where.type = type as EntityTypes;
      if (zacharie_compatible) where.zacharie_compatible = zacharie_compatible === 'true';
      if (search) {
        where.OR = [
          { nom_d_usage: { contains: search, mode: 'insensitive' } },
          { raison_sociale: { contains: search, mode: 'insensitive' } },
          { numero_ddecpp: { contains: search, mode: 'insensitive' } },
          { siret: { contains: search, mode: 'insensitive' } },
          { address_ligne_1: { contains: search, mode: 'insensitive' } },
          { code_postal: { contains: search, mode: 'insensitive' } },
          { ville: { contains: search, mode: 'insensitive' } },
        ];
      }

      const baseWhere: Prisma.EntityWhereInput = { deleted_at: null };
      if (search) {
        baseWhere.OR = where.OR;
      }
      if (zacharie_compatible) baseWhere.zacharie_compatible = zacharie_compatible === 'true';

      const [entities, allCount, ...typeCounts] = await Promise.all([
        prisma.entity.findMany({
          where,
          orderBy: [{ type: 'asc' }, { zacharie_compatible: 'desc' }, { nom_d_usage: 'asc' }],
        }),
        prisma.entity.count({ where: baseWhere }),
        ...Object.values(EntityTypes).map((t) =>
          prisma.entity.count({ where: { ...baseWhere, type: t } }),
        ),
      ]);

      const counts: Record<string, number> = { all: allCount };
      Object.values(EntityTypes).forEach((t, i) => {
        counts[t] = typeCounts[i];
      });

      res.status(200).send({
        ok: true,
        data: { entities, counts },
        error: '',
      });
    },
  ),
);

router.get(
  '/entity/:entity_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminGetEntityResponse>,
      next: express.NextFunction,
    ) => {
      const entity = await prisma.entity.findUnique({
        where: {
          id: req.params.entity_id,
          deleted_at: null,
        },
        include: entityAdminInclude,
      });
      if (!entity) {
        res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }

      const canTakeFichesForEntity =
        entity.type === EntityTypes.CCG
          ? []
          : await prisma.user.findMany({
              where: {
                roles: (() => {
                  if (entity.type === EntityTypes.PREMIER_DETENTEUR) {
                    return {
                      has: UserRoles.CHASSEUR,
                    };
                  }
                  if (
                    entity.type === EntityTypes.ETG ||
                    entity.type === EntityTypes.COLLECTEUR_PRO ||
                    entity.type === EntityTypes.SVI
                  ) {
                    return {
                      has: entity.type,
                    };
                  }
                })(),
                id: {
                  notIn: entity.EntityRelationsWithUsers.filter(
                    (entityRelation) =>
                      entityRelation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                  ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
                },
              },
              orderBy: {
                updated_at: 'desc',
              },
              select: userAdminSelect,
            });

      const canSendFichesToEntity =
        entity.type === EntityTypes.CCG
          ? []
          : await prisma.user.findMany({
              where: {
                id: {
                  notIn: entity.EntityRelationsWithUsers.filter(
                    (entityRelation) =>
                      entityRelation.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
                  ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
                },
                roles: {
                  hasSome:
                    entity.type === EntityTypes.ETG || entity.type === EntityTypes.COLLECTEUR_PRO
                      ? [UserRoles.CHASSEUR, UserRoles.ETG, UserRoles.COLLECTEUR_PRO]
                      : entity.type === EntityTypes.PREMIER_DETENTEUR
                        ? [UserRoles.CHASSEUR]
                        : entity.type === EntityTypes.SVI
                          ? [UserRoles.ETG]
                          : [],
                },
              },
              orderBy: {
                updated_at: 'desc',
              },
              select: userAdminSelect,
            });

      const sviRelatedToETG =
        entity.type !== EntityTypes.ETG
          ? null
          : !entity.etg_linked_to_svi_id
            ? null
            : await prisma.entity.findUnique({
                where: {
                  id: entity.etg_linked_to_svi_id,
                },
              });

      const potentialSvisRelatedToETG = await prisma.entity.findMany({
        where: {
          type: EntityTypes.SVI,
          id: {
            not: sviRelatedToETG?.id,
          },
          deleted_at: null,
        },
        orderBy: {
          updated_at: 'desc',
        },
      });

      const etgsRelatedWithSvi =
        entity.type !== EntityTypes.SVI
          ? []
          : await prisma.entity.findMany({
              where: {
                etg_linked_to_svi_id: entity.id,
                deleted_at: null,
              },
              orderBy: {
                updated_at: 'desc',
              },
            });

      const potentialEtgsRelatedWithSvi =
        entity.type !== EntityTypes.SVI
          ? []
          : await prisma.entity.findMany({
              where: {
                type: EntityTypes.ETG,
                deleted_at: null,
                id: {
                  notIn: etgsRelatedWithSvi.map((entity) => entity.id),
                },
              },
              orderBy: {
                updated_at: 'desc',
              },
            });

      const dedicatedApiKey = await prisma.apiKey.findFirst({
        where: {
          dedicated_to_entity_id: entity.id,
        },
      });

      res.status(200).send({
        ok: true,
        data: {
          entity,
          dedicatedApiKey,
          canTakeFichesForEntity,
          canSendFichesToEntity,
          sviRelatedToETG,
          potentialSvisRelatedToETG,
          etgsRelatedWithSvi,
          potentialEtgsRelatedWithSvi,
        },
        error: '',
      });
    },
  ),
);

router.post(
  '/entity-dedicated-api-key/:entity_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (req: express.Request, res: express.Response<AdminApiKeyResponse>, next: express.NextFunction) => {
      const entity = await prisma.entity.findUnique({
        where: {
          id: req.params.entity_id,
          deleted_at: null,
        },
      });
      if (!entity) {
        res.status(404).send({ ok: false, data: null, error: 'Entity not found' });
        return;
      }

      const createdApiKey = await prisma.apiKey.create({
        data: {
          name: `${entity.nom_d_usage} - Clé API dédiée`,
          slug_for_context: slugify(entity.nom_d_usage, {
            replacement: '-', // replace spaces with replacement character
            remove: undefined, // remove colons and parentheses
            lower: true, // convert to lower case, defaults to `false`
            strict: true, // strip special characters except replacement, defaults to `false`
            locale: 'fr',
            trim: true, // trim leading and trailing replacement chars, defaults to `true`
          }),
          dedicated_to_entity_id: entity.id,
          description: `Clé API dédiée pour l'entité ${entity.nom_d_usage}`,
          private_key: crypto.randomBytes(32).toString('hex'),
          public_key: crypto.randomBytes(32).toString('hex'),
          scopes: [ApiKeyScope.FEI_READ_FOR_ENTITY, ApiKeyScope.CARCASSE_READ_FOR_ENTITY],
          active: true,
        },
      });

      await prisma.apiKeyApprovalByUserOrEntity.create({
        data: {
          api_key_id: createdApiKey.id,
          entity_id: entity.id,
          status: ApiKeyApprovalStatus.APPROVED,
        },
      });

      res.status(200).send({ ok: true, data: { apiKey: createdApiKey }, error: '' });
    },
  ),
);

router.post(
  '/entity/nouvelle',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminNewEntityResponse>,
      next: express.NextFunction,
    ) => {
      const body = req.body;

      const type = body[Prisma.EntityScalarFieldEnum.type] as EntityTypes;
      let code_etbt_certificat;
      if (type === EntityTypes.ETG) {
        const existingEtgs = await prisma.entity.count({
          where: {
            type: EntityTypes.ETG,
          },
        });
        code_etbt_certificat = existingEtgs + 1;
      }

      const entityType = body[Prisma.EntityScalarFieldEnum.type] as EntityTypes;
      const zacharie_compatible =
        entityType === EntityTypes.PREMIER_DETENTEUR ||
        entityType === EntityTypes.SVI ||
        entityType === EntityTypes.CCG;
      const createdEntity = await prisma.entity.create({
        data: {
          raison_sociale: body[Prisma.EntityScalarFieldEnum.raison_sociale],
          nom_d_usage: body[Prisma.EntityScalarFieldEnum.raison_sociale],
          type: body[Prisma.EntityScalarFieldEnum.type],
          zacharie_compatible,
          code_etbt_certificat: code_etbt_certificat
            ? code_etbt_certificat.toString().padStart(2, '0')
            : null,
        },
        include: entityAdminInclude,
      });

      await updateOrCreateBrevoCompany(createdEntity);

      res.status(200).send({ ok: true, data: { entity: createdEntity }, error: '' });
    },
  ),
);

router.post(
  '/entity/:entity_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminActionEntityResponse>,
      next: express.NextFunction,
    ) => {
      const body = req.body;

      const data: Prisma.EntityUncheckedUpdateInput = {};
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.raison_sociale)) {
        data.raison_sociale = body[Prisma.EntityScalarFieldEnum.raison_sociale];
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.nom_d_usage)) {
        data.nom_d_usage = body[Prisma.EntityScalarFieldEnum.nom_d_usage];
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.address_ligne_1)) {
        data.address_ligne_1 = body[Prisma.EntityScalarFieldEnum.address_ligne_1];
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.address_ligne_2)) {
        data.address_ligne_2 = body[Prisma.EntityScalarFieldEnum.address_ligne_2];
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.etg_linked_to_svi_id)) {
        data.etg_linked_to_svi_id = body[Prisma.EntityScalarFieldEnum.etg_linked_to_svi_id] || null;
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.code_postal)) {
        data.code_postal = body[Prisma.EntityScalarFieldEnum.code_postal];
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.prefecture_svi)) {
        data.prefecture_svi = body[Prisma.EntityScalarFieldEnum.prefecture_svi];
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.nom_prenom_responsable)) {
        data.nom_prenom_responsable = body[Prisma.EntityScalarFieldEnum.nom_prenom_responsable];
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.ville)) {
        data.ville = body[Prisma.EntityScalarFieldEnum.ville];
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.siret)) {
        data.siret = body[Prisma.EntityScalarFieldEnum.siret] || null;
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.numero_ddecpp)) {
        data.numero_ddecpp = body[Prisma.EntityScalarFieldEnum.numero_ddecpp] || null;
      }
      if (body.hasOwnProperty(Prisma.EntityScalarFieldEnum.zacharie_compatible)) {
        data.zacharie_compatible = body[Prisma.EntityScalarFieldEnum.zacharie_compatible];
      }

      const updatedEntity = await prisma.entity.update({
        where: {
          id: req.params.entity_id,
        },
        data,
        include: entityAdminInclude,
      });

      await updateOrCreateBrevoCompany(updatedEntity);

      res.status(200).send({
        ok: true,
        data: { entity: updatedEntity },
        error: '',
      });
    },
  ),
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
        CarcasseIntermediaire: {
          include: {
            CarcasseIntermediaireEntity: {
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
              nom_d_usage: '',
            },
            {
              type: 'Premier Detenteur',
              email: fei.FeiPremierDetenteurUser?.email,
              nom_d_usage: '',
            },
            ...Object.values(
              fei.CarcasseIntermediaire.reduce(
                (acc, intermediaire) => {
                  if (acc[intermediaire.intermediaire_entity_id]) return acc;
                  return {
                    ...acc,
                    [intermediaire.intermediaire_entity_id]: {
                      type: intermediaire.intermediaire_role,
                      email: '',
                      nom_d_usage: intermediaire.CarcasseIntermediaireEntity.nom_d_usage,
                    },
                  };
                },
                {} as Record<string, { type: string; email: string; nom_d_usage: string }>,
              ),
            ),
            {
              type: 'SVI',
              email: '',
              nom_d_usage: fei.FeiSviEntity?.nom_d_usage,
            },
          ],
        })),
      },
      error: '',
    });
  }),
);

router.get(
  '/api-keys',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (req: express.Request, res: express.Response<AdminApiKeysResponse>, next: express.NextFunction) => {
      const apiKeys = await prisma.apiKey.findMany({
        orderBy: {
          created_at: 'desc',
        },
        include: {
          approvals: {
            include: {
              User: true,
              Entity: true,
            },
          },
        },
      });

      res.status(200).send({ ok: true, data: { apiKeys }, error: '' });
    },
  ),
);

router.post(
  '/api-key/nouvelle',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (req: express.Request, res: express.Response<AdminApiKeyResponse>, next: express.NextFunction) => {
      const body = req.body;
      const createdApiKey = await prisma.apiKey.create({
        data: {
          name: body[Prisma.ApiKeyScalarFieldEnum.name],
          slug_for_context: slugify(body[Prisma.ApiKeyScalarFieldEnum.name], {
            replacement: '-', // replace spaces with replacement character
            remove: undefined, // remove colons and parentheses
            lower: true, // convert to lower case, defaults to `false`
            strict: true, // strip special characters except replacement, defaults to `false`
            locale: 'fr',
            trim: true, // trim leading and trailing replacement chars, defaults to `true`
          }),
          description: body[Prisma.ApiKeyScalarFieldEnum.description],
          private_key: crypto.randomBytes(32).toString('hex'),
          public_key: crypto.randomBytes(32).toString('hex'),
          scopes: body[Prisma.ApiKeyScalarFieldEnum.scopes] as ApiKeyScope[],
          active: true,
        },
      });

      res.status(200).send({ ok: true, data: { apiKey: createdApiKey }, error: '' });
    },
  ),
);

router.post(
  '/api-key/new-access-token/:api_key_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (req: express.Request, res: express.Response<AdminApiKeyResponse>, next: express.NextFunction) => {
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: req.params.api_key_id },
      });
      if (!apiKey) {
        res.status(404).send({ ok: false, data: null, error: 'API key not found' });
        return;
      }
      const accessToken = crypto.randomBytes(32).toString('hex');
      const updatedApiKey = await prisma.apiKey.update({
        where: { id: req.params.api_key_id },
        data: {
          access_token: accessToken,
          access_token_read_at: null,
        },
      });
      res.status(200).send({ ok: true, data: { apiKey: updatedApiKey }, error: '' });
    },
  ),
);

router.get(
  '/api-key/:api_key_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminApiKeyAndApprovalsResponse>,
      next: express.NextFunction,
    ) => {
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: req.params.api_key_id },
        include: {
          approvals: {
            include: {
              User: true,
              Entity: true,
            },
          },
        },
      });
      if (!apiKey) {
        res.status(404).send({ ok: false, data: null, error: 'API key not found' });
        return;
      }
      const approvalsRecord: Record<string, boolean> = {};
      for (const approval of apiKey.approvals) {
        if (approval.user_id) {
          approvalsRecord[approval.user_id] = true;
        }
        if (approval.entity_id) {
          approvalsRecord[approval.entity_id] = true;
        }
      }
      const allUsers = await prisma.user.findMany({ where: { deleted_at: null } }).then((users) => {
        const allUsersRecord: Record<string, User> = {};
        for (const user of users) {
          if (approvalsRecord[user.id]) {
            continue;
          }
          allUsersRecord[user.id] = user;
        }
        return allUsersRecord;
      });
      const allEntities = await prisma.entity
        .findMany({ where: { deleted_at: null, type: { not: EntityTypes.CCG } } })
        .then((entities) => {
          const allEntitiesRecord: Record<string, Entity> = {};
          for (const entity of entities) {
            if (approvalsRecord[entity.id]) {
              continue;
            }
            allEntitiesRecord[entity.id] = entity;
          }
          return allEntitiesRecord;
        });
      res.status(200).send({ ok: true, data: { apiKey: apiKey, allUsers, allEntities }, error: '' });
    },
  ),
);

router.get(
  '/official-cfeis',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminOfficialCfeisResponse>,
      next: express.NextFunction,
    ) => {
      const officialCfeis = await prisma.officialCfei.findMany({
        select: {
          numero_cfei: true,
          nom: true,
          prenom: true,
          departement: true,
        },
      });
      res.status(200).send({ ok: true, data: { officialCfeis }, error: '' });
    },
  ),
);

router.post(
  '/api-key-approval',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminApiKeyAndApprovalsResponse>,
      next: express.NextFunction,
    ) => {
      const action = req.body.action as 'create' | 'delete' | 'update';
      const body: Prisma.ApiKeyApprovalByUserOrEntityUncheckedCreateInput = {
        user_id: req.body.user_id,
        entity_id: req.body.entity_id,
        api_key_id: req.body.api_key_id,
        status: req.body.status as ApiKeyApprovalStatus,
      };
      const where: Prisma.ApiKeyApprovalByUserOrEntityWhereUniqueInput | undefined = body.user_id
        ? {
            api_key_id_user_id: {
              api_key_id: body.api_key_id,
              user_id: body.user_id,
            },
          }
        : body.entity_id
          ? {
              api_key_id_entity_id: {
                api_key_id: body.api_key_id,
                entity_id: body.entity_id,
              },
            }
          : undefined;
      if (action === 'delete') {
        await prisma.apiKeyApprovalByUserOrEntity.delete({
          where,
        });
      } else {
        await prisma.apiKeyApprovalByUserOrEntity.upsert({
          where,
          update: body,
          create: body,
        });
      }
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: body.api_key_id },
        include: {
          approvals: {
            include: {
              User: true,
              Entity: true,
            },
          },
        },
      });
      if (!apiKey) {
        res.status(404).send({ ok: false, data: null, error: 'API key not found' });
        return;
      }
      const approvalsRecord: Record<string, boolean> = {};
      for (const approval of apiKey.approvals) {
        if (approval.user_id) {
          approvalsRecord[approval.user_id] = true;
        }
        if (approval.entity_id) {
          approvalsRecord[approval.entity_id] = true;
        }
      }
      const allUsers = await prisma.user.findMany({ where: { deleted_at: null } }).then((users) => {
        const allUsersRecord: Record<string, User> = {};
        for (const user of users) {
          if (approvalsRecord[user.id]) {
            continue;
          }
          allUsersRecord[user.id] = user;
        }
        return allUsersRecord;
      });
      const allEntities = await prisma.entity.findMany({ where: { deleted_at: null } }).then((entities) => {
        const allEntitiesRecord: Record<string, Entity> = {};
        for (const entity of entities) {
          if (approvalsRecord[entity.id]) {
            continue;
          }
          allEntitiesRecord[entity.id] = entity;
        }
        return allEntitiesRecord;
      });
      res.status(200).send({ ok: true, data: { apiKey: apiKey, allUsers, allEntities }, error: '' });
    },
  ),
);

router.get(
  '/carcasses',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCarcassesResponse>,
      next: express.NextFunction,
    ) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = (req.query.search as string) || '';

      const where = search
        ? {
            OR: [
              { numero_bracelet: { contains: search, mode: 'insensitive' as const } },
              { fei_numero: { contains: search, mode: 'insensitive' as const } },
              { espece: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [carcasses, total] = await Promise.all([
        prisma.carcasse.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          include: {
            _count: { select: { CarcasseIntermediaire: true } },
          },
        }),
        prisma.carcasse.count({ where }),
      ]);

      res.status(200).send({ ok: true, data: { carcasses, total }, error: '' });
    },
  ),
);

router.get(
  '/carcasses-intermediaires',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCarcassesIntermediairesResponse>,
      next: express.NextFunction,
    ) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const [carcassesIntermediaires, total] = await Promise.all([
        prisma.carcasseIntermediaire.findMany({
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          include: {
            CarcasseIntermediaireEntity: { select: { nom_d_usage: true, type: true } },
            CarcasseIntermediaireUser: { select: { email: true } },
            CarcasseCarcasseIntermediaire: { select: { numero_bracelet: true, espece: true } },
          },
        }),
        prisma.carcasseIntermediaire.count(),
      ]);

      res.status(200).send({ ok: true, data: { carcassesIntermediaires, total }, error: '' });
    },
  ),
);

router.get(
  '/carcasse/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCarcasseDetailResponse>,
      next: express.NextFunction,
    ) => {
      const carcasse = await prisma.carcasse.findUnique({
        where: { zacharie_carcasse_id: req.params.zacharie_carcasse_id },
        include: {
          CarcasseIntermediaire: {
            orderBy: { created_at: 'asc' },
            include: {
              CarcasseIntermediaireEntity: { select: { nom_d_usage: true, type: true } },
              CarcasseIntermediaireUser: { select: { email: true } },
            },
          },
          Fei: true,
        },
      });

      if (!carcasse) {
        res.status(404).send({ ok: false, data: null as never, error: 'Carcasse not found' });
        return;
      }

      res.status(200).send({ ok: true, data: { carcasse }, error: '' });
    },
  ),
);

router.get(
  '/dashboard',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminDashboardResponse>,
      next: express.NextFunction,
    ) => {
      const dateFrom = (req.query.date_from as string) || null;
      const dateTo = (req.query.date_to as string) || null;

      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const defaultTo = now.toISOString().slice(0, 10);
      const from = dateFrom || defaultFrom;
      const to = dateTo || defaultTo;

      const [chasseursInscrits, compteValide, ficheOuverteRows, envoye1FicheRows] = await Promise.all([
        // Stage 1: Chasseurs inscrits
        prisma.user.count({
          where: { roles: { has: UserRoles.CHASSEUR }, deleted_at: null },
        }),
        // Stage 2: Compte validé (numero_cfei renseigné)
        prisma.user.count({
          where: {
            roles: { has: UserRoles.CHASSEUR },
            deleted_at: null,
            numero_cfei: { not: null },
            activated: true,
          },
        }),
        // Stage 3: Chasseurs avec >= 1 FEI créée (envoyée ou non)
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT u.id) as count
          FROM "User" u
          INNER JOIN "Fei" f ON (f.created_by_user_id = u.id OR f.examinateur_initial_user_id = u.id)
          WHERE 'CHASSEUR' = ANY(u.roles)
            AND u.deleted_at IS NULL
            AND f.deleted_at IS NULL
        `,
        // Stage 4+: Chasseurs avec >= 1 FEI envoyée (+ count pour stages 5, 6)
        prisma.$queryRaw<Array<{ user_id: string; fei_count: bigint }>>`
          SELECT u.id as user_id, COUNT(DISTINCT f.numero) as fei_count
          FROM "User" u
          INNER JOIN "Fei" f ON (f.created_by_user_id = u.id OR f.premier_detenteur_user_id = u.id)
          WHERE 'CHASSEUR' = ANY(u.roles)
            AND u.deleted_at IS NULL
            AND f.deleted_at IS NULL
            AND f.fei_prev_owner_user_id IS NOT NULL
          GROUP BY u.id
        `,
      ]);

      const envoye1 = envoye1FicheRows.length;
      const envoye2 = envoye1FicheRows.filter((r) => Number(r.fei_count) >= 2).length;
      const envoye3 = envoye1FicheRows.filter((r) => Number(r.fei_count) >= 3).length;

      // Cumulative funnel (each stage >= next)
      const ficheOuverte = Number(ficheOuverteRows[0]?.count ?? 0);
      const funnel = {
        chasseurs_inscrits: chasseursInscrits,
        compte_valide: compteValide,
        fiche_ouverte: ficheOuverte,
        envoye_1_fiche: envoye1,
        envoye_2_fiches: envoye2,
        envoye_3_fiches: envoye3,
      };

      // Inscriptions par semaine
      const inscriptionsParSemaine = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT DATE_TRUNC('week', created_at) as date, COUNT(*) as count
        FROM "User"
        WHERE 'CHASSEUR' = ANY(roles)
          AND deleted_at IS NULL
          AND created_at >= ${new Date(from)}::date
          AND created_at < (${new Date(to)}::date + interval '1 day')
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY date ASC
      `;

      res.status(200).send({
        ok: true,
        data: {
          funnel,
          inscriptions_par_semaine: inscriptionsParSemaine.map((r) => ({
            date: new Date(r.date).toISOString().slice(0, 10),
            count: Number(r.count),
          })),
        },
        error: '',
      });
    },
  ),
);

const POIDS_MOYEN_KG: Record<string, number> = {
  'Cerf élaphe': 80,
  'Cerf sika': 80,
  Chevreuil: 15,
  Daim: 40,
  Sanglier: 50,
  Chamois: 25,
  Isard: 25,
  'Mouflon méditerranéen': 30,
};
const POIDS_MOYEN_DEFAULT_KG = 1;

router.get(
  '/parts-de-marche',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminPartsDeMarcheResponse>,
      next: express.NextFunction,
    ) => {
      const now = dayjs();
      const currentYear = now.year();
      const currentSeasonStart = now.month() < 6 ? currentYear - 1 : currentYear;

      // Day offset within current season (days since July 1)
      const seasonStartDate = dayjs(`${currentSeasonStart}-07-01`);
      const dayOffsetInSeason = now.diff(seasonStartDate, 'day');

      // Fetch all circuit-long carcasses grouped by season and species
      const rows = await prisma.$queryRaw<
        Array<{ season_start: number; espece: string; carcasse_count: bigint; nombre_total: bigint }>
      >`
        SELECT
          CASE
            WHEN EXTRACT(MONTH FROM c.date_mise_a_mort) >= 7
            THEN EXTRACT(YEAR FROM c.date_mise_a_mort)::int
            ELSE EXTRACT(YEAR FROM c.date_mise_a_mort)::int - 1
          END AS season_start,
          c.espece,
          COUNT(*) AS carcasse_count,
          COALESCE(SUM(c.nombre_d_animaux), COUNT(*)) AS nombre_total
        FROM "Carcasse" c
        INNER JOIN "CarcasseIntermediaire" ci ON ci.zacharie_carcasse_id = c.zacharie_carcasse_id
        INNER JOIN "Entity" e ON e.id = ci.intermediaire_entity_id
        WHERE c.deleted_at IS NULL
          AND c.date_mise_a_mort IS NOT NULL
          AND e.type IN ('ETG', 'COLLECTEUR_PRO')
        GROUP BY season_start, c.espece
      `;

      // Also fetch with date cutoff for potentiel calculation
      const rowsWithCutoff = await prisma.$queryRaw<
        Array<{ season_start: number; espece: string; carcasse_count: bigint; nombre_total: bigint }>
      >`
        SELECT
          CASE
            WHEN EXTRACT(MONTH FROM c.date_mise_a_mort) >= 7
            THEN EXTRACT(YEAR FROM c.date_mise_a_mort)::int
            ELSE EXTRACT(YEAR FROM c.date_mise_a_mort)::int - 1
          END AS season_start,
          c.espece,
          COUNT(*) AS carcasse_count,
          COALESCE(SUM(c.nombre_d_animaux), COUNT(*)) AS nombre_total
        FROM "Carcasse" c
        INNER JOIN "CarcasseIntermediaire" ci ON ci.zacharie_carcasse_id = c.zacharie_carcasse_id
        INNER JOIN "Entity" e ON e.id = ci.intermediaire_entity_id
        WHERE c.deleted_at IS NULL
          AND c.date_mise_a_mort IS NOT NULL
          AND e.type IN ('ETG', 'COLLECTEUR_PRO')
          AND c.date_mise_a_mort <= (
            MAKE_DATE(
              CASE
                WHEN EXTRACT(MONTH FROM c.date_mise_a_mort) >= 7
                THEN EXTRACT(YEAR FROM c.date_mise_a_mort)::int
                ELSE EXTRACT(YEAR FROM c.date_mise_a_mort)::int - 1
              END, 7, 1
            ) + ${dayOffsetInSeason} * INTERVAL '1 day'
          )
        GROUP BY season_start, c.espece
      `;

      // Calculate tonnage per season (full season = reel, with cutoff = for potentiel)
      function computeTonnage(data: typeof rows): Record<number, number> {
        const result: Record<number, number> = {};
        for (const row of data) {
          const poids = POIDS_MOYEN_KG[row.espece ?? ''] ?? POIDS_MOYEN_DEFAULT_KG;
          const tonnes = (Number(row.nombre_total) * poids) / 1000;
          result[row.season_start] = (result[row.season_start] ?? 0) + tonnes;
        }
        return result;
      }

      const tonnageFull = computeTonnage(rows);
      const tonnageCutoff = computeTonnage(rowsWithCutoff);

      // Build response: for each season, reel = cutoff tonnage, potentiel = previous season's cutoff tonnage
      const allSeasons = [...new Set([...Object.keys(tonnageFull).map(Number)])].sort();

      const circuit_long = allSeasons.map((seasonStart) => {
        const label = `${String(seasonStart).slice(2)}-${String(seasonStart + 1).slice(2)}`;
        return {
          saison: label,
          volume_reel: Math.round((tonnageCutoff[seasonStart] ?? 0) * 100) / 100,
          volume_potentiel: Math.round((tonnageCutoff[seasonStart - 1] ?? 0) * 100) / 100,
          volume_absolu: Math.round((tonnageFull[seasonStart] ?? 0) * 100) / 100,
        };
      });

      res.status(200).send({
        ok: true,
        data: { circuit_long },
        error: '',
      });
    },
  ),
);

router.post(
  '/ccg/preview',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCcgPreviewResponse>,
      next: express.NextFunction,
    ) => {
      const { ccgs } = req.body as { ccgs: CcgPreviewRow[] };
      if (!Array.isArray(ccgs) || ccgs.length === 0) {
        res
          .status(400)
          .send({
            ok: false,
            data: { nouveaux: [], modifies: [], unchanged_count: 0 },
            error: 'ccgs requis',
          });
        return;
      }
      const numeroDdecpps = ccgs.map((c) => c.numero_ddecpp);
      const existingEntities = await prisma.entity.findMany({
        where: {
          numero_ddecpp: { in: numeroDdecpps },
          type: EntityTypes.CCG,
          deleted_at: null,
        },
        select: {
          numero_ddecpp: true,
          nom_d_usage: true,
          address_ligne_1: true,
          code_postal: true,
          ville: true,
          siret: true,
        },
      });
      const existingByNumero: Record<
        string,
        { nom_d_usage: string; address_ligne_1: string; code_postal: string; ville: string; siret: string }
      > = {};
      for (const e of existingEntities) {
        if (e.numero_ddecpp) {
          existingByNumero[e.numero_ddecpp] = {
            nom_d_usage: e.nom_d_usage ?? '',
            address_ligne_1: e.address_ligne_1 ?? '',
            code_postal: e.code_postal ?? '',
            ville: e.ville ?? '',
            siret: e.siret ?? '',
          };
        }
      }

      const nouveaux: CcgPreviewRow[] = [];
      const modifies: CcgPreviewModifiedRow[] = [];
      let unchanged_count = 0;

      for (const row of ccgs) {
        const ex = existingByNumero[row.numero_ddecpp];
        if (!ex) {
          nouveaux.push(row);
        } else if (
          row.nom_d_usage !== ex.nom_d_usage ||
          row.address_ligne_1 !== ex.address_ligne_1 ||
          row.code_postal !== ex.code_postal ||
          row.ville !== ex.ville ||
          row.siret !== ex.siret
        ) {
          modifies.push({ ...row, existing: ex });
        } else {
          unchanged_count++;
        }
      }

      res.status(200).send({ ok: true, data: { nouveaux, modifies, unchanged_count }, error: '' });
    },
  ),
);

router.post(
  '/ccg/import',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ADMIN]),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCcgImportResponse>,
      next: express.NextFunction,
    ) => {
      const { ccgs } = req.body as {
        ccgs: Array<{
          numero_ddecpp: string;
          nom_d_usage: string;
          address_ligne_1: string;
          address_ligne_2: string;
          code_postal: string;
          ville: string;
          siret: string;
          action: 'create' | 'update' | 'skip';
        }>;
      };
      if (!Array.isArray(ccgs) || ccgs.length === 0) {
        res
          .status(400)
          .send({ ok: false, data: { created: 0, updated: 0, skipped: 0 }, error: 'ccgs requis' });
        return;
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const ccg of ccgs) {
        if (ccg.action === 'skip') {
          skipped++;
          continue;
        }
        const entityData = {
          nom_d_usage: ccg.nom_d_usage || '',
          raison_sociale: ccg.nom_d_usage || '',
          address_ligne_1: ccg.address_ligne_1 || '',
          address_ligne_2: ccg.address_ligne_2 || '',
          code_postal: ccg.code_postal || '',
          ville: ccg.ville || '',
          siret: ccg.siret || null,
          numero_ddecpp: ccg.numero_ddecpp,
        };
        if (ccg.action === 'create') {
          await prisma.entity.create({
            data: {
              ...entityData,
              type: EntityTypes.CCG,
              zacharie_compatible: true,
            },
          });
          created++;
        } else if (ccg.action === 'update') {
          await prisma.entity.updateMany({
            where: {
              numero_ddecpp: ccg.numero_ddecpp,
              type: EntityTypes.CCG,
              deleted_at: null,
            },
            data: entityData,
          });
          updated++;
        }
      }

      res.status(200).send({ ok: true, data: { created, updated, skipped }, error: '' });
    },
  ),
);

export default router;
