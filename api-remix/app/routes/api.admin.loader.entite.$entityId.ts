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

  const collecteursRelatedToETG =
    entity.type !== EntityTypes.ETG
      ? []
      : await prisma.eTGAndEntityRelations
          .findMany({
            where: {
              etg_id: entity.id,
              entity_type: EntityTypes.COLLECTEUR_PRO,
            },
            orderBy: {
              updated_at: "desc",
            },
            include: {
              EntitiesRelatedWithETG: true,
            },
          })
          .then((data) => data.map((rel) => rel.EntitiesRelatedWithETG));

  console.log("collecteursRelatedToETG", collecteursRelatedToETG);

  const potentialCollecteursRelatedToETG = await prisma.entity.findMany({
    where: {
      type: EntityTypes.COLLECTEUR_PRO,
      id: {
        notIn: collecteursRelatedToETG.map((entity) => entity.id),
      },
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const svisRelatedToETG =
    entity.type !== EntityTypes.ETG
      ? []
      : await prisma.eTGAndEntityRelations
          .findMany({
            where: {
              etg_id: entity.id,
              entity_type: EntityTypes.SVI,
            },
            orderBy: {
              updated_at: "desc",
            },
            include: {
              EntitiesRelatedWithETG: true,
            },
          })
          .then((data) => data.map((rel) => rel.EntitiesRelatedWithETG));

  const potentialSvisRelatedToETG = await prisma.entity.findMany({
    where: {
      type: EntityTypes.SVI,
      id: {
        notIn: svisRelatedToETG.map((entity) => entity.id),
      },
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const etgsRelatedWithEntity =
    entity.type !== EntityTypes.COLLECTEUR_PRO && entity.type !== EntityTypes.SVI
      ? []
      : await prisma.eTGAndEntityRelations
          .findMany({
            where: {
              entity_id: entity.id,
            },
            orderBy: {
              updated_at: "desc",
            },
            include: {
              ETGRelatedWithEntities: true,
            },
          })
          .then((data) => data.map((rel) => rel.ETGRelatedWithEntities));

  const potentialEtgsRelatedWithEntity =
    entity.type !== EntityTypes.COLLECTEUR_PRO && entity.type !== EntityTypes.SVI
      ? []
      : await prisma.entity.findMany({
          where: {
            type: EntityTypes.ETG,
            id: {
              notIn: etgsRelatedWithEntity.map((entity) => entity.id),
            },
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
      collecteursRelatedToETG,
      potentialCollecteursRelatedToETG,
      svisRelatedToETG,
      potentialSvisRelatedToETG,
      etgsRelatedWithEntity,
      potentialEtgsRelatedWithEntity,
    },
    error: "",
  });
}

export type AdminEntityLoaderData = ExtractLoaderData<typeof loader>;
