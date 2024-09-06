import { User, Entity, RelationType } from "@prisma/client";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { authorizeUserOrAdmin } from "~/utils/authorizeUserOrAdmin";

export async function action(args: ActionFunctionArgs) {
  const { user, error } = await authorizeUserOrAdmin(args);
  if (!user) return json({ ok: false, data: null, error }, { status: 401 });
  const { request, params } = args;

  const formData = await request.formData();
  if (!formData.has("owner_id")) return json({ ok: false, data: null, error: "Missing owner_id" }, { status: 400 });
  if (!formData.has("entity_id")) return json({ ok: false, data: null, error: "Missing entity_id" }, { status: 400 });
  if (params.user_id !== formData.get("owner_id")) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  if (formData.get("_action") === "create") {
    if (!formData.has("relation")) return json({ ok: false, data: null, error: "Missing relation" }, { status: 400 });

    const nextEntityRelation = {
      owner_id: formData.get("owner_id") as User["id"],
      entity_id: formData.get("entity_id") as Entity["id"],
      relation: formData.get("relation") as RelationType,
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
        owner_id: formData.get("owner_id") as User["id"],
        entity_id: formData.get("entity_id") as Entity["id"],
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

export default function ActionUserEntities() {
  return null;
}
