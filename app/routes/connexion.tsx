import { Input } from "@codegouvfr/react-dsfr/Input";
import { ActionFunctionArgs } from "@remix-run/node";
import { Form, json, redirect } from "@remix-run/react";
import { SpamError } from "remix-utils/honeypot/server";
import { sendEmail } from "~/services/sendEmail";
import { honeypot } from "~/services/honeypot.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  if (!email) {
    return json({ error: "Email is required" }, { status: 400 });
  }
  try {
    honeypot.check(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      // handle spam requests here
      console.error("Spam detected", error);
      throw redirect("/");
    } else {
      console.error("Unknown error", error);
    }
    throw redirect("/");
    // handle any other possible error here, e.g. re-throw since nothing else
    // should be thrown
  }
  // let user = await prisma.user.findUnique({ where: { email } });
  // if (!user) user = await prisma.user.create({ data: { email } });
  // const otp = Math.random().toString(36).substring(2, 8).toLocaleUpperCase();
  // await prisma.user.update({ where: { email }, data: { otp, otpCreatedAt: new Date() } });
  // const magicLinkEmail = createMagicLinkEmail(user, otp);
  // if (process.env.NODE_ENV === "development") {
  //   console.log("code unique ", otp);
  //   // await sendEmail(magicLinkEmail);
  // } else {
  //   await sendEmail(magicLinkEmail);
  // }
  // throw redirect(loginRedirectLink);
}

export default function Connexion() {
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
                  <h2 className="fr-h3">Me connecter</h2>
                </legend>
              </fieldset>
              <Input
                hintText="Un code vous sera envoyé pour vous connecter"
                label="Mon email"
                state="default"
                nativeInputProps={{
                  name: "email-utilisateur",
                  type: "email",
                  placeholder: "votre@email.com",
                }}
              />
              <ul className="fr-btns-group fr-btns-group--left fr-btns-group--icon-left">
                <li>
                  <button className="fr-btn" type="submit">
                    Recevoir le code de connexion
                  </button>
                </li>
              </ul>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
