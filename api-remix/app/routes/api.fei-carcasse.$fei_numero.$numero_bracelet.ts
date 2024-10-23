import { json, SerializeFrom, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { CarcasseType, Prisma, UserRoles, type Carcasse } from "@prisma/client";
import dayjs from "dayjs";

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

  console.log("formData action.carcasse.$numero_bracelet", Object.fromEntries(formData));

  if (formData.get("_action") === "delete") {
    const existinCarcasse = await prisma.carcasse.findUnique({
      where: {
        numero_bracelet,
      },
    });
    if (existinCarcasse) {
      await prisma.carcasse.update({
        where: {
          numero_bracelet,
        },
        data: {
          deleted_at: dayjs().toISOString(),
        },
      });
    }
    return json({ ok: true, data: null, error: "" });
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

  let existingCarcasse = await prisma.carcasse.findUnique({
    where: {
      numero_bracelet,
    },
  });
  if (!existingCarcasse) {
    existingCarcasse = await prisma.carcasse.create({
      data: {
        numero_bracelet,
        fei_numero,
      },
    });
  }

  const nextCarcasse: Prisma.CarcasseUncheckedUpdateInput = {};

  // Helper function to convert string to boolean
  const stringToBoolean = (value: string | null): boolean | null => {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return null;
  };

  if (formData.has(Prisma.CarcasseScalarFieldEnum.numero_bracelet)) {
    nextCarcasse.numero_bracelet = formData.get(Prisma.CarcasseScalarFieldEnum.numero_bracelet) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.heure_evisceration)) {
    nextCarcasse.heure_evisceration = formData.get(Prisma.CarcasseScalarFieldEnum.heure_evisceration) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.type)) {
    nextCarcasse.type = formData.get(Prisma.CarcasseScalarFieldEnum.type) as CarcasseType;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.nombre_d_animaux)) {
    nextCarcasse.nombre_d_animaux = Number(
      (formData.get(Prisma.CarcasseScalarFieldEnum.nombre_d_animaux) as string) || 0,
    );
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
    const nextValue = stringToBoolean(
      formData.get(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie) as string,
    );
    nextCarcasse.examinateur_carcasse_sans_anomalie = nextValue;
    if (nextValue === true) {
      nextCarcasse.examinateur_anomalies_carcasse = [];
      nextCarcasse.examinateur_anomalies_abats = [];
    }
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse)) {
    nextCarcasse.examinateur_anomalies_carcasse = formData
      .getAll(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse)
      .filter(Boolean) as string[];
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats)) {
    nextCarcasse.examinateur_anomalies_abats = formData
      .getAll(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats)
      .filter(Boolean) as string[];
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_commentaire)) {
    nextCarcasse.examinateur_commentaire = formData.get(
      Prisma.CarcasseScalarFieldEnum.examinateur_commentaire,
    ) as string;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at)) {
    if (formData.get(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at) === "") {
      nextCarcasse.examinateur_signed_at = null;
    } else {
      // nextCarcasse.examinateur_signed_at = dayjs().toISOString();
      nextCarcasse.examinateur_signed_at = new Date(
        formData.get(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at) as string,
      );
    }
  }

  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at)) {
    console.log("MAAANQUANTE DIRECTE API");
    if (formData.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at) === "") {
      nextCarcasse.intermediaire_carcasse_signed_at = null;
    } else {
      // nextCarcasse.intermediaire_carcasse_signed_at = dayjs().toISOString();
      nextCarcasse.intermediaire_carcasse_signed_at = new Date(
        formData.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at) as string,
      );
    }
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante)) {
    const nextValue = stringToBoolean(
      formData.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante) as string,
    );
    nextCarcasse.intermediaire_carcasse_manquante = nextValue;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id)) {
    nextCarcasse.intermediaire_carcasse_refus_intermediaire_id =
      (formData.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id) as string) || null;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif)) {
    nextCarcasse.intermediaire_carcasse_refus_motif =
      (formData.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif) as string) || null;
  }
  if (formData.has(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire)) {
    nextCarcasse.intermediaire_carcasse_commentaire =
      (formData.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire) as string) || null;
  }

  if (user.roles.includes(UserRoles.SVI)) {
    if (formData.has(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie)) {
      nextCarcasse.svi_carcasse_saisie = formData
        .getAll(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie)
        .filter(Boolean) as string[];
    }
    if (formData.has(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif)) {
      nextCarcasse.svi_carcasse_saisie_motif = formData
        .getAll(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif)
        .filter(Boolean) as string[];
    }
    if (formData.get(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at)) {
      const saisieAt = formData.get(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at) as string;
      if (saisieAt !== "") {
        nextCarcasse.svi_carcasse_saisie_at = dayjs(saisieAt || undefined).toISOString();
        nextCarcasse.svi_carcasse_signed_at = null;
      }
    }
    if (formData.get(Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at)) {
      const signedAt = formData.get(Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at) as string;
      if (signedAt !== "") {
        nextCarcasse.svi_carcasse_signed_at = dayjs(signedAt || undefined).toISOString();
        nextCarcasse.svi_carcasse_saisie_at = null;
        nextCarcasse.svi_carcasse_saisie_motif = [];
        nextCarcasse.svi_carcasse_saisie = [];
      }
    }
    if (formData.has(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire)) {
      nextCarcasse.svi_carcasse_commentaire = formData.get(
        Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire,
      ) as string;
    }
  }

  console.log({ nextCarcasse });

  const updatedCarcasse = await prisma.carcasse.update({
    where: {
      numero_bracelet: existingCarcasse.numero_bracelet,
    },
    data: nextCarcasse,
  });

  return json({
    ok: true,
    data: {
      carcasse: JSON.parse(JSON.stringify(updatedCarcasse)) as SerializeFrom<Carcasse>,
    },
    error: "",
  });
}

export type CarcasseActionData = ExtractLoaderData<typeof action>;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  const carcasse = await prisma.carcasse.findUnique({
    where: {
      numero_bracelet: params.numero_bracelet,
      fei_numero: params.fei_numero,
    },
  });
  if (!carcasse) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  return json({
    ok: true,
    data: {
      carcasse: JSON.parse(JSON.stringify(carcasse)) as SerializeFrom<Carcasse>,
    },
    error: "",
  });
}

export type CarcasseLoaderData = ExtractLoaderData<typeof loader>;
