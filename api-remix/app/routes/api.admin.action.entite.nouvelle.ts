import { type ActionFunctionArgs, json } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles, Prisma, EntityTypes } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  console.log("formData tableau-de-bord.admin.entite.nouvelle", Object.fromEntries(formData));

  const createdEntity = await prisma.entity.create({
    data: {
      raison_sociale: formData.get(Prisma.EntityScalarFieldEnum.raison_sociale) as string,
      nom_d_usage: formData.get(Prisma.EntityScalarFieldEnum.raison_sociale) as string,
      type: formData.get(Prisma.EntityScalarFieldEnum.type) as EntityTypes,
    },
  });

  return json({ ok: true, data: createdEntity, error: "" });
}

export type AdminNouvelleEntiteActionData = ExtractLoaderData<typeof action>;
