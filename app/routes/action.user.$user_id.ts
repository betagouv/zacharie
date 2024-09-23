import { Prisma, User, UserNotifications, UserRoles } from "@prisma/client";
import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { authorizeUserOrAdmin } from "~/utils/authorizeUserOrAdmin";

export async function action(args: ActionFunctionArgs) {
  const { user, error } = await authorizeUserOrAdmin(args);
  if (!user) {
    return json({ ok: false, data: null, error }, { status: 401 });
  }
  const { request, params } = args;

  const formData = await request.formData();

  console.log("formData", Object.fromEntries(formData.entries()));

  const nextUser: Prisma.UserUpdateInput = {};

  if (formData.has(Prisma.UserScalarFieldEnum.activated)) {
    nextUser.activated = formData.get(Prisma.UserScalarFieldEnum.activated) === "true" ? true : false;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox)) {
    nextUser.user_entities_vivible_checkbox =
      formData.get(Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox) === "true" ? true : false;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.prefilled)) {
    nextUser.prefilled = formData.get(Prisma.UserScalarFieldEnum.prefilled) === "true" ? true : false;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.nom_de_famille)) {
    nextUser.nom_de_famille = formData.get(Prisma.UserScalarFieldEnum.nom_de_famille) as string;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.prenom)) {
    nextUser.prenom = formData.get(Prisma.UserScalarFieldEnum.prenom) as string;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.telephone)) {
    nextUser.telephone = formData.get(Prisma.UserScalarFieldEnum.telephone) as string;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.email)) {
    nextUser.email = formData.get(Prisma.UserScalarFieldEnum.email) as string;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.addresse_ligne_1)) {
    nextUser.addresse_ligne_1 = formData.get(Prisma.UserScalarFieldEnum.addresse_ligne_1) as string;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.addresse_ligne_2)) {
    nextUser.addresse_ligne_2 = formData.get(Prisma.UserScalarFieldEnum.addresse_ligne_2) as string;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.code_postal)) {
    nextUser.code_postal = formData.get(Prisma.UserScalarFieldEnum.code_postal) as string;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.ville)) {
    nextUser.ville = formData.get(Prisma.UserScalarFieldEnum.ville) as string;
  }
  if (formData.has(Prisma.UserScalarFieldEnum.roles)) {
    nextUser.roles = formData.getAll(Prisma.UserScalarFieldEnum.roles) as UserRoles[];
  }
  if (formData.has(Prisma.UserScalarFieldEnum.notifications)) {
    nextUser.notifications = formData.getAll("notifications") as UserNotifications[];
  }
  if (formData.has("web_push_token")) {
    const web_push_token = formData.get("web_push_token") as string;
    const existingSubscriptions = user.web_push_tokens || [];
    if (!existingSubscriptions.includes(web_push_token)) {
      nextUser.web_push_tokens = [...existingSubscriptions, web_push_token];
    }
  }
  if (formData.has(Prisma.UserScalarFieldEnum.numero_cfei)) {
    nextUser.numero_cfei = formData.get(Prisma.UserScalarFieldEnum.numero_cfei) as string;
  }
  if (formData.has("onboarding_finished")) {
    nextUser.onboarded_at = new Date();
  }

  let savedUser: User | null = null;
  const userId = params.user_id;
  if (!userId) {
    // admin creation
    savedUser = await prisma.user.create({
      data: nextUser as Prisma.UserCreateInput,
    });
  } else {
    // user update / self-update
    savedUser = await prisma.user.update({
      where: { id: userId },
      data: nextUser,
    });
  }

  if (formData.has("_redirect")) {
    return redirect(formData.get("_redirect") as string);
  }

  return json({ ok: true, data: savedUser, error: null });
}
