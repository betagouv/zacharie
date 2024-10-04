import { Prisma } from "@prisma/client";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const numero_bracelet = params.numero_bracelet;
  if (!numero_bracelet) {
    return json({ ok: false, data: null, error: "Le numéro de la carcasse est obligatoire" }, { status: 400 });
  }

  const { intermediaire_id } = params;
  if (!intermediaire_id) {
    return json({ ok: false, data: null, error: "L'identifiant de l'intermédiaire est obligatoire" }, { status: 400 });
  }

  const formData = await request.formData();
  const feiNumero = formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.fei_numero) as string;
  const existingFei = await prisma.fei.findUnique({
    where: { numero: feiNumero },
  });
  if (!existingFei) {
    return json({ ok: false, data: null, error: "FEI not found" }, { status: 404 });
  }
  const feiIntermediaire = await prisma.feiIntermediaire.findUnique({
    where: { id: intermediaire_id },
  });
  if (!feiIntermediaire) {
    return json({ ok: false, data: null, error: "FEI intermediaire not found" }, { status: 404 });
  }
  const existingCarcasse = await prisma.carcasse.findUnique({
    where: { numero_bracelet: numero_bracelet },
  });
  if (!existingCarcasse) {
    return json({ ok: false, data: null, error: "Carcasse not found" }, { status: 404 });
  }
  const fei_numero__bracelet__intermediaire_id = `${feiNumero}__${numero_bracelet}__${intermediaire_id}`;
  const data: Prisma.CarcasseIntermediaireUncheckedCreateInput = {
    fei_numero__bracelet__intermediaire_id,
    fei_numero: feiNumero,
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
    return json({ ok: true, data: carcasseIntermediaire, error: "" });
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
    const carcasseUpdated = await prisma.carcasse.update({
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
    return json({ ok: true, data: carcasseIntermediaire, error: "" });
  }

  return json({ ok: true, data: null, error: "" });
}

export type SuiviCarcasseActionData = ExtractLoaderData<typeof action>;
