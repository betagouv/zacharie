import { Prisma, UserRoles } from "@prisma/client";
import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const feiNumero = params.fei_numero;
  const formData = await request.formData();
  const existingFei = await prisma.fei.findUnique({
    where: { numero: feiNumero },
  });
  if (!existingFei) {
    return json({ ok: false, data: null, error: "FEI not found" }, { status: 404 });
  }
  const nextFei: Prisma.FeiUpdateInput = {};

  // log the whole form data for debugging - key values
  console.log("formData", Object.fromEntries(formData.entries()));

  if (formData.has(Prisma.FeiScalarFieldEnum.date_mise_a_mort)) {
    nextFei.date_mise_a_mort = formData.get(Prisma.FeiScalarFieldEnum.date_mise_a_mort) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.commune_mise_a_mort)) {
    nextFei.commune_mise_a_mort = formData.get(Prisma.FeiScalarFieldEnum.commune_mise_a_mort) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.created_by_user_id)) {
    nextFei.FeiCreatedByUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.created_by_user_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id)) {
    nextFei.fei_current_owner_user_id = formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id)) {
    nextFei.fei_current_owner_entity_id = formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_role)) {
    nextFei.fei_current_owner_role = formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) as UserRoles;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id)) {
    nextFei.fei_next_owner_user_id = formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
    nextFei.fei_next_owner_entity_id = formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_role)) {
    nextFei.fei_next_owner_role = formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_role) as UserRoles;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_prev_owner_role)) {
    nextFei.fei_prev_owner_role = formData.get(Prisma.FeiScalarFieldEnum.fei_prev_owner_role) as UserRoles;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id)) {
    nextFei.fei_prev_owner_user_id = formData.get(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id)) {
    nextFei.fei_prev_owner_entity_id = formData.get(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
    nextFei.FeiExaminateurInitialUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche)) {
    nextFei.examinateur_initial_approbation_mise_sur_le_marche =
      formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche) === "true"
        ? true
        : false;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche)) {
    nextFei.examinateur_initial_date_approbation_mise_sur_le_marche = formData.get(
      "examinateur_initial_date_approbation_mise_sur_le_marche"
    ) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.detenteur_initial_user_id)) {
    nextFei.FeiDetenteurInitialUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.detenteur_initial_user_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.date_depot_centre_collecte)) {
    nextFei.date_depot_centre_collecte = formData.get(Prisma.FeiScalarFieldEnum.date_depot_centre_collecte) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_signed_at)) {
    nextFei.svi_signed_at = formData.get(Prisma.FeiScalarFieldEnum.svi_signed_at) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_entity_id)) {
    nextFei.FeiSviEntity = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.svi_entity_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_user_id)) {
    nextFei.FeiSviUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.svi_user_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_carcasses_saisies)) {
    nextFei.svi_carcasses_saisies = Number(formData.get(Prisma.FeiScalarFieldEnum.svi_carcasses_saisies) as string);
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_aucune_carcasse_saisie)) {
    nextFei.svi_aucune_carcasse_saisie =
      formData.get(Prisma.FeiScalarFieldEnum.svi_aucune_carcasse_saisie) === "true" ? true : false;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_commentaire)) {
    nextFei.svi_commentaire = formData.get(Prisma.FeiScalarFieldEnum.svi_commentaire) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_signed_at)) {
    nextFei.svi_signed_at = formData.get(Prisma.FeiScalarFieldEnum.svi_signed_at) as string;
  }
  const savedFei = await prisma.fei.update({
    where: { numero: feiNumero },
    data: nextFei,
  });

  if (formData.has("_redirect")) {
    return redirect(formData.get("_redirect") as string);
  }

  return json({ ok: true, data: savedFei, error: null });
}

export default function ActionUser() {
  return null;
}
