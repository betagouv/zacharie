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

  // Fetch the FEI data along with the required intervenants
  const feis = await prisma.fei.findMany({
    include: {
      FeiCurrentUser: { select: { email: true } }, // Fetching the current user's email
      FeiCurrentEntity: { select: { raison_sociale: true } }, // Fetching the current entity's raison sociale
      FeiNextEntity: { select: { raison_sociale: true } }, // Fetching the next entity's raison sociale
      FeiNextUser: { select: { email: true } }, // Fetching the next user's email
      FeiExaminateurInitialUser: { select: { email: true } }, // Fetching the examinateur's email
      FeiPremierDetenteurUser: { select: { email: true } }, // Fetching the premier detenteur's email
      FeiPremierDetenteurEntity: { select: { raison_sociale: true } }, // Fetching the premier detenteur's raison sociale
      FeiIntermediaires: {
        include: {
          FeiIntermediaireEntity: {
            select: {
              raison_sociale: true,
              type: true,
            },
          },
        },
      },
      FeiSviEntity: { select: { raison_sociale: true } },
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
          raison_sociale: fei.FeiCurrentEntity?.raison_sociale,
        },
        {
          type: "Propriétaire suivant",
          role: fei.fei_next_owner_role,
          email: fei.FeiNextUser?.email,
          raison_sociale: fei.FeiNextEntity?.raison_sociale,
        },
      ],
      intervenants: [
        {
          type: "Examinateur Initial",
          email: fei.FeiExaminateurInitialUser?.email,
          raison_sociale: null,
        },
        {
          type: "Premier Detenteur",
          email: fei.FeiPremierDetenteurUser?.email,
          raison_sociale: null,
        },
        ...fei.FeiIntermediaires.map((inter) => ({
          type: inter.FeiIntermediaireEntity.type,
          email: null,
          raison_sociale: inter.FeiIntermediaireEntity.raison_sociale,
        })),
        {
          type: "SVI",
          email: null,
          raison_sociale: fei.FeiSviEntity?.raison_sociale,
        },
      ],
    })),
  });
}

export type AdminFeisLoaderData = ExtractLoaderData<typeof loader>;
