import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { EntityRelationType, EntityTypes, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
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
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const usersWithEntityType = await prisma.user.findMany({
    where: {
      roles:
        entity.type === EntityTypes.PREMIER_DETENTEUR
          ? {
              hasSome: [UserRoles.PREMIER_DETENTEUR, UserRoles.EXAMINATEUR_INITIAL],
            }
          : {
              has: entity.type,
            },
      id: {
        notIn: entity.EntityRelatedWithUser.filter(
          (entityRelation) => entityRelation.relation === EntityRelationType.WORKING_FOR,
        ).map((entityRelation) => entityRelation.UserRelatedWithEntity.id),
      },
    },
    orderBy: {
      updated_at: "desc",
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
    orderBy: {
      updated_at: "desc",
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
    orderBy: {
      updated_at: "desc",
    },
  });

  return json({
    ok: true,
    data: {
      entity,
      usersWithEntityType,
      potentialPartenaires,
      sviOrEtgPotentielCouple,
    },
    error: "",
  });
}

export type AdminEntityLoaderData = ExtractLoaderData<typeof loader>;
