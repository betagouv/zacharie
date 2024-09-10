import { User, UserRelationType } from "@prisma/client";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { authorizeUserOrAdmin } from "~/utils/authorizeUserOrAdmin";

export async function action(args: ActionFunctionArgs) {
  const { user, error } = await authorizeUserOrAdmin(args);
  if (!user) return json({ ok: false, data: null, error }, { status: 401 });
  const { request, params } = args;

  const formData = await request.formData();
  if (!formData.get("owner_id")) return json({ ok: false, data: null, error: "Missing owner_id" }, { status: 400 });
  if (!formData.get("related_id")) return json({ ok: false, data: null, error: "Missing related_id" }, { status: 400 });
  if (params.user_id !== formData.get("owner_id")) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  if (formData.get("_action") === "create") {
    if (!formData.get("relation")) return json({ ok: false, data: null, error: "Missing relation" }, { status: 400 });

    const nextUserRelation = {
      owner_id: formData.get("owner_id") as User["id"],
      related_id: formData.get("related_id") as User["id"],
      relation: formData.get("relation") as UserRelationType,
    };

    console.log("nextUserRelation", nextUserRelation);

    const existingEntityRelation = await prisma.userRelations.findFirst({
      where: nextUserRelation,
    });
    if (existingEntityRelation) {
      return json({ ok: false, data: null, error: "EntityRelation already exists" }, { status: 409 });
    }
    const relation = await prisma.userRelations.create({
      data: nextUserRelation,
    });

    return json({ ok: true, data: relation, error: null });
  }

  if (formData.get("_action") === "delete") {
    const existingEntityRelation = await prisma.userRelations.findFirst({
      where: {
        owner_id: formData.get("owner_id") as User["id"],
        related_id: formData.get("related_id") as User["id"],
        relation: formData.get("relation") as UserRelationType,
      },
    });
    if (existingEntityRelation) {
      await prisma.userRelations.delete({
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
