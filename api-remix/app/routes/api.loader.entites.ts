import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { EntityRelationType, EntityTypes } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { sortEntitiesByTypeAndId, sortEntitiesRelationsByTypeAndId } from "~/utils/sort-things-by-type-and-id.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

// Loader function
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const allEntities = await prisma.entity.findMany({
    where: {
      type: { not: EntityTypes.CCG },
    },
    orderBy: {
      updated_at: "desc",
    },
  });
  const userEntitiesRelationsWorkingFor = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
      relation: EntityRelationType.WORKING_FOR,
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const [allEntitiesIds, allEntitiesByTypeAndId] = sortEntitiesByTypeAndId(allEntities);
  const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(userEntitiesRelationsWorkingFor, allEntitiesIds);

  return json({
    ok: true,
    data: {
      allEntitiesByTypeAndId,
      userEntitiesByTypeAndId,
    },
    error: "",
  });
}

export type EntitiesLoaderData = ExtractLoaderData<typeof loader>;
