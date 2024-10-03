import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
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
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  return json({ ok: true, data: { carcasse, fei: carcasse.Fei }, error: "" });
}

export type CarcasseLoaderData = ExtractLoaderData<typeof loader>;
