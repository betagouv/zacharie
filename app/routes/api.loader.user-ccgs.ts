import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { EntityTypes, EntityRelationType } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const userCCGs = (
    await prisma.entityRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_WITH,
        EntityRelatedWithUser: {
          type: EntityTypes.CCG,
        },
      },
      include: {
        EntityRelatedWithUser: true,
      },
    })
  ).map((relation) => relation.EntityRelatedWithUser);

  return json({
    userCCGs,
    latestVersion: __VITE_BUILD_ID__,
  });
}

export type UserCCGsLoaderData = ExtractLoaderData<typeof loader>;
