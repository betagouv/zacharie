import { json, type ActionFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { Prisma, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { intermediaire_id } = params;
  const formData = await request.formData();
  if (!intermediaire_id) {
    return json({ ok: false, data: null, error: "L'identifiant de l'intermédiaire est obligatoire" }, { status: 400 });
  }

  console.log("formData action.fei-intermediaire.$intermedaire_id", Object.fromEntries(formData));

  const fei_numero = formData.get(Prisma.FeiIntermediaireScalarFieldEnum.fei_numero) as string;
  if (!fei_numero) {
    return json({ ok: false, data: null, error: "Le numéro de la FEI est obligatoire" }, { status: 400 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: fei_numero,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "La FEI n'existe pas" }, { status: 400 });
  }

  const newFeiIntermediaire = await prisma.feiIntermediaire.create({
    data: {
      id: intermediaire_id, // {user_id}_{fei_numero}_{HHMMSS}
      fei_numero,
      fei_intermediaire_user_id: formData.get(
        Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_user_id,
      ) as string,
      fei_intermediaire_entity_id: formData.get(
        Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_entity_id,
      ) as string,
      fei_intermediaire_role: formData.get(Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_role) as UserRoles,
    },
  });

  return json({ ok: true, data: newFeiIntermediaire, error: "" });
}

export type FeiIntermediaireActionData = ExtractLoaderData<typeof action>;