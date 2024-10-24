import { json, type LoaderFunctionArgs, type ActionFunctionArgs, SerializeFrom } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { UserRoles, Prisma, type FeiIntermediaire } from "@prisma/client";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { intermediaire_id, fei_numero } = params;
  if (!intermediaire_id) {
    return json({ ok: false, data: null, error: "L'identifiant du destinataire est obligatoire" }, { status: 400 });
  }
  if (!fei_numero) {
    return json({ ok: false, data: null, error: "Le numéro de la fiche est obligatoire" }, { status: 400 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: fei_numero,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "La fiche n'existe pas" }, { status: 400 });
  }

  const formData = await request.formData();

  if (formData.get(Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at)) {
    // check if valid date
    let dateValue;
    const date = new Date(formData.get(Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at) as string);
    if (!isNaN(date.getTime())) {
      dateValue = date;
    } else {
      dateValue = new Date();
    }

    const intermediaire = await prisma.feiIntermediaire.update({
      where: {
        id: intermediaire_id,
      },
      data: {
        check_finished_at: dateValue,
      },
    });
    return json({ ok: true, data: { intermediaire }, error: "" });
  }

  const intermediaire = await prisma.feiIntermediaire.create({
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

  return json({
    ok: true,
    data: {
      intermediaire: JSON.parse(JSON.stringify(intermediaire)) as SerializeFrom<FeiIntermediaire>,
    },
    error: "",
  });
}

export type FeiIntermediaireActionData = ExtractLoaderData<typeof action>;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  if (!params.fei_numero) {
    return json({ ok: false, data: null, error: "Missing fei_numero" }, { status: 401 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: params.fei_numero as string,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  if (!params.intermediaire_id) {
    return json({ ok: false, data: null, error: "Missing intermediaire_id" }, { status: 400 });
  }
  const feiIntermedaire = await prisma.feiIntermediaire.findUnique({
    where: {
      id: params.intermediaire_id,
    },
  });
  if (!feiIntermedaire) {
    return json({
      ok: true,
      data: null,
      error: "",
    });
  }

  return json({
    ok: true,
    data: {
      intermediaire: JSON.parse(JSON.stringify(feiIntermedaire)) as SerializeFrom<FeiIntermediaire>,
    },
    error: "",
  });
}

export type FeiIntermediaireLoaderData = ExtractLoaderData<typeof loader>;
