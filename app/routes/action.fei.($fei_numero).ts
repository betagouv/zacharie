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

  /*
  *
  *
  * *

  Examinateur initial

  */
  if (formData.has(Prisma.FeiScalarFieldEnum.date_mise_a_mort)) {
    nextFei.date_mise_a_mort = new Date(formData.get(Prisma.FeiScalarFieldEnum.date_mise_a_mort) as string);
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
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
    nextFei.FeiExaminateurInitialUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id) as string,
      },
    };
  }
  if (formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche) === "true") {
    nextFei.examinateur_initial_approbation_mise_sur_le_marche = true;
    nextFei.examinateur_initial_date_approbation_mise_sur_le_marche = new Date().toISOString();
  }
  if (formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche) === "true") {
    nextFei.examinateur_initial_approbation_mise_sur_le_marche = true;
    nextFei.examinateur_initial_date_approbation_mise_sur_le_marche = new Date().toISOString();
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche)) {
    nextFei.examinateur_initial_date_approbation_mise_sur_le_marche = formData.get(
      "examinateur_initial_date_approbation_mise_sur_le_marche"
    ) as string;
    nextFei.fei_next_owner_role = UserRoles.PREMIER_DETENTEUR;
  }
  /*
  *
  *
  * *

  Premier détenteur

  */

  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part)) {
    nextFei.premier_detenteur_date_depot_quelque_part = new Date(
      formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part) as string
    );
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id)) {
    nextFei.FeiDetenteurInitialUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part)) {
    nextFei.premier_detenteur_date_depot_quelque_part = new Date(
      formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part) as string
    );
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id)) {
    nextFei.FeiDepotEntity = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage)) {
    nextFei.premier_detenteur_depot_sauvage = formData.get(
      Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage
    ) as string;
  }

  /*
  *
  *
  * *

  Responsabilités

  */
  /*  Current Owner */
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id)) {
    nextFei.FeiCurrentUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id)) {
    if (!formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id)) {
      nextFei.FeiCurrentEntity = {
        disconnect: true,
      };
    } else {
      nextFei.FeiCurrentEntity = {
        connect: {
          id: formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id) as string,
        },
      };
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_role)) {
    nextFei.fei_current_owner_role =
      (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) as UserRoles) || null;
  }
  /*  Next Owner */
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id)) {
    nextFei.fei_next_owner_user_id = (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
    if (!formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
      nextFei.FeiNextEntity = {
        disconnect: true,
      };
    } else {
      nextFei.FeiNextEntity = {
        connect: {
          id: formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id) as string,
        },
      };
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_role)) {
    nextFei.fei_next_owner_role = (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_role) as UserRoles) || null;
  }
  /*  Prev Owner */
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id)) {
    nextFei.fei_prev_owner_user_id = formData.get(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id)) {
    nextFei.fei_prev_owner_entity_id = formData.get(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_prev_owner_role)) {
    nextFei.fei_prev_owner_role = (formData.get(Prisma.FeiScalarFieldEnum.fei_prev_owner_role) as UserRoles) || null;
  }

  /*
  *
  *
  * *

  ETG

  */
  if (formData.has(Prisma.FeiScalarFieldEnum.etg_received_at)) {
    nextFei.etg_received_at = formData.get(Prisma.FeiScalarFieldEnum.etg_received_at) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.etg_entity_id)) {
    nextFei.FeiEtgEntity = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.etg_entity_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.etg_user_id)) {
    nextFei.FeiEtgUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.etg_user_id) as string,
      },
    };
  }
  // if (formData.has(Prisma.FeiScalarFieldEnum.etg)) {
  //   nextFei.svi_carcasses_saisies = Number(formData.get(Prisma.FeiScalarFieldEnum.svi_carcasses_saisies) as string);
  // }
  // if (formData.has(Prisma.FeiScalarFieldEnum.svi_aucune_carcasse_saisie)) {
  //   nextFei.svi_aucune_carcasse_saisie =
  //     formData.get(Prisma.FeiScalarFieldEnum.svi_aucune_carcasse_saisie) === "true" ? true : false;
  // }
  if (formData.has(Prisma.FeiScalarFieldEnum.etg_commentaire)) {
    nextFei.etg_commentaire = formData.get(Prisma.FeiScalarFieldEnum.etg_commentaire) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.etg_check_finished_at)) {
    nextFei.etg_check_finished_at = formData.get(Prisma.FeiScalarFieldEnum.etg_check_finished_at) as string;
  }
  /*
  *
  *
  * *

  SVI

  */
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

  console.log("nextFei", nextFei);

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
