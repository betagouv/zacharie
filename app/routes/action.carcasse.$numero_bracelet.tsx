import { json, type ActionFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";

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
  const formData = await request.formData();

  console.log("formData", Object.fromEntries(formData));

  if (formData.get("_action") === "delete") {
    const existinCarcasse = await prisma.carcasse.findUnique({
      where: {
        numero_bracelet,
      },
    });
    if (existinCarcasse) {
      await prisma.carcasse.delete({
        where: {
          numero_bracelet,
        },
      });
      return json({ ok: true, data: null, error: null });
    }
  }

  const fei_numero = formData.get(Prisma.CarcasseScalarFieldEnum.fei_numero) as string;
  const fei = await prisma.fei.findUnique({
    where: {
      numero: fei_numero,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "La FEI n'existe pas" }, { status: 400 });
  }
  const nextCarcasse: Prisma.CarcasseUpdateInput = {};

  // Helper function to convert string to boolean
  const stringToBoolean = (value: string | null): boolean | undefined => {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return undefined;
  };

  if (formData.has(Prisma.CarcasseScalarFieldEnum.numero_bracelet)) {
    nextCarcasse.numero_bracelet = formData.get(Prisma.CarcasseScalarFieldEnum.numero_bracelet) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.heure_evisceration)) {
    nextCarcasse.heure_evisceration = formData.get(Prisma.CarcasseScalarFieldEnum.heure_evisceration) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort)) {
    nextCarcasse.heure_mise_a_mort = formData.get(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.espece)) {
    nextCarcasse.espece = formData.get(Prisma.CarcasseScalarFieldEnum.espece) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.categorie)) {
    nextCarcasse.categorie = formData.get(Prisma.CarcasseScalarFieldEnum.categorie) as string;
  }

  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie)) {
    nextCarcasse.examinateur_carcasse_sans_anomalie = stringToBoolean(
      formData.get(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie) as string,
    );
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse)) {
    nextCarcasse.examinateur_anomalies_carcasse = formData.getAll(
      Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse,
    ) as string[];
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_abats_sans_anomalie)) {
    nextCarcasse.examinateur_abats_sans_anomalie = stringToBoolean(
      formData.get(Prisma.CarcasseScalarFieldEnum.examinateur_abats_sans_anomalie) as string,
    );
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats)) {
    nextCarcasse.examinateur_anomalies_abats = formData.getAll(
      Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats,
    ) as string[];
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_commentaire)) {
    nextCarcasse.examinateur_commentaire = formData.get(
      Prisma.CarcasseScalarFieldEnum.examinateur_commentaire,
    ) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_refus)) {
    nextCarcasse.examinateur_refus = stringToBoolean(
      formData.get(Prisma.CarcasseScalarFieldEnum.examinateur_refus) as string,
    );
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at)) {
    nextCarcasse.examinateur_signed_at = formData.get(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id)) {
    nextCarcasse.FeiIntermediaireCarcasseRefus = {
      connect: {
        id: formData.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id) as string,
      },
    };
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif)) {
    nextCarcasse.intermediaire_carcasse_refus_motif = formData.get(
      Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif,
    ) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at)) {
    nextCarcasse.intermediaire_carcasse_signed_at = formData.get(
      Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at,
    ) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire)) {
    nextCarcasse.intermediaire_carcasse_commentaire = formData.get(
      Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire,
    ) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.svi_saisie_carcasse)) {
    nextCarcasse.svi_saisie_carcasse = stringToBoolean(
      formData.get(Prisma.CarcasseScalarFieldEnum.svi_saisie_carcasse) as string,
    );
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.svi_saisie_carcasse_motif)) {
    nextCarcasse.svi_saisie_carcasse_motif = formData.get(
      Prisma.CarcasseScalarFieldEnum.svi_saisie_carcasse_motif,
    ) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.svi_saisie_carcasse_at)) {
    nextCarcasse.svi_saisie_carcasse_at = formData.get(Prisma.CarcasseScalarFieldEnum.svi_saisie_carcasse_at) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at)) {
    nextCarcasse.svi_carcasse_signed_at = formData.get(Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire)) {
    nextCarcasse.svi_carcasse_commentaire = formData.get(
      Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire,
    ) as string;
  }

  const updatedCarcasse = await prisma.carcasse.update({
    where: {
      numero_bracelet,
    },
    data: nextCarcasse,
  });

  return json({ ok: true, data: updatedCarcasse, error: null });
}

export default function CarcasseAction() {
  return null;
}
