import { Button } from '@codegouvfr/react-dsfr/Button';

export default function BetaTesteurs() {
  return (
    <main className="fr-container my-auto flex min-h-[50vh] flex-col justify-center">
      <div className="fr-grid-row fr-grid-row--gutters fr-py-6w my-auto flex flex-col justify-center">
        <h1 className="fr-h1 text-balance text-center">Devenez utilisateurs-testeurs de Zacharie</h1>
        <section className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-1 md:gap-16">
          <div className="mx-auto h-full w-full overflow-hidden md:col-span-1 md:col-start-2">
            <img
              src="/landing/implantation-zacharie.png"
              alt="La carte de France de l'implantation de Zacharie"
              className="h-full max-h-[50vh] w-full overflow-hidden object-contain"
            />
          </div>
          <div className="my-8 md:col-start-1 md:row-start-1 md:m-0">
            <h2 className="fr-h2 text-center md:text-left">Phase de test du service</h2>
            <p className="text-pretty text-justify font-normal text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
              Zacharie est en phase de test jusqu'à la fin de l'année 2024, auprès d'un nombre restreint
              d'utilisateurs. 3 établissements de traitement du gibier sauvage agréés participent actuellement
              à cette expérimentation :
              <br />
              <br />- VILLETTE VIANDES, dans l'Aisne (02)
              <br />- GUELLIER ET FILS, en Eure-et-Loir (28)
              <br />- NEMROD ALSACE, dans le Haut-Rhin (68).
              <br />
              <br />
              Toutes les fonctionnalités de Zacharie ne sont pas encore disponibles mais l'outil sera amélioré
              grâce aux retours des premiers utilisateurs. Si le test est concluant, Zacharie sera accessible
              à l'ensemble des chasseurs au cours de l'année 2025.
            </p>
          </div>
        </section>
        <hr className="mt-8 md:mt-16" />
        <section className="mt-8 flex flex-col">
          <h2 className="fr-h2 text-balance text-center">Contactez-nous</h2>

          <p className="text-pretty text-center font-normal text-gray-700">
            Pour plus d'informations ou pour commencer à utiliser Zacharie, contactez-nous dès aujourd'hui.
          </p>
          <div className="my-8 flex items-center justify-center">
            <Button
              className="m-0"
              iconId="fr-icon-mail-fill"
              linkProps={{
                href: `mailto:contact@zacharie.beta.gouv.fr?subject=Je souhaite devenir utilisateur-testeur de Zacharie`,
              }}
            >
              Contactez-nous
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
