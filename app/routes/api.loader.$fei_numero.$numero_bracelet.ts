import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/app/connexion?type=compte-existant");
  }
  const carcasse = await prisma.carcasse.findUnique({
    where: {
      numero_bracelet: params.numero_bracelet,
      fei_numero: params.fei_numero,
    },
    include: {
      Fei: true,
    },
  });
  if (!carcasse) {
    throw redirect(`/app/tableau-de-bord/fei/${params.fei_numero}`);
  }

  return json({ carcasse, fei: carcasse.Fei });
}

export type CarcasseLoaderData = ExtractLoaderData<typeof loader>;
