import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { Prisma, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { getFeiByNumero } from "~/db/fei.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

  console.log("formData action.fei.nouvelle", Object.fromEntries(formData));

  // Create a new object with only the fields that are required and set
  const createData: Prisma.FeiCreateInput = {
    numero: formData.get(Prisma.FeiScalarFieldEnum.numero) as string,
    FeiCurrentUser: {
      connect: {
        id: user.id,
      },
    },
    FeiCreatedByUser: {
      connect: {
        id: user.id,
      },
    },
  };

  if (formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id)) {
    createData.FeiDetenteurInitialUser = {
      connect: {
        id: user.id,
      },
    };
    createData.fei_current_owner_role = UserRoles.PREMIER_DETENTEUR;
  }
  if (formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
    // if (!formData.get(Prisma.FeiScalarFieldEnum.commune_mise_a_mort)) {
    //   return json({ ok: false, data: null, error: "La commune de mise à mort est obligatoire" }, { status: 400 });
    // }

    if (!formData.get(Prisma.FeiScalarFieldEnum.date_mise_a_mort)) {
      return json({ ok: false, data: null, error: "La date de mise à mort est obligatoire" }, { status: 400 });
    }

    createData.date_mise_a_mort = new Date(formData.get(Prisma.FeiScalarFieldEnum.date_mise_a_mort) as string);
    createData.commune_mise_a_mort = formData.get(Prisma.FeiScalarFieldEnum.commune_mise_a_mort) as string;
    createData.FeiExaminateurInitialUser = {
      connect: {
        id: user.id,
      },
    };
    createData.fei_current_owner_role = UserRoles.EXAMINATEUR_INITIAL;
  }

  const fei = await prisma.fei.create({
    data: createData,
  });
  const feiToReturn = await getFeiByNumero(fei.numero);

  return json({ ok: true, data: feiToReturn, error: "" }, { status: 200 });
}

export type FeiNouvelleActionData = ExtractLoaderData<typeof action>;

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/app/connexion?type=compte-existant");
  }
  if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    return json({ user });
  }
  throw redirect("/app/tableau-de-bord");
}
