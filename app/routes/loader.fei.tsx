import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { getUserOnboardingRoute } from "~/utils/user-onboarded.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("BETABIM");
  const user = await getUserFromCookie(request, { debug: true });
  return json({ ok: true });
  // console.log("user", user);
  // if (!user) {
  //   throw redirect("/connexion?type=compte-existant");
  // }
  const onboardingRoute = getUserOnboardingRoute(user);
  if (onboardingRoute) {
    throw redirect(onboardingRoute);
  }
  const feiAssigned = await prisma.fei.findMany({
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
  const feiDone = await prisma.fei.findMany({
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

  return json({ user, feiAssigned, feiDone });
}

export type FeisLoaderData = ExtractLoaderData<typeof loader>;
