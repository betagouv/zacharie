import { ActionFunctionArgs, json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");
  return json({ user });
}

export default function TableauDeBord() {
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher({ key: "onboarding-etape-1" });
  return (
    <main role="main" id="content">
      <fetcher.Form id="login_form" method="POST" action={`/action/user/${user.id}`}>
        <input type="hidden" name="_redirect" value="/tableau-de-bord/onboarding-etape-2" />
        <div className="fr-container fr-container--fluid fr-my-md-14v">
          <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
            <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
              <div className="fr-background-alt--blue-france p-16 pb-32 md:pb-0">
                <Stepper
                  currentStep={2}
                  nextTitle="Vos partenaires"
                  stepCount={3}
                  title="Vos informations personnelles"
                />
                <Accordion titleAs="h2" label="Votre identité" defaultExpanded={true}>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Nom"
                      nativeInputProps={{
                        id: "nom_de_famille",
                        name: "nom_de_famille",
                        autoComplete: "family-name",
                        defaultValue: user.nom_de_famille ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Prénom"
                      nativeInputProps={{
                        id: "prenom",
                        name: "prenom",
                        autoComplete: "given-name",
                        defaultValue: user.prenom ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Téléphone"
                      hintText="Format attendu : 01 22 33 44 55"
                      nativeInputProps={{
                        id: "telephone",
                        name: "telephone",
                        autoComplete: "tel",
                        defaultValue: user.telephone ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Adresse"
                      hintText="Indication : numéro et voie"
                      nativeInputProps={{
                        id: "addresse_ligne_1",
                        name: "addresse_ligne_1",
                        autoComplete: "address-line1",
                        defaultValue: user.addresse_ligne_1 ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Complément d'adresse (optionnel)"
                      hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                      nativeInputProps={{
                        id: "addresse_ligne_2",
                        name: "addresse_ligne_2",
                        autoComplete: "address-line2",
                        defaultValue: user.addresse_ligne_2 ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element fr-fieldset__element--inline fr-fieldset__element--postal flex">
                    <Input
                      label="Code postal"
                      hintText="Format attendu : 5 chiffres"
                      nativeInputProps={{
                        id: "code_postal",
                        name: "code_postal",
                        autoComplete: "postal-code",
                        defaultValue: user.code_postal ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element fr-fieldset__element--inline@md fr-fieldset__element--inline-grow">
                    <Input
                      label="Ville ou commune"
                      hintText="Exemple : Montpellier"
                      nativeInputProps={{
                        id: "ville",
                        name: "ville",
                        autoComplete: "address-level2",
                        defaultValue: user.ville ?? "",
                      }}
                    />
                  </div>
                </Accordion>
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>

                <div className="fixed md:relative md:mt-16 bottom-0 left-0 w-full p-6 bg-white md:bg-transparent drop-shadow-xl">
                  <ButtonsGroup
                    buttons={[
                      {
                        children: "Continuer",
                        nativeButtonProps: {
                          type: "submit",
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </fetcher.Form>
    </main>
  );
}
