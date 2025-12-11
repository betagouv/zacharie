import { Button } from '@codegouvfr/react-dsfr/Button';
import { SideMenu } from '@codegouvfr/react-dsfr/SideMenu';

// import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { Link } from 'react-router';
import useMinimumWidth from '@app/utils/useMinimumWidth';
import { useState } from 'react';

export default function LandingDemarchesPage() {
  const isDesktop = useMinimumWidth('sm');
  const [showContent, setShowContent] = useState<'demarches' | 'fei' | 'formation' | 'ccg'>('demarches');

  return (
    <>
      <title>
        Toutes vos démarches avec Zacharie | Garantir des viandes de gibier sauvage saines et sûres |
        Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="flex">
        <div className="container hidden w-80 pt-8 pl-4 md:block [&_.fr-sidemenu\_\_inner]:shadow-none!">
          <SideMenu
            align="left"
            burgerMenuButtonText="Dans cette rubrique"
            items={[
              {
                isActive: showContent === 'demarches',
                linkProps: {
                  href: '#',
                  onClick: () => {
                    setShowContent('demarches');
                  },
                },
                text: 'Vos démarches',
              },
              {
                isActive: showContent === 'fei',
                linkProps: {
                  href: '#',
                  onClick: () => {
                    setShowContent('fei');
                  },
                },
                text: 'La fiche d’examen inital',
              },
              {
                isActive: showContent === 'formation',
                linkProps: {
                  href: '#',
                  onClick: () => {
                    setShowContent('formation');
                  },
                },
                text: 'Se former à l’examen initial',
              },
              {
                isActive: showContent === 'ccg',
                linkProps: {
                  href: '#',
                  onClick: () => {
                    setShowContent('ccg');
                  },
                },
                text: 'Déclarer sa chambre froide',
              },
            ]}
          />
        </div>
        <main className="fr-container my-auto flex min-h-[50vh] flex-col justify-center border-l border-gray-100">
          <div className="fr-grid-row fr-grid-row--gutters fr-py-6w my-auto flex flex-col justify-center">
            {/* <CTA mobile /> */}
            <section
              className={[
                'mt-8 flex flex-col items-start px-8',
                isDesktop && showContent !== 'demarches' ? 'hidden' : '',
              ].join(' ')}
            >
              <h1 className="fr-h1 text-action-high-blue-france !text-left text-balance">Vos démarches</h1>
              <div className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-2 md:gap-16">
                <div className="mx-auto h-full w-full overflow-hidden md:col-span-1 md:row-span-2">
                  <img
                    src="/landing/chasseur-et-telephone.png"
                    alt="Un vétérinaire en train de faire une inspection de carcasse"
                    className="h-full max-h-[50vh] w-full overflow-hidden object-cover md:max-h-full"
                  />
                </div>
                <div className="my-8 flex flex-col gap-4 md:col-start-2 md:row-span-2 md:row-start-1 md:m-0">
                  <p className="text-justify font-normal text-pretty text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                    Pour valoriser la viande de gibier en toute sécurité et en suivant la réglementation en
                    vigueur, plusieurs démarches sont à effectuer{' '}
                    <b>par les chasseurs qui souhaitent vendre ou céder leurs carcasses</b>.
                  </p>
                  <p className="text-justify font-normal text-pretty text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                    On vous explique tout sur ces démarches essentielles, pour vous aider à les réaliser
                    simplement.
                  </p>
                  <p className="text-justify font-normal text-pretty text-gray-700 [&_b]:font-bold [&_b]:text-gray-900">
                    Qu’il s’agisse de la fiche d’examen initial du gibier sauvage, de la formation à l’examen
                    initial ou encore de la déclaration de votre chambre froide, on fait le point sur ce qui
                    vous concerne et les étapes à suivre pour réaliser ces démarches le plus simplement
                    possible.
                  </p>
                </div>
              </div>
            </section>
            <section
              className={[
                'mt-8 flex flex-col items-start px-8',
                isDesktop && showContent !== 'fei' ? 'hidden' : '',
              ].join(' ')}
            >
              <h2 className="fr-h2 text-action-high-blue-france !text-left text-balance">
                La fiche d’examen initial
              </h2>
              <Section title="Qu’est-ce qu’une fiche d’examen initial&nbsp;?">
                <p>
                  Aussi appelée fiche d’accompagnement du gibier sauvage, une fiche d’examen initial est un{' '}
                  <b>document réglementaire</b> qui accompagne la ou les carcasses en peau que vous vendez ou
                  donnez à un professionnel ou à une association.
                </p>
                <p>Ce document sert à&nbsp;:</p>
                <ul className="list-inside list-disc">
                  <li>
                    attester que la carcasse et les viscères ont été contrôlés par un <b>chasseur formé</b>
                  </li>
                  <li>
                    garantir que le gibier est <b>propre à la consommation</b> humaine
                  </li>
                  <li>
                    assurer <b>la traçabilité</b> des carcasses vendues ou cédées (espèce, numéro
                    d’identification de l’animal, lieu et date de tir).
                  </li>
                </ul>
                <p>
                  En contrôlant les carcasses juste après la chasse, le chasseur formé à l’examen initial
                  apporte des informations sanitaires que les professionnels de la filière ne pourraient pas
                  obtenir autrement.
                </p>
              </Section>
              <Section title="Quand doit-on remplir une fiche d’examen initial&nbsp;?">
                <p>
                  La fiche d’examen initial concerne <b>le grand et le petit gibier</b>. Elle est obligatoire
                  dans les cas de figure suivants&nbsp;:
                </p>
                <ul className="list-inside list-disc">
                  <li>
                    <b>vous vendez vos carcasses</b> à un établissement de traitement du gibier sauvage, à un
                    collecteur professionnel (transporteur) ou à un commerce de détail de proximité
                    (boucherie, restaurant, supermarché).
                  </li>
                  <li>
                    vous faites <b>don</b> de vos carcasses <b>à une association caritative</b> ou{' '}
                    <b>à une commune pour l’organisation d’évènements publics</b>.
                  </li>
                  <li>
                    vous apportez votre gibier <b>à un repas associatif ou de chasse</b>.
                  </li>
                </ul>
                <p>
                  La fiche doit être rédigée <b>immédiatement après l’examen initial</b>, qui est lui-même
                  effectué le plus tôt possible après la chasse. La fiche d’examen initial doit être remplie
                  impérativement <b>avant le transport des carcasses</b>.
                </p>
              </Section>
              <Section title="Qui peut remplir une fiche d’examen initial&nbsp;?">
                <p>
                  Seul un <b>formateur référent</b> ou un <b>chasseur formé par un formateur référent</b> peut
                  remplir une fiche d’examen initial. À l’issue de la formation, la fédération nationale des
                  chasseurs (FNC) ou la fédération départementale des chasseurs (FDC) délivre aux chasseurs
                  une carte d’examinateur avec un <b>numéro d’identification</b>.
                </p>
                <p>
                  Lors de la création d’un compte sur Zacharie, il est indispensable de renseigner ce numéro
                  d’examinateur initial pour pouvoir remplir une fiche d’examen initial.
                </p>
              </Section>
              <Section title="Comment peut-on remplir une fiche d’examen initial&nbsp;?">
                <h4>En format numérique avec Zacharie</h4>
                <p>
                  On peut remplir la fiche d’examen initial sur téléphone, tablette ou ordinateur, grâce à
                  l’application Zacharie. Toutes vos fiches seront enregistrées et accessibles à tout moment.
                  Ce service du Ministère chargé de l’Agriculture est gratuit, facile et rapide d’utilisation.
                  On peut créer son compte sur Zacharie en{' '}
                  <Link to="/app/connexion/creation-de-compte">cliquant ici</Link>.
                </p>
                <h4 className="mt-8">
                  En format papier avec le carnet à souches distribué par la Fédération Départementale des
                  Chasseurs
                </h4>
                <p>
                  Il est aussi possible de remplir une fiche d’examen initial en format papier, en utilisant
                  les carnets à souches vendus par votre Fédération Départementale des Chasseurs. Vous devrez
                  remplir une fiche par espèce et attacher la fiche au lot de carcasses concernées. Vous devez
                  conserver le double (papier carbone) 5 ans après la date de mise à mort des carcasses.
                </p>
              </Section>
            </section>
            <section
              className={[
                'mt-8 flex flex-col items-start px-8',
                isDesktop && showContent !== 'formation' ? 'hidden' : '',
              ].join(' ')}
            >
              <h2 className="fr-h2 text-action-high-blue-france !text-left text-balance">
                Se former à l’examen initial
              </h2>
              <Section title="Comment peut-on se former et devenir examinateur initial&nbsp;?">
                <p>
                  Ce sont les Fédération Départementale des Chasseurs (FDC) qui organisent et dispensent les
                  formations auprès des chasseurs qui souhaitent être formés.
                </p>
                <p>
                  Contactez votre{' '}
                  <a
                    href="https://www.chasseurdefrance.com/pratiquer/annuaire-des-federations/"
                    target="_blank"
                  >
                    Fédération Départementale des Chasseurs (FDC)
                  </a>{' '}
                  pour connaitre les prochaines dates de formation à l’examen initial.
                </p>
                <p>
                  À l’issue de la formation, vous recevrez une attestation avec votre numéro d’examinateur
                  initial. Il vous sera demandé lors de votre création de compte Zacharie, si vous souhaitez
                  avoir le rôle d’examinateur initial.
                </p>
              </Section>
            </section>
            <section
              className={[
                'mt-8 flex flex-col items-start px-8',
                isDesktop && showContent !== 'ccg' ? 'hidden' : '',
              ].join(' ')}
            >
              <h2 className="fr-h2 text-action-high-blue-france !text-left text-balance">
                Déclarer sa chambre froide
              </h2>
              <Section title="Qu'est ce qu'un centre de collecte du gibier sauvage dit ‘chambre froide’&nbsp;?">
                <p>
                  Les centres de collecte du gibier sauvage sont des chambres froides dans lesquelles le
                  gibier est regroupé et refroidi avant d'être distribué.
                </p>
                <p>
                  Toute chambre froide où est entreposé du gibier en poils ou en plumes avant qu'il soit cédé
                  ou vendu est considérée comme un centre de collecte du gibier sauvage. Dans ce cas, il doit
                  être déclaré auprès des services de l'État de votre département.
                </p>
              </Section>
              <Section title="Dois-je déclarer la chambre froide où j’entrepose du gibier&nbsp;?">
                <p>
                  Oui, si vous y stockez du gibier <b>que vous comptez vendre ou donner</b>. Elle devient un{' '}
                  <b>Centre de Collecte du Gibier sauvage (CCG)</b> et doit être enregistrée auprès des
                  services de l’Etat de votre département (DDPP ou DDETSPP).
                </p>
                <p>
                  Si c’est le cas, votre chambre froide est considérée comme un{' '}
                  <b>Centre de Collecte du Gibier sauvage (CCG)</b> et doit être enregistrée auprès des
                  services de l’Etat de votre département (DDPP ou DDETSPP).
                </p>
              </Section>
              <Section title="Comment déclarer sa chambre froide où j’entrepose du gibier&nbsp;?">
                <p>
                  Pour déclarer votre chambre froide, il vous suffit de remplir le{' '}
                  <a href="https://entreprendre.service-public.fr/vosdroits/R17520" target="_blank">
                    CERFA 13984
                  </a>{' '}
                  et de le renvoyer à la direction départementale en charge de la protection des populations
                  (DDPP/DDETSPP) du département où se trouve votre chambre froide.
                </p>
                <p>
                  Après réception de votre demande, les services de l’État vous attribueront un numéro
                  d’enregistrement pour la chambre froide. Ce numéro devra être inscrit sur vos fiches
                  d’examen initial. Dans Zacharie, une fois que vous aurez enregistré votre chambre froide sur
                  votre compte, ce numéro sera automatiquement ajouté aux fiches numériques.
                </p>
                <p className="mt-8">
                  Pour en savoir plus sur cette démarche et comment la réaliser vous pouvez{' '}
                  <a
                    href="https://scribehow.com/shared/Declarer_un_centre_de_collecte_de_gibier_CCG__f9XrNsQYQx68Mk-WDBJr0w"
                    target="_blank"
                  >
                    consulter notre tutoriel.
                  </a>
                </p>
              </Section>
            </section>
          </div>
        </main>
      </div>

      <hr className="mt-8 md:mt-16" />

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
    </>
  );
}

// function CTA({ mobile, desktop }: { mobile?: boolean; desktop?: boolean }) {
//   const user = useMostFreshUser('landing CTA');
//   const isLoggedIn = !!user?.id;

//   return (
//     <div
//       className={[
//         'my-4 flex-col items-center justify-center gap-4 md:my-16',
//         mobile && !desktop && 'flex md:hidden',
//         !mobile && desktop && 'hidden md:flex',
//         mobile && desktop && 'flex',
//       ]
//         .filter(Boolean)
//         .join(' ')}
//     >
//       <Button
//         className="m-0"
//         priority={isLoggedIn ? 'tertiary no outline' : 'primary'}
//         linkProps={{
//           to: isLoggedIn ? '/app/connexion' : '/app/connexion/creation-de-compte',
//           href: '#',
//         }}
//       >
//         {isLoggedIn ? 'Accéder à mon compte' : 'Créer mon compte'}
//       </Button>
//     </div>
//   );
// }

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  titleAs?: 'h2' | 'h3' | 'h4';
  open?: boolean;
}

function Section({ title = 'Titre de section', children, className = '' }: SectionProps) {
  return (
    <div className={['mt-16 w-full max-w-4xl bg-white', className].join(' ')}>
      <h3 className="fr-h3 text-action-high-blue-france inline font-semibold">{title}</h3>
      <div className="mt-8 [&_p]:mt-4">{children}</div>
    </div>
  );
}
