import express from 'express';
import { catchErrors } from '~/middlewares/errors';
import crypto from 'crypto';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import {
  ApiKeyApprovalStatus,
  ApiKeyScope,
  EntityRelationType,
  EntityTypes,
  Prisma,
  UserRoles,
} from '@prisma/client';
import { userAdminSelect } from '~/types/user';
import type {
  AdminGetEntityResponse,
  AdminActionEntityResponse,
  AdminEntitiesResponse,
  AdminNewEntityResponse,
  AdminApiKeyResponse,
} from '~/types/responses';
import { entityAdminInclude } from '~/types/entity';
import { updateOrCreateBrevoCompany } from '~/third-parties/brevo';
import slugify from 'slugify';

router.get(
  '/entities',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminEntitiesResponse>,
      next: express.NextFunction
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
        ...Object.values(EntityTypes).map((t) => prisma.entity.count({ where: { ...baseWhere, type: t } })),
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
    }
  )
);

router.get(
  '/entity/:entity_id',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminGetEntityResponse>,
      next: express.NextFunction
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
                      entityRelation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
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
                      entityRelation.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY
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
    }
  )
);

router.post(
  '/entity-dedicated-api-key/:entity_id',
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
    }
  )
);

router.post(
  '/entity/nouvelle',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminNewEntityResponse>,
      next: express.NextFunction
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
    }
  )
);

router.post(
  '/entity/:entity_id',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminActionEntityResponse>,
      next: express.NextFunction
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
    }
  )
);

export default router;
