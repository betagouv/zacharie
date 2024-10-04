import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { feiInclude } from "~/db/fei.server";
import { prisma } from "~/db/prisma.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: params.fei_numero as string,
    },
    include: feiInclude,
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  return json({
    ok: true,
    data: {
      fei,
    },
    error: "",
  });
}

export type FeiLoaderData = ExtractLoaderData<typeof loader>;
