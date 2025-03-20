import { Button } from '@codegouvfr/react-dsfr/Button';
import RootDisplay from '@app/components/RootDisplay';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';

export default function LandingPage() {
  return (
    <RootDisplay id="landing">
      <main className="fr-container my-auto flex min-h-[50vh] flex-col justify-center">
        <div className="fr-grid-row fr-grid-row--gutters fr-py-6w my-auto flex flex-col justify-center">
          <h1 className="fr-h1 text-balance text-center">
            Le service numérique officiel pour tracer les infos sanitaires des viandes de gibier sauvage
          </h1>
          <CTA mobile />
          <section className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-2 md:gap-16">
            <div className="mx-auto h-full w-full overflow-hidden md:col-span-1 md:row-span-2">
              <img
                src="/landing/cerf.png"
                alt="Un cerf qui vous regarde droit dans les yeux avec de beaux bois"
                className="h-full max-h-[50vh] w-full overflow-hidden object-cover md:max-h-full"
              />
            </div>
            <div className="my-8 md:col-start-2 md:row-start-1 md:m-0">
              <h3 className="fr-h3 text-center">Obligation de tracer</h3>
              <p className="text-pretty text-justify font-normal text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                En France, les chasseurs qui souhaitent <b>vendre ou céder</b> leurs carcasses sont dans l'
                <b>obligation de transmettre l'ensemble des données sanitaires</b> (identification de
                l'animal, lésions possibles comportement anormal, etc.) et les <b>données de traçabilité</b>{' '}
                (lieu de mise à mort, date, acteurs qui prennent en charge la carcasse, etc.) associées à ces
                carcasses. Ces informations sont consignées sur un document papier qui suit la carcasse&nbsp;:
                c'est la fiche d'accompagnement du gibier sauvage.
              </p>
            </div>
            <hr className="m-4 md:hidden" />
            <div className="my-8 md:col-start-2 md:row-start-2 md:m-0">
              <h3 className="fr-h3 text-center">Simplifiez vos démarches</h3>
              <p className="text-pretty text-justify font-normal text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                Zacharie est un <b>service public gratuit</b> pour ses utilisateurs, conçu pour les chasseurs
                et les acteurs de la filière de valorisation des viandes de gibier sauvage. Zacharie permet de
                créer des <b>fiche d'accompagnement du gibier sauvage</b> en un{' '}
                <b>format numérique unique, partagé, modifiable et traçable</b> par tous les acteurs de la
                filière.
                <br />
                Zacharie est une <b>alternative officielle et numérique</b> à la démarche réalisée aujourd'hui
                sur papier.
              </p>
            </div>
          </section>
          <CTA mobile desktop />
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col md:gap-16">
            <h2 className="fr-h2 text-balance text-center md:text-left">Pourquoi choisir Zacharie&nbsp;?</h2>
            <div className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-1 md:gap-16">
              <div className="mx-auto h-full w-full overflow-hidden md:col-span-1 md:col-start-2 md:row-span-1">
                <img
                  src="/landing/chasseur.png"
                  alt="Un chasseur à l'affut avec un fusil à lunette"
                  className="mx-auto max-h-[50vh] w-full object-cover"
                />
              </div>
              <div className="my-8 md:col-span-1 md:col-start-1 md:row-start-1">
                <h3 className="fr-h3 text-balance text-center md:text-right">Pour les chasseurs</h3>
                <ul className="mt-8 flex flex-col gap-2 md:gap-6 md:text-right">
                  <li className="ml-4 flex flex-col">
                    <h4 className="text-lg font-bold">Simplification des déclarations</h4>
                    <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                      Créez et gérez vos fiches en quelques clics.
                    </p>
                  </li>
                  <li className="ml-4 flex flex-col">
                    <h4 className="text-lg font-bold">Suivi de vos carcasses</h4>
                    <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                      Suivez la prise en charge de vos carcasses et soyez informé en cas de saisies
                      sanitaires.
                    </p>
                  </li>
                  <li className="ml-4 flex flex-col">
                    <h4 className="text-lg font-bold">Conformité et sécurité</h4>
                    <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                      Assurez-vous de transmettre les informations sanitaires utiles à la sécurité des
                      viandes.
                    </p>
                  </li>
                </ul>
                <CTA mobile />
              </div>
            </div>
            <hr className="mx-8 my-4 md:hidden" />
            <div className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-1 md:gap-16">
              <div className="mx-auto h-full w-full overflow-hidden md:col-span-1 md:col-start-1 md:row-span-1">
                <img
                  src="/landing/inspection-svi.png"
                  alt="Un vétérinaire en train de faire une inspection de carcasse"
                  className="mx-auto max-h-[50vh] w-full object-cover"
                />
              </div>
              <div className="my-8 md:col-span-1 md:col-start-2 md:row-start-1">
                <h3 className="fr-h3 text-balance text-center md:text-left">
                  Pour les acteurs pros de la filière
                </h3>
                <ul className="flex flex-col gap-2 md:gap-6">
                  <li className="ml-4 flex flex-col md:ml-0">
                    <h4 className="text-lg font-bold">Meilleure maîtrise du risque</h4>
                    <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                      Garantissez la sécurité sanitaire des aliments via une donnée sanitaire de qualité.
                    </p>
                  </li>
                  <li className="ml-4 flex flex-col md:ml-0">
                    <h4 className="text-lg font-bold">Amélioration de la traçabilité</h4>
                    <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                      Consignez les données de traçabilité des viandes requises pour leur commercialisation.
                    </p>
                  </li>
                  <li className="ml-4 flex flex-col md:ml-0">
                    <h4 className="text-lg font-bold">Collaboration efficace</h4>
                    <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                      Partagez et modifiez les fiche d'accompagnement du gibier en toute simplicité.
                    </p>
                  </li>
                </ul>
              </div>
            </div>
          </section>
          <CTA mobile desktop />
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col">
            <h2 className="fr-h2 text-balance text-center md:text-left">
              Comment ça marche&nbsp;?
              <br />
              <span className="font-normal">Côté chasseur</span>
            </h2>
            <ul className="my-8 flex flex-col gap-8 md:max-w-[75%]">
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-400">1</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold md:text-2xl">Inscription</h4>
                  <p className="mt-1">
                    Créez votre compte en quelques minutes et renseignez vos rôles dans la filière&nbsp;:
                    chasseur, examinateur ou encore centre de collecte.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-600">2</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold md:text-2xl">
                    Création d'une fiche d'accompagnement du gibier sauvage
                  </h4>
                  <p className="mt-1">
                    Remplissez ou faites remplir vos fiches puis soumettez-les à vos partenaires en un clic.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-800">3</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold md:text-2xl">Retours et confirmation</h4>
                  <p className="mt-1">
                    Vous verrez la bonne réception de vos carcasses chez vos partenaires et le bilan du
                    contrôle des services vétérinaires d'inspection.
                  </p>
                </div>
              </li>
            </ul>
          </section>
          <CTA mobile />
          <hr className="mt-8 md:hidden" />
          <section className="mt-8 flex flex-col">
            <h2 className="fr-h2 text-balance text-center md:text-right">
              Comment ça marche&nbsp;?
              <br />
              <span className="font-normal">Côté pros de la filière</span>
            </h2>
            <ul className="my-8 flex flex-col gap-8 md:ml-auto md:max-w-[75%]">
              <li className="flex items-center gap-4 md:flex-row-reverse md:text-right">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-400">1</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold md:text-2xl">Inscription</h4>
                  <p className="mt-1">
                    Créez votre compte en quelques minutes et renseignez vos partenaires de valorisation.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4 md:flex-row-reverse md:text-right">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-600">2</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold md:text-2xl">Réception et validation des fiches</h4>
                  <p className="mt-1">
                    Vous verrez toutes les fiches qui vous seront attribuées et pourrez les annoter suivant
                    vos observations.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4 md:flex-row-reverse md:text-right">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-800">3</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold md:text-2xl">Collaboration</h4>
                  <p className="mt-1">
                    Partagez et modifiez les fiches avec les autres acteurs de la filière.
                  </p>
                </div>
              </li>
            </ul>
          </section>
          <CTA mobile desktop />
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-5 md:gap-x-16 md:gap-y-4">
            <h2 className="fr-h2 text-balance text-center md:col-start-1 md:row-span-1 md:row-start-1 md:text-left">
              Vers une valorisation plus performante
            </h2>
            <div className="mx-auto h-full w-full overflow-hidden md:col-span-1 md:col-start-2 md:row-span-5 md:row-start-1">
              <img
                src="/landing/viande.png"
                alt="Une bone pièce de viande appétissante"
                className="fr-mx-auto max-h-[600px] w-full object-cover"
              />
            </div>
            <div className="my-8 md:col-start-1 md:row-span-4 md:row-start-2">
              <ul className="mt-8 flex flex-col gap-2">
                <li className="ml-4 flex flex-col md:ml-0">
                  <h4 className="text-lg font-bold">Amélioration de la qualité sanitaire</h4>
                  <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                    Des viandes commercialisées plus sûres et conformes aux normes sanitaires.
                  </p>
                </li>
                <li className="ml-4 flex flex-col md:ml-0">
                  <h4 className="text-lg font-bold">Réduction du gaspillage alimentaire</h4>
                  <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                    Une meilleure traçabilité des carcasses pour limiter les saisies en établissements de
                    traitement du gibier sauvage.
                  </p>
                </li>
                <li className="ml-4 flex flex-col md:ml-0">
                  <h4 className="text-lg font-bold">Une confiance restaurée</h4>
                  <p className="ml-4 mt-1 text-sm md:ml-0 md:text-base">
                    Des données sanitaires plus fiables c'est aussi des professionnels de la filière plus
                    confiants dans la qualité des viandes.
                  </p>
                </li>
              </ul>
              <CTA mobile />
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
                  href: `mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de Zacharie`,
                }}
              >
                Contactez-nous
              </Button>
            </div>
          </section>
        </div>
      </main>
    </RootDisplay>
  );
}

function CTA({ mobile, desktop }: { mobile?: boolean; desktop?: boolean }) {
  const user = useMostFreshUser('landing CTA');
  const isLoggedIn = !!user?.id;

  return (
    <div
      className={[
        'my-4 items-center justify-center md:my-16',
        mobile && !desktop && 'flex md:hidden',
        !mobile && desktop && 'hidden md:flex',
        mobile && desktop && 'flex',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Button
        className="m-0"
        linkProps={{
          // to: "/app/connexion?type=creation-de-compte",
          // to: isLoggedIn ? '/app/connexion?type=compte-existant' : '/beta-testeurs',
          to: '/app/connexion?type=compte-existant',
          href: '#',
        }}
      >
        {isLoggedIn ? 'Accéder à mon compte' : 'Se connecter'}
      </Button>
    </div>
  );
}
