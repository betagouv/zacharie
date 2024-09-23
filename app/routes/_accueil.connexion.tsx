import { Input } from "@codegouvfr/react-dsfr/Input";
import {
  Link,
  useActionData,
  useFetcher,
  useSearchParams,
  redirect,
  type ClientLoaderFunctionArgs,
  type ClientActionFunctionArgs,
} from "@remix-run/react";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { getUserIdFromCookieClient } from "~/services/auth.client";

type ConnexionType = "creation-de-compte" | "compte-existant";

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/action/connexion`, {
    method: "POST",
    credentials: "include",
    body: await request.formData(),
    headers: {
      Accept: "application/json",
    },
  });
  console.log("CACA ZIZI", response);
  try {
    const json = await response.json();
    console.log("CACA ZIZOUT JSON", json);
  } catch (e) {
    console.log("CACA ZIZOUT", e);
    try {
      const text = await response.text();
      console.log("CACA ZIZOUT TEXT", text);
    } catch (e) {
      console.log("CACA ZIZOUT TEXT LAHELJ", e);
    }
  }
  console.log("CACA BOUDINOS", response);
  // if (response.ok) {
  //   throw redirect("/tableau-de-bord");
  // }
  return { ok: true };
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const userId = getUserIdFromCookieClient(request);
  if (userId) {
    throw redirect("/tableau-de-bord");
  }
  return null;
}

export default function Connexion() {
  const data = useActionData<{ ok: boolean; error: string }>();
  const [searchParams] = useSearchParams();
  const connexionType = searchParams.get("type") as ConnexionType;
  const connexionFetcher = useFetcher({ key: "connexion" });

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
            <connexionFetcher.Form id="login_form" method="POST" className="fr-background-alt--blue-france p-4 md:p-8">
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
              <input type="text" name="name" className="hidden" />
              <Input
                hintText="Renseignez votre email ci-dessous"
                label="Mon email"
                state={getErrorMessage("email") ? "error" : "default"}
                stateRelatedMessage={getErrorMessage("email")}
                nativeInputProps={{
                  name: "email-utilisateur",
                  type: "email",
                  placeholder: "votre@email.com",
                  defaultValue: import.meta.env.VITE_EMAIL,
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
                  defaultValue: import.meta.env.VITE_PASSWORD,
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
            </connexionFetcher.Form>
          </div>
        </div>
      </div>
    </main>
  );
}
