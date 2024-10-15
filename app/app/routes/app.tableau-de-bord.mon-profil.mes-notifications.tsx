import { useMemo } from "react";
import {
  json,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  type ClientActionFunctionArgs,
} from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { UserNotifications, UserRoles } from "@prisma/client";
import { getMostFreshUser } from "@app/utils-offline/get-most-fresh-user";
import { usePush } from "@app/sw/web-push-notifications";
import { setCacheItem } from "@app/services/indexed-db.client";

export function meta() {
  return [
    {
      title: "Mes notifications | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }
  const formData = await request.formData();
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/action/user/${user.id}`, {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json());
  if (response.ok && response.data?.id) {
    await setCacheItem("user", response.data);
  }
  if (formData.has("_redirect")) {
    return redirect(formData.get("_redirect") as string);
  }
  return response;
}

export async function clientLoader() {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }
  return json({ user, VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY as string });
}

export default function MesNotifications() {
  const { user, VAPID_PUBLIC_KEY } = useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher({ key: "mon-profil-mes-notifications" });
  const navigate = useNavigate();

  const tokenFetcher = useFetcher({ key: "notifications-token" });
  const { subscribeToPush, canSendPush, isSubscribed, pushSubscription, pushAvailable } = usePush();

  const checkBoxChecked = useMemo(() => {
    return (
      canSendPush &&
      isSubscribed &&
      !!pushSubscription &&
      !!user?.web_push_tokens?.find((token) => JSON.parse(token)?.endpoint === pushSubscription?.endpoint)
    );
  }, [canSendPush, isSubscribed, pushSubscription, user.web_push_tokens]);

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
    <fetcher.Form id="user_roles_form" method="POST">
      <input type="hidden" name="_redirect" value="/app/tableau-de-bord/" />
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
                  key={checkBoxChecked ? "checked" : "unchecked"}
                  legend="Sélectionnez tous les types de notifications que vous souhaitez recevoir"
                  options={[
                    {
                      label: "Notification via Zacharie",
                      hintText: pushAvailable
                        ? "Notification directement sur cet appareil"
                        : "Vous devriez installer l'application sur un appareil compatible pour activer les notifications.",
                      nativeInputProps: {
                        name: "notifications",
                        value: UserNotifications.PUSH,
                        defaultChecked: checkBoxChecked,
                        disabled: !pushAvailable,
                        onClick: () => {
                          subscribeToPush(
                            VAPID_PUBLIC_KEY,
                            (subscription) => {
                              console.log({
                                subscription,
                                VAPID_PUBLIC_KEY,
                              });
                              tokenFetcher.submit(
                                {
                                  web_push_token: JSON.stringify(subscription.toJSON()),
                                },
                                {
                                  method: "POST",
                                  preventScrollReset: true,
                                },
                              );
                            },
                            (error) => {
                              console.error("Error subscribing user to push notifications!", error);
                            },
                          );
                        },
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
