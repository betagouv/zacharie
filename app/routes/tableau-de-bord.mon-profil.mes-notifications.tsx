import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { usePush } from "@remix-pwa/push/client";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { UserNotifications } from "@prisma/client";
import { useEffect } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");
  return json({ user });
}

export default function TableauDeBord() {
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher({ key: "onboarding-notifications" });
  const tokenFetcher = useFetcher({ key: "notifications-token" });
  const { subscribeToPush, canSendPush, isSubscribed, pushSubscription } = usePush();

  const checkBoxChecked =
    canSendPush &&
    isSubscribed &&
    !!pushSubscription &&
    user.web_push_tokens.includes(JSON.stringify(pushSubscription));

  useEffect(() => {
    console.log(window.ENV);
    console.log(window.ENV?.VAPID_PUBLIC_KEY);
  }, []);

  return (
    <main role="main" id="content">
      <fetcher.Form id="user_roles_form" method="POST" action={`/action/user/${user.id}`}>
        <input type="hidden" name="_redirect" value="/tableau-de-bord/" />
        <div className="fr-container fr-container--fluid fr-my-md-14v">
          <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
            <div className="fr-col-12 fr-col-md-10 fr-col-lg-8">
              <div className="fr-background-alt--blue-france p-4 md:p-16 pb-32 md:pb-0">
                <Stepper currentStep={4} stepCount={4} title="Vos notifications" />
                <h1 className="fr-h2 fr-mb-2w">Activez les notifications</h1>
                <CallOut iconId="ri-bell-line" title="Soyez notifié d'une FEI qui vous est attribuée">
                  Vous pouvez être notifié par mail ou par une notification sur votre smartphone dès qu'une Fiche
                  d'Examen Initial (FEI) vous est attribuée.
                </CallOut>
                <Checkbox
                  legend="Sélectionnez tous les rôles qui vous correspondent"
                  options={[
                    {
                      label: "Notification Push",
                      hintText: canSendPush
                        ? "Notification directement sur cet appareil"
                        : "Vous devriez installer l'application sur un appareil compatible pour activer les notifications.",
                      nativeInputProps: {
                        name: "notifications",
                        value: UserNotifications.PUSH,
                        defaultChecked: checkBoxChecked,
                        disabled: !canSendPush,
                        onClick: () => {
                          subscribeToPush(
                            window.ENV.VAPID_PUBLIC_KEY,
                            (subscription) => {
                              tokenFetcher.submit(
                                {
                                  web_push_token: JSON.stringify(subscription),
                                },
                                {
                                  method: "POST",
                                  action: `/action/user/${user.id}`,
                                  preventScrollReset: true,
                                }
                              );
                            },
                            (error) => {
                              logger.error("Error subscribing user to push notifications!", error);
                            }
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
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
                <div className="fixed md:relative md:mt-16 bottom-0 left-0 w-full p-6 bg-white md:bg-transparent drop-shadow-xl z-50">
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
                        linkProps: {
                          to: "/tableau-de-bord/mon-profil/mes-informations",
                          href: "#",
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
    </main>
  );
}
