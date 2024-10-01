import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/app/connexion?type=compte-existant");
  }
  return json({
    user,
    latestVersion: __VITE_BUILD_ID__,
  });
}

export type MeLoaderData = ExtractLoaderData<typeof loader>;
