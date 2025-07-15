import { Button } from '@codegouvfr/react-dsfr/Button';
import RootDisplay from '@app/components/RootDisplay';

export default function LandingPage() {
  return (
    <RootDisplay id="landing">
      <main>
        {/* Hero Section */}
        <section
          className="bg-cover bg-center bg-no-repeat py-16 lg:py-24"
          style={{ backgroundImage: "url('/landing/gradient-cerf.png')" }}
        >
          <div className="fr-container">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="max-w-[75%] space-y-8">
                <h1 className="text-xl font-bold leading-tight text-white lg:text-3xl">
                  Réalisez vos fiches d'examen initial du gibier directement depuis votre smartphone ou votre
                  ordinateur, où que vous soyez.
                </h1>
                <p className="text-xl font-bold leading-relaxed text-white lg:text-3xl">
                  Simple, rapide et 100% gratuit, Zacharie accélère vos démarches.
                </p>
                <div className="flex flex-col gap-4">
                  <Button
                    size="large"
                    linkProps={{
                      to: '/app/connexion?type=compte-existant',
                      href: '#',
                    }}
                  >
                    Créer un compte
                  </Button>
                  <Button
                    size="large"
                    priority="secondary"
                    className="border-white bg-white shadow-none!"
                    linkProps={{
                      to: '/app/connexion?type=compte-existant',
                      href: '#',
                    }}
                  >
                    Se connecter
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-white py-16 lg:py-24">
          <div className="fr-container">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="flex justify-center">
                {/* Phone mockup */}
                <img
                  src="/landing/main-app-mockup.png"
                  alt="Mockup de l'application Zacharie sur smartphone"
                  className="h-auto w-80 max-w-full"
                />
              </div>
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-blue-900 lg:text-4xl">
                  Une application qui fonctionne même hors réseau
                </h2>
                <ul className="space-y-4 text-lg text-blue-900">
                  <li className="flex items-start gap-3">
                    <span className="text-xl text-blue-600">•</span>
                    Toute la chasse du jour sur une seule fiche, peu importe le nombre de carcasses ou
                    d'espèces
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-xl text-blue-600">•</span>
                    Des informations pré-enregistrées pour un remplissage rapide et complet à coup sûr
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-xl text-blue-600">•</span>
                    Un retour clair et direct sur les carcasses traitées et inspectées
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-xl text-blue-600">•</span>
                    Un service public gratuit et sans engagement
                  </li>
                </ul>
                <Button
                  size="large"
                  linkProps={{
                    to: '/app/connexion?type=compte-existant',
                    href: '#',
                  }}
                >
                  ▷ Regarder la démo
                </Button>
              </div>
            </div>
            <div className="mt-12 text-center">
              <p className="text-lg text-blue-900">
                Le service est aussi disponible depuis votre ordinateur.
              </p>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section
          className="bg-cover bg-center bg-no-repeat py-16 lg:py-24"
          style={{ backgroundImage: "url('/landing/testimonials-bg.png')" }}
        >
          <div className="fr-container">
            <div className="mb-12 text-center">
              <div className="mb-4 text-6xl font-bold text-blue-900 lg:text-8xl">100%</div>
              <p className="mb-2 text-xl text-blue-900 lg:text-2xl">
                des chasseurs ayant utilisé Zacharie recommandent l'application
              </p>
              <p className="text-gray-600">Enquête de février 2025</p>
            </div>

            <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
              <blockquote className="relative rounded-lg bg-white p-6 shadow-xs">
                <div
                  className="absolute -left-4 -top-4"
                  style={{
                    width: '78px',
                    height: '89px',
                    fontFamily: 'Marianne',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '128px',
                    lineHeight: '125%',
                    color: 'rgba(1, 0, 139, 0.3)',
                  }}
                >
                  "
                </div>
                <p className="mb-4 text-lg text-blue-900">
                  En un clic, je transmets ma fiche et je sais tout de suite si une carcasse est saisie.
                </p>
                <div
                  className="absolute -bottom-4 -right-4"
                  style={{
                    width: '78px',
                    height: '89px',
                    fontFamily: 'Marianne',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '128px',
                    lineHeight: '125%',
                    color: 'rgba(1, 0, 139, 0.3)',
                  }}
                >
                  "
                </div>
              </blockquote>

              <blockquote className="relative rounded-lg bg-white p-6 shadow-xs">
                <div
                  className="absolute -left-4 -top-4"
                  style={{
                    width: '78px',
                    height: '89px',
                    fontFamily: 'Marianne',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '128px',
                    lineHeight: '125%',
                    color: 'rgba(1, 0, 139, 0.3)',
                  }}
                >
                  "
                </div>
                <p className="mb-4 text-lg text-blue-900">
                  J'ai rempli une fiche d'examen initial en 15 minutes alors que ça m'aurait pris 1 heure avec
                  le carnet à souches.
                </p>
                <div
                  className="absolute -bottom-4 -right-4"
                  style={{
                    width: '78px',
                    height: '89px',
                    fontFamily: 'Marianne',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '128px',
                    lineHeight: '125%',
                    color: 'rgba(1, 0, 139, 0.3)',
                  }}
                >
                  "
                </div>
              </blockquote>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-blue-900 py-16 lg:py-24">
          <div className="fr-container text-center">
            <h2 className="mb-8 text-3xl font-bold text-white lg:text-4xl">
              Vous avez des questions ? Des remarques ?
            </h2>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                priority="secondary"
                size="large"
                linkProps={{
                  href: 'mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de Zacharie',
                }}
              >
                Nous contacter
              </Button>
              <Button
                size="large"
                linkProps={{
                  to: '/app/connexion?type=compte-existant',
                  href: '#',
                }}
              >
                Créer votre compte
              </Button>
            </div>
          </div>
        </section>

        {/* Desktop Additional Content */}
        <section className="hidden bg-gray-50 py-16 lg:block">
          <div className="fr-container">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="space-y-6">
                <h3 className="rounded bg-blue-900 p-4 text-2xl font-bold text-white">
                  Votre compte Zacharie est aussi accessible depuis votre ordinateur
                </h3>
              </div>
              <div className="flex justify-center">
                {/* Desktop screenshot mockup */}
                <img
                  src="/landing/laptop-scene-1.png"
                  alt="Interface desktop de Zacharie"
                  className="h-auto w-full max-w-2xl"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </RootDisplay>
  );
}
