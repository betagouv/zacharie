import { Input } from "@codegouvfr/react-dsfr/Input";
import { type ActionFunctionArgs, redirect, json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { SpamError } from "remix-utils/honeypot/server";
import { honeypot } from "~/services/honeypot.server";
import { capture } from "~/services/capture";
import { prisma } from "~/db/prisma.server";
import { comparePassword, hashPassword } from "~/services/crypto.server";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createUserSession, getUserIdFromCookie } from "~/services/auth.server";
import { getUserOnboardingRoute } from "~/utils/user-onboarded.server";

type ConnexionType = "creation-de-compte" | "compte-existant";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email-utilisateur") as string;
  const passwordUser = formData.get("password-utilisateur") as string;
  const connexionType = formData.get("connexion-type") as ConnexionType;
  if (!email) {
    return json({ ok: false, error: "Veuillez renseigner votre email" });
  }
  if (!passwordUser) {
    return json({ ok: false, error: "Veuillez renseigner votre mot de passe" });
  }
  if (!connexionType) {
    return json({ ok: false, error: "L'URL de connexion est incorrecte" });
  }
  try {
    honeypot.check(formData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof SpamError) {
      // handle spam requests here
      capture(error, { extra: { email, message: "Spam detected" } });
    } else {
      capture(error, { extra: { email, message: "Unknown error" } });
    }
    throw redirect("/");
    // handle any other possible error here, e.g. re-throw since nothing else
    // should be thrown
  }
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    if (connexionType === "creation-de-compte") {
      return json({ ok: false, error: "Un compte existe déjà avec cet email" });
    }
  }
  if (!user) {
    if (connexionType === "compte-existant") {
      return json({
        ok: false,
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
        return json({ ok: false, error: "Le mot de passe est incorrect" });
      } else {
        return json({ ok: false, error: "Un compte existe déjà avec cet email" });
      }
    }
  }
  return createUserSession(request, user, getUserOnboardingRoute(user) ?? "/tableau-de-bord");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserIdFromCookie(request, { optional: true });
  if (userId) {
    throw redirect("/tableau-de-bord");
  }
  return null;
}

export default function Connexion() {
  const data = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const connexionType = searchParams.get("type") as ConnexionType;
  // Helper function to safely access error message
  const getErrorMessage = (field: string): string => {
    if (typeof data === "object" && data !== null && "error" in data) {
      return data.error.includes(field) ? data.error : "";
    }
    return "";
  };
  return (
    <main role="main" id="content">
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
            <Form id="login_form" method="POST" className="fr-background-alt--blue-france fr-p-16v">
              <fieldset
                className="fr-fieldset"
                id="login-1760-fieldset"
                aria-labelledby="login-1760-fieldset-legend login-1760-fieldset-messages"
              >
                <legend className="fr-fieldset__legend" id="login-1760-fieldset-legend">
                  <h2 className="fr-h3">
                    {connexionType === "creation-de-compte" ? <>Créer mon compte</> : <>Me connecter</>}
                  </h2>
                </legend>
              </fieldset>
              <input type="hidden" name="connexion-type" value={connexionType} />
              <Input
                hintText="Renseignez votre email ci-dessous"
                label="Mon email"
                state={getErrorMessage("email") ? "error" : "default"}
                stateRelatedMessage={getErrorMessage("email")}
                nativeInputProps={{
                  name: "email-utilisateur",
                  type: "email",
                  placeholder: "votre@email.com",
                }}
              />
              <Input
                hintText="Veuillez entrer votre mot de passe"
                label="Mon mot de passe"
                state={getErrorMessage("mot de passe") ? "error" : "default"}
                stateRelatedMessage={getErrorMessage("mot de passe")}
                nativeInputProps={{
                  name: "password-utilisateur",
                  type: "password",
                  minLength: 12,
                  placeholder: "votre mot de passe",
                }}
              />
              <ul className="fr-btns-group fr-btns-group--left fr-btns-group--icon-left">
                <li className="flex w-auto justify-start">
                  <Button type="submit">
                    {connexionType === "creation-de-compte" ? <>Créer mon compte</> : <>Me connecter</>}
                  </Button>
                </li>
              </ul>
              <hr />
              <p className="text-xs">
                {connexionType === "creation-de-compte" ? (
                  <>
                    Vous avez déjà un compte ? <br />
                    <Link to="/connexion?type=compte-existant">Cliquez ici pour vous connecter</Link>
                  </>
                ) : (
                  <>
                    Vous n'avez pas encore de compte ? <br />
                    <Link to="/connexion?type=creation-de-compte">Cliquez ici pour en créer un</Link>
                  </>
                )}
              </p>
            </Form>
          </div>
        </div>
      </div>
    </main>
  );
}
