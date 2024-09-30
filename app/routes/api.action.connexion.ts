import { type ActionFunctionArgs, redirect, json, type LoaderFunctionArgs } from "@remix-run/node";

import { prisma } from "~/db/prisma.server";
import { comparePassword, hashPassword } from "~/services/crypto.server";
import { createUserSession, getUserIdFromCookie } from "~/services/auth.server";
import { capture } from "~/services/capture";
import { ExtractLoaderData } from "~/services/extract-loader-data";

type ConnexionType = "creation-de-compte" | "compte-existant";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email-utilisateur") as string;
  const passwordUser = formData.get("password-utilisateur") as string;
  const connexionType = formData.get("connexion-type") as ConnexionType;
  if (!email) {
    return json({ ok: false, data: null, error: "Veuillez renseigner votre email" });
  }
  if (!passwordUser) {
    return json({ ok: false, data: null, error: "Veuillez renseigner votre mot de passe" });
  }
  if (!connexionType) {
    return json({ ok: false, data: null, error: "L'URL de connexion est incorrecte" });
  }
  if (formData.get("name")) {
    capture(new Error("Spam detected"), { extra: { email, message: "Spam detected" } });
    throw redirect("/");
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    if (connexionType === "creation-de-compte") {
      return json({ ok: false, data: null, error: "Un compte existe déjà avec cet email" });
    }
  }
  if (!user) {
    if (connexionType === "compte-existant") {
      return json({
        ok: false,
        data: null,
        error: "L'email est incorrect, ou vous n'avez pas encore de compte",
      });
    }
    user = await prisma.user.create({ data: { email, activated: false, prefilled: false } });
  }
  const hashedPassword = await hashPassword(passwordUser);
  const existingPassword = await prisma.password.findFirst({ where: { user_id: user.id } });
  if (!existingPassword) {
    await prisma.password.create({
      data: { user_id: user.id, password: hashedPassword },
    });
  } else {
    const isOk = await comparePassword(passwordUser, existingPassword.password);
    if (!isOk) {
      if (connexionType === "compte-existant") {
        return json({ ok: false, data: null, error: "Le mot de passe est incorrect" });
      } else {
        return json({ ok: false, data: null, error: "Un compte existe déjà avec cet email" });
      }
    }
  }
  return createUserSession(request, user);
}

export type ConnexionActionData = ExtractLoaderData<typeof action>;

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserIdFromCookie(request, { optional: true });
  if (userId) {
    throw redirect("/app/tableau-de-bord");
  }
  return null;
}
