import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles, Prisma, EntityTypes } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  console.log("formData tableau-de-bord.admin.entite.$entityId", Object.fromEntries(formData));

  if (formData.get("_action") === "remove-etg-relation") {
    await prisma.eTGAndEntityRelations.delete({
      where: {
        etg_id_entity_id: formData.get("etg_id_entity_id") as string,
      },
    });
    return json({ ok: true });
  }
  if (formData.get("_action") === "add-etg-relation") {
    const data: Prisma.ETGAndEntityRelationsUncheckedCreateInput = {
      etg_id_entity_id: formData.get(Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id_entity_id) as string,
      entity_id: formData.get(Prisma.ETGAndEntityRelationsScalarFieldEnum.entity_id) as string,
      etg_id: formData.get(Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id) as string,
      entity_type: formData.get(Prisma.ETGAndEntityRelationsScalarFieldEnum.entity_type) as EntityTypes,
    };
    const relation = await prisma.eTGAndEntityRelations.upsert({
      where: {
        etg_id_entity_id: formData.get(Prisma.ETGAndEntityRelationsScalarFieldEnum.etg_id_entity_id) as string,
      },
      create: data,
      update: data,
    });
    return json({ ok: true, data: relation });
  }

  const data: Prisma.EntityUncheckedUpdateInput = {
    raison_sociale: formData.get(Prisma.EntityScalarFieldEnum.raison_sociale) as string,
    nom_d_usage: formData.get(Prisma.EntityScalarFieldEnum.nom_d_usage) as string,
    address_ligne_1: formData.get(Prisma.EntityScalarFieldEnum.address_ligne_1) as string,
    address_ligne_2: formData.get(Prisma.EntityScalarFieldEnum.address_ligne_2) as string,
    code_postal: formData.get(Prisma.EntityScalarFieldEnum.code_postal) as string,
    ville: formData.get(Prisma.EntityScalarFieldEnum.ville) as string,
    siret: (formData.get(Prisma.EntityScalarFieldEnum.siret) as string) || null,
    numero_ddecpp: (formData.get(Prisma.EntityScalarFieldEnum.numero_ddecpp) as string) || null,
  };

  const updatedEntity = await prisma.entity.update({
    where: {
      id: params.entityId,
    },
    data,
  });

  return json({ ok: true, data: updatedEntity });
}

export type AdminEntiteActionData = ExtractLoaderData<typeof action>;
