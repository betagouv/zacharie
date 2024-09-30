import { User, EntityRelationType, Prisma, EntityTypes, UserRoles } from "@prisma/client";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { authorizeUserOrAdmin } from "~/utils/authorizeUserOrAdmin";

export async function action(args: ActionFunctionArgs) {
  const { user, error, isAdmin } = await authorizeUserOrAdmin(args);
  if (!user) {
    return json({ ok: false, data: null, error }, { status: 401 });
  }
  const { request, params } = args;

  const formData = await request.formData();
  console.log("formData action.user-entity.$user_id", Object.fromEntries(formData));
  if (!formData.get(Prisma.EntityRelationsScalarFieldEnum.owner_id)) {
    return json({ ok: false, data: null, error: "Missing owner_id" }, { status: 400 });
  }
  let entityId: string = formData.get(Prisma.EntityRelationsScalarFieldEnum.entity_id) as string;
  if (formData.get(Prisma.EntityScalarFieldEnum.numero_ddecpp)) {
    const entity = await prisma.entity.findFirst({
      where: {
        numero_ddecpp: formData.get(Prisma.EntityScalarFieldEnum.numero_ddecpp) as string,
        type: formData.get(Prisma.EntityScalarFieldEnum.type) as EntityTypes,
      },
    });
    entityId = entity?.id || "";
  }
  if (!entityId) {
    return json({ ok: false, data: null, error: "Missing entity_id" }, { status: 400 });
  }
  if (!isAdmin && params.user_id !== formData.get(Prisma.EntityRelationsScalarFieldEnum.owner_id)) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  if (formData.get("_action") === "create") {
    if (!formData.get(Prisma.EntityRelationsScalarFieldEnum.relation)) {
      return json({ ok: false, data: null, error: "Missing relation" }, { status: 400 });
    }

    const nextEntityRelation = {
      owner_id: formData.get(Prisma.EntityRelationsScalarFieldEnum.owner_id) as User["id"],
      entity_id: entityId,
      relation: formData.get(Prisma.EntityRelationsScalarFieldEnum.relation) as EntityRelationType,
    };

    const existingEntityRelation = await prisma.entityRelations.findFirst({
      where: nextEntityRelation,
    });
    if (existingEntityRelation) {
      return json({ ok: false, data: null, error: "EntityRelation already exists" }, { status: 409 });
    }

    const relation = await prisma.entityRelations.create({
      data: nextEntityRelation,
    });

    return json({ ok: true, data: relation, error: null });
  }

  if (formData.get("_action") === "delete") {
    const existingEntityRelation = await prisma.entityRelations.findFirst({
      where: {
        owner_id: formData.get(Prisma.EntityRelationsScalarFieldEnum.owner_id) as User["id"],
        relation: formData.get(Prisma.EntityRelationsScalarFieldEnum.relation) as EntityRelationType,
        entity_id: entityId,
      },
    });
    if (existingEntityRelation) {
      await prisma.entityRelations.delete({
        where: {
          id: existingEntityRelation.id,
        },
      });
      return json({ ok: true, data: null, error: null });
    }
  }

  return json({ ok: false, data: null, error: "Invalid action" }, { status: 400 });
}
