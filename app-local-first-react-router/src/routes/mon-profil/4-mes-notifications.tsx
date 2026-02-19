import { useEffect, useMemo, useState } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { UserNotifications } from '@prisma/client';
import type { UserConnexionResponse } from '@api/src/types/responses';
import { usePush } from '@app/sw/web-push-notifications';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import { toast } from 'react-toastify';

export default function MesNotifications() {
  const user = useUser((state) => state.user)!;

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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSubmit = () => {
    toast.success('Notifications enregistrées');
  };

  return (
    <form
      id="user_roles_form"
      method="POST"
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const notifications = formData.getAll('notifications') as UserNotifications[];
        const response = await API.post({
          path: `/user/${user.id}`,
          body: { notifications, onboarding_finished: true },
        }).then((data) => data as UserConnexionResponse);
        if (response.ok && response.data?.user?.id) {
          useUser.setState({ user: response.data.user });
        }
      }}
    >
      <title>
        Mes notifications | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
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
                              const response = await API.post({
                                path: `/user/${user.id}`,
                                body: {
                                  web_push_token: JSON.stringify(subscription.toJSON()),
                                },
                              }).then((data) => data as UserConnexionResponse);
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
              <div className="fixed bottom-16 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:bottom-0 md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: 'Enregistrer',
                      nativeButtonProps: {
                        type: 'submit',
                        onClick: handleSubmit,
                      },
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
