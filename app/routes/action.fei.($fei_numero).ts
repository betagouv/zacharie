import { Prisma, Fei } from "@prisma/client";
import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { authorizeUserOrAdmin } from "~/utils/authorizeUserOrAdmin";

export async function action(args: ActionFunctionArgs) {
  const { user, error } = await authorizeUserOrAdmin(args);
  if (!user) return json({ ok: false, data: null, error }, { status: 401 });
  const { request, params } = args;

  let feiNumero = params.fei_numero;
  const formData = await request.formData();
  let existingFei: Fei | null = null;

  if (!feiNumero) {
    if (!formData.get("commune_mise_a_mort")) {
      return json({ ok: false, data: null, error: "La commune de mise à mort est obligatoire" }, { status: 400 });
    }

    if (!formData.get("date_mise_a_mort")) {
      return json({ ok: false, data: null, error: "La date de mise à mort est obligatoire" }, { status: 400 });
    }

    const newId = (await prisma.fei.count()) + 1;
    const tenDigits = newId.toString().padStart(10, "0");
    feiNumero = `FEI-${tenDigits}`;

    // Create a new object with only the fields that are required and set
    const createData: Prisma.FeiCreateInput = {
      numero: feiNumero,
      commune_mise_a_mort: formData.get("commune_mise_a_mort") as string,
      date_mise_a_mort: new Date(formData.get("date_mise_a_mort") as string),
      FeiCreatedBy: {
        connect: {
          id: user.id,
        },
      },
    };

    existingFei = await prisma.fei.create({
      data: createData,
    });
  } else {
    existingFei = await prisma.fei.findFirst({ where: { numero: feiNumero } });
    if (!existingFei) return json({ ok: false, data: null, error: "La FEI n'existe pas" }, { status: 404 });
  }

  const nextFei = { ...existingFei };

  if (formData.has("numero")) nextFei.numero = formData.get("numero") as string;
  if (formData.has("date_mise_a_mort")) nextFei.date_mise_a_mort = new Date(formData.get("date_mise_a_mort") as string);
  if (formData.has("commune_mise_a_mort")) nextFei.commune_mise_a_mort = formData.get("commune_mise_a_mort") as string;
  if (formData.has("approbation_mise_sur_le_marche_examinateur_initial")) {
    nextFei.approbation_mise_sur_le_marche_examinateur_initial =
      formData.get("approbation_mise_sur_le_marche_examinateur_initial") === "true" ? true : false;
  }
  if (formData.has("date_approbation_mise_sur_le_marche_examinateur_initial")) {
    nextFei.date_approbation_mise_sur_le_marche_examinateur_initial = new Date(
      formData.get("date_approbation_mise_sur_le_marche_examinateur_initial") as string
    );
  }
  if (formData.has("date_depot_centre_collecte")) {
    nextFei.date_depot_centre_collecte = new Date(formData.get("date_depot_centre_collecte") as string);
  }
  if (formData.has("date_validation_svi")) {
    nextFei.date_validation_svi = new Date(formData.get("date_validation_svi") as string);
  }

  const savedFei = await prisma.fei.update({
    where: { numero: feiNumero },
    data: nextFei,
  });

  if (formData.has("_redirect")) return redirect(formData.get("_redirect") as string);

  return json({ ok: true, data: savedFei, error: null });
}

export default function ActionUser() {
  return null;
}
