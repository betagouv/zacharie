import { type LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { EntityRelationType } from "@prisma/client";

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
      deleted_at: null,
      svi_assigned_at: { not: null },
      OR: [
        {
          examinateur_initial_user_id: user.id,
        },
        {
          premier_detenteur_user_id: user.id,
        },
        {
          FeiPremierDetenteurEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
                relation: EntityRelationType.WORKING_FOR,
              },
            },
          },
        },
        {
          svi_user_id: user.id,
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
        {
          FeiSviEntity: {
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
    select: {
      numero: true,
      created_at: true,
      updated_at: true,
      fei_current_owner_role: true,
      fei_next_owner_role: true,
      commune_mise_a_mort: true,
      svi_assigned_at: true,
      examinateur_initial_date_approbation_mise_sur_le_marche: true,
      premier_detenteur_name_cache: true,
      resume_nombre_de_carcasses: true,
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
