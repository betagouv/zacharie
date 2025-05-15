import { Footer } from '@codegouvfr/react-dsfr/Footer';
import { Header, type HeaderProps } from '@codegouvfr/react-dsfr/Header';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import { UserRoles } from '@prisma/client';
import { clearCache } from '@app/services/indexed-db';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import SearchInput from '@app/components/SearchInput';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { useRef } from 'react';

export default function RootDisplay({
  navigation,
  children,
  hideMinistereName,
  id,
}: {
  navigation?: MainNavigationProps.Item[];
  children: React.ReactNode;
  hideMinistereName?: boolean;
  id: string;
}) {
  const user = useMostFreshUser('RootDisplay ' + id);
  const isOnline = useIsOnline();
  // there is a bug on user's first connexion where user is not defined
  // RENDER 1. user is not connected -> renderSearchInput is undefined
  // RENDER 2. user is connected -> renderSearchInput is SearchInput -> ERROR of number of hooks somewhere
  // Error: Rendered more hooks than during the previous render. at SearchInput
  // Previous render            Next render
  // ------------------------------------------------------
  // 1. useMemo                    useMemo
  // 2. useMemo                    useMemo
  // 3. undefined                  useState
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  const RenderedSearchInput = useRef(user?.roles.includes(UserRoles.SVI) ? SearchInput : undefined).current;
  // console.log("root display user " + id, user);
  const quickAccessItems: Array<HeaderProps.QuickAccessItem> = [
    {
      linkProps: {
        to: user?.email ? '/app/tableau-de-bord' : '/app/connexion?type=compte-existant',
        href: '#',
      },
      iconId: 'ri-account-box-line',
      text: user?.email ?? 'Se connecter',
    },
  ];
  if (!user) {
    quickAccessItems.push({
      linkProps: {
        to: '/app/connexion?type=creation-de-compte',
        href: '#',
      },
      iconId: 'fr-icon-add-circle-line',
      text: 'Créer un compte',
    });
  }
  quickAccessItems.push({
    iconId: 'fr-icon-mail-fill',
    linkProps: {
      href: `mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de Zacharie`,
    },
    text: 'Contact',
  });

  return (
    <>
      <Header
        brandTop={
          <span className={hideMinistereName ? 'hidden md:inline' : ''}>
            Ministère
            <br />
            de l'Agriculture et
            <br />
            de la Souveraineté
            <br />
            Alimentaire
          </span>
        }
        homeLinkProps={{
          to: user?.activated ? '/app/tableau-de-bord' : '/',
          title: "Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire",
        }}
        id="fr-header-header-with-quick-access-items"
        className="[&_.fr-header\_\_service-title]:flex [&_.fr-header\_\_service-title]:items-end"
        navigation={navigation}
        allowEmptySearch={false}
        renderSearchInput={RenderedSearchInput}
        quickAccessItems={quickAccessItems}
        operatorLogo={{
          alt: 'Logo de Zacharie - un bois de cerf bland sur fond bleu avec liseré rouge',
          imgUrl: '/logo_zacharie_solo_small.svg',
          orientation: 'vertical',
        }}
        serviceTagline="Garantir des viandes de gibier sauvage saines et sûres"
        serviceTitle={
          <>
            Zacharie
            <span className="ml-4 inline-block">
              <em className="mb-1 block rounded bg-green-300 px-1 text-sm not-italic text-green-900">
                VERSION BETA
              </em>
            </span>
          </>
        }
      />
      {children}
      <Footer
        accessibility="partially compliant"
        accessibilityLinkProps={{
          to: '/accessibilite',
        }}
        contentDescription={`
        Zacharie est un service à destination des chasseurs et des acteurs de la filière de valorisation des viandes de gibier sauvage (collecteurs,  ETG, SVI). Il permet de créer des fiche d'accompagnement du gibier sauvage en un format numérique unique, partagé, modifiable et traçable  par tous les acteurs.
        Dernière mise à jour le ${__VITE_BUILD_ID__}
        `}
        termsLinkProps={{
          to: '/mentions-legales',
        }}
        websiteMapLinkProps={{
          href: '#',
        }}
        linkList={[
          {
            categoryName: 'Connexion',
            links: [
              {
                linkProps: {
                  to: '/app/connexion?type=compte-existant',
                  href: '#',
                },
                text: 'Se connecter',
              },
              {
                linkProps: {
                  to: '/app/tableau-de-bord',
                  href: '#',
                },
                text: 'Accéder à mon compte',
              },
              {
                linkProps: {
                  to: '/modalites-d-utilisation',
                  href: '#',
                },
                text: "Modalités d'utilisation",
              },
              {
                linkProps: {
                  to: '/mentions-legales',
                  href: '#',
                },
                text: 'Mentions légales',
              },
              {
                linkProps: {
                  to: '/stats',
                  href: '#',
                },
                text: 'Statistiques',
              },
            ],
          },
          {
            categoryName: 'Assistance',
            links: [
              {
                linkProps: {
                  href: '#',
                  onClick: () => {
                    if (isOnline) {
                      clearCache().then(() => window.location.reload());
                    } else {
                      alert('Vous devez être connecté à internet pour effectuer cette action');
                    }
                  },
                },
                text: "Obtenir la dernière version de l'app",
              },
              {
                linkProps: {
                  href: `mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de Zacharie`,
                },
                text: 'Contactez-nous',
              },
            ],
          },
        ]}
      />
    </>
  );
}
