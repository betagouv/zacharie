import { Button } from "@codegouvfr/react-dsfr/Button";
// import type { MetaFunction } from "@remix-run/node";

// export const meta: MetaFunction = () => {
//   return [
//     { title: "New Remix App" },
//     { name: "description", content: "Welcome to Remix!" },
//   ];
// };

export default function Index() {
  return (
    <section className="fr-container min-h-[50vh] flex flex-col justify-center my-auto">
      <div className="fr-grid-row fr-grid-row--gutters fr-py-6w flex flex-col justify-center my-auto">
        <h1 className="fr-h1">La Fiche d'Examen Initial SIMPLIFIÉE</h1>
        <Button
          linkProps={{
            to: "connexion",
          }}
          iconId="ri-account-box-line">
          Se connecter / Créer un espace
        </Button>
      </div>
    </section>
  );
}
