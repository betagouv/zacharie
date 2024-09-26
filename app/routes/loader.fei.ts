import { type LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { feiInclude } from "~/db/fei.server";
import { type CachedFeis } from "~/utils/caches";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  const latestFeis: CachedFeis = {};

  if (!user?.onboarded_at) {
    return json(
      { user: null, latestFeis },
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
      fei_current_owner_user_id: { not: user.id },
      fei_next_owner_user_id: { not: user.id },
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
  const feisDone = await prisma.fei.findMany({
    where: {
      svi_signed_at: {
        not: null,
      },
    },
    include: feiInclude,
    orderBy: {
      updated_at: "desc",
    },
  });

  for (const fei of [...feisUnderMyResponsability, ...feisToTake, ...feisOngoing, ...feisDone]) {
    latestFeis[fei.numero] = fei;
  }

  console.log("feisUnderMyResponsability", feisUnderMyResponsability.length);
  console.log("feisToTake", feisToTake.length);
  console.log("feisOngoing", feisOngoing.length);
  console.log("feisDone", feisDone.length);
  console.log("latestFeis", Object.keys(latestFeis).length);

  return json({ user, latestFeis });
}

export type FeisLoaderData = ExtractLoaderData<typeof loader>;
