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
    return json({ ok: false, data: null, error: "Le numéro de la FEI est obligatoire" }, { status: 400 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: formData.get(Prisma.FeiScalarFieldEnum.numero) as string,
      fei_next_owner_role: UserRoles.PREMIER_DETENTEUR,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "La FEI n'existe pas" }, { status: 400 });
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
      title: "Vous avez une nouvelle FEI à traiter",
      body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle FEI. Rendez vous sur Zacharie pour la traiter.`,
    });
  }

  return json({ ok: true, data: nextPremierDetenteur, error: null });
}
