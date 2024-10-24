import { json, SerializeFrom, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { EntityRelationType, type Fei } from "@prisma/client";

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
          AND: [
            {
              fei_current_owner_user_id: null,
            },
            {
              FeiCurrentEntity: {
                EntityRelatedWithUser: {
                  some: {
                    owner_id: user.id,
                    relation: EntityRelationType.WORKING_FOR,
                  },
                },
              },
            },
          ],
        },
      ],
    },
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
                relation: EntityRelationType.WORKING_FOR,
              },
            },
          },
        },
      ],
    },
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
          AND: [
            {
              fei_next_owner_user_id: { not: user.id },
            },
            {
              fei_next_owner_user_id: { not: null },
            },
          ],
        },
        {
          OR: [
            { fei_next_owner_entity_id: null },
            {
              FeiNextEntity: {
                EntityRelatedWithUser: {
                  none: {
                    owner_id: user.id,
                    relation: EntityRelationType.WORKING_FOR,
                  },
                },
              },
            },
          ],
        },
        {
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
                        relation: EntityRelationType.WORKING_FOR,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  // console.log("feisUnderMyResponsability", feisUnderMyResponsability.length);
  // console.log("feisToTake", feisToTake.length);
  // console.log("feisOngoing", feisOngoing.length);

  return json({
    user,
    feisUnderMyResponsability: JSON.parse(JSON.stringify(feisUnderMyResponsability)) as SerializeFrom<Array<Fei>>,
    feisToTake: JSON.parse(JSON.stringify(feisToTake)) as SerializeFrom<Array<Fei>>,
    feisOngoing: JSON.parse(JSON.stringify(feisOngoing)) as SerializeFrom<Array<Fei>>,
  });
}

export type FeisLoaderData = ExtractLoaderData<typeof loader>;
