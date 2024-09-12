import { Header } from "@codegouvfr/react-dsfr/Header";

export default function TableauDeBordLayout() {
  return (
    <>
      <Header
        brandTop={
          <>
            Ministère
            <br />
            de l'Agriculture
          </>
        }
        homeLinkProps={{
          href: "/",
          title: "Zacharie - Ministère de l'Agriculture",
        }}
        id="fr-header-header-with-quick-access-items"
        serviceTagline="La Fiche d’Examen Initial (FEI) simplifiée"
        serviceTitle="Zacharie"
      />
    </>
  );
}
