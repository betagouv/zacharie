import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { getFeiByNumero, type FeiByNumero } from "~/db/fei.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect(`${import.meta.env.VITE_APP_URL}/app/connexion?type=compte-existant`);
  }
  const fei = (await getFeiByNumero(params.fei_numero as string)) as FeiByNumero;
  if (!fei) {
    throw redirect("/app/tableau-de-bord");
  }

  return json({
    fei,
    latestVersion: __VITE_BUILD_ID__,
  });
}

export type FeiLoaderData = ExtractLoaderData<typeof loader>;
