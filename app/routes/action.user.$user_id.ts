import { User, UserNotifications, UserRoles } from "@prisma/client";
import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { authorizeUserOrAdmin } from "~/utils/authorizeUserOrAdmin";

export async function action(args: ActionFunctionArgs) {
  const { user, error } = await authorizeUserOrAdmin(args);
  if (!user) return json({ ok: false, data: null, error }, { status: 401 });
  const { request, params } = args;

  const formData = await request.formData();
  const nextUser: Partial<User> = {};

  if (formData.has("nom_de_famille")) nextUser.nom_de_famille = formData.get("nom_de_famille") as string;
  if (formData.has("prenom")) nextUser.prenom = formData.get("prenom") as string;
  if (formData.has("telephone")) nextUser.telephone = formData.get("telephone") as string;
  if (formData.has("email")) nextUser.email = formData.get("email") as string;
  if (formData.has("addresse_ligne_1")) nextUser.addresse_ligne_1 = formData.get("addresse_ligne_1") as string;
  if (formData.has("addresse_ligne_2")) nextUser.addresse_ligne_2 = formData.get("addresse_ligne_2") as string;
  if (formData.has("code_postal")) nextUser.code_postal = formData.get("code_postal") as string;
  if (formData.has("ville")) nextUser.ville = formData.get("ville") as string;
  if (formData.has("roles")) nextUser.roles = formData.getAll("roles") as UserRoles[];
  if (formData.has("notifications")) nextUser.notifications = formData.getAll("notifications") as UserNotifications[];
  if (formData.has("web_push_token")) {
    const web_push_token = formData.get("web_push_token") as string;
    const existingSubscriptions = user.web_push_tokens || [];
    if (!existingSubscriptions.includes(web_push_token)) {
      nextUser.web_push_tokens = [...existingSubscriptions, web_push_token];
    }
  }
  if (formData.has("numero_cfei")) nextUser.numero_cfei = formData.get("numero_cfei") as string;
  if (formData.has("numero_frei")) nextUser.numero_frei = formData.get("numero_frei") as string;
  if (formData.has("onboarding_finished")) nextUser.onboarded_at = new Date();

  let savedUser: User | null = null;
  const userId = params.user_id;
  if (!userId) {
    // admin creation
    savedUser = await prisma.user.create({
      data: nextUser,
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

export default function ActionUser() {
  return null;
}
