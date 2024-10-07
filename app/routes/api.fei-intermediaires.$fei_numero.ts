import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import type { FeiIntermediaire } from "@prisma/client";
import { prisma } from "~/db/prisma.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  if (!params.fei_numero) {
    return json({ ok: false, data: null, error: "Missing fei_numero" }, { status: 400 });
  }
  const intermediaires = await prisma.feiIntermediaire.findMany({
    where: {
      fei_numero: params.fei_numero,
    },
    orderBy: {
      created_at: "desc", // the latest first
    },
  });

  return json({
    ok: true,
    data: {
      intermediaires: intermediaires satisfies Array<FeiIntermediaire>,
    },
    error: "",
  });
}

export type FeiIntermediairesLoaderData = ExtractLoaderData<typeof loader>;
