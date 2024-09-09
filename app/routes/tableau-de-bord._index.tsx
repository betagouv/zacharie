import { redirect, json, type LoaderFunctionArgs } from "@remix-run/node";
// import { useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { getUserOnboardingRoute } from "~/utils/user-onboarded.server";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { useLoaderData } from "@remix-run/react";
import { UserRoles } from "@prisma/client";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");
  const onboardingRoute = getUserOnboardingRoute(user);
  if (onboardingRoute) throw redirect(onboardingRoute);
  return json({ user });
}

export default function TableauDeBord() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Mes FEI</h1>
          <CallOut title="🖥️ Toutes vos FEI centralisées" className="bg-white">
            Retrouvez ici toutes vos FEI - en cours, validées, refusées - et les actions à mener.
          </CallOut>
          {(user.roles.includes(UserRoles.DETENTEUR_INITIAL) || user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) && (
            <section className="bg-white mb-6 md:shadow">
              <div className="p-4 md:p-8 pb-32 md:pb-0">
                <h2 className="fr-h3 fr-mb-2w">Nouvelle FEI</h2>
                <p className="fr-text--regular mb-4">Pour créer une nouvelle FEI, c'est par ici 👇</p>
                <div className="flex flex-col items-start [&_ul]:md:min-w-96 bg-white">
                  <ButtonsGroup
                    buttons={[
                      {
                        children: "Nouvelle FEI",
                        linkProps: {
                          href: "/tableau-de-bord/fei",
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            </section>
          )}
          <section className="bg-white mb-6 md:shadow">
            <div className="p-4 md:p-8 pb-32 md:pb-0">
              <h2 className="fr-h3 fr-mb-2w">FEI assignées</h2>
              <div className="flex flex-col items-start [&_ul]:md:min-w-96 bg-white">
                <ButtonsGroup
                  buttons={[
                    {
                      children: "Rafraichir",
                      linkProps: {
                        href: "/tableau-de-bord/",
                      },
                    },
                  ]}
                />
              </div>
            </div>
          </section>
          <section className="bg-white mb-6 md:shadow">
            <div className="p-4 md:p-8 pb-32 md:pb-0">
              <h2 className="fr-h3 fr-mb-2w">FEI passées</h2>
              <div className="flex flex-col items-start [&_ul]:md:min-w-96 bg-white">
                <ButtonsGroup
                  buttons={[
                    {
                      children: "Rafraichir",
                      linkProps: {
                        href: "/tableau-de-bord/",
                      },
                    },
                  ]}
                />
              </div>
              <div className="mt-6 ml-6 mb-16">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
