import { json, SerializeFrom, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import type { Carcasse } from "@prisma/client";
import { prisma } from "~/db/prisma.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  if (!params.fei_numero) {
    return json({ ok: false, data: null, error: "Missing fei_numero" }, { status: 400 });
  }
  const carcasses = await prisma.carcasse.findMany({
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
      carcasses: JSON.parse(JSON.stringify(carcasses)) as Array<SerializeFrom<Carcasse>>,
    },
    error: "",
  });
}

export type CarcassesLoaderData = ExtractLoaderData<typeof loader>;
