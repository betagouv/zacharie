import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { UserRoles } from "@prisma/client";

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
      <fetcher.Form id="user_roles_form" method="POST" action={`/action/user/${user.id}`}>
        <input type="hidden" name="_redirect" value="/tableau-de-bord/mon-profil/mes-informations" />
        <input type="hidden" name="onboarding_finished" value="true" />
        <div className="fr-container fr-container--fluid fr-my-md-14v">
          <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
            <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
              <div className="fr-background-alt--blue-france p-4 md:p-16 pb-32 md:pb-0">
                <Stepper currentStep={1} nextTitle="Vos informations personnelles" stepCount={4} title="Vos rôles" />
                <h1 className="fr-h2 fr-mb-2w">Renseignez vos rôles</h1>
                <CallOut iconId="ri-information-line" title="Un seul compte pour toutes vos casquettes">
                  Les acteurs de la chasse sont nombreux : examinateur, centre de collecte, etc. et parfois vous
                  combinez plusieurs rôles. <br />
                  Zacharie vous permet de jongler entre tous très facilement. Quels sont vos rôles ?
                </CallOut>
                <Checkbox
                  legend="Sélectionnez tous les rôles qui vous correspondent"
                  options={[
                    {
                      hintText: "Chasseur, société de chasse, association de chasse",
                      label: "Détenteur initial",
                      nativeInputProps: {
                        name: "roles",
                        value: UserRoles.DETENTEUR_INITIAL,
                        defaultChecked: user.roles.includes(UserRoles.DETENTEUR_INITIAL),
                      },
                    },
                    {
                      hintText:
                        "Munissez-vous de votre numéro d'attestation (de la forme CFEI-DEP-YY-001) pour l'étape suivante",
                      label: "Examinateur initial",
                      nativeInputProps: {
                        name: "roles",
                        value: UserRoles.EXAMINATEUR_INITIAL,
                        defaultChecked: user.roles.includes(UserRoles.EXAMINATEUR_INITIAL),
                      },
                    },
                    {
                      hintText:
                        "Local réfrigéré où le gibier en entreposé. Le nom de l'établissement sera demandé à l'étape suivante",
                      label: "Exploitant d'un Centre de Collecte",
                      nativeInputProps: {
                        name: "roles",
                        value: UserRoles.EXPLOITANT_CENTRE_COLLECTE,
                        defaultChecked: user.roles.includes(UserRoles.EXPLOITANT_CENTRE_COLLECTE),
                      },
                    },
                    {
                      hintText:
                        "Récupère les carcasses et les livre aux ETG. Le nom de l'établissement sera demandé à l'étape suivante",
                      label: "Collecteur Professionnel",
                      nativeInputProps: {
                        name: "roles",
                        value: UserRoles.COLLECTEUR_PRO,
                        defaultChecked: user.roles.includes(UserRoles.COLLECTEUR_PRO),
                      },
                    },
                    {
                      hintText: "Le nom de l'établissement sera demandé à l'étape suivante",
                      label: "Etablissement de Traitement du Gibier (ETG)",
                      nativeInputProps: {
                        name: "roles",
                        value: UserRoles.ETG,
                        defaultChecked: user.roles.includes(UserRoles.ETG),
                      },
                    },
                    {
                      label: "Service Vétérinaire d'Inspection (SVI)",
                      hintText: "Le nom de l'établissement sera demandé à l'étape suivante",
                      nativeInputProps: {
                        name: "roles",
                        value: UserRoles.SVI,
                        defaultChecked: user.roles.includes(UserRoles.SVI),
                      },
                    },
                  ]}
                />
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
                <div className="fixed md:relative md:mt-16 bottom-0 left-0 w-full p-6 bg-white md:bg-transparent drop-shadow-xl z-50">
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
