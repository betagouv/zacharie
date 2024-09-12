import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  const formData = await request.formData();

  console.log("formData", Object.fromEntries(formData));

  const fei_numero = formData.get(Prisma.CarcasseScalarFieldEnum.fei_numero) as string;
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
  const numero_bracelet = formData.get(Prisma.CarcasseScalarFieldEnum.numero_bracelet) as string;
  if (!numero_bracelet) {
    return json({ ok: false, data: null, error: "Le numéro de bracelet est obligatoire" }, { status: 400 });
  }
  const heure_evisceration = formData.get(Prisma.CarcasseScalarFieldEnum.heure_evisceration) as string;
  if (!heure_evisceration) {
    return json({ ok: false, data: null, error: "L'heure d'éviscération est obligatoire" }, { status: 400 });
  }
  const heure_mise_a_mort = formData.get(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort) as string;
  if (!heure_mise_a_mort) {
    return json({ ok: false, data: null, error: "L'heure de mise à mort est obligatoire" }, { status: 400 });
  }
  const espece = formData.get(Prisma.CarcasseScalarFieldEnum.espece) as string;
  if (!espece) {
    return json({ ok: false, data: null, error: "L'espèce est obligatoire" }, { status: 400 });
  }
  const categorie = formData.get(Prisma.CarcasseScalarFieldEnum.categorie) as string;
  if (!categorie) {
    return json({ ok: false, data: null, error: "La categorie est obligatoire" }, { status: 400 });
  }
  const newCarcasse = await prisma.carcasse.create({
    data: {
      fei_numero,
      numero_bracelet,
      heure_evisceration,
      heure_mise_a_mort,
      espece,
      categorie,
    },
  });

  return redirect(`/tableau-de-bord/fei/${fei.numero}/carcasse-examinateur/${newCarcasse.numero_bracelet}`);
}

export default function NouvelleCarcasse() {
  return null;
}
