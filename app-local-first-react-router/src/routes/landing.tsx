import { Button } from '@codegouvfr/react-dsfr/Button';
import VideoOverlay, { useVideo } from '@app/components/VideoOverlay';

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
        <section className="min-h-96 bg-[#A38A6C] bg-[url('/landing/gradient-cerf.png')] bg-cover bg-center bg-no-repeat py-16 lg:min-h-auto lg:py-24 2xl:py-36">
          <div className="h-full w-full px-4 lg:px-8 xl:px-32 2xl:px-[12%]">
            <div className="grid h-full items-center gap-12 lg:grid-cols-2">
              <div className="flex h-full max-w-[75vw] flex-col justify-center sm:max-w-[50vw] 2xl:max-w-[35vw]">
                <h1 className="3xl:text-5xl text-2xl leading-tight font-bold text-white! text-shadow-xs lg:text-3xl 2xl:text-4xl">
                  Réalisez vos fiches d'examen initial du gibier directement depuis votre smartphone ou votre
                  ordinateur, où que vous soyez.
                </h1>
                <p className="3xl:text-5xl mt-8 text-2xl leading-tight font-bold text-white! text-shadow-xs lg:mt-[10%] lg:text-3xl 2xl:text-4xl">
                  Simple, rapide et 100% gratuit, Zacharie accélère vos démarches.
                </p>
                <div className="mt-16 ml-6 flex items-center justify-start lg:hidden">
                  <button
                    onClick={() => setVideoUrl('https://www.youtube.com/embed/TkTd5P6S6ck')}
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
                      <path d="M68 42L30.5 63.6506L30.5 20.3494L68 42Z" fill="white" />
                      <circle cx="42.5" cy="42.5" r="40" stroke="white" strokeWidth="5" />
                    </svg>
                  </button>
                </div>
                <Button
                  size="large"
                  className="mt-8 block lg:mt-[10%]"
                  linkProps={{
                    to: '/app/connexion/creation-de-compte',
                    href: '#',
                  }}
                >
                  Créer un compte
                </Button>
                <Button
                  size="large"
                  priority="secondary"
                  className="mt-4 block border-white bg-white shadow-none!"
                  linkProps={{
                    to: '/app/connexion',
                    href: '#',
                  }}
                >
                  Se connecter
                </Button>
              </div>
              <div className="hidden items-center justify-center lg:flex lg:max-w-[50vw]">
                <button
                  onClick={() => setVideoUrl('https://www.youtube.com/embed/TkTd5P6S6ck')}
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
                    <path d="M68 42L30.5 63.6506L30.5 20.3494L68 42Z" fill="white" />
                    <circle cx="42.5" cy="42.5" r="40" stroke="white" strokeWidth="5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative grid items-center bg-white lg:flex">
          <div className="relative z-10 -mt-16 flex justify-start lg:-mt-24 lg:basis-1/2 2xl:basis-1/3">
            {/* Phone mockup */}
            <img
              src="/landing/main-app-mockup.png"
              alt="Mockup de l'application Zacharie sur smartphone"
              className="h-1/4 w-full max-w-lg 2xl:max-w-3xl"
            />
          </div>
          <div className="bg-action-high-blue-france/5 flex flex-col space-y-6 p-6 lg:basis-1/2 lg:bg-transparent 2xl:basis-2/3 2xl:py-20 2xl:pr-32 2xl:pl-64">
            <ul className="text-action-high-blue-france list-none space-y-4 text-lg text-balance 2xl:text-3xl">
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
                }}
              >
                Participer à une démo
              </Button>
              <div className="flex items-center gap-3 lg:hidden">
                <a
                  href="https://apps.apple.com/fr/app/id6753714911"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundImage: 'none' }}
                  className="inline-block border-none transition-opacity after:content-none hover:opacity-80"
                >
                  <img
                    src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                    alt="Télécharger sur l'App Store"
                    className="h-10 w-auto"
                  />
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=fr.gouv.zacharie.v1"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundImage: 'none' }}
                  className="inline-block transition-opacity after:content-none hover:opacity-80"
                >
                  <img
                    src="https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png"
                    alt="Disponible sur Google Play"
                    className="h-12 w-auto"
                  />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="bg-[url('/landing/testimonials-bg.png')] bg-cover bg-center bg-no-repeat py-16 lg:py-24 2xl:py-32">
          <div className="h-full w-full pl-4 lg:pl-8 xl:px-[12%]">
            <div className="grid items-center gap-12 lg:flex">
              {/* Left side - 100% text */}
              <div className="text-center lg:basis-1/2 lg:text-left">
                <p className="text-action-high-blue-france mb-4 text-6xl font-bold lg:text-8xl">100%</p>
                <p className="text-action-high-blue-france mb-4 text-xl lg:text-2xl 2xl:max-w-[75%] 2xl:text-4xl">
                  des chasseurs ayant utilisé Zacharie recommandent l'application.
                </p>
                <p className="text-action-high-blue-france">Enquête de février 2025</p>
              </div>

              {/* Right side - testimonials */}
              <div className="grid gap-8 lg:basis-1/2 2xl:gap-30">
                {[
                  'En un clic, je transmets ma fiche et je sais tout de suite si une carcasse est saisie.',
                  "J'ai rempli une fiche d'examen initial en 15 minutes alors que ça m'aurait pris 1 heure avec le carnet à souches.",
                ].map((quote) => {
                  return (
                    <blockquote className="relative p-6" key={quote}>
                      <p className="text-action-high-blue-france mb-4 text-2xl 2xl:text-4xl">
                        <span className="text-action-high-blue-france/30 absolute -top-4 -left-4 text-[128px] font-normal italic 2xl:-top-8 2xl:-left-8 2xl:text-[180px]">
                          "
                        </span>
                        {quote}
                        <span className="text-action-high-blue-france/30 absolute inline-block h-0 w-0 -translate-x-10 translate-y-15 text-[128px] leading-0 font-normal italic 2xl:translate-y-20 2xl:text-[180px]">
                          "
                        </span>
                      </p>
                    </blockquote>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Desktop Additional Content */}
        <section className="bg-action-high-blue-france/5 flex h-screen flex-col justify-between bg-[url('/landing/laptop-scene-2.png')] bg-cover bg-center bg-no-repeat lg:h-auto lg:min-h-0 lg:flex-row lg:bg-none">
          <div className="flex basis-full flex-col items-center justify-between space-y-12 p-8 lg:justify-center lg:p-16 2xl:space-y-24">
            <h3 className="lg:text-action-high-blue-france rounded text-center text-xl font-medium text-balance text-white text-shadow-2xs lg:text-2xl 2xl:text-4xl">
              Votre compte Zacharie est aussi accessible depuis votre ordinateur.
            </h3>
            <Button
              size="large"
              linkProps={{
                to: '/app/connexion/creation-de-compte',
                href: '#',
              }}
            >
              Créer un compte
            </Button>
          </div>
          <div className="hidden max-w-2xl justify-end lg:block 2xl:max-w-5xl">
            <img
              src="/landing/laptop-scene-1.png"
              alt="Interface desktop de Zacharie"
              className="hidden size-full object-fill lg:block"
            />
          </div>
        </section>

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
      </main>
      <VideoOverlay />
    </>
  );
}
