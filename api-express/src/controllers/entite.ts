import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { RequestWithUser } from '~/types/request';
import type { EntitiesWorkingForResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { EntityRelationType, EntityTypes, Prisma, UserRoles } from '@prisma/client';
import {
  sortEntitiesByTypeAndId,
  sortEntitiesRelationsByTypeAndId,
} from '~/utils/sort-things-by-type-and-id.server';
import { linkBrevoCompanyToContact, sendEmail, updateOrCreateBrevoCompany } from '~/third-parties/brevo';

router.get(
  '/fei/:entity_id/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  }),
);

router.get(
  '/working-for',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;

    const allEntities = await prisma.entity.findMany({
      where: {
        type: { not: EntityTypes.CCG },
      },
      orderBy: {
        nom_d_usage: 'asc',
      },
    });
    const userEntitiesRelationsWorkingFor = await prisma.entityAndUserRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_FOR,
      },
      orderBy: {
        EntityRelatedWithUser: {
          nom_d_usage: 'asc',
        },
      },
    });

    const [allEntitiesIds, allEntitiesByTypeAndId] = sortEntitiesByTypeAndId(allEntities);
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
    } satisfies EntitiesWorkingForResponse);
  }),
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
  }),
);

router.post(
  '/association-de-chasse',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;

    const body = req.body;

    const data: Prisma.EntityUncheckedCreateInput = {
      raison_sociale: body[Prisma.EntityScalarFieldEnum.raison_sociale],
      nom_d_usage: body[Prisma.EntityScalarFieldEnum.raison_sociale],
      type: EntityTypes.PREMIER_DETENTEUR,
      address_ligne_1: body[Prisma.EntityScalarFieldEnum.address_ligne_1],
      address_ligne_2: body[Prisma.EntityScalarFieldEnum.address_ligne_2],
      code_postal: body[Prisma.EntityScalarFieldEnum.code_postal],
      prefecture_svi: body[Prisma.EntityScalarFieldEnum.prefecture_svi],
      nom_prenom_responsable: body[Prisma.EntityScalarFieldEnum.nom_prenom_responsable],
      ville: body[Prisma.EntityScalarFieldEnum.ville],
      siret: body[Prisma.EntityScalarFieldEnum.siret] || null,
      zacharie_compatible: true,
    };

    const createdEntity = await prisma.entity.create({
      data,
    });

    await updateOrCreateBrevoCompany(createdEntity);

    const createdEntityRelation = await prisma.entityAndUserRelations.create({
      data: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_FOR,
        entity_id: createdEntity.id,
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

router.post(
  '/ccg',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;

    const body = req.body;

    const data: Prisma.EntityUncheckedCreateInput = {
      raison_sociale: body[Prisma.EntityScalarFieldEnum.nom_d_usage],
      nom_d_usage: body[Prisma.EntityScalarFieldEnum.nom_d_usage],
      type: EntityTypes.CCG,
      ccg_status: 'Pré-enregistré dans Zacharie',
      address_ligne_1: body[Prisma.EntityScalarFieldEnum.address_ligne_1],
      address_ligne_2: body[Prisma.EntityScalarFieldEnum.address_ligne_2],
      code_postal: body[Prisma.EntityScalarFieldEnum.code_postal],
      ville: body[Prisma.EntityScalarFieldEnum.ville],
      siret: body[Prisma.EntityScalarFieldEnum.siret] || null,
      numero_ddecpp: body[Prisma.EntityScalarFieldEnum.numero_ddecpp] || null,
      zacharie_compatible: true,
    };

    const createdEntity = await prisma.entity.create({
      data,
    });

    const createdEntityRelation = await prisma.entityAndUserRelations.create({
      data: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_WITH,
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
