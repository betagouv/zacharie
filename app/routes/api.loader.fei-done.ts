import { type LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);

  if (!user?.onboarded_at) {
    return json(
      {
        user: null,
        feisDone: [],
      },
      {
        status: 401,
      },
    );
  }
  const feisDone = await prisma.fei.findMany({
    where: {
      svi_signed_at: {
        not: null,
      },
    },
    select: {
      numero: true,
      created_at: true,
      updated_at: true,
      fei_current_owner_role: true,
      fei_next_owner_role: true,
      commune_mise_a_mort: true,
      svi_signed_at: true,
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  console.log("feisDone", feisDone.length);

  return json({
    user,
    feisDone,
  });
}

export type FeisDoneLoaderData = ExtractLoaderData<typeof loader>;
