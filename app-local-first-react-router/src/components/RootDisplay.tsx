import { Footer } from '@codegouvfr/react-dsfr/Footer';
import { Header, type HeaderProps } from '@codegouvfr/react-dsfr/Header';
import { type MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';
import { clearCache } from '@app/services/indexed-db';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import SearchInput from '@app/components/SearchInput';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { useRef, useState } from 'react';
import API from '@app/services/api';
import { useLocation } from 'react-router';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import { disconnect } from '@app/utils/disconnect';
import { syncData } from '@app/utils/sync-data';
import { hasUnsyncedData } from '@app/utils/has-unsynced-data';
import useZustandStore from '@app/zustand/store';
import { createModal } from '@app/components/Modal';
import { matomoClickId } from '@app/services/matomo';

// Attente maximale de l'envoi des modifications locales avant une déconnexion manuelle.
const LOGOUT_SYNC_TIMEOUT_MS = 15_000;

// La déconnexion vide le stockage local : on envoie d'abord ce qui n'est pas synchronisé.
// Renvoie vrai si plus rien n'attend d'être envoyé.
async function syncBeforeLogout() {
  if (!hasUnsyncedData(useZustandStore.getState())) return true;
  if (useZustandStore.getState().isOnline) {
    await Promise.race([
      syncData('logout'),
      new Promise((resolve) => setTimeout(resolve, LOGOUT_SYNC_TIMEOUT_MS)),
    ]);
  }
  return !hasUnsyncedData(useZustandStore.getState());
}

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
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const user = useMostFreshUser('RootDisplay ' + id);
  const isOnline = useIsOnline();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const unsyncedLogoutModal = useRef(
    createModal({ id: `deconnexion-donnees-non-envoyees-${id}`, isOpenedByDefault: false })
  ).current;

  async function logout() {
    setIsLoggingOut(true);
    await API.post({ path: '/user/logout' });
    await disconnect({ reason: 'logout' });
    setIsLoggingOut(false);
  }

  const RenderedSearchInput = useRef(SearchInput).current;

  const quickAccessItemsConnected: Array<HeaderProps.QuickAccessItem> = [
    {
      linkProps: {
        to: mainLink,
        href: '#',
      },
      iconId: 'ri-account-box-line',
      text: isInApp ? user?.email || 'Mon espace' : 'Mon espace',
    } satisfies HeaderProps.QuickAccessItem,
    {
      iconId: 'ri-logout-box-line',
      buttonProps: {
        onClick: async () => {
          if (isLoggingOut) return;
          setIsLoggingOut(true);
          const allSent = await syncBeforeLogout();
          if (!allSent) {
            setIsLoggingOut(false);
            unsyncedLogoutModal.open();
            return;
          }
          await logout();
        },
      },
      text: isLoggingOut ? 'Déconnexion en cours...' : 'Déconnexion',
    },
  ];

  if (user?.isZacharieAdmin) {
    quickAccessItemsConnected.push({
      linkProps: {
        to: '/app/admin/users',
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
        className="[&_.fr-header\\_\\_navbar_.fr-btn--search]:hidden [&_.fr-header\\_\\_service-title]:flex [&_.fr-header\\_\\_service-title]:items-end"
        navigation={navigation}
        allowEmptySearch={false}
        renderSearchInput={RenderedSearchInput}
        quickAccessItems={quickAccessItems}
        operatorLogo={{
          alt: 'Logo de Zacharie - un bois de cerf bland sur fond bleu avec liseré rouge',
          imgUrl: '/logo-zacharie.png',
          orientation: 'vertical',
        }}
        serviceTagline="Garantir des viandes de gibier sauvage saines et sûres"
        serviceTitle={<>Zacharie</>}
      />
      {user && (
        <unsyncedLogoutModal.Component
          title="Des modifications ne sont pas encore envoyées"
          buttons={[
            {
              children: 'Annuler',
              priority: 'secondary',
              doClosesModal: true,
              nativeButtonProps: matomoClickId('deconnexion-annuler-donnees-non-envoyees'),
            },
            {
              children: 'Se déconnecter quand même',
              doClosesModal: true,
              onClick: logout,
              nativeButtonProps: matomoClickId('deconnexion-forcer-donnees-non-envoyees'),
            },
          ]}
        >
          <p>
            Des modifications ne sont pas encore envoyées au serveur (pas de connexion internet ou envoi en
            échec). Si vous vous déconnectez maintenant, elles seront perdues.
          </p>
          <p>
            Cliquez sur « Annuler », puis reconnectez-vous à internet : les modifications seront envoyées
            automatiquement. Vous pourrez ensuite vous déconnecter.
          </p>
        </unsyncedLogoutModal.Component>
      )}
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
                  to: '/conditions-d-utilisation-api',
                  href: '#',
                },
                text: "Conditions d'utilisation de l'API",
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
        ]}
      />
    </>
  );
}
