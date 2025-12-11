import { Button } from '@codegouvfr/react-dsfr/Button';

import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import SchemaPros from '@app/components/SchemaPros';
import SchemaProsMobile from '@app/components/SchemaProsMobile';

export default function LandingProsPage() {
  return (
    <>
      <title>
        Zacharie pour les professionnels de la filière de valorisation du gibier sauvage | Garantir des
        viandes de gibier sauvage saines et sûres | Ministère de l'Agriculture et de la Souveraineté
        Alimentaire
      </title>
      <main className="fr-container my-auto flex min-h-[50vh] flex-col justify-center">
        <div className="fr-grid-row fr-grid-row--gutters fr-py-6w my-auto flex flex-col justify-center">
          <h1 className="fr-h1 text-action-high-blue-france text-center text-balance">
            Zacharie pour les professionnels de la filière de valorisation du gibier sauvage
          </h1>
          <CTA mobile />
          <section className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-2 md:gap-16">
            <div className="mx-auto h-full w-full overflow-hidden md:col-span-1 md:row-span-2">
              <img
                src="/landing/inspection-svi.png"
                alt="Un vétérinaire en train de faire une inspection de carcasse"
                className="h-full max-h-[50vh] w-full overflow-hidden object-cover md:max-h-full"
              />
            </div>
            <div className="my-8 flex flex-col gap-4 md:col-start-2 md:row-span-2 md:row-start-1 md:m-0">
              <h2 className="text-action-high-blue-france text-justify text-lg font-bold text-pretty">
                Zacharie accompagne les professionnels de la filière gibier sauvage – collecteurs,
                établissements de traitement et services vétérinaires d’inspection – dans la gestion et la
                transmission des fiches d’examen initial (FEI).
              </h2>
              <p className="text-justify font-normal text-pretty text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                Avec Zacharie, les FEI sont créées et transmises dans un{' '}
                <b>format numérique unique, sécurisé et traçable</b>, garantissant une circulation fluide et
                fiable de l’information tout au long de la chaîne de valorisation des viandes de gibier
                sauvage.
              </p>
              <p className="text-justify font-normal text-pretty text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                Zacharie est aujourd’hui la seule alternative officielle au support papier, et devient
                progressivement un <b>outil de référence</b> pour l’ensemble des acteurs de la filière.
              </p>
              <p className="text-justify font-normal text-pretty text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                Actuellement{' '}
                <b>
                  ouvert à tous les chasseurs, collecteurs professionnels et établissements de traitement du
                  gibier sauvage et services vétérinaires d’inspection
                </b>
                , Zacharie sera bientôt ouvert aux commerces de proximité dans le cadre de la vente directe.
              </p>
            </div>
          </section>
          <CTA mobile desktop />
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col md:gap-16">
            <div className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-1 md:gap-16">
              <div className="mx-auto h-full w-full overflow-hidden md:col-span-1 md:col-start-2 md:row-span-1">
                <img
                  src="/landing/morceaux-de-viande.png"
                  alt="Des morceaux de viande de gibier sauvage"
                  className="mx-auto max-h-[50vh] w-full object-cover md:max-h-[600px]"
                />
              </div>
              <div className="my-8 md:col-span-1 md:col-start-1 md:row-start-1">
                <h3 className="fr-h3 text-center text-balance md:text-right">
                  Quels bénéfices pour les professionnels&nbsp;?
                </h3>
                <ul className="mt-8 flex flex-col gap-2 md:gap-6 md:text-right">
                  <li className="ml-4 flex flex-col">
                    <h4 className="text-action-high-blue-france mb-1 text-lg font-bold">
                      Sécurité sanitaire renforcée
                    </h4>
                    <p className="ml-4 text-sm md:ml-0 md:text-base">
                      Des informations lisibles, fiables et complètes, directement transmises par les
                      chasseurs via des fiches numériques standardisées.
                    </p>
                  </li>
                  <li className="ml-4 flex flex-col">
                    <h4 className="text-action-high-blue-france mb-1 text-lg font-bold">
                      Traçabilité simplifiée
                    </h4>
                    <p className="mt-1 ml-4 text-sm md:ml-0 md:text-base">
                      Un archivage automatique et organisé des FEI, indispensable pour la conformité
                      réglementaire et la commercialisation des viandes de gibier.
                    </p>
                  </li>
                  <li className="ml-4 flex flex-col">
                    <h4 className="text-action-high-blue-france mb-1 text-lg font-bold">
                      Collaboration fluide
                    </h4>
                    <p className="mt-1 ml-4 text-sm md:ml-0 md:text-base">
                      Possibilité de partager, d’annoter et de mettre à jour les FEI en temps réel entre
                      collecteurs, établissements de traitement et services vétérinaires. Les décisions sur
                      les carcasses sont automatiquement transmises aux chasseurs.
                    </p>
                  </li>
                  <li className="ml-4 flex flex-col">
                    <h4 className="text-action-high-blue-france mb-1 text-lg font-bold">
                      Gain de temps et efficacité
                    </h4>
                    <p className="mt-1 ml-4 text-sm md:ml-0 md:text-base">
                      Fin des erreurs liées au papier et réduction des délais de transmission et des doubles
                      saisies.
                    </p>
                  </li>
                </ul>
                <CTA mobile />
              </div>
            </div>
          </section>
          <CTA mobile desktop />
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col items-center">
            <h2 className="fr-h2 text-action-high-blue-france text-center text-balance md:text-left">
              Comment ça marche&nbsp;?
              <br />
            </h2>
            <ul className="my-8 flex flex-col gap-8 md:max-w-[75%]">
              <li className="flex items-center gap-4">
                <p className="text-action-high-blue-france shrink-0 basis-20 pl-4 text-6xl font-bold md:text-8xl">
                  1
                </p>
                <div className="flex flex-col">
                  <p className="mt-1">Créez votre compte en quelques minutes.</p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="text-action-high-blue-france shrink-0 basis-20 pl-4 text-6xl font-bold md:text-8xl">
                  2
                </p>
                <div className="flex flex-col">
                  <p className="mt-1">
                    Informez vos partenaires (chasses, professionels) que vous acceptez désormais les fiches
                    numériques.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="text-action-high-blue-france shrink-0 basis-20 pl-4 text-6xl font-bold md:text-8xl">
                  3
                </p>
                <div className="flex flex-col">
                  <p className="mt-1">
                    Recevez et validez les fiches d’examen initial (FEI) qui vous sont adressées, en ajoutant
                    si besoin vos observations.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="text-action-high-blue-france shrink-0 basis-20 pl-4 text-6xl font-bold md:text-8xl">
                  4
                </p>
                <div className="flex flex-col">
                  <p className="mt-1">
                    Collaborez avec l’ensemble de la chaîne : chasseurs, collecteurs, établissements de
                    traitement et services vétérinaires accèdent aux mêmes informations, de façon claire et
                    fiable.
                  </p>
                </div>
              </li>
            </ul>
          </section>
          <CTA mobile />
          <hr className="mt-8 md:mt-24" />
          <section className="mt-8 w-full md:mt-24">
            <h2 className="fr-h2 text-action-high-blue-france mx-auto text-center text-balance">
              Quels sont les rôles de chaque acteurs de la chaîne&nbsp;?
              <br />
            </h2>
            <div className="-ml-6 w-screen md:ml-0 md:w-auto">
              <div className="ml-4 justify-center overflow-x-auto md:mx-auto md:ml-0 md:flex md:w-full">
                <SchemaPros className="hidden h-full w-full max-w-full min-w-[500px] shrink sm:block md:max-w-4xl" />
                <SchemaProsMobile className="mx-auto my-12 h-[900px] w-[300px] sm:hidden" />
              </div>
            </div>
          </section>
          <hr className="mt-8 md:mt-24" />

          <section className="py-16 lg:py-16">
            <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center lg:px-8 xl:px-[12%] 2xl:min-h-96">
              <h3 className="text-action-high-blue-france mb-8 rounded text-xl font-medium text-shadow-2xs lg:text-2xl 2xl:mb-16 2xl:text-4xl">
                Vous avez des questions ? Des remarques ?
              </h3>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  size="large"
                  linkProps={{
                    to: '/contact',
                  }}
                >
                  Nous contacter
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function CTA({ mobile, desktop }: { mobile?: boolean; desktop?: boolean }) {
  const user = useMostFreshUser('landing CTA');
  const isLoggedIn = !!user?.id;

  return (
    <div
      className={[
        'my-4 flex-col items-center justify-center gap-4 md:my-16',
        mobile && !desktop && 'flex md:hidden',
        !mobile && desktop && 'hidden md:flex',
        mobile && desktop && 'flex',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Button
        className="m-0"
        priority={isLoggedIn ? 'tertiary no outline' : 'primary'}
        linkProps={{
          to: isLoggedIn ? '/app/connexion' : '/app/connexion/creation-de-compte',
          href: '#',
        }}
      >
        {isLoggedIn ? 'Accéder à mon compte' : 'Créer un compte'}
      </Button>
    </div>
  );
}
