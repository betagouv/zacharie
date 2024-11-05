import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import dayjs from "dayjs";
import { prisma } from "~/db/prisma.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const password = await prisma.password.findFirst({ where: { reset_password_token: token } });
  if (!password) {
    const message = encodeURIComponent("Le lien de réinitialisation de mot de passe est invalide. Veuillez réessayer.");
    return redirect(
      `${import.meta.env.VITE_APP_URL}/app/connexion?type=compte-existant&reset-password-message=${message}`,
    );
  }
  if (dayjs().diff(password.reset_password_last_email_sent_at, "minutes") > 60) {
    const message = encodeURIComponent("Le lien de réinitialisation de mot de passe a expiré. Veuillez réessayer.");
    return redirect(
      `${import.meta.env.VITE_APP_URL}/app/connexion?type=compte-existant&reset-password-message=${message}`,
    );
  }
  await prisma.password.delete({
    where: { user_id: password.user_id },
  });
  await prisma.user.update({
    where: { id: password.user_id },
    data: { deleted_at: new Date() },
  });
  return json({ ok: true });
}

export default function Index() {
  return (
    <div>
      <h1>Réinitialisation de mot de passe</h1>
      <p
        style={{
          fontFamily: "Arial, sans-serif",
        }}
      >
        Votre mot de passe a été réinitialisé avec succès.
        <br /> Vous pouvez maintenant vous connecter avec votre nouveau mot de passe, soit en ouvrant l'app si vous
        l'avez installée, soit en cliquant sur le lien suivant : <a href={import.meta.env.VITE_APP_URL}>
          Se connecter
        </a>{" "}
        pour vous connecter depuis un navigateur
      </p>
    </div>
  );
}
