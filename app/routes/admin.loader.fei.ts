import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { cors } from "remix-utils/cors";

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }
  const feis = await prisma.fei.findMany();
  return cors(request, json({ feis }), {
    origin: "https://zacharie.cleverapps.io",
    credentials: true,
  });
}

export type AdminFeisLoaderData = ExtractLoaderData<typeof loader>;
