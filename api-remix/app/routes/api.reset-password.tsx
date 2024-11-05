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
      `https://zacharie.beta.gouv.fr/app/connexion?type=compte-existant&reset-password-message=${message}`,
    );
  }
  if (dayjs().diff(password.reset_password_last_email_sent_at, "minutes") > 60) {
    const message = encodeURIComponent("Le lien de réinitialisation de mot de passe a expiré. Veuillez réessayer.");
    return redirect(
      `https://zacharie.beta.gouv.fr/app/connexion?type=compte-existant&reset-password-message=${message}`,
    );
  }
  await prisma.password.delete({
    where: { user_id: password.user_id },
  });
  return json({ ok: true });
}

export default function Index() {
  return (
    <>
      <style>
        {`
      * {
        font-family: Arial, sans-serif;
      }
    `}
      </style>
      <div>
        <h1>Réinitialisation de mot de passe</h1>
        <p>
          Votre mot de passe a été réinitialisé avec succès.
          <br />
          <br /> Vous pouvez maintenant&nbsp;
          <ul>
            <li>
              <b>OUVRIR L'APP</b> si vous l'avez installée
            </li>
            <li>
              cliquer <a href={`https://zacharie.beta.gouv.fr/app/connexion?type=compte-existant`}>ici</a> pour vous
              connecter depuis un navigateur
            </li>
          </ul>
        </p>
      </div>
    </>
  );
}
