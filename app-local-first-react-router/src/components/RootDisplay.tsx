import { Footer } from '@codegouvfr/react-dsfr/Footer';
import { Header, type HeaderProps } from '@codegouvfr/react-dsfr/Header';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import { clearCache } from '@app/services/indexed-db';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import SearchInput from '@app/components/SearchInput';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { useRef, useState } from 'react';
import API, { setNativeAuthToken } from '@app/services/api';
import { useSearchParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';

const environment = import.meta.env.VITE_ENV || 'development';

export default function RootDisplay({
  navigation,
  mainLink,
  children,
  hideMinistereName,
  id,
  contactLink,
}: {
  navigation?: MainNavigationProps.Item[];
  mainLink: string;
  children: React.ReactNode;
  hideMinistereName?: boolean;
  id: string;
  contactLink?: string;
}) {
  const [searchParams] = useSearchParams();
  const embedded = searchParams.get('embedded') === 'true';
  const user = useMostFreshUser('RootDisplay ' + id);
  const isOnline = useIsOnline();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const RenderedSearchInput = useRef(SearchInput).current;

  const quickAccessItemsConnected: Array<HeaderProps.QuickAccessItem> = [
    {
      linkProps: {
        to: mainLink,
        href: '#',
      },
      iconId: 'ri-account-box-line',
      text: user?.email || '',
    },
    {
      iconId: 'ri-logout-box-line',
      buttonProps: {
        onClick: async () => {
          setIsLoggingOut(true);
          API.post({ path: '/user/logout' }).then(async () => {
            setNativeAuthToken(null);
            useZustandStore.getState().reset();
            await clearCache()
              .then(() => new Promise((resolve) => setTimeout(resolve, 1500)))
              .then(() => {
                useUser.setState({ user: null }); // this line is important : if useUser is not null then /app/connexion will redirect to /app/[role] even if /user/me returns a 401 (because of offline mode)
                window.location.href = '/app/connexion';
                // we need to reload to make sure JavaScript memory is cleared - if not, there will still be objects in memory that can create bugs
                window.location.reload();
                setIsLoggingOut(false);
              });
          });
        },
      },
      text: isLoggingOut ? 'Déconnexion en cours...' : 'Déconnexion',
    },
  ];

  if (user?.isZacharieAdmin) {
    quickAccessItemsConnected.push({
      linkProps: {
        to: '/app/admin/dashboard',
        href: '#',
      },
      iconId: 'ri-admin-line',
      text: 'Admin',
    });
  }

  const quickAccessItemsDisconnected: Array<HeaderProps.QuickAccessItem> = [
    {
      linkProps: {
        to: '/app/connexion',
        href: '#',
      },
      iconId: 'ri-account-box-line',
      text: 'Se connecter',
    },
    {
      linkProps: {
        to: '/app/connexion/creation-de-compte',
        href: '#',
      },
      iconId: 'fr-icon-add-circle-line',
      text: 'Créer un compte',
    },
    {
      iconId: 'fr-icon-mail-fill',
      linkProps: {
        to: '/contact',
        href: '#',
      },
      text: 'Contact',
    },
  ];

  const quickAccessItems: Array<HeaderProps.QuickAccessItem> | undefined = user
    ? quickAccessItemsConnected
    : quickAccessItemsDisconnected;

  return (
    <>
      {environment === 'test' && (
        <div className="sticky top-0 z-[999]">
          <div className="fixed bottom-0 z-[999] rounded-tr-md border border-red-200 bg-red-50/75 px-4 py-2 text-center backdrop-blur-xs">
            <span className="text-xs text-red-700">Environnement {environment.toUpperCase()}</span>
          </div>
        </div>
      )}
      <Header
        brandTop={
          <span className={hideMinistereName ? 'hidden md:inline' : ''}>
            Ministère
            <br />
            de l'Agriculture,
            <br />
            de l'Agro-alimentaire
            <br />
            et de la Souveraineté
            <br />
            Alimentaire
          </span>
        }
        homeLinkProps={{
          to: '/',
          title: "Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire",
        }}
        id="fr-header-header-with-quick-access-items"
        className="[&_.fr-header\\_\\_service-title]:flex [&_.fr-header\\_\\_service-title]:items-end"
        navigation={embedded ? undefined : navigation}
        allowEmptySearch={false}
        renderSearchInput={RenderedSearchInput}
        quickAccessItems={embedded ? undefined : quickAccessItems}
        operatorLogo={{
          alt: 'Logo de Zacharie - un bois de cerf bland sur fond bleu avec liseré rouge',
          imgUrl: '/logo_zacharie_solo_small.svg',
          orientation: 'vertical',
        }}
        serviceTagline="Garantir des viandes de gibier sauvage saines et sûres"
        serviceTitle={<>Zacharie</>}
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
        linkList={
          embedded
            ? undefined
            : [
                {
                  categoryName: 'Connexion',
                  links: [
                    {
                      linkProps: {
                        to: '/app/connexion',
                        href: '#',
                      },
                      text: 'Se connecter',
                    },
                    {
                      linkProps: {
                        to: user ? getUserOnboardingRoute(user) : '/app/connexion',
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
                        to: '/politique-de-confidentialite',
                        href: '#',
                      },
                      text: 'Politique de confidentialité',
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
                        to: '/faq',
                        href: '#',
                      },
                      text: 'FAQ',
                    },
                    {
                      linkProps: {
                        to: contactLink ?? '/contact',
                        href: '#',
                      },
                      text: 'Contactez-nous',
                    },
                  ],
                },
              ]
        }
      />
    </>
  );
}
