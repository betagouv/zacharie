import { useEffect, useMemo, useState } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { UserNotifications, UserRoles } from '@prisma/client';
import type { UserConnexionResponse } from '@api/src/types/responses';
import { usePush } from '@app/sw/web-push-notifications';
import useUser from '@app/zustand/user';
import { useNavigate } from 'react-router';

export default function MesNotifications() {
  const user = useUser((state) => state.user)!;
  const navigate = useNavigate();

  const {
    subscribeToPush,
    canSendPush,
    isSubscribed,
    pushSubscription,
    pushAvailable: pushAvailableOnWeb,
  } = usePush();

  const [nativePushTokenRegistered, setNativePushTokenRegistered] = useState(false);
  useEffect(() => {
    if (window.ReactNativeWebView) {
      window.onNativePushToken = async function handleNativePushToken(token) {
        setNativePushTokenRegistered(user.native_push_tokens.includes(token));
      };
      window.ReactNativeWebView.postMessage('request-native-get-expo-token');
    }
  }, [user.native_push_tokens]);

  const pushAvailabledOnThisPlatform = useMemo(() => {
    if (window.ReactNativeWebView) {
      return true;
    }
    return pushAvailableOnWeb;
  }, [pushAvailableOnWeb]);

  const checkBoxChecked = useMemo(() => {
    if (window.ReactNativeWebView) {
      return nativePushTokenRegistered;
    }
    return (
      canSendPush &&
      isSubscribed &&
      !!pushSubscription &&
      !!user?.web_push_tokens?.find((token) => JSON.parse(token)?.endpoint === pushSubscription?.endpoint)
    );
  }, [nativePushTokenRegistered, canSendPush, isSubscribed, pushSubscription, user.web_push_tokens]);

  const skipCCG = useMemo(() => {
    if (!user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      return true;
    }
    return false;
  }, [user.roles]);
  const stepCount = skipCCG ? 3 : 4;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <form
      id="user_roles_form"
      method="POST"
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const notifications = formData.getAll('notifications') as UserNotifications[];
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/${user.id}`, {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ notifications, onboarding_finished: true }),
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        })
          .then((response) => response.json())
          .then((data) => data as UserConnexionResponse);
        if (response.ok && response.data?.user?.id) {
          useUser.setState({ user: response.data.user });
          navigate('/app/tableau-de-bord');
        }
      }}
    >
      <title>
        Mes notifications | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Stepper currentStep={stepCount} stepCount={stepCount} title="Vos notifications" />
            <h1 className="fr-h2 fr-mb-2w">Activez les notifications</h1>
            <CallOut title="🔔 Soyez notifié d'une fiche qui vous est attribuée" className="bg-white">
              Vous pouvez être notifié par mail ou par une notification sur votre smartphone dès qu'une Fiche
              d'Examen Initial vous est attribuée.
            </CallOut>
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 pb-32 md:p-8 md:pb-0">
                <Checkbox
                  key={checkBoxChecked ? 'checked' : 'unchecked'}
                  legend="Sélectionnez tous les types de notifications que vous souhaitez recevoir"
                  options={[
                    {
                      label: 'Notification via Zacharie',
                      hintText: pushAvailabledOnThisPlatform
                        ? 'Notification directement sur cet appareil'
                        : "Vous devriez installer l'application sur un appareil compatible pour activer les notifications.",
                      nativeInputProps: {
                        name: 'notifications',
                        value: UserNotifications.PUSH,
                        defaultChecked: checkBoxChecked,
                        disabled: !pushAvailabledOnThisPlatform,
                        onClick: async () => {
                          if (window.ReactNativeWebView) {
                            window.ReactNativeWebView.postMessage('request-native-expo-push-permission');
                            // token reading is handled in tableau-de-bord.tsx
                            // window.onNativePushToken = async function handleNativePushToken(token) { ... }
                            return;
                          }
                          const VITE_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                          subscribeToPush(
                            VITE_VAPID_PUBLIC_KEY,
                            async (subscription) => {
                              const response = await fetch(
                                `${import.meta.env.VITE_API_URL}/user/${user.id}`,
                                {
                                  method: 'POST',
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    web_push_token: JSON.stringify(subscription.toJSON()),
                                  }),
                                  headers: {
                                    Accept: 'application/json',
                                    'Content-Type': 'application/json',
                                  },
                                },
                              )
                                .then((response) => response.json())
                                .then((data) => data as UserConnexionResponse);
                              if (response.ok && response.data?.user?.id) {
                                useUser.setState({ user: response.data.user });
                              }
                            },
                            (error) => {
                              console.error('Error subscribing user to push notifications!', error);
                            },
                          );
                        },
                      },
                    },
                    {
                      label: 'Notification par email',
                      nativeInputProps: {
                        name: 'notifications',
                        value: UserNotifications.EMAIL,
                        defaultChecked: user.notifications.includes(UserNotifications.EMAIL),
                      },
                    },
                  ]}
                />
                <div className="mt-6 mb-16 ml-6">
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                    Haut de page
                  </a>
                </div>
              </div>
              <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: 'Continuer',
                      nativeButtonProps: {
                        type: 'submit',
                      },
                    },
                    {
                      children: 'Précédent',
                      type: 'button',
                      nativeButtonProps: {
                        onClick: () => navigate(-1),
                      },
                      priority: 'secondary',
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
