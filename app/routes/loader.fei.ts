import { type LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { cors } from "remix-utils/cors";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.onboarded_at) {
    return cors(
      request,
      json(
        { user: null, feisAssigned: [], feisDone: [] },
        {
          status: 401,
        },
      ),
      {
        origin: "https://zacharie.cleverapps.io",
        credentials: true,
      },
    );
  }
  const feisAssigned = await prisma.fei.findMany({
    where: {
      svi_signed_at: null,
      OR: [
        {
          fei_current_owner_user_id: user.id,
        },
        {
          fei_next_owner_user_id: user.id,
        },
        {
          FeiNextEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
              },
            },
          },
        },
        {
          FeiCurrentEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
              },
            },
          },
        },
      ],
    },
    select: {
      numero: true,
      created_at: true,
      updated_at: true,
      fei_current_owner_role: true,
      fei_next_owner_role: true,
      commune_mise_a_mort: true,
    },
    orderBy: {
      updated_at: "desc",
    },
  });
  const feisDone = await prisma.fei.findMany({
    where: {
      created_by_user_id: user.id,
      svi_signed_at: {
        not: null,
      },
    },
    select: {
      numero: true,
      created_at: true,
      updated_at: true,
      svi_signed_at: true,
      commune_mise_a_mort: true,
    },
  });

  return cors(request, json({ user, feisAssigned, feisDone }), {
    origin: "https://zacharie.cleverapps.io",
    credentials: true,
  });
}

export type FeisLoaderData = ExtractLoaderData<typeof loader>;
