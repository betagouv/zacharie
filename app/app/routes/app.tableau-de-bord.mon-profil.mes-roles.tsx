import { json, redirect, useFetcher, useLoaderData, type ClientActionFunctionArgs } from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import RolesCheckBoxes from "@app/components/RolesCheckboxes";
import { Prisma, UserRoles } from "@prisma/client";
import { setCacheItem } from "@app/services/indexed-db.client";
import { getMostFreshUser } from "@app/utils-offline/get-most-fresh-user";
import { getFormData } from "@app/utils/getFormData";

export function meta() {
  return [
    {
      title: "Mes rôles | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/action/user/${user.id}`, {
    method: "POST",
    credentials: "include",
    body: await getFormData(request),
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json());
  if (response.ok && response.data?.id) {
    await setCacheItem("user", response.data);
    return redirect("/app/tableau-de-bord/mon-profil/mes-informations");
  }
  return response;
}

export async function clientLoader() {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }
  return json({ user });
}

export default function MesRoles() {
  const { user } = useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher({ key: "mon-profil-mes-roles" });

  return (
    <fetcher.Form id="user_roles_form" method="POST">
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Stepper currentStep={1} nextTitle="Vos informations personnelles" stepCount={4} title="Vos rôles" />
            <h1 className="fr-h2 fr-mb-2w">Renseignez vos rôles</h1>
            <CallOut title="☝️ Un seul compte pour toutes vos casquettes" className="bg-white">
              Les acteurs de la chasse sont nombreux : examinateur, centre de collecte, etc. et parfois vous combinez
              plusieurs rôles. Zacharie vous permet de jongler entre tous très facilement.
              <br />
              Quels sont vos rôles ?
            </CallOut>
            <div className="mb-6 bg-white md:shadow">
              <div className="p-4 pb-32 md:p-8 md:pb-0">
                {user.roles.includes(UserRoles.ADMIN) && (
                  <input type="hidden" name={Prisma.UserScalarFieldEnum.roles} value={UserRoles.ADMIN} />
                )}
                <RolesCheckBoxes
                  user={user}
                  legend="Sélectionnez tous les rôles qui vous correspondent"
                  withAdmin={user.roles.includes(UserRoles.ADMIN)}
                />
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
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
