import { ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles, Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }

  const formData = await request.formData();
  console.log("formData tableau-de-bord.admin.utilisateur.nouveau", Object.fromEntries(formData));

  const createdUser = await prisma.user.create({
    data: {
      email: formData.get(Prisma.UserScalarFieldEnum.email) as string,
      roles: formData.getAll(Prisma.UserScalarFieldEnum.roles) as UserRoles[],
    },
  });

  return json({ ok: true, data: createdUser });
}

export type AdminNouveauUserLoaderData = ExtractLoaderData<typeof action>;