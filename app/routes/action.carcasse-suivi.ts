import { Prisma } from "@prisma/client";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const feiNumero = formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.fei_numero) as string;
  const existingFei = await prisma.fei.findUnique({
    where: { numero: feiNumero },
  });
  if (!existingFei) {
    return json({ ok: false, data: null, error: "FEI not found" }, { status: 404 });
  }
  const feiIntermediaireId = formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.fei_intermediaire_id) as string;
  const feiIntermediaire = await prisma.feiIntermediaire.findUnique({
    where: { id: feiIntermediaireId },
  });
  if (!feiIntermediaire) {
    return json({ ok: false, data: null, error: "FEI intermediaire not found" }, { status: 404 });
  }
  if (formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.check_finished_at)) {
    await prisma.feiIntermediaire.update({
      where: {
        id: feiIntermediaireId,
      },
      data: {
        check_finished_at: new Date(),
      },
    });
    return json({ ok: true, data: null, error: null });
  }
  const carcasseBracelet = formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.numero_bracelet) as string;
  const existingCarcasse = await prisma.carcasse.findUnique({
    where: { numero_bracelet: carcasseBracelet },
  });
  if (!existingCarcasse) {
    return json({ ok: false, data: null, error: "Carcasse not found" }, { status: 404 });
  }
  const fei_numero__bracelet__intermediaire_id = `${feiNumero}__${carcasseBracelet}__${feiIntermediaireId}`;
  const data: Prisma.CarcasseIntermediaireCreateInput = {
    fei_numero__bracelet__intermediaire_id,
    CarcasseIntermediaireFei: {
      connect: {
        numero: feiNumero,
      },
    },
    CarcasseCarcasseIntermediaire: {
      connect: {
        numero_bracelet: carcasseBracelet,
      },
    },
    CarcasseIntermediaireFeiIntermediaire: {
      connect: {
        id: feiIntermediaireId,
      },
    },
    CarcasseIntermediaireUser: {
      connect: {
        id: user.id,
      },
    },
    CarcasseIntermediaireEntity: {
      connect: {
        id: existingFei.fei_current_owner_entity_id!,
      },
    },
  };
  if (formData.has(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire)) {
    data.commentaire = formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire) as string;
  }
  if (formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge) === "true") {
    data.prise_en_charge = true;
    data.refus = null;
    data.check_finished_at = new Date();
    const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert({
      where: {
        fei_numero__bracelet__intermediaire_id,
      },
      create: data,
      update: data,
    });
    // remove refus if there was one
    const carcasseUpdated = await prisma.carcasse.update({
      where: {
        numero_bracelet: carcasseBracelet,
      },
      data: {
        intermediaire_carcasse_commentaire: null,
        intermediaire_carcasse_refus_motif: null,
        intermediaire_carcasse_refus_intermediaire_id: null,
        intermediaire_carcasse_signed_at: null,
      },
    });
    return json({ ok: true, data: carcasseIntermediaire, error: null });
  }
  if (formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.refus)) {
    data.refus = formData.get(Prisma.CarcasseIntermediaireScalarFieldEnum.refus) as string;
    data.prise_en_charge = false;
    data.check_finished_at = new Date();
    const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert({
      where: {
        fei_numero__bracelet__intermediaire_id,
      },
      create: data,
      update: data,
    });
    const carcasseUpdated = await prisma.carcasse.update({
      where: {
        numero_bracelet: carcasseBracelet,
      },
      data: {
        intermediaire_carcasse_commentaire: data.commentaire,
        intermediaire_carcasse_refus_motif: data.refus,
        intermediaire_carcasse_refus_intermediaire_id: feiIntermediaireId,
        intermediaire_carcasse_signed_at: new Date(),
      },
    });
    console.log("carcasseUpdated", carcasseUpdated);
    return json({ ok: true, data: carcasseIntermediaire, error: null });
  }

  return json({ ok: true, data: null, error: null });
}

export default function ActionUser() {
  return null;
}
