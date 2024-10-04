import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { feiInclude } from "~/db/fei.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);

  if (!user?.onboarded_at) {
    return json(
      {
        user: null,
        feisUnderMyResponsability: [],
        feisToTake: [],
        feisOngoing: [],
        feisDone: [],
      },
      {
        status: 401,
      },
    );
  }
  const feisUnderMyResponsability = await prisma.fei.findMany({
    where: {
      svi_signed_at: null,
      fei_next_owner_user_id: null,
      fei_next_owner_entity_id: null,
      OR: [
        {
          fei_current_owner_user_id: user.id,
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
    include: feiInclude,
    orderBy: {
      updated_at: "desc",
    },
  });
  const feisToTake = await prisma.fei.findMany({
    where: {
      svi_signed_at: null,
      OR: [
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
      ],
    },
    include: feiInclude,
    orderBy: {
      updated_at: "desc",
    },
  });
  const feisOngoing = await prisma.fei.findMany({
    where: {
      svi_signed_at: null,
      // fei_current_owner_user_id: { not: user.id },
      AND: [
        {
          fei_next_owner_user_id: { not: user.id },
        },
        {
          fei_next_owner_user_id: { not: null },
        },
      ],
      FeiNextEntity: {
        EntityRelatedWithUser: {
          none: {
            owner_id: user.id,
          },
        },
      },
      OR: [
        {
          examinateur_initial_user_id: user.id,
        },
        {
          premier_detenteur_user_id: user.id,
        },
        {
          FeiIntermediaires: {
            some: {
              fei_intermediaire_user_id: user.id,
            },
          },
        },
        {
          FeiIntermediaires: {
            some: {
              FeiIntermediaireEntity: {
                EntityRelatedWithUser: {
                  some: {
                    owner_id: user.id,
                  },
                },
              },
            },
          },
        },
      ],
    },
    include: feiInclude,
    orderBy: {
      updated_at: "desc",
    },
  });

  console.log("feisUnderMyResponsability", feisUnderMyResponsability.length);
  console.log("feisToTake", feisToTake.length);
  console.log("feisOngoing", feisOngoing.length);

  return json({
    user,
    feisUnderMyResponsability,
    feisToTake,
    feisOngoing,
  });
}

export type FeisLoaderData = ExtractLoaderData<typeof loader>;
