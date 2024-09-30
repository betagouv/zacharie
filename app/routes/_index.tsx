import { Button } from "@codegouvfr/react-dsfr/Button";
import { json, useLoaderData } from "@remix-run/react";
import RootDisplay from "~/components/RootDisplay";
import { getMostFreshUser } from "~/utils-offline/get-most-fresh-user";
// import type { MetaFunction } from "@remix-run/node";

// export const meta: MetaFunction = () => {
//   return [
//     { title: "New Remix App" },
//     { name: "description", content: "Welcome to Remix!" },
//   ];
// };

export async function clientLoader() {
  const user = await getMostFreshUser();
  return json({
    isLoggedIn: !!user?.id,
  });
}

export default function LandingPage() {
  const { isLoggedIn } = useLoaderData<typeof clientLoader>();
  return (
    <RootDisplay>
      <section className="fr-container my-auto flex min-h-[50vh] flex-col justify-center">
        <div className="fr-grid-row fr-grid-row--gutters fr-py-6w my-auto flex flex-col justify-center">
          <h1 className="fr-h1">La Fiche d'Examen Initial SIMPLIFIÉE</h1>
          {isLoggedIn ? (
            <Button
              linkProps={{
                to: "/app/tableau-de-bord",
                href: "#",
              }}
              iconId="ri-account-box-line"
              className="mb-6"
            >
              Accéder à mon compte
            </Button>
          ) : (
            <Button
              linkProps={{
                to: "/app/connexion?type=compte-existant",
                href: "#",
              }}
              iconId="ri-account-box-line"
              className="mb-6"
            >
              Se connecter
            </Button>
          )}
          <Button
            linkProps={{
              to: "/app/connexion?type=creation-de-compte",
              href: "#",
            }}
            iconId="fr-icon-add-circle-line"
          >
            Créer un compte
          </Button>
        </div>
      </section>
    </RootDisplay>
  );
}
