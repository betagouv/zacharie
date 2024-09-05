import { User, UserRoles } from "@prisma/client";
import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");

  const isAdmin = user.roles.includes(UserRoles.ADMIN);
  const userId = params.user_id;

  if (!userId) {
    // only admins can create new users this way
    if (!isAdmin) return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  if (userId !== user.id && !isAdmin) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

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
  if (formData.has("numero_cfei")) nextUser.numero_cfei = formData.get("numero_cfei") as string;
  if (formData.has("numero_frei")) nextUser.numero_frei = formData.get("numero_frei") as string;

  let savedUser: User | null = null;
  if (!userId) {
    savedUser = await prisma.user.create({
      data: nextUser,
    });
  } else {
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
