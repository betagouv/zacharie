import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect, SerializeFrom } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { EntityRelationType, Prisma, UserRoles, type User, type Fei } from "@prisma/client";
import sendNotificationToUser from "~/services/notifications.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const feiNumero = params.fei_numero; // can also be "nouvelle"
  const formData = await request.formData();
  let existingFei = await prisma.fei.findUnique({
    where: { numero: feiNumero, deleted_at: null },
  });
  if (!existingFei) {
    existingFei = await prisma.fei.create({
      data: {
        numero: feiNumero!,
        created_by_user_id: user.id,
      },
    });
  }
  const nextFei: Prisma.FeiUncheckedUpdateInput = {};

  // log the whole form data for debugging - key values
  console.log("formData action.fei.$fei_numero", Object.fromEntries(formData.entries()));

  /*
  *
  *
  * *

  Examinateur initial

  */
  if (formData.has(Prisma.FeiScalarFieldEnum.date_mise_a_mort)) {
    if (formData.get(Prisma.FeiScalarFieldEnum.date_mise_a_mort) === "") {
      nextFei.date_mise_a_mort = null;
    } else {
      nextFei.date_mise_a_mort = new Date(formData.get(Prisma.FeiScalarFieldEnum.date_mise_a_mort) as string);
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.commune_mise_a_mort)) {
    nextFei.commune_mise_a_mort = formData.get(Prisma.FeiScalarFieldEnum.commune_mise_a_mort) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse)) {
    nextFei.heure_mise_a_mort_premiere_carcasse = formData.get(
      Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
    ) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse)) {
    nextFei.heure_evisceration_derniere_carcasse = formData.get(
      Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
    ) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.created_by_user_id)) {
    nextFei.created_by_user_id = formData.get(Prisma.FeiScalarFieldEnum.created_by_user_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.resume_nombre_de_carcasses)) {
    nextFei.resume_nombre_de_carcasses = formData.get(Prisma.FeiScalarFieldEnum.resume_nombre_de_carcasses) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
    nextFei.examinateur_initial_user_id = formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id) as string;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_offline)) {
    nextFei.examinateur_initial_offline =
      formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_offline) === "true" ? true : false;
  }
  if (formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche) === "true") {
    nextFei.examinateur_initial_approbation_mise_sur_le_marche = true;
    nextFei.examinateur_initial_date_approbation_mise_sur_le_marche = new Date().toISOString();
    nextFei.fei_next_owner_role = UserRoles.PREMIER_DETENTEUR;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche)) {
    if (formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche) === "") {
      nextFei.examinateur_initial_date_approbation_mise_sur_le_marche = null;
    } else {
      nextFei.examinateur_initial_date_approbation_mise_sur_le_marche = new Date(
        formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche) as string,
      );
    }
  }
  /*
  *
  *
  * *

  Premier détenteur

  */
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id)) {
    nextFei.premier_detenteur_user_id =
      (formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_offline)) {
    nextFei.premier_detenteur_offline =
      formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_offline) === "true" ? true : false;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_entity_id)) {
    nextFei.premier_detenteur_entity_id =
      (formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_entity_id) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_name_cache)) {
    nextFei.premier_detenteur_name_cache =
      (formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_name_cache) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part)) {
    if (formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part) === "") {
      nextFei.premier_detenteur_date_depot_quelque_part = null;
    } else {
      nextFei.premier_detenteur_date_depot_quelque_part = new Date(
        formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part) as string,
      );
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id)) {
    nextFei.premier_detenteur_depot_entity_id =
      (formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id) as string) || null;
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
    nextFei.fei_current_owner_user_id =
      (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id) as string) || null;
    if (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) === UserRoles.SVI) {
      nextFei.fei_current_owner_user_id =
        (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id) as string) || null;
      nextFei.fei_current_owner_entity_id =
        (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id) as string) || null;
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_user_name_cache)) {
    nextFei.fei_current_owner_user_name_cache =
      (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_user_name_cache) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer)) {
    nextFei.fei_current_owner_wants_to_transfer =
      formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer) === "true" ? true : false;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id)) {
    if (!formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id)) {
      nextFei.fei_current_owner_entity_id = null;
    } else {
      nextFei.fei_current_owner_entity_id = formData.get(
        Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id,
      ) as string;
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_name_cache)) {
    nextFei.fei_current_owner_entity_name_cache =
      (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_name_cache) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_current_owner_role)) {
    nextFei.fei_current_owner_role =
      (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) as UserRoles) || null;
  }
  /*  Next Owner */
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id)) {
    nextFei.fei_next_owner_user_id = (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_user_name_cache)) {
    nextFei.fei_next_owner_user_name_cache =
      (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_user_name_cache) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
    if (!formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
      nextFei.fei_next_owner_entity_id = null;
    } else {
      nextFei.fei_next_owner_entity_id = formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id) as string;
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
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_name_cache)) {
    nextFei.fei_next_owner_entity_name_cache =
      (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_name_cache) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_next_owner_role)) {
    nextFei.fei_next_owner_role = (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_role) as UserRoles) || null;
  }
  /*  Prev Owner */
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id)) {
    nextFei.fei_prev_owner_user_id = (formData.get(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id)) {
    nextFei.fei_prev_owner_entity_id =
      (formData.get(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id) as string) || null;
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
    if (formData.get(Prisma.FeiScalarFieldEnum.svi_signed_at) === "") {
      nextFei.svi_signed_at = null;
    } else {
      nextFei.svi_signed_at = new Date(formData.get(Prisma.FeiScalarFieldEnum.svi_signed_at) as string);
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_assigned_at)) {
    if (formData.get(Prisma.FeiScalarFieldEnum.svi_assigned_at) === "") {
      nextFei.svi_assigned_at = null;
    } else {
      nextFei.svi_assigned_at = new Date(formData.get(Prisma.FeiScalarFieldEnum.svi_assigned_at) as string);
    }
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_entity_id)) {
    nextFei.svi_entity_id = (formData.get(Prisma.FeiScalarFieldEnum.svi_entity_id) as string) || null;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_user_id)) {
    nextFei.svi_user_id = (formData.get(Prisma.FeiScalarFieldEnum.svi_user_id) as string) || null;
  }
  if (formData.get(Prisma.FeiScalarFieldEnum.svi_carcasses_saisies)) {
    nextFei.svi_carcasses_saisies = Number(formData.get(Prisma.FeiScalarFieldEnum.svi_carcasses_saisies) as string);
  }
  if (formData.get(Prisma.FeiScalarFieldEnum.svi_aucune_carcasse_saisie)) {
    nextFei.svi_aucune_carcasse_saisie =
      formData.get(Prisma.FeiScalarFieldEnum.svi_aucune_carcasse_saisie) === "true" ? true : false;
  }
  if (formData.has(Prisma.FeiScalarFieldEnum.svi_commentaire)) {
    nextFei.svi_commentaire = formData.get(Prisma.FeiScalarFieldEnum.svi_commentaire) as string;
  }

  const savedFei = await prisma.fei.update({
    where: { numero: feiNumero },
    data: nextFei,
  });

  if (existingFei.fei_next_owner_role !== UserRoles.SVI && savedFei.fei_next_owner_role === UserRoles.SVI) {
    // this is the end of the fiche
    // send notification to examinateur initial
    const feiWithSvi = await prisma.fei.update({
      where: { numero: feiNumero },
      data: {
        svi_entity_id: savedFei.fei_next_owner_entity_id,
        svi_assigned_at: new Date(),
      },
    });
    const examinateurInitial = await prisma.user.findUnique({ where: { id: feiWithSvi.examinateur_initial_user_id! } });
    sendNotificationToUser({
      user: examinateurInitial!,
      title: `La fiche du ${feiWithSvi.date_mise_a_mort?.toLocaleDateString()} est prise en charge par l'ETG`,
      body: `Les carcasses vont être inspectées par le Service Vétérinaire. Si une carcasse est saisie, vous serez notifié. Vous ne serez pas notifié pour les carcasses acceptées.`,
      email: `Les carcasses vont être inspectées par le Service Vétérinaire. Si une carcasse est saisie, vous serez notifié. Vous ne serez pas notifié pour les carcasses acceptées.`,
      notificationLogAction: `FEI_ASSIGNED_TO_${feiWithSvi.fei_next_owner_role}_${feiWithSvi.numero}`,
    });
    if (feiWithSvi.examinateur_initial_user_id !== feiWithSvi.premier_detenteur_user_id) {
      const premierDetenteur = await prisma.user.findUnique({ where: { id: feiWithSvi.premier_detenteur_user_id! } });
      sendNotificationToUser({
        user: premierDetenteur!,
        title: `La fiche du ${feiWithSvi.date_mise_a_mort?.toLocaleDateString()} est prise en charge par l'ETG`,
        body: `Les carcasses vont être inspectées par le Service Vétérinaire. Si une carcasse est saisie, vous serez notifié. Vous ne serez pas notifié pour les carcasses acceptées.`,
        email: `Les carcasses vont être inspectées par le Service Vétérinaire. Si une carcasse est saisie, vous serez notifié. Vous ne serez pas notifié pour les carcasses acceptées.`,
        notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
      });
    }
    return json({
      ok: true,
      data: {
        fei: JSON.parse(JSON.stringify(feiWithSvi)) as SerializeFrom<Fei>,
      },
      error: "",
    });
  }

  if (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id)) {
    const nextOwnerId = formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id) as string;
    if (nextOwnerId !== user.id) {
      console.log("need to send notification new fiche");
      const nextOwner = await prisma.user.findUnique({ where: { id: nextOwnerId } });
      sendNotificationToUser({
        user: nextOwner!,
        title: "Vous avez une nouvelle fiche à traiter",
        body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
        email: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche, la ${savedFei?.numero}. Rendez vous sur Zacharie pour la traiter.`,
        notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
      });
    } else if (existingFei.fei_next_owner_user_id && existingFei.fei_next_owner_user_id !== nextOwnerId) {
      console.log("need to send notification remove fiche");
      const exNextOwner = await prisma.user.findUnique({ where: { id: existingFei.fei_next_owner_user_id } });
      sendNotificationToUser({
        user: exNextOwner!,
        title: "Une fiche ne vous est plus attribuée",
        body: `${user.prenom} ${user.nom_de_famille} vous avait attribué une fiche, mais elle a finalement été attribuée à quelqu'un d'autre.`,
        email: `${user.prenom} ${user.nom_de_famille} vous avait attribué la fiche ${savedFei?.numero}, mais elle a finalement été attribuée à quelqu'un d'autre.`,
        notificationLogAction: `FEI_REMOVED_FROM_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
      });
    } else {
      console.log("no need to send notification");
    }
  }

  if (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
    const usersWorkingForEntity = (
      await prisma.entityRelations.findMany({
        where: {
          entity_id: formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id) as string,
          relation: EntityRelationType.WORKING_FOR,
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
          title: "Vous avez une nouvelle fiche à traiter",
          body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
          email: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche, la ${savedFei?.numero}. Rendez vous sur Zacharie pour la traiter.`,
          notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
        });
      }
      if (existingFei.fei_next_owner_user_id && existingFei.fei_next_owner_user_id !== nextOwner.id) {
        const exNextOwner = await prisma.user.findUnique({ where: { id: existingFei.fei_next_owner_user_id } });
        sendNotificationToUser({
          user: exNextOwner!,
          title: "Une fiche ne vous est plus attribuée",
          body: `${user.prenom} ${user.nom_de_famille} vous avait attribué une fiche, mais elle a finalement été attribuée à quelqu'un d'autre.`,
          email: `${user.prenom} ${user.nom_de_famille} vous avait attribué la fiche ${savedFei?.numero}, mais elle a finalement été attribuée à quelqu'un d'autre.`,
          notificationLogAction: `FEI_REMOVED_FROM_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
        });
      }
    }
  }

  if (formData.has("_redirect")) {
    return redirect(formData.get("_redirect") as string);
  }

  return json({
    ok: true,
    data: {
      fei: JSON.parse(JSON.stringify(savedFei)) as SerializeFrom<Fei>,
    },
    error: "",
  });
}

export type FeiActionData = ExtractLoaderData<typeof action>;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: params.fei_numero as string,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  return json({
    ok: true,
    data: {
      fei: JSON.parse(JSON.stringify(fei)) as SerializeFrom<Fei>,
    },
    error: "",
  });
}

export type FeiLoaderData = ExtractLoaderData<typeof loader>;
