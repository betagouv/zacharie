import { useMemo } from "react";
import { json, redirect, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { UserNotifications, UserRoles, type User } from "@prisma/client";
import { getCacheItem } from "~/services/indexed-db.client";

export function meta() {
  return [
    {
      title: "Mes notifications | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientLoader() {
  const user = (await getCacheItem("user")) as User | null;

  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  return json({ user });
}

export default function MesNotifications() {
  const { user } = useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher({ key: "mon-profil-mes-notifications" });
  const navigate = useNavigate();

  // const tokenFetcher = useFetcher({ key: "notifications-token" });
  const {
    // subscribeToPush,
    canSendPush,
    isSubscribed,
    pushSubscription,
  } = {
    canSendPush: false,
    isSubscribed: false,
    pushSubscription: null,
    // subscribeToPush: () => {},
  };

  const checkBoxChecked =
    canSendPush &&
    isSubscribed &&
    !!pushSubscription &&
    user.web_push_tokens.includes(JSON.stringify(pushSubscription));

  const skipCCG = useMemo(() => {
    if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      if (user.roles.length === 1) {
        return true;
      }
    }
    if (user.roles.includes(UserRoles.SVI)) {
      return true;
    }
    return false;
  }, [user.roles]);
  const stepCount = skipCCG ? 3 : 4;

  return (
    <fetcher.Form id="user_roles_form" method="POST" action={`/action/user/${user.id}`}>
      <input type="hidden" name="_redirect" value="/tableau-de-bord/" />
      <input type="hidden" name="onboarding_finished" value="true" />
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Stepper currentStep={stepCount} stepCount={stepCount} title="Vos notifications" />
            <h1 className="fr-h2 fr-mb-2w">Activez les notifications</h1>
            <CallOut title="🔔 Soyez notifié d'une FEI qui vous est attribuée" className="bg-white">
              Vous pouvez être notifié par mail ou par une notification sur votre smartphone dès qu'une Fiche d'Examen
              Initial (FEI) vous est attribuée.
            </CallOut>
            <div className="mb-6 bg-white md:shadow">
              <div className="p-4 pb-32 md:p-8 md:pb-0">
                <Checkbox
                  legend="Sélectionnez tous les types de notifications que vous souhaitez recevoir"
                  options={[
                    {
                      label: "Notification via Zacharie",
                      hintText: !canSendPush
                        ? "Notification directement sur cet appareil"
                        : "Vous devriez installer l'application sur un appareil compatible pour activer les notifications.",
                      nativeInputProps: {
                        name: "notifications",
                        value: UserNotifications.PUSH,
                        defaultChecked: checkBoxChecked,
                        disabled: !canSendPush,
                        // onClick: () => {
                        //   subscribeToPush(
                        //     window.ENV.VAPID_PUBLIC_KEY,
                        //     (subscription) => {
                        //       tokenFetcher.submit(
                        //         {
                        //           web_push_token: JSON.stringify(subscription),
                        //         },
                        //         {
                        //           method: "POST",
                        //           action: `/action/user/${user.id}`,
                        //           preventScrollReset: true,
                        //         },
                        //       );
                        //     },
                        //     (error) => {
                        //       console.error("Error subscribing user to push notifications!", error);
                        //     },
                        //   );
                        // },
                      },
                    },
                    {
                      label: "Notification par email",
                      nativeInputProps: {
                        name: "notifications",
                        value: UserNotifications.EMAIL,
                        defaultChecked: user.notifications.includes(UserNotifications.EMAIL),
                      },
                    },
                  ]}
                />
                <div className="mb-16 ml-6 mt-6">
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                    Haut de page
                  </a>
                </div>
              </div>
              <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: "Continuer",
                      nativeButtonProps: {
                        type: "submit",
                      },
                    },
                    {
                      children: "Précédent",
                      type: "button",
                      nativeButtonProps: {
                        onClick: () => navigate(-1),
                      },
                      priority: "secondary",
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </fetcher.Form>
  );
}
