import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles, Prisma, EntityTypes } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/app/connexion?type=compte-existant");
  }

  const formData = await request.formData();
  console.log("formData tableau-de-bord.admin.entite.nouvelle", Object.fromEntries(formData));

  const createdEntity = await prisma.entity.create({
    data: {
      raison_sociale: formData.get(Prisma.EntityScalarFieldEnum.raison_sociale) as string,
      type: formData.get(Prisma.EntityScalarFieldEnum.type) as EntityTypes,
    },
  });

  return json({ ok: true, data: createdEntity });
}

export type AdminNouvelleEntiteActionData = ExtractLoaderData<typeof action>;
