import express from 'express';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, Prisma } from '@prisma/client';
import type { RequestWithUser } from '~/types/request';
import type { UserEntityResponse } from '~/types/responses';
import { linkBrevoCompanyToContact, unlinkBrevoCompanyToContact } from '~/third-parties/brevo';
import { getEntity, userEntitySchema } from '~/controllers/user-entity';

const router: express.Router = express.Router();

// Rattachement d'un utilisateur à une entité par l'équipe Zacharie : ajout, changement de statut, retrait.
// Les utilisateurs et les admins d'entité passent par /user-entity.

async function parseAdminUserEntityBody(req: RequestWithUser, res: express.Response<UserEntityResponse>) {
  const result = userEntitySchema.safeParse(req.body);
  if (!result.success) {
    res.status(406).send({ ok: false, data: { relation: null, entity: null }, error: result.error.message });
    return null;
  }
  const body = result.data;
  if (!body.relation) {
    res.status(400).send({ ok: false, data: { relation: null, entity: null }, error: 'Missing relation' });
    return null;
  }
  const entity = await getEntity(body);
  if (!entity) {
    res.status(400).send({ ok: false, data: { relation: null, entity: null }, error: 'Missing entity_id' });
    return null;
  }
  const owner = await prisma.user.findUnique({ where: { id: body.owner_id, deleted_at: null } });
  if (!owner) {
    res
      .status(404)
      .send({ ok: false, data: { relation: null, entity: null }, error: 'Utilisateur non trouvé' });
    return null;
  }
  return { body, entity, owner, relation: body.relation };
}

router.post(
  '/user-entity',
  catchErrors(async (req: RequestWithUser, res: express.Response<UserEntityResponse>) => {
    const parsed = await parseAdminUserEntityBody(req, res);
    if (!parsed) return;
    const { body, entity, owner, relation: relationType } = parsed;

    const nextEntityRelation: Prisma.EntityAndUserRelationsUncheckedCreateInput = {
      owner_id: owner.id,
      entity_id: entity.id,
      relation: relationType,
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

    if (body.status) nextEntityRelation.status = body.status;

    // rattachement direct : le premier utilisateur de l'entité en devient l'admin
    if (
      nextEntityRelation.status === EntityRelationStatus.MEMBER &&
      relationType === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
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

    const relation = await prisma.entityAndUserRelations.create({ data: nextEntityRelation });

    if (relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      await linkBrevoCompanyToContact(entity, owner);
    }

    res.status(200).send({ ok: true, data: { relation, entity }, error: '' });
  })
);

router.put(
  '/user-entity',
  catchErrors(async (req: RequestWithUser, res: express.Response<UserEntityResponse>) => {
    const parsed = await parseAdminUserEntityBody(req, res);
    if (!parsed) return;
    const { body, entity, owner, relation: relationType } = parsed;

    const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
      where: { owner_id: owner.id, entity_id: entity.id, relation: relationType, deleted_at: null },
    });
    if (!existingEntityRelation) {
      res.status(404).send({
        ok: false,
        data: { relation: null, entity: null },
        error: 'Relation non trouvée',
      });
      return;
    }

    const relation = await prisma.entityAndUserRelations.update({
      where: { id: existingEntityRelation.id },
      data: body.status ? { status: body.status } : {},
    });

    if (relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      await linkBrevoCompanyToContact(entity, owner);
    }

    res.status(200).send({ ok: true, data: { relation, entity }, error: '' });
  })
);

router.delete(
  '/user-entity',
  catchErrors(async (req: RequestWithUser, res: express.Response<UserEntityResponse>) => {
    const parsed = await parseAdminUserEntityBody(req, res);
    if (!parsed) return;
    const { entity, owner, relation: relationType } = parsed;

    const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
      where: { owner_id: owner.id, entity_id: entity.id, relation: relationType, deleted_at: null },
    });

    if (existingEntityRelation) {
      await prisma.entityAndUserRelations.delete({ where: { id: existingEntityRelation.id } });
      if (existingEntityRelation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
        await unlinkBrevoCompanyToContact(entity, owner);
      }
    }

    res.status(200).send({ ok: true, data: { relation: null, entity: null }, error: '' });
  })
);

export default router;
