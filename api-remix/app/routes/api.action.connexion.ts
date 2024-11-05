import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { comparePassword, hashPassword } from "~/services/crypto.server";
import { createUserSession, getUserIdFromCookie } from "~/services/auth.server";
import { capture } from "~/services/capture";
import { ExtractLoaderData } from "~/services/extract-loader-data";
import createUserId from "~/utils/createUserId.server";
import { sendEmail } from "~/services/sendEmail.server";
import dayjs from "dayjs";

type ConnexionType = "creation-de-compte" | "compte-existant";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email-utilisateur") as string;
  const passwordUser = formData.get("password-utilisateur") as string;
  const connexionType = formData.get("connexion-type") as ConnexionType;
  const resetPassword = formData.get("reset-password") as string;
  if (!email) {
    console.log("NO EMAIL");
    return json({ ok: false, data: null, message: null, error: "Veuillez renseigner votre email" });
  }
  if (resetPassword === "true") {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.email) {
      const password = await prisma.password.findFirst({ where: { user_id: user.id } });
      if (!password) {
        return json({
          ok: true,
          data: null,
          error: null,
          message: "Vous pouvez désormais vous connecter avec votre email et créer un mot de passe",
        });
      }
      if (password?.reset_password_last_email_sent_at) {
        const sentMinutesAgo = dayjs().diff(password.reset_password_last_email_sent_at, "minute");
        if (sentMinutesAgo < 5) {
          return json({
            ok: false,
            data: null,
            message: `Un email de réinitialisation a déjà été envoyé, veuillez patienter encore ${5 - sentMinutesAgo} minutes`,
            error: null,
          });
        }
      }
      const token = crypto.randomUUID();
      await prisma.password.update({
        where: { user_id: user.id },
        data: { reset_password_token: token, reset_password_last_email_sent_at: new Date() },
      });
      const text = `Bonjour, vous avez demandé à réinitialiser votre mot de passe. Pour ce faire, veuillez cliquer sur le lien suivant : ${import.meta.env.VITE_API_URL}/api/reset-password?token=${token}`;
      sendEmail({
        emails: import.meta.env.DEV ? ["arnaud@ambroselli.io"] : [user.email!],
        subject: "[Zacharie] Réinitialisation de votre mot de passe",
        text,
        html: text,
      });
      return json({
        ok: true,
        data: null,
        error: null,
        message: "Un email de réinitialisation de mot de passe a été envoyé",
      });
    }
  }
  if (!passwordUser) {
    console.log("NO PASSWORD");
    return json({ ok: false, data: null, message: null, error: "Veuillez renseigner votre mot de passe" });
  }
  if (!connexionType) {
    console.log("NO CONNEXION TYPE");
    return json({ ok: false, data: null, message: null, error: "L'URL de connexion est incorrecte" });
  }
  if (formData.get("name")) {
    console.log("SPAM DETECTED");
    capture(new Error("Spam detected"), { extra: { email, message: "Spam detected" } });
    return json({ ok: false, data: null, message: null, error: "Unauthorized" });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    if (connexionType === "creation-de-compte") {
      console.log("ACCOUNT ALREADY EXISTS");
      return json({ ok: false, data: null, message: null, error: "Un compte existe déjà avec cet email" });
    }
  }
  if (!user) {
    if (connexionType === "compte-existant") {
      console.log("NO ACCOUNT");
      return json({
        ok: false,
        data: null,
        message: null,
        error: "L'email est incorrect, ou vous n'avez pas encore de compte",
      });
    }
    user = await prisma.user.create({
      data: {
        id: await createUserId(),
        email,
        activated: false,
        prefilled: false,
      },
    });
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
        console.log("WRONG PASSWORD");
        return json({ ok: false, data: null, message: null, error: "Le mot de passe est incorrect" });
      } else {
        console.log("ACCOUNT ALREADY EXISTS");
        return json({ ok: false, data: null, message: null, error: "Un compte existe déjà avec cet email" });
      }
    }
  }
  console.log("OK BEBE");
  return createUserSession(request, user);
}

export type ConnexionActionData = ExtractLoaderData<typeof action>;

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserIdFromCookie(request, { optional: true });
  if (userId) {
    return json({ ok: false, data: null, message: null, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
