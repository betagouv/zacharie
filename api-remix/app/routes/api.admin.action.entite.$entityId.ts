import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles, Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  console.log("formData tableau-de-bord.admin.entite.$entityId", Object.fromEntries(formData));

  if (formData.get("_action") === "remove-couple") {
    const entity = await prisma.entity.findUnique({
      where: {
        id: params.entityId,
      },
    });
    if (entity && entity.coupled_entity_id) {
      const couple = await prisma.entity.findUnique({
        where: {
          id: entity.coupled_entity_id,
        },
      });
      if (couple) {
        await prisma.entity.update({
          where: {
            id: couple.id,
          },
          data: {
            coupled_entity_id: null,
          },
        });
        const updatedEntity = await prisma.entity.update({
          where: {
            id: params.entityId,
          },
          data: {
            coupled_entity_id: null,
          },
        });
        return json({ ok: true, data: updatedEntity });
      }
    } else {
      throw redirect("/app/tableau-de-bord/admin/entites");
    }
  }
  if (formData.get(Prisma.EntityScalarFieldEnum.coupled_entity_id)) {
    const coupledEntityId = formData.get(Prisma.EntityScalarFieldEnum.coupled_entity_id) as string;

    await prisma.entity.update({
      where: {
        id: coupledEntityId,
      },
      data: {
        coupled_entity_id: params.entityId,
      },
    });

    const updatedEntity = await prisma.entity.update({
      where: {
        id: params.entityId,
      },
      data: {
        coupled_entity_id: coupledEntityId,
      },
    });
    return json({ ok: true, data: updatedEntity });
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
