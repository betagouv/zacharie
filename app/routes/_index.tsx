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
      <main className="fr-container my-auto flex min-h-[50vh] flex-col justify-center">
        <div className="fr-grid-row fr-grid-row--gutters fr-py-6w my-auto flex flex-col justify-center">
          <h1 className="fr-h1 text-balance text-center">
            Le service numérique officiel pour tracer les infos sanitaires des viandes de gibier sauvage
          </h1>
          <CTA />
          <section className="mt-8 flex flex-col">
            <img
              src="/landing/cerf.png"
              alt="Un cerf qui vous regarde droit dans les yeux avec de beaux bois"
              className="mx-auto max-h-[50vh] w-full object-cover"
            />
            <div className="my-8">
              <h3 className="fr-h3 text-center">Obligation de tracer</h3>
              <p className="text-pretty text-justify font-normal text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                En France, les chasseurs qui souhaitent <b>vendre ou céder</b> leurs carcasses sont dans l'
                <b>obligation de transmettre l'ensemble des données sanitaires</b> (identification de l'animal, lésions
                possibles comportement anormal, etc.) et les <b>données de traçabilité</b> (lieu de mise à mort, date,
                acteurs qui prennent en charge la carcasse, etc.). Ces information sont consignées sur un document
                papier qui suit la carcasse : c'est la fiche d'accompagnement du gibier sauvage appelée aussi la fiche
                d'examen initial ou (FEI).
              </p>
            </div>
            <hr className="m-4" />
            <div className="my-8">
              <h3 className="fr-h3 text-center">Simplifiez vos démarches</h3>
              <p className="text-pretty text-justify font-normal text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                Zacharie est un <b>service public gratuit</b> pour ses utilisateurs conçu pour les chasseurs et les
                acteurs de la filière de valorisation des viandes de gibier sauvage. Zacharie permet de créer des{" "}
                <b>fiches d'examen initial (FEI)</b> en un{" "}
                <b>format numérique unique, partagé, modifiable et traçable</b> par tous les acteurs de la filière.
                <br />
                Zacharie est une <b>alternative officielle et numérique</b> à la démarche réalisée aujourd'hui sur
                papier.
              </p>
            </div>
          </section>
          <CTA />
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col">
            <h2 className="fr-h2 text-balance text-center">Pourquoi choisir Zacharie&nbsp;?</h2>
            <img
              src="/landing/chasseur.png"
              alt="Un chasseur à l'affut avec un fusil à lunette"
              className="mx-auto max-h-[50vh] w-full object-cover"
            />
            <div className="my-8">
              <h3 className="fr-h3 text-balance text-center">Pour les chasseurs</h3>
              <ul className="mt-8 flex flex-col gap-2">
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Simplification des déclarations</h4>
                  <p className="ml-4 mt-1 text-sm">Créez et gérez vos fiches d'examen initial en quelques clics.</p>
                </li>
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Suivi de vos carcasses</h4>
                  <p className="ml-4 mt-1 text-sm">
                    Suivez la prise en charge de vos carcasses et soyez informé en cas de saisies sanitaires.
                  </p>
                </li>
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Conformité et sécurité</h4>
                  <p className="ml-4 mt-1 text-sm">
                    Assurez-vous de transmettre les informations sanitaires utiles à la sécurité des viandes.
                  </p>
                </li>
              </ul>
              <CTA />
            </div>
            <hr className="mx-8 my-4" />
            <img
              src="/landing/inspection-svi.png"
              alt="Un vétérinaire en train de faire une inspection de carcasse"
              className="mx-auto max-h-[50vh] w-full object-cover"
            />
            <div className="my-8">
              <h3 className="fr-h3 text-balance text-center">Pour les acteurs pros de la filière</h3>
              <ul className="flex flex-col gap-2">
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Meilleure maîtrise du risque</h4>
                  <p className="ml-4 mt-1 text-sm">
                    Garantissez la sécurité sanitaire des aliments via une donnée sanitaire de qualité.
                  </p>
                </li>
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Amélioration de la traçabilité</h4>
                  <p className="ml-4 mt-1 text-sm">
                    Consignez les données de traçabilité des viandes requises pour leur commercialisation.
                  </p>
                </li>
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Collaboration efficace</h4>
                  <p className="ml-4 mt-1 text-sm">Partagez et modifiez les FEI en toute simplicité.</p>
                </li>
              </ul>
            </div>
            <CTA />
          </section>
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col">
            <h2 className="fr-h2 text-balance text-center">
              Comment ça marche&nbsp;?
              <br />
              <span className="font-normal">Côté chasseur</span>
            </h2>
            <ul className="my-8 flex flex-col gap-8">
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-400">1</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold">Inscription</h4>
                  <p className="mt-1">
                    Créez votre compte en quelques minutes et renseignez vos rôles dans la filière : chasseurs,
                    examinateur ou encore centre de collecte.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-600">2</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold">Création d'une fiche d'examen initiale</h4>
                  <p className="mt-1">
                    Remplissez ou faites remplir vos fiches d'examen initial puis soumettez-les à vos partenaires en un
                    clic.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-800">3</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold">Retours et confirmation</h4>
                  <p className="mt-1">
                    Vous verrez la bonne réception de vos carcasses chez vos partenaires et le bilan du contrôle des
                    services vétérinaires d'inspection.
                  </p>
                </div>
              </li>
            </ul>
          </section>
          <CTA />
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col">
            <h2 className="fr-h2 text-balance text-center">
              Comment ça marche&nbsp;?
              <br />
              <span className="font-normal">Côté pros de la filière</span>
            </h2>
            <ul className="my-8 flex flex-col gap-8">
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-400">1</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold">Inscription</h4>
                  <p className="mt-1">
                    Créez votre compte en quelques minutes et renseignez vos partenaires de valorisation.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-600">2</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold">Réception et validation des FEIs</h4>
                  <p className="mt-1">
                    Vous verrez toutes les FEIs qui vous seront attribuées et pourrez les annoter suivant vos
                    observations.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <p className="shrink-0 basis-20 pl-4 text-8xl font-bold text-green-800">3</p>
                <div className="flex flex-col">
                  <h4 className="text-lg font-bold">Collaboration</h4>
                  <p className="mt-1">Partagez et modifiez les FEIs avec les autres acteurs de la filière.</p>
                </div>
              </li>
            </ul>
          </section>
          <CTA />
          <hr className="mt-8" />
          <section className="mt-8 flex flex-col">
            <h2 className="fr-h2 text-balance text-center">Vers une valorisation plus performante</h2>
            <img
              src="/landing/viande.png"
              alt="Une bone pièce de viande appétissante"
              className="fr-mx-auto max-h-[50vh] w-full object-cover"
            />
            <div className="my-8">
              <ul className="mt-8 flex flex-col gap-2">
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Amélioration de la qualité sanitaire</h4>
                  <p className="ml-4 mt-1 text-sm">
                    Des viandes commercialisées plus sûres et conformes aux normes sanitaires.
                  </p>
                </li>
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Réduction du gaspillage alimentaire</h4>
                  <p className="ml-4 mt-1 text-sm">
                    Une meilleure traçabilité des carcasses pour limiter les saisies en établissements de traitement du
                    gibier sauvage.
                  </p>
                </li>
                <li className="ml-4 flex flex-col">
                  <h4 className="text-lg font-bold">Une confiance restaurée</h4>
                  <p className="ml-4 mt-1 text-sm">
                    Des données sanitaires plus fiables c'est aussi des professionnels de la filière plus confiants dans
                    la qualité des viandes.
                  </p>
                </li>
              </ul>
              <CTA />
            </div>
          </section>
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

function CTA() {
  return (
    <div className="my-4 flex items-center justify-center">
      <Button
        className="m-0"
        linkProps={{
          to: "/app/connexion?type=creation-de-compte",
          href: "#",
        }}
      >
        Découvrir le service
      </Button>
    </div>
  );
}
