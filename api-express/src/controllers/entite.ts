import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import validateUser from '~/middlewares/validateUser';
import type { RequestWithUser } from '~/types/request';
import type {
  EntitiesWorkingForResponse,
  EtgUsersInteractedResponse,
  PartenairesResponse,
  UserEntityResponse,
} from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  Prisma,
  User,
  UserRoles,
} from '@prisma/client';
import { userFeiSelect } from '~/types/user';
import {
  sortEntitiesByTypeAndId,
  sortEntitiesRelationsByTypeAndId,
} from '~/utils/sort-things-by-type-and-id.server';
import {
  createBrevoContact,
  linkBrevoCompanyToContact,
  sendEmail,
  updateOrCreateBrevoCompany,
} from '~/third-parties/brevo';
import { EntitiesById, entityAdminInclude } from '~/types/entity';
import { sanitize } from '~/utils/sanitize';
import { z } from 'zod';
import createUserId from '~/utils/createUserId';
import { inviteUser } from '~/utils/invite-user';

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

      const allEntities = await prisma.entity
        .findMany({
          where: {
            deleted_at: null,
            type: { not: EntityTypes.CCG },
            ...(user.isZacharieAdmin ? {} : { for_testing: false }),
          },
          orderBy: {
            nom_d_usage: 'asc',
          },
        })
        .then((entities) => entities.map((entity) => ({ ...entity, EntityRelationsWithUsers: [] as any })));
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

      const allEntitiesByTypeAndId = sortEntitiesByTypeAndId(allEntities);
      const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(entitiesUserCanHandleOnBehalf);

      res.status(200).send({
        ok: true,
        data: {
          allEntitiesByTypeAndId,
          userEntitiesByTypeAndId,
        },
        error: '',
      });
    }
  )
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

      const allEntities = await prisma.entity
        .findMany({
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
            ...(user.isZacharieAdmin ? {} : { for_testing: false }),
          },
          orderBy: {
            nom_d_usage: 'asc',
          },
        })
        .then((entities) =>
          entities.map((entity) => ({
            ...entity,
            EntityRelationsWithUsers: [] as any,
          }))
        );

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
    }
  )
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
    if (!user.roles.includes(UserRoles.CHASSEUR)) {
      const error = new Error('Seulement un chasseur peut créer une association de chasse');
      res.status(400);
      return next(error);
    }

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
  })
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
          "Cette adresse email est déjà associée à un compte Zacharie existant. Veuillez utiliser une autre adresse email ou contacter l'utilisateur pour qu'il ajoute lui-même cette entité à son compte."
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

      await inviteUser(ownerUser, user);

      res
        .status(200)
        .send({ ok: true, error: '', data: { entity: createdEntity, relation: createdEntityRelation } });
    }
  )
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
    if (!user.roles.includes(UserRoles.CHASSEUR)) {
      const error = new Error('Seulement un chasseur peut créer un CCG');
      res.status(400);
      return next(error);
    }

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
  })
);

router.get(
  '/ccg/:entityId',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    const { entityId } = req.params;

    const relation = await prisma.entityAndUserRelations.findFirst({
      where: {
        owner_id: user.id,
        entity_id: entityId,
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        deleted_at: null,
        EntityRelatedWithUser: {
          type: EntityTypes.CCG,
        },
      },
      include: {
        EntityRelatedWithUser: true,
      },
    });

    if (!relation) {
      res.status(403).send({ ok: false, data: null, error: 'Accès non autorisé' });
      return;
    }

    res.status(200).send({
      ok: true,
      data: { entity: relation.EntityRelatedWithUser },
      error: '',
    });
  })
);

router.put(
  '/ccg/:entityId',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    const { entityId } = req.params;

    const relation = await prisma.entityAndUserRelations.findFirst({
      where: {
        owner_id: user.id,
        entity_id: entityId,
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        deleted_at: null,
        EntityRelatedWithUser: {
          type: EntityTypes.CCG,
          ccg_status: 'Pré-enregistré dans Zacharie',
        },
      },
      include: {
        EntityRelatedWithUser: true,
      },
    });

    if (!relation) {
      res.status(403).send({ ok: false, data: null, error: 'Accès non autorisé ou CCG déjà déclaré' });
      return;
    }

    const result = ccgSchema.safeParse(req.body);
    if (!result.success) {
      const error = new Error(result.error.message);
      res.status(406);
      return next(error);
    }
    const body = result.data;

    const updatedEntity = await prisma.entity.update({
      where: { id: entityId },
      data: {
        raison_sociale: sanitize(body[Prisma.EntityScalarFieldEnum.nom_d_usage]),
        nom_d_usage: sanitize(body[Prisma.EntityScalarFieldEnum.nom_d_usage]),
        address_ligne_1: sanitize(body[Prisma.EntityScalarFieldEnum.address_ligne_1]),
        address_ligne_2: sanitize(body[Prisma.EntityScalarFieldEnum.address_ligne_2]),
        code_postal: sanitize(body[Prisma.EntityScalarFieldEnum.code_postal]),
        ville: sanitize(body[Prisma.EntityScalarFieldEnum.ville]),
        siret: sanitize(body[Prisma.EntityScalarFieldEnum.siret]) || null,
        numero_ddecpp: sanitize(body[Prisma.EntityScalarFieldEnum.numero_ddecpp]) || null,
      },
    });

    res.status(200).send({ ok: true, error: '', data: { entity: updatedEntity } });
  })
);

router.get(
  '/etg/utilisateurs',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ETG]),
  catchErrors(async (req: RequestWithUser, res: express.Response<EtgUsersInteractedResponse>) => {
    const user = req.user!;

    // ETG entities the user can handle carcasses on behalf of
    const userEntityRelations = await prisma.entityAndUserRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
        deleted_at: null,
        EntityRelatedWithUser: { type: EntityTypes.ETG },
      },
      select: { entity_id: true },
    });
    const etgEntityIds = userEntityRelations.map((r) => r.entity_id);

    if (!etgEntityIds.length) {
      res.status(200).send({ ok: true, data: { users: [] }, error: '' });
      return;
    }

    // All carcasses that passed through these ETG entities (same filter as carcasse.ts)
    const carcasses = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        OR: [
          { CarcasseIntermediaire: { some: { intermediaire_entity_id: { in: etgEntityIds } } } },
          { next_owner_entity_id: { in: etgEntityIds } },
          { current_owner_entity_id: { in: etgEntityIds } },
        ],
      },
      select: {
        zacharie_carcasse_id: true,
        fei_numero: true,
        espece: true,
        updated_at: true,
        premier_detenteur_user_id: true,
        examinateur_initial_user_id: true,
        svi_user_id: true,
        svi_ipm1_user_id: true,
        svi_ipm2_user_id: true,
      },
    });

    // espece lookup by carcasse id (used to attribute species to intermediaire interactions)
    const especeByCarcasseId = new Map<string, string | null>();
    for (const c of carcasses) {
      especeByCarcasseId.set(c.zacharie_carcasse_id, c.espece);
    }

    // Intermediaires (collecteurs, etc.) that handled carcasses for these ETG entities
    const intermediaires = await prisma.carcasseIntermediaire.findMany({
      where: {
        intermediaire_entity_id: { in: etgEntityIds },
        deleted_at: null,
      },
      select: {
        zacharie_carcasse_id: true,
        intermediaire_user_id: true,
        intermediaire_role: true,
        fei_numero: true,
        updated_at: true,
      },
    });

    // Members of the ETG entities (employees) — excluded from the list
    const members = await prisma.entityAndUserRelations.findMany({
      where: {
        entity_id: { in: etgEntityIds },
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        deleted_at: null,
      },
      select: { owner_id: true },
    });
    const memberIds = new Set(members.map((m) => m.owner_id));

    type Aggregate = {
      feiNumeros: Set<string>;
      carcasseIds: Set<string>;
      carcassesByEspece: Map<string, Set<string>>;
      lastInteractionAt: Date;
      roles: Set<string>;
    };
    const byUser = new Map<string, Aggregate>();

    const addInteraction = (
      userId: string | null,
      role: string,
      feiNumero: string,
      date: Date,
      carcasseId: string | null,
      espece: string | null
    ) => {
      if (!userId) return;
      if (memberIds.has(userId)) return;
      let agg = byUser.get(userId);
      if (!agg) {
        agg = {
          feiNumeros: new Set(),
          carcasseIds: new Set(),
          carcassesByEspece: new Map(),
          lastInteractionAt: date,
          roles: new Set(),
        };
        byUser.set(userId, agg);
      }
      agg.feiNumeros.add(feiNumero);
      agg.roles.add(role);
      if (date > agg.lastInteractionAt) agg.lastInteractionAt = date;
      if (carcasseId) {
        agg.carcasseIds.add(carcasseId);
        if (espece) {
          let especeSet = agg.carcassesByEspece.get(espece);
          if (!especeSet) {
            especeSet = new Set();
            agg.carcassesByEspece.set(espece, especeSet);
          }
          especeSet.add(carcasseId);
        }
      }
    };

    for (const c of carcasses) {
      const args = [c.fei_numero, c.updated_at, c.zacharie_carcasse_id, c.espece] as const;
      addInteraction(c.premier_detenteur_user_id, FeiOwnerRole.PREMIER_DETENTEUR, ...args);
      addInteraction(c.examinateur_initial_user_id, FeiOwnerRole.EXAMINATEUR_INITIAL, ...args);
      addInteraction(c.svi_user_id, FeiOwnerRole.SVI, ...args);
      addInteraction(c.svi_ipm1_user_id, FeiOwnerRole.SVI, ...args);
      addInteraction(c.svi_ipm2_user_id, FeiOwnerRole.SVI, ...args);
    }
    for (const i of intermediaires) {
      addInteraction(
        i.intermediaire_user_id,
        i.intermediaire_role ?? FeiOwnerRole.COLLECTEUR_PRO,
        i.fei_numero,
        i.updated_at,
        i.zacharie_carcasse_id,
        especeByCarcasseId.get(i.zacharie_carcasse_id) ?? null
      );
    }

    const userIds = [...byUser.keys()];
    if (!userIds.length) {
      res.status(200).send({ ok: true, data: { users: [] }, error: '' });
      return;
    }

    const usersDetails = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { ...userFeiSelect, roles: true },
    });

    const users = usersDetails
      .map((u) => {
        const agg = byUser.get(u.id)!;
        const carcassesByEspece: Record<string, number> = {};
        for (const [espece, set] of agg.carcassesByEspece) {
          carcassesByEspece[espece] = set.size;
        }
        return {
          ...u,
          interactionRoles: [...agg.roles],
          nbFiches: agg.feiNumeros.size,
          nbCarcasses: agg.carcasseIds.size,
          carcassesByEspece,
          lastInteractionAt: agg.lastInteractionAt.toISOString(),
        };
      })
      .sort((a, b) => (b.lastInteractionAt ?? '').localeCompare(a.lastInteractionAt ?? ''));

    res.status(200).send({ ok: true, data: { users }, error: '' });
  })
);

export default router;
