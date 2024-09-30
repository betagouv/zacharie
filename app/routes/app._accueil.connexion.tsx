import { Input } from "@codegouvfr/react-dsfr/Input";
import {
  Link,
  useActionData,
  useFetcher,
  useSearchParams,
  redirect,
  type ClientActionFunctionArgs,
} from "@remix-run/react";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { ConnexionActionData } from "~/routes/api.action.connexion";
import { setCacheItem } from "~/services/indexed-db.client";
import { getUserOnboardingRoute } from "~/utils/user-onboarded.client";
import { getMostFreshUser } from "~/utils-offline/get-most-fresh-user";

type ConnexionType = "creation-de-compte" | "compte-existant";

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const response = (await fetch(`${import.meta.env.VITE_API_URL}/api/action/connexion`, {
    method: "POST",
    credentials: "include",
    body: await request.formData(),
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json())) as ConnexionActionData;
  if (response.ok && response.data?.id) {
    const user = response.data;
    setCacheItem("user", user);
    throw redirect(getUserOnboardingRoute(user) ?? "/app/tableau-de-bord");
  }
  setCacheItem("user", null);
  return response;
}

export async function clientLoader() {
  const user = await getMostFreshUser();
  if (user) {
    throw redirect("/app/tableau-de-bord");
  }
  return null;
}

export default function Connexion() {
  const data = useActionData<{ ok: boolean; error: string }>();
  const [searchParams] = useSearchParams();
  const connexionType = (searchParams.get("type") as ConnexionType) || "compte-existant";
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
                  defaultValue: import.meta.env.VITE_EMAIL ?? "",
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
                  defaultValue: import.meta.env.VITE_PASSWORD ?? "",
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
                    <Link to="/app/connexion?type=compte-existant">Cliquez ici pour vous connecter</Link>
                  </>
                ) : (
                  <>
                    Vous n'avez pas encore de compte ? <br />
                    <Link to="/app/connexion?type=creation-de-compte">Cliquez ici pour en créer un</Link>
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
