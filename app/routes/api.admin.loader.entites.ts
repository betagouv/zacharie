import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/app/connexion?type=compte-existant");
  }
  const entities = await prisma.entity.findMany({
    orderBy: {
      type: "asc",
    },
  });
  return json({ entities, latestVersion: __VITE_BUILD_ID__ });
}

export type AdminEntitesLoaderData = ExtractLoaderData<typeof loader>;
