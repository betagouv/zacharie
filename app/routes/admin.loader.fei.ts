import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }
  const users = await prisma.user.findMany();
  return json({ users });
}

export type AdminFeisLoaderData = ExtractLoaderData<typeof loader>;