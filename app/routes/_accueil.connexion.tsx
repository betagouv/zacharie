import { Input } from "@codegouvfr/react-dsfr/Input";
import { ActionFunctionArgs, json } from "@remix-run/node";
import { Form, Link, redirect, useActionData, useSearchParams } from "@remix-run/react";
import { SpamError } from "remix-utils/honeypot/server";
import { honeypot } from "~/services/honeypot.server";
import { capture } from "~/services/capture";
import { prisma } from "~/db/prisma.server";
import { comparePassword, hashPassword } from "~/services/crypto.server";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createUserSession } from "~/services/auth.server";

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
    user = await prisma.user.create({ data: { email } });
  }
  const hashedPassword = await hashPassword(passwordUser);
  const existingPassword = await prisma.password.findFirst({ where: { userId: user.id } });
  if (!existingPassword) {
    await prisma.password.create({
      data: { userId: user.id, password: hashedPassword },
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
  return createUserSession(request, user, "/tableau-de-bord");
}

export default function Connexion() {
  const data = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const connexionType = searchParams.get("type") as ConnexionType;

  return (
    <div className="fr-container fr-container--fluid fr-mb-10v" id="root-container">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center ">
        <div className="fr-grid-row fr-m-4w w-full">
          <div className="fr-col-md-6">
            <h1 className="fr-mb-1v text-action-high-blue-france">Connectez-vous</h1>
            <p className="fr-text--bold fr-text--bold text-action-high-blue-france">
              et retrouvez vos Fiches d'Examen Initial (FEI)
            </p>
            <ul className="list-none">
              <li>
                <span className="mr-4 text-action-high-blue-france">✔</span>Examinateur{" "}
                <strong>pour créer la FEI</strong>
              </li>
              <li>
                <span className="mr-4 text-action-high-blue-france">✔</span>Premier détenteur{" "}
                <strong>pour suivre la FEI</strong>
              </li>
              <li>
                <span className="mr-4 text-action-high-blue-france">✔</span>Collecteur,
                Transporteur, ETG <strong> pour la traçabilité</strong>
              </li>
              <li>
                <span className="mr-4 text-action-high-blue-france">✔</span>Fonctionne
                <strong> en zone blanche</strong>
              </li>
            </ul>
            <img src="/connexion.svg" alt="" width="300" />
          </div>
          <div className="fr-col-md-6">
            <Form id="login_form" method="POST" className=" bg-alt-blue-france p-16">
              <fieldset
                className="fr-fieldset"
                id="login-1760-fieldset"
                aria-labelledby="login-1760-fieldset-legend login-1760-fieldset-messages">
                <legend className="fr-fieldset__legend" id="login-1760-fieldset-legend">
                  <h2 className="fr-h3">
                    {connexionType === "creation-de-compte" ? (
                      <>Créer mon compte</>
                    ) : (
                      <>Me connecter</>
                    )}
                  </h2>
                </legend>
              </fieldset>
              <input type="hidden" name="connexion-type" value={connexionType} />
              <Input
                hintText="Renseignez votre email ci-dessous"
                label="Mon email"
                state={data?.error.includes("email") ? "error" : "default"}
                stateRelatedMessage={data?.error.includes("email") ? data.error : ""}
                nativeInputProps={{
                  name: "email-utilisateur",
                  type: "email",
                  placeholder: "votre@email.com",
                }}
              />
              <Input
                hintText="Veuillez entrer votre mot de passe"
                label="Mon mot de passe"
                state={data?.error.includes("mot de passe") ? "error" : "default"}
                stateRelatedMessage={data?.error.includes("mot de passe") ? data.error : ""}
                nativeInputProps={{
                  name: "password-utilisateur",
                  type: "password",
                  minLength: 12,
                  placeholder: "votre mot de passe",
                }}
              />
              <ul className="fr-btns-group fr-btns-group--left fr-btns-group--icon-left">
                <li className="flex justify-start w-auto">
                  <Button type="submit">
                    {connexionType === "creation-de-compte" ? (
                      <>Créer mon compte</>
                    ) : (
                      <>Me connecter</>
                    )}
                  </Button>
                </li>
              </ul>
              <hr />
              <p className="text-xs">
                {connexionType === "creation-de-compte" ? (
                  <>
                    Vous avez déjà un compte ? <br />
                    <Link to="/connexion?type=compte-existant">
                      Cliquez ici pour vous connecter
                    </Link>
                  </>
                ) : (
                  <>
                    Vous n'avez pas encore de compte ? <br />
                    <Link to="/connexion?type=creation-de-compte">
                      Cliquez ici pour en créer un
                    </Link>
                  </>
                )}
              </p>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
