import { EntityRelationType, Prisma, UserRoles, type User } from "@prisma/client";
import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { getFeiByNumero } from "~/db/fei.server";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";
import { type ExtractLoaderData } from "~/services/extract-loader-data";
import sendNotificationToUser from "~/services/notifications.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const feiNumero = params.fei_numero;
  const formData = await request.formData();
  let existingFei = await prisma.fei.findUnique({
    where: { numero: feiNumero },
  });
  if (!existingFei) {
    existingFei = await prisma.fei.create({
      data: {
        numero: feiNumero!,
        FeiCreatedByUser: {
          connect: {
            id: user.id,
          },
        },
      },
    });
  }
  const nextFei: Prisma.FeiUpdateInput = {};

  // log the whole form data for debugging - key values
  console.log("formData action.fei.$fei_numero", Object.fromEntries(formData.entries()));

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
    nextFei.fei_next_owner_role = UserRoles.PREMIER_DETENTEUR;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche)) {
    nextFei.examinateur_initial_date_approbation_mise_sur_le_marche = formData.get(
      "examinateur_initial_date_approbation_mise_sur_le_marche",
    ) as string;
  }
  /*
  *
  *
  * *

  Premier détenteur

  */

  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part)) {
    nextFei.premier_detenteur_date_depot_quelque_part = new Date(
      formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part) as string,
    );
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id)) {
    nextFei.FeiPremierDetenteurUser = {
      connect: {
        id: formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id) as string,
      },
    };
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part)) {
    nextFei.premier_detenteur_date_depot_quelque_part = new Date(
      formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part) as string,
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
      Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage,
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
    if (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) === UserRoles.SVI) {
      nextFei.FeiSviUser = {
        connect: {
          id: formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id) as string,
        },
      };
      nextFei.FeiSviEntity = {
        connect: {
          id: formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id) as string,
        },
      };
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer)) {
    nextFei.fei_current_owner_wants_to_transfer =
      formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer) === "true" ? true : false;
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
      const nextRelation = {
        entity_id: formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id) as string,
        owner_id: user.id,
        relation: EntityRelationType.WORKING_WITH,
      };
      const existingRelation = await prisma.entityRelations.findFirst({ where: nextRelation });
      if (!existingRelation) {
        await prisma.entityRelations.create({ data: nextRelation });
      }
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

  const savedFei = await prisma.fei.update({
    where: { numero: feiNumero },
    data: nextFei,
  });

  const fei = await getFeiByNumero(savedFei.numero);

  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id)) {
    const nextOwnerId = formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id) as string;
    if (nextOwnerId !== user.id) {
      const nextOwner = await prisma.user.findUnique({ where: { id: nextOwnerId } });
      sendNotificationToUser({
        user: nextOwner!,
        title: "Vous avez une nouvelle FEI à traiter",
        body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle FEI. Rendez vous sur Zacharie pour la traiter.`,
      });
    }
    if (existingFei.fei_next_owner_user_id && existingFei.fei_next_owner_user_id !== nextOwnerId) {
      const exNextOwner = await prisma.user.findUnique({ where: { id: existingFei.fei_next_owner_user_id } });
      sendNotificationToUser({
        user: exNextOwner!,
        title: "Une FEI ne vous est plus attribuée",
        body: `${user.prenom} ${user.nom_de_famille} vous avait attribué une nouvelle FEI, mais elle a finalement été attribuée à quelqu'un d'autre.`,
      });
    }
  }

  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
    const usersWorkingForEntity = (
      await prisma.entityRelations.findMany({
        where: {
          entity_id: formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id) as string,
        },
        include: {
          UserRelatedWithEntity: {
            select: {
              id: true,
              web_push_tokens: true,
              notifications: true,
              prenom: true,
              nom_de_famille: true,
              email: true,
            },
          },
        },
      })
    ).map((relation) => relation.UserRelatedWithEntity);
    for (const nextOwner of usersWorkingForEntity) {
      if (nextOwner.id !== user.id) {
        sendNotificationToUser({
          user: nextOwner as User,
          title: "Vous avez une nouvelle FEI à traiter",
          body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle FEI. Rendez vous sur Zacharie pour la traiter.`,
        });
      }
      if (existingFei.fei_next_owner_user_id && existingFei.fei_next_owner_user_id !== nextOwner.id) {
        const exNextOwner = await prisma.user.findUnique({ where: { id: existingFei.fei_next_owner_user_id } });
        sendNotificationToUser({
          user: exNextOwner!,
          title: "Une FEI ne vous est plus attribuée",
          body: `${user.prenom} ${user.nom_de_famille} vous avait attribué une nouvelle FEI, mais elle a finalement été attribuée à quelqu'un d'autre.`,
        });
      }
    }
  }

  if (formData.has("_redirect")) {
    return redirect(formData.get("_redirect") as string);
  }

  return json({ ok: true, data: fei, error: null });
}

export type FeiActionData = ExtractLoaderData<typeof action>;
