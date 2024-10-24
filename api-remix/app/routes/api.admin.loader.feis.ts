import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    return json({ ok: false, data: null, error: "Unauthorized access" });
  }

  // Fetch the fiche data along with the required intervenants
  const feis = await prisma.fei.findMany({
    include: {
      FeiCurrentUser: { select: { email: true } }, // Fetching the current user's email
      FeiCurrentEntity: { select: { nom_d_usage: true } }, // Fetching the current entity's raison sociale
      FeiNextEntity: { select: { nom_d_usage: true } }, // Fetching the next entity's raison sociale
      FeiNextUser: { select: { email: true } }, // Fetching the next user's email
      FeiExaminateurInitialUser: { select: { email: true } }, // Fetching the examinateur's email
      FeiPremierDetenteurUser: { select: { email: true } }, // Fetching the premier detenteur's email
      FeiPremierDetenteurEntity: { select: { nom_d_usage: true } }, // Fetching the premier detenteur's raison sociale
      FeiIntermediaires: {
        include: {
          FeiIntermediaireEntity: {
            select: {
              nom_d_usage: true,
              type: true,
            },
          },
        },
      },
      FeiSviEntity: { select: { nom_d_usage: true } },
    },
  });

  return json({
    ok: true,
    data: feis.map((fei) => ({
      ...fei,
      responsabilites: [
        {
          type: "Propriétaire actuel",
          role: fei.fei_current_owner_role,
          email: fei.FeiCurrentUser?.email,
          nom_d_usage: fei.FeiCurrentEntity?.nom_d_usage,
        },
        {
          type: "Propriétaire suivant",
          role: fei.fei_next_owner_role,
          email: fei.FeiNextUser?.email,
          nom_d_usage: fei.FeiNextEntity?.nom_d_usage,
        },
      ],
      intervenants: [
        {
          type: "Examinateur Initial",
          email: fei.FeiExaminateurInitialUser?.email,
          nom_d_usage: null,
        },
        {
          type: "Premier Detenteur",
          email: fei.FeiPremierDetenteurUser?.email,
          nom_d_usage: null,
        },
        ...fei.FeiIntermediaires.map((inter) => ({
          type: inter.FeiIntermediaireEntity.type,
          email: null,
          nom_d_usage: inter.FeiIntermediaireEntity.nom_d_usage,
        })),
        {
          type: "SVI",
          email: null,
          nom_d_usage: fei.FeiSviEntity?.nom_d_usage,
        },
      ],
    })),
  });
}

export type AdminFeisLoaderData = ExtractLoaderData<typeof loader>;
