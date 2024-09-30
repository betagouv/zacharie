import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { UserRoles } from "@prisma/client";
import { getUserFromCookie } from "~/services/auth.server";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/app/connexion?type=compte-existant");
  }
  const user = await prisma.user.findUnique({
    where: {
      id: params.userId,
    },
  });
  if (!user) {
    throw redirect("/app/tableau-de-bord/admin/utilisateurs");
  }
  const allEntities = await prisma.entity.findMany();
  const userEntitiesRelations = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
    },
    include: {
      EntityRelatedWithUser: true,
    },
  });

  return json({
    user,
    identityDone:
      !!user.nom_de_famille &&
      !!user.prenom &&
      !!user.telephone &&
      !!user.addresse_ligne_1 &&
      !!user.code_postal &&
      !!user.ville,
    examinateurDone: !user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) ? true : !!user.numero_cfei,
    allEntities,
    userEntitiesRelations,
  });
}

export type AdminUserLoaderData = ExtractLoaderData<typeof loader>;
