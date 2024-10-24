import { Prisma, UserRelationType, UserRoles } from "@prisma/client";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";
import sendNotificationToUser from "~/services/notifications.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  console.log("formData action.trouver-premier-detenteur", Object.fromEntries(formData.entries()));

  if (!formData.has(Prisma.UserScalarFieldEnum.email)) {
    return json({ ok: false, data: null, error: "L'email est obligatoire" }, { status: 400 });
  }
  if (!formData.has(Prisma.FeiScalarFieldEnum.numero)) {
    return json({ ok: false, data: null, error: "Le numéro de la fiche est obligatoire" }, { status: 400 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: formData.get(Prisma.FeiScalarFieldEnum.numero) as string,
      fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "La fiche n'existe pas" }, { status: 400 });
  }
  const nextPremierDetenteur = await prisma.user.findUnique({
    where: {
      email: formData.get(Prisma.UserScalarFieldEnum.email) as string,
    },
  });
  if (!nextPremierDetenteur) {
    return json({ ok: false, data: null, error: "L'utilisateur n'existe pas" }, { status: 400 });
  }

  const existingRelation = await prisma.userRelations.findFirst({
    where: {
      owner_id: user.id,
      related_id: nextPremierDetenteur.id,
      relation: UserRelationType.PREMIER_DETENTEUR,
    },
  });

  if (!existingRelation) {
    await prisma.userRelations.create({
      data: {
        owner_id: user.id,
        related_id: nextPremierDetenteur.id,
        relation: UserRelationType.PREMIER_DETENTEUR,
      },
    });
  }

  await prisma.fei.update({
    where: {
      numero: fei.numero,
    },
    data: {
      fei_next_owner_user_id: nextPremierDetenteur.id,
    },
  });

  if (nextPremierDetenteur.id !== user.id) {
    sendNotificationToUser({
      user: nextPremierDetenteur!,
      title: "Vous avez une nouvelle fiche d'accompagnement du gibier sauvage à traiter",
      body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche d'accompagnement du gibier sauvage. Rendez vous sur Zacharie pour la traiter.`,
      email: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche d'accompagnement du gibier sauvage, la ${fei?.numero}. Rendez vous sur Zacharie pour la traiter.`,
      notificationLogAction: `FEI_ASSIGNED_TO_${UserRelationType.PREMIER_DETENTEUR}_${fei.numero}`,
    });
  }

  return json({ ok: true, data: nextPremierDetenteur, error: "" });
}
