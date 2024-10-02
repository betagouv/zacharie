import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { EntityRelationType } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { sortEntitiesByTypeAndId, sortEntitiesRelationsByTypeAndId } from "~/utils/sort-things-by-type-and-id";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

// Loader function
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const allEntities = await prisma.entity.findMany();
  const userEntitiesRelations = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
      relation: EntityRelationType.WORKING_FOR,
    },
  });

  const [allEntitiesIds, allEntitiesByTypeAndId] = sortEntitiesByTypeAndId(allEntities);
  const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(userEntitiesRelations, allEntitiesIds);

  return json({
    allEntitiesByTypeAndId,
    userEntitiesByTypeAndId,
    latestVersion: __VITE_BUILD_ID__,
  });
}

export type EntitiesLoaderData = ExtractLoaderData<typeof loader>;
