import { Button } from '@codegouvfr/react-dsfr/Button';
import VideoOverlay, { useVideo } from '@app/components/VideoOverlay';
import { trackEvent } from '@app/services/matomo';

export default function LandingPage() {
  const setVideoUrl = useVideo((state) => state.setVideoUrl);
  return (
    <>
      <title>
        Zacharie | Garantir des viandes de gibier sauvage saines et sûres | Ministère de l'Agriculture et de
        la Souveraineté Alimentaire
      </title>
      <main>
        {/* Hero Section */}
        <section className="min-h-96 bg-[#A38A6C] bg-[url('/landing/gradient-cerf.webp')] bg-cover bg-center bg-no-repeat py-16 pb-32 lg:min-h-[740px] lg:py-24 2xl:py-36">
          <div className="h-full w-full px-4 lg:px-8 xl:px-32 2xl:px-[12%]">
            <div className="grid h-full items-center gap-12 lg:grid-cols-2">
              <div className="flex h-full max-w-[75vw] flex-col justify-center sm:max-w-[50vw] 2xl:max-w-[35vw]">
                <h1 className="3xl:text-5xl text-2xl leading-tight font-bold text-white! text-shadow-xs lg:text-3xl 2xl:text-4xl">
                  Vous vendez ou cédez le gibier que vous chassez&nbsp;?
                </h1>
                <p className="3xl:text-4xl mt-8 text-2xl leading-tight font-bold text-white! text-shadow-xs lg:text-3xl 2xl:text-4xl">
                  Où que vous soyez, réalisez vos fiches d'examen initial du gibier directement depuis votre
                  smartphone ou votre ordinateur.
                </p>
                <p className="3xl:text-4xl mt-8 text-2xl leading-tight font-bold text-white! text-shadow-xs lg:mt-[6%] lg:text-3xl 2xl:text-4xl">
                  Simple, rapide et 100% gratuit, Zacharie accélère vos démarches.
                </p>
                <div className="mt-16 ml-6 flex items-center justify-start lg:hidden">
                  <button
                    onClick={() => {
                      trackEvent('landing', 'video_play', 'mobile');
                      setVideoUrl('https://www.youtube.com/embed/TkTd5P6S6ck');
                    }}
                    className="rounded-full transition-transform hover:scale-110 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#A38A6C] focus:outline-none"
                    aria-label="Regarder la vidéo de démonstration"
                  >
                    <svg
                      width="60"
                      height="60"
                      viewBox="0 0 85 85"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M68 42L30.5 63.6506L30.5 20.3494L68 42Z"
                        fill="white"
                      />
                      <circle
                        cx="42.5"
                        cy="42.5"
                        r="40"
                        stroke="white"
                        strokeWidth="5"
                      />
                    </svg>
                  </button>
                </div>
                <div className="mt-10 flex flex-col gap-4 md:flex-row">
                  <Button
                    size="large"
                    className="block"
                    linkProps={{
                      to: '/app/connexion/creation-de-compte',
                      href: '#',
                      onClick: () => trackEvent('landing', 'cta_creer_compte'),
                    }}
                  >
                    Créer un compte
                  </Button>
                  <Button
                    size="large"
                    priority="secondary"
                    className="block border-white bg-white shadow-none!"
                    linkProps={{
                      to: '/app/connexion',
                      href: '#',
                      onClick: () => trackEvent('landing', 'cta_se_connecter'),
                    }}
                  >
                    Se connecter
                  </Button>
                </div>
              </div>
              <div className="hidden items-center justify-center lg:flex lg:max-w-[50vw]">
                <button
                  onClick={() => {
                    trackEvent('landing', 'video_play', 'desktop');
                    setVideoUrl('https://www.youtube.com/embed/TkTd5P6S6ck');
                  }}
                  className="rounded-full transition-transform hover:scale-110 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#A38A6C] focus:outline-none"
                  aria-label="Regarder la vidéo de démonstration"
                >
                  <svg
                    width="85"
                    height="85"
                    viewBox="0 0 85 85"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M68 42L30.5 63.6506L30.5 20.3494L68 42Z"
                      fill="white"
                    />
                    <circle
                      cx="42.5"
                      cy="42.5"
                      r="40"
                      stroke="white"
                      strokeWidth="5"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative grid items-center bg-white lg:flex">
          <div className="relative z-10 -mt-8 flex justify-start lg:-mt-16 lg:basis-1/2 2xl:basis-1/3">
            {/* Phone mockup */}
            <img
              src="/landing/MAIN APPLI_TBD.webp"
              alt="Mockup de l'application Zacharie sur smartphone"
              className="h-1/4 w-full max-w-lg 2xl:max-w-3xl"
            />
          </div>
          <div className="bg-action-high-blue-france/5 flex flex-col space-y-6 p-6 lg:basis-1/2 lg:bg-transparent 2xl:basis-2/3 2xl:py-20 2xl:pr-32 2xl:pl-64">
            <ul className="text-action-high-blue-france list-none space-y-4 text-lg text-balance lg:text-xl 2xl:text-2xl">
              <li>
                Une application qui fonctionne <b>même hors réseau</b>.
              </li>
              <li>
                Toute la chasse du jour sur <b>une seule fiche</b>, peu importe le nombre de carcasses ou
                d'espèces.
              </li>
              <li>
                Des <b>informations pré-enregistrées</b> pour un remplissage rapide et complet à coup sûr.
              </li>
              <li>
                Un <b>retour clair et direct</b> sur les carcasses traitées et inspectées.
              </li>
              <li>
                Un service public <b>gratuit et sans engagement</b>.
              </li>
            </ul>
            <div className="my-8 flex w-full flex-col items-center gap-4 md:items-start">
              <Button
                size="large"
                linkProps={{
                  href: 'https://zcal.co/zacharie/demo',
                  onClick: () => trackEvent('landing', 'cta_demo', 'features'),
                }}
              >
                Participer à une démo
              </Button>
              <div className="flex items-center gap-3 lg:hidden">
                <a
                  href="https://apps.apple.com/fr/app/id6753714911"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent('landing', 'app_store')}
                  style={{ backgroundImage: 'none' }}
                  className="inline-block border-none transition-opacity after:content-none hover:opacity-80"
                >
                  <img
                    src="/landing/download-on-the-app-store.svg"
                    alt="Télécharger sur l'App Store"
                    className="h-10 w-auto"
                  />
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=fr.gouv.zacharie.v1"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent('landing', 'google_play')}
                  style={{ backgroundImage: 'none' }}
                  className="inline-block transition-opacity after:content-none hover:opacity-80"
                >
                  <img
                    src="/landing/badge-google-play.png"
                    alt="Disponible sur Google Play"
                    className="h-12 w-auto"
                  />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="bg-[url('/landing/testimonials-bg.webp')] bg-cover bg-center bg-no-repeat py-12">
          <div className="h-full w-full px-4 lg:px-8 xl:px-[12%]">
            <div className="grid gap-8 lg:grid-cols-2 2xl:gap-30">
              {[
                {
                  quote:
                    'En un clic, je transmets ma fiche et je sais rapidement si une carcasse est saisie.',
                  author: 'Chasseur valorisant son gibier',
                },
                {
                  quote:
                    "J'ai rempli une fiche d'examen initial en quelques minutes alors que ça m'aurait pris 1 heure avec le carnet à souches.",
                  author: 'Chasseur examinateur initial',
                },
              ].map(({ quote, author }) => {
                return (
                  <blockquote
                    className="relative p-4"
                    key={quote}
                  >
                    <p className="text-action-high-blue-france mb-4 text-center text-lg text-balance lg:text-xl 2xl:text-2xl">
                      <span className="text-action-high-blue-france/30 absolute -top-4 -left-4 text-[128px] font-normal italic 2xl:-top-8 2xl:-left-8">
                        "
                      </span>
                      {quote}
                    </p>
                    <footer className="text-action-high-blue-france text-center text-base">— {author}</footer>
                  </blockquote>
                );
              })}
            </div>
          </div>
        </section>

        {/* Partenaires de valorisation Section */}
        <section className="bg-action-high-blue-france/5 py-8">
          <div className="w-full px-4 lg:px-8 xl:px-32 2xl:px-[12%]">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="flex flex-col gap-8">
                <h2 className="text-action-high-blue-france text-2xl leading-tight font-bold text-balance lg:text-right lg:text-3xl 2xl:text-4xl">
                  En quelques clics, transmettez vos fiches d'examen initial à tous vos partenaires de
                  valorisation.
                </h2>
                <ul className="text-action-high-blue-france list-none space-y-1 text-lg lg:text-right lg:text-xl 2xl:text-2xl">
                  <li>Collecteurs professionnels</li>
                  <li>Établissements de traitement du gibier</li>
                  <li>Restaurateurs</li>
                  <li>Bouchers</li>
                  <li>Associations</li>
                  <li>Particuliers</li>
                </ul>
                <div className="flex justify-center lg:justify-end">
                  <Button
                    size="large"
                    linkProps={{
                      to: '/demarches',
                      onClick: () => trackEvent('landing', 'cta_demarches'),
                    }}
                  >
                    Comprendre les démarches
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <img
                  src="/landing/collecteur-camion.png"
                  alt="Un collecteur professionnel chargeant du gibier dans son camion"
                  className="aspect-square w-full rounded object-cover"
                />
                <img
                  src="/landing/carcasses-chambre-froide.png"
                  alt="Des carcasses de gibier suspendues en chambre froide"
                  className="aspect-square w-full rounded object-cover"
                />
                <img
                  src="/landing/cuisinier-decoupe.png"
                  alt="Un cuisinier découpant de la viande de gibier"
                  className="aspect-square w-full rounded object-cover"
                />
                <img
                  src="/landing/plat-gibier.png"
                  alt="Un plat de gibier dressé à l'assiette"
                  className="aspect-square w-full rounded object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Répartition des carcasses Section */}
        <section className="grid items-stretch bg-white bg-[url('/landing/testimonials-bg.webp')] bg-cover bg-center bg-no-repeat lg:grid-cols-2">
          <div className="min-h-72">
            <img
              src="/landing/chasseurs-chiens.png"
              alt="Des chasseurs en gilets orange marchant avec leurs chiens"
              className="size-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-center gap-6 p-8 lg:p-16 2xl:px-32">
            <h2 className="text-action-high-blue-france text-2xl leading-tight font-bold text-balance lg:text-3xl 2xl:text-4xl">
              Après la chasse, vous répartissez vos carcasses entre différents partenaires&nbsp;?
            </h2>
            <p className="text-action-high-blue-france text-lg text-pretty lg:text-xl 2xl:text-2xl">
              Avec Zacharie, vous pouvez répartir vos carcasses depuis une seule fiche d'examen initial. En
              quelques clics, vous indiquez à qui vous céder vos carcasses et adaptez la répartition au fil de
              vos ventes.
            </p>
            <p className="text-action-high-blue-france text-lg text-pretty lg:text-xl 2xl:text-2xl">
              Les destinataires sont immédiatement informés&nbsp;! Tout devient simple, rapide et sécurisé.
            </p>
            <div className="flex justify-center lg:justify-start">
              <Button
                size="large"
                linkProps={{
                  href: 'https://zcal.co/zacharie/demo',
                  onClick: () => trackEvent('landing', 'cta_demo', 'repartition'),
                }}
              >
                Participer à une démo
              </Button>
            </div>
          </div>
        </section>

        {/* Le saviez-vous Section */}
        <section className="grid items-stretch lg:grid-cols-2">
          <div className="bg-action-high-blue-france/5 flex flex-col justify-center gap-6 p-8 text-center lg:p-16 2xl:px-32">
            <h2 className="text-action-high-blue-france text-2xl font-bold lg:text-right lg:text-3xl 2xl:text-4xl">
              Le saviez-vous&nbsp;?
            </h2>
            <p className="text-action-high-blue-france text-lg text-pretty lg:text-right lg:text-xl 2xl:text-2xl">
              Le rinçage à grande eau peut diffuser les bactéries au lieu de les éliminer, même si la carcasse
              paraît propre.
            </p>
            <div className="flex justify-center lg:justify-end">
              <Button
                size="large"
                linkProps={{
                  to: '/quiz',
                  onClick: () => trackEvent('landing', 'cta_quiz'),
                }}
              >
                Testez vos connaissances
              </Button>
            </div>
          </div>
          <div className="min-h-72">
            <img
              src="/landing/bacteries-microscope.png"
              alt="Des bactéries observées au microscope"
              className="size-full object-cover"
            />
          </div>
        </section>

        {/* Contact Section */}
        <section className="bg-[url('/landing/testimonials-bg.webp')] bg-cover bg-center bg-no-repeat py-16 lg:py-24">
          <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center lg:px-8 xl:px-[12%] 2xl:min-h-96">
            <h3 className="text-action-high-blue-france mb-8 rounded text-2xl font-medium text-shadow-2xs lg:text-3xl 2xl:mb-16 2xl:text-4xl">
              Vous avez des questions ? Vous voulez être accompagné ?
            </h3>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="large"
                linkProps={{
                  to: '/contact',
                  onClick: () => trackEvent('landing', 'cta_contact'),
                }}
              >
                Nous contacter
              </Button>
            </div>
          </div>
        </section>
      </main>
      <VideoOverlay />
    </>
  );
}
