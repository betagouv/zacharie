import { Button } from '@codegouvfr/react-dsfr/Button';

import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { Link } from 'react-router';

export default function LandingDemarchesPage() {
  return (
    <>
      <title>
        Toutes vos démarches avec Zacharie | Garantir des viandes de gibier sauvage saines et sûres |
        Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <main className="fr-container my-auto flex min-h-[50vh] flex-col justify-center">
        <div className="fr-grid-row fr-grid-row--gutters fr-py-6w my-auto flex flex-col justify-center">
          <h1 className="fr-h1 text-action-high-blue-france text-center text-balance">
            Toutes vos démarches
          </h1>
          <CTA mobile />
          <section className="mt-8 flex flex-col items-center">
            <Section title="Qu’est-ce qu’une fiche d’examen initial (ou fiche d’accompagnement du gibier sauvage)&nbsp;?">
              <p>
                Une fiche d’examen initial est un <b>document réglementaire</b> qui accompagne la ou les
                carcasses en peau que vous vendez ou donnez à un professionnel ou à une association. Ce
                document sert à&nbsp;:
              </p>
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
                ULa fiche d’examen initial concerne <b>le grand et le petit gibier</b>. Elle est obligatoire
                dans les cas de figure suivants&nbsp;:
              </p>
              <ul className="list-inside list-disc">
                <li>
                  <b>vous vendez vos carcasses</b> à un établissement de traitement du gibier sauvage, à un
                  collecteur professionnel (transporteur) ou à un commerce de détail de proximité (boucherie,
                  restaurant, supermarché).
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
                chasseurs (FNC) ou la fédération départementale des chasseurs (FDC) délivre aux chasseurs une
                carte d’examinateur avec un <b>numéro d’identification</b>.
              </p>
              <p>
                Lors de la création d’un compte sur Zacharie, il est indispensable de renseigner ce numéro
                d’examinateur initial pour pouvoir remplir une fiche d’examen initial.
              </p>
            </Section>
            <Section title="Comment peut-on remplir une fiche d’examen initial&nbsp;?">
              <p>
                Contactez votre{' '}
                <a
                  href="https://www.chasseurdefrance.com/pratiquer/annuaire-des-federations/"
                  target="_blank"
                >
                  Fédération Départementale des Chasseurs (FDC)
                </a>{' '}
                pour connaitre les prochaines dates de formation à l’examen initial. A l’issue de la
                formation, vous recevrez une attestation avec votre numéro d’examinateur initial.
              </p>
            </Section>
            <Section title="Comment peut-on se former et devenir examinateur initial&nbsp;?">
              <h4>En format numérique avec Zacharie</h4>
              <p>
                On peut remplir la fiche d’examen initial sur téléphone, tablette ou ordinateur, grâce à
                l’application Zacharie. Toutes vos fiches seront enregistrées et accessibles à tout moment. Ce
                service du Ministère chargé de l’Agriculture est gratuit, facile et rapide d’utilisation. On
                peut créer son compte sur Zacharie en{' '}
                <Link to="/app/connexion?type=creation-de-compte">cliquant ici</Link>.
              </p>
              <h4 className="mt-8">
                En format papier avec le carnet à souches distribué par la Fédération Départementale des
                Chasseurs
              </h4>
              <p>
                Il est aussi possible de remplir une fiche d’examen initial en format papier, en utilisant les
                carnets à souches vendus par votre Fédération Départementale des Chasseurs. Vous devrez
                remplir une fiche par espèce et attacher la fiche au lot de carcasses concernées. Vous devez
                conserver le double (papier carbone) 5 ans après la date de mise à mort des carcasses.
              </p>
            </Section>
            <Section title="Dois-je déclarer la chambre froide où j’entrepose du gibier&nbsp;?">
              <p>
                Oui, si vous y stockez du gibier <b>que vous comptez vendre ou donner</b>. Elle devient un
                <b>Centre de Collecte du Gibier sauvage (CCG)</b> et doit être enregistrée auprès des services
                de l’Etat de votre département (DDPP ou DDETSPP).
              </p>
              <p className="mt-8">
                C’est facile, rapide et gratuit de déclarer sa chambre froide.{' '}
                <a
                  href="https://scribehow.com/shared/Declarer_un_centre_de_collecte_de_gibier_CCG__f9XrNsQYQx68Mk-WDBJr0w"
                  target="_blank"
                >
                  Cliquez ici pour découvrir comment.
                </a>
              </p>
            </Section>
          </section>

          <hr className="mt-8 md:mt-16" />

          <section className="py-16 lg:py-24">
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
          // to: "/app/connexion?type=creation-de-compte",
          to: isLoggedIn ? '/app/connexion?type=compte-existant' : '/app/connexion?type=creation-de-compte',
          href: '#',
        }}
      >
        {isLoggedIn ? 'Accéder à mon compte' : 'Créer mon compte'}
      </Button>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  titleAs?: 'h2' | 'h3' | 'h4';
  open?: boolean;
}

function Section({ title = 'Titre de section', children, className = '', open = true }: SectionProps) {
  return (
    <details open={open} className={['w-full max-w-4xl bg-white p-4 md:p-8', className].join(' ')}>
      <summary>
        <h3 className="fr-h3 text-action-high-blue-france ml-2 inline text-lg font-semibold">{title}</h3>
      </summary>
      <div className="p-5">{children}</div>
    </details>
  );
}
