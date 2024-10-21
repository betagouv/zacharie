import { json, SerializeFrom, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { Prisma, type CarcasseIntermediaire } from "@prisma/client";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { fei_numero, intermediaire_id, numero_bracelet } = params;
  if (!fei_numero) {
    return json({ ok: false, data: null, error: "Le numéro FEI est obligatoire" }, { status: 400 });
  }
  const existingFei = await prisma.fei.findUnique({
    where: { numero: fei_numero },
  });
  if (!existingFei) {
    return json({ ok: false, data: null, error: "FEI not found" }, { status: 404 });
  }
  if (!numero_bracelet) {
    return json({ ok: false, data: null, error: "Le numéro de la carcasse est obligatoire" }, { status: 400 });
  }
  console.log("numero_bracelet", numero_bracelet);
  const existingCarcasse = await prisma.carcasse.findUnique({
    where: { numero_bracelet: numero_bracelet },
  });
  if (!existingCarcasse) {
    return json({ ok: false, data: null, error: "Carcasse not found" }, { status: 404 });
  }
  if (!intermediaire_id) {
    return json({ ok: false, data: null, error: "L'identifiant du destinataire est obligatoire" }, { status: 400 });
  }
  const feiIntermediaire = await prisma.feiIntermediaire.findUnique({
    where: { id: intermediaire_id },
  });
  if (!feiIntermediaire) {
    return json({ ok: false, data: null, error: "FEI intermediaire not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const fei_numero__bracelet__intermediaire_id = `${fei_numero}__${numero_bracelet}__${intermediaire_id}`;
  const data: Prisma.CarcasseIntermediaireUncheckedCreateInput = {
    fei_numero__bracelet__intermediaire_id,
    fei_numero: fei_numero,
    numero_bracelet,
    fei_intermediaire_id: intermediaire_id,
    fei_intermediaire_user_id: user.id,
    fei_intermediaire_entity_id: feiIntermediaire.fei_intermediaire_entity_id,
  };
  if (formData.has(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire)) {
    data.commentaire = formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire) as string;
  }
  if (formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge) === "true") {
    data.prise_en_charge = true;
    data.refus = null;
    data.carcasse_check_finished_at = new Date();
    const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert({
      where: {
        fei_numero__bracelet__intermediaire_id,
      },
      create: data,
      update: data,
    });
    // remove refus if there was one
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const carcasseUpdated = await prisma.carcasse.update({
      where: {
        numero_bracelet: numero_bracelet,
      },
      data: {
        intermediaire_carcasse_commentaire: null,
        intermediaire_carcasse_refus_motif: null,
        intermediaire_carcasse_refus_intermediaire_id: null,
        intermediaire_carcasse_signed_at: null,
      },
    });

    return json({
      ok: true,
      data: {
        carcasseIntermediaire: JSON.parse(
          JSON.stringify(carcasseIntermediaire),
        ) as SerializeFrom<CarcasseIntermediaire>,
      },
      error: "",
    });
  }

  if (formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.refus)) {
    data.refus = formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.refus) as string;
    data.prise_en_charge = false;
    data.carcasse_check_finished_at = new Date();
    const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert({
      where: {
        fei_numero__bracelet__intermediaire_id,
      },
      create: data,
      update: data,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    await prisma.carcasse.update({
      where: {
        numero_bracelet: numero_bracelet,
      },
      data: {
        intermediaire_carcasse_commentaire: data.commentaire,
        intermediaire_carcasse_refus_motif: data.refus,
        intermediaire_carcasse_refus_intermediaire_id: intermediaire_id,
        intermediaire_carcasse_signed_at: new Date(),
      },
    });
    return json({
      ok: true,
      data: {
        carcasseIntermediaire: JSON.parse(
          JSON.stringify(carcasseIntermediaire),
        ) as SerializeFrom<CarcasseIntermediaire>,
      },
      error: "",
    });
  }

  return json({ ok: true, data: null, error: "" });
}

export type CarcasseIntermediaireActionData = ExtractLoaderData<typeof action>;

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
  const carcasseIntermediaire = await prisma.carcasseIntermediaire.findUnique({
    where: {
      fei_numero__bracelet__intermediaire_id: `${params.fei_numero}__${params.numero_bracelet}__${params.intermediaire_id}`,
    },
  });
  if (!carcasseIntermediaire) {
    return json({
      ok: true,
      data: null,
      error: "",
    });
  }

  return json({
    ok: true,
    data: {
      carcasseIntermediaire: JSON.parse(JSON.stringify(carcasseIntermediaire)) as SerializeFrom<CarcasseIntermediaire>,
    },
    error: "",
  });
}

export type CarcasseIntermediaireLoaderData = ExtractLoaderData<typeof loader>;
