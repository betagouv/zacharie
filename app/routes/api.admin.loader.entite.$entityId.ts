import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { EntityRelationType, EntityTypes, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect(`${import.meta.env.VITE_APP_URL}/app/connexion?type=compte-existant`);
  }
  const entity = await prisma.entity.findUnique({
    where: {
      id: params.entityId,
    },
    include: {
      CoupledEntity: true,
      EntityRelatedWithUser: {
        select: {
          relation: true,
          UserRelatedWithEntity: {
            select: {
              id: true,
              email: true,
              nom_de_famille: true,
              prenom: true,
              code_postal: true,
              ville: true,
              roles: true,
            },
          },
        },
      },
    },
  });
  if (!entity) {
    throw redirect("/app/tableau-de-bord/admin/entites");
  }

  const usersWithEntityType = await prisma.user.findMany({
    where: {
      roles: {
        has: entity.type,
      },
      id: {
        notIn: entity.EntityRelatedWithUser.filter(
          (entityRelation) => entityRelation.relation === EntityRelationType.WORKING_FOR,
        ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
      },
    },
    select: {
      id: true,
      email: true,
      nom_de_famille: true,
      prenom: true,
      code_postal: true,
      ville: true,
      roles: true,
    },
  });

  const potentialPartenaires = await prisma.user.findMany({
    where: {
      id: {
        notIn: entity.EntityRelatedWithUser.filter(
          (entityRelation) => entityRelation.relation === EntityRelationType.WORKING_WITH,
        ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
      },
    },
    select: {
      id: true,
      email: true,
      nom_de_famille: true,
      prenom: true,
      code_postal: true,
      ville: true,
      roles: true,
    },
  });

  const sviOrEtgPotentielCouple = await prisma.entity.findMany({
    where: {
      id: {
        not: entity.id,
      },
      type: entity.type === EntityTypes.ETG ? EntityTypes.SVI : EntityTypes.ETG,
      coupled_entity_id: null,
    },
  });

  return json({
    entity,
    usersWithEntityType,
    potentialPartenaires,
    sviOrEtgPotentielCouple,
    latestVersion: __VITE_BUILD_ID__,
  });
}

export type AdminEntityLoaderData = ExtractLoaderData<typeof loader>;
