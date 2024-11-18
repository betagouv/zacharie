import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { createUserSession, getUserFromCookie } from "~/services/auth.server";
import { UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function action({ request }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    return json({ ok: false, data: null, error: "Unauthorized access" });
  }
  const formData = await request.formData();
  const email = formData.get("email-utilisateur") as string;
  if (!email) {
    console.log("NO EMAIL");
    return json({ ok: false, data: null, message: null, error: "Veuillez renseigner votre email" });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return json({ ok: false, data: null, error: "Utilisateur introuvable" });
  }
  return createUserSession(request, user);
}

export type AdminConnectAsLoaderData = ExtractLoaderData<typeof loader>;
