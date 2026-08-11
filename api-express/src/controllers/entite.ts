import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import validateUser from '~/middlewares/validateUser';
import type { RequestWithUser } from '~/types/request';
import type {
  AnnuaireResult,
  AnnuaireSearchResponse,
  EntitiesWorkingForResponse,
  EtgUserInteractedResponse,
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

      // Entités dont j'ai le droit (relation validée) → relations complètes, PII des membres autorisée
      const authorizedEntities = await prisma.entity.findMany({
        where: {
          deleted_at: null,
          EntityRelationsWithUsers: {
            some: {
              owner_id: user.id,
              relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
              status: { in: [EntityRelationStatus.MEMBER, EntityRelationStatus.ADMIN] },
              deleted_at: null,
            },
          },
        },
        include: entityAdminInclude,
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

      // Entités dont je n'ai pas (encore) le droit (demande en attente) → ma seule relation, aucune PII tierce
      const pendingEntities = await prisma.entity.findMany({
        where: {
          deleted_at: null,
          EntityRelationsWithUsers: {
            some: {
              owner_id: user.id,
              relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
              status: EntityRelationStatus.REQUESTED,
              deleted_at: null,
            },
          },
        },
        include: {
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
        } as unknown as typeof entityAdminInclude,
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

      const entitiesUserCanHandleOnBehalf = [...authorizedEntities, ...pendingEntities];

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
                // EntityTypes.CONSOMMATEUR_FINAL, // pas besoin du consommateur final, il ne sera pas réutilisé
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

      const partenaireRelatedTypeFilter = {
        EntityRelatedWithUser: {
          type: {
            in: [
              EntityTypes.COMMERCE_DE_DETAIL,
              EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
              EntityTypes.CONSOMMATEUR_FINAL,
            ],
          },
        },
      };

      // Partenaires dont j'ai le droit (relation validée) → relations complètes, PII du contact autorisée
      const authorizedEntities = await prisma.entity.findMany({
        where: {
          deleted_at: null,
          EntityRelationsWithUsers: {
            some: {
              owner_id: user.id,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
              status: { in: [EntityRelationStatus.MEMBER, EntityRelationStatus.ADMIN] },
              deleted_at: null,
              ...partenaireRelatedTypeFilter,
            },
          },
        },
        include: entityAdminInclude,
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

      // Partenaires dont je n'ai pas (encore) le droit (demande en attente) → ma seule relation, aucune PII tierce
      const pendingEntities = await prisma.entity.findMany({
        where: {
          deleted_at: null,
          EntityRelationsWithUsers: {
            some: {
              owner_id: user.id,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
              status: EntityRelationStatus.REQUESTED,
              deleted_at: null,
              ...partenaireRelatedTypeFilter,
            },
          },
        },
        include: {
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
        } as unknown as typeof entityAdminInclude,
        orderBy: {
          nom_d_usage: 'asc',
        },
      });

      const entitiesUserCanHandleOnBehalf = [...authorizedEntities, ...pendingEntities].map((entity) => ({
        id: entity.id,
        raison_sociale: entity.raison_sociale,
        nom_d_usage: entity.nom_d_usage,
        address_ligne_1: entity.address_ligne_1,
        address_ligne_2: entity.address_ligne_2,
        code_postal: entity.code_postal,
        ville: entity.ville,
        siret: entity.siret,
        type: entity.type,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
        is_synced: entity.is_synced,
        EntityRelationsWithUsers: entity.EntityRelationsWithUsers,
      }));

      const allEntitiesById: EntitiesById = {};
      for (const entity of allEntities) {
        allEntitiesById[entity.id] = entity;
      }
      const userEntitiesById: EntitiesById = {};
      for (const entity of entitiesUserCanHandleOnBehalf) {
        // @ts-expect-error - TODO: fix this
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

// Codes NAF des commerces de détail susceptibles de recevoir du gibier (boucherie-charcuterie,
// autres commerces alimentaires, supérettes). À affiner selon les retours terrain.
const COMMERCE_DETAIL_NAF = ['47.22Z', '47.29Z', '47.11B'];

// Construit address_ligne_1 à partir de l'adresse complète de l'API
// ("14 RUE SUBLEYRAS 34000 MONTPELLIER") en retirant le suffixe "code_postal ville".
function extractAddressLigne1(adresse: string, code_postal: string, ville: string): string {
  const suffix = `${code_postal} ${ville}`;
  if (adresse.endsWith(suffix)) {
    return adresse.slice(0, adresse.length - suffix.length).trim();
  }
  return adresse.trim();
}

router.get(
  '/annuaire/search',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response<AnnuaireSearchResponse>,
      next: express.NextFunction
    ) => {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const codePostal = typeof req.query.code_postal === 'string' ? req.query.code_postal.trim() : '';
      const page = typeof req.query.page === 'string' ? req.query.page : '1';

      if (q.length < 3) {
        res.status(200).send({ ok: true, data: { results: [] }, error: '' });
        return;
      }

      const params = new URLSearchParams({
        q,
        activite_principale: COMMERCE_DETAIL_NAF.join(','),
        etat_administratif: 'A',
        per_page: '10',
        page,
      });
      if (codePostal) {
        params.set('code_postal', codePostal);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      let gouvResponse: Response;
      try {
        gouvResponse = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params.toString()}`, {
          signal: controller.signal,
        });
      } catch {
        res
          .status(503)
          .send({
            ok: false,
            data: { results: [] },
            error: 'Annuaire momentanément indisponible, réessayez',
          });
        return;
      } finally {
        clearTimeout(timeout);
      }

      if (!gouvResponse.ok) {
        res
          .status(503)
          .send({
            ok: false,
            data: { results: [] },
            error: 'Annuaire momentanément indisponible, réessayez',
          });
        return;
      }

      const json = (await gouvResponse.json()) as {
        results?: Array<{
          siren?: string;
          nom_complet?: string;
          siege?: {
            siret?: string;
            adresse?: string;
            code_postal?: string;
            libelle_commune?: string;
            activite_principale?: string;
            etat_administratif?: string;
          };
          matching_etablissements?: Array<{
            siret?: string;
            adresse?: string;
            code_postal?: string;
            libelle_commune?: string;
            activite_principale?: string;
            etat_administratif?: string;
          }>;
        }>;
      };

      const resultsBySiret: Record<string, AnnuaireResult> = {};
      for (const entreprise of json.results ?? []) {
        const raison_sociale = entreprise.nom_complet ?? '';
        const siren = entreprise.siren ?? '';
        // On privilégie les établissements correspondants au commerce (NAF commerce de détail),
        // car le siège social peut avoir un autre code NAF (ex. holding).
        const candidats = (entreprise.matching_etablissements ?? []).filter(
          (etab) =>
            etab.etat_administratif === 'A' &&
            etab.activite_principale != null &&
            COMMERCE_DETAIL_NAF.includes(etab.activite_principale)
        );
        if (candidats.length === 0 && entreprise.siege) {
          const siege = entreprise.siege;
          if (
            siege.etat_administratif === 'A' &&
            siege.activite_principale != null &&
            COMMERCE_DETAIL_NAF.includes(siege.activite_principale)
          ) {
            candidats.push(siege);
          }
        }
        for (const etab of candidats) {
          if (!etab.siret) continue;
          const code_postal = etab.code_postal ?? '';
          const ville = etab.libelle_commune ?? '';
          resultsBySiret[etab.siret] = {
            siret: etab.siret,
            siren,
            raison_sociale,
            address_ligne_1: extractAddressLigne1(etab.adresse ?? '', code_postal, ville),
            code_postal,
            ville,
            naf: etab.activite_principale ?? '',
          };
        }
      }

      res.status(200).send({ ok: true, data: { results: Object.values(resultsBySiret) }, error: '' });
    }
  )
);

const annuaireSelectSchema = z.object({
  siret: z.string().min(1),
  siren: z.string().optional(),
  raison_sociale: z.string(),
  address_ligne_1: z.string(),
  address_ligne_2: z.string().optional(),
  code_postal: z.string(),
  ville: z.string(),
});

router.post(
  '/annuaire/select',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<UserEntityResponse>, next: express.NextFunction) => {
      const user = req.user!;

      const result = annuaireSelectSchema.safeParse(req.body);
      if (!result.success) {
        const error = new Error(result.error.message);
        res.status(406);
        return next(error);
      }
      const body = result.data;
      const siret = sanitize(body.siret);

      // Dédup par SIRET : deux chasseurs choisissant le même commerce pointent sur la même Entity.
      let entity = await prisma.entity.findFirst({
        where: { siret, type: EntityTypes.COMMERCE_DE_DETAIL, deleted_at: null },
      });

      if (!entity) {
        entity = await prisma.entity.create({
          data: {
            raison_sociale: sanitize(body.raison_sociale),
            nom_d_usage: sanitize(body.raison_sociale),
            type: EntityTypes.COMMERCE_DE_DETAIL,
            address_ligne_1: sanitize(body.address_ligne_1),
            address_ligne_2: sanitize(body.address_ligne_2) || null,
            code_postal: sanitize(body.code_postal),
            ville: sanitize(body.ville),
            siret,
            zacharie_compatible: false, // entité d'annuaire sans utilisateur (circuit court = vue passive)
            prefilled: true, // marque une entité issue de l'annuaire public
          },
        });
        entity = await updateOrCreateBrevoCompany(entity);
      }

      // Relation du chasseur idempotente : on ne recrée pas si elle existe déjà.
      let relation = await prisma.entityAndUserRelations.findFirst({
        where: {
          owner_id: user.id,
          entity_id: entity.id,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          deleted_at: null,
        },
      });
      if (!relation) {
        relation = await prisma.entityAndUserRelations.create({
          data: {
            owner_id: user.id,
            entity_id: entity.id,
            relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            status: EntityRelationStatus.MEMBER,
          },
        });
      }

      res.status(200).send({ ok: true, error: '', data: { entity, relation } });
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

// Ensemble des utilisateurs ayant interagi avec les entités ETG de l'utilisateur connecté
// (premier détenteur, examinateur, SVI, intermédiaires des carcasses passées par ces ETG),
// hors membres des ETG. Sert de périmètre d'autorisation pour la liste et le détail.
async function getEtgInteractedUserIds(userId: User['id']): Promise<Set<string>> {
  // ETG entities the user can handle carcasses on behalf of
  const userEntityRelations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      deleted_at: null,
      EntityRelatedWithUser: { type: EntityTypes.ETG },
    },
    select: { entity_id: true },
  });
  const etgEntityIds = userEntityRelations.map((r) => r.entity_id);

  if (!etgEntityIds.length) {
    return new Set<string>();
  }

  // User IDs from carcasses that passed through these ETG entities
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
      premier_detenteur_user_id: true,
      examinateur_initial_user_id: true,
      svi_user_id: true,
      svi_ipm1_user_id: true,
      svi_ipm2_user_id: true,
    },
  });

  const intermediaires = await prisma.carcasseIntermediaire.findMany({
    where: {
      intermediaire_entity_id: { in: etgEntityIds },
      deleted_at: null,
    },
    select: { intermediaire_user_id: true },
  });

  // Collecteurs ayant transporté des carcasses passées par l'ETG
  const collecteurs = await prisma.carcasseIntermediaire.findMany({
    where: {
      zacharie_carcasse_id: { in: carcasses.map((c) => c.zacharie_carcasse_id) },
      intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
      deleted_at: null,
    },
    select: { intermediaire_user_id: true },
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

  const userIds = new Set<string>();
  const addId = (id: string | null) => {
    if (id && !memberIds.has(id)) userIds.add(id);
  };
  for (const c of carcasses) {
    addId(c.premier_detenteur_user_id);
    addId(c.examinateur_initial_user_id);
    addId(c.svi_user_id);
    addId(c.svi_ipm1_user_id);
    addId(c.svi_ipm2_user_id);
  }
  for (const i of intermediaires) {
    addId(i.intermediaire_user_id);
  }
  for (const c of collecteurs) {
    addId(c.intermediaire_user_id);
  }

  return userIds;
}

router.get(
  '/etg/utilisateurs',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ETG]),
  catchErrors(async (req: RequestWithUser, res: express.Response<EtgUsersInteractedResponse>) => {
    const user = req.user!;

    const userIds = await getEtgInteractedUserIds(user.id);

    if (!userIds.size) {
      res.status(200).send({ ok: true, data: { users: [] }, error: '' });
      return;
    }

    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { ...userFeiSelect, roles: true },
      orderBy: [{ nom_de_famille: 'asc' }, { prenom: 'asc' }],
    });

    res.status(200).send({ ok: true, data: { users }, error: '' });
  })
);

router.get(
  '/etg/utilisateurs/:userId',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ETG]),
  catchErrors(async (req: RequestWithUser, res: express.Response<EtgUserInteractedResponse>) => {
    const user = req.user!;
    const userId = req.params.userId;

    const userIds = await getEtgInteractedUserIds(user.id);
    if (!userIds.has(userId)) {
      res.status(404).send({ ok: false, data: null, error: 'Utilisateur introuvable' });
      return;
    }

    const interactedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...userFeiSelect, roles: true },
    });
    if (!interactedUser) {
      res.status(404).send({ ok: false, data: null, error: 'Utilisateur introuvable' });
      return;
    }

    res.status(200).send({ ok: true, data: { user: interactedUser }, error: '' });
  })
);

export default router;
