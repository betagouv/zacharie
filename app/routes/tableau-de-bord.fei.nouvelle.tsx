import dayjs from "dayjs";
import { json, redirect, type ClientActionFunctionArgs } from "@remix-run/react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Prisma, UserRoles, type User } from "@prisma/client";
import UserNotEditable from "~/components/UserNotEditable";
import { getCacheItem } from "~/services/indexed-db.client";
import type { FeiNouvelleActionData } from "~/routes/action.fei.nouvelle";
import { setFeiToCache } from "~/utils/caches";

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const response = (await fetch(`${import.meta.env.VITE_API_URL}/action/fei/nouvelle`, {
    method: "POST",
    credentials: "include",
    body: await request.formData(),
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json())) as FeiNouvelleActionData;
  if (response.ok && response.data?.numero) {
    const fei = response.data;
    setFeiToCache(fei);
    return redirect(`/tableau-de-bord/fei/${fei.numero}`);
  }
  return response;
}

export async function clientLoader() {
  const user = (await getCacheItem("user")) as User | null;
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    return json({ user });
  }
  throw redirect("/tableau-de-bord");
}

export default function NouvelleFEI() {
  const { user } = useLoaderData<typeof clientLoader>();
  const nouvelleFeiFetcher = useFetcher({ key: "fei_create_form" });

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvelle FEI</h1>
          <CallOut title="📮 N'oubliez-pas d'assigner la FEI une fois remplie !" className="bg-white">
            Zacharie se chargera de notifier les personnes concernées.
          </CallOut>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-4">
              <nouvelleFeiFetcher.Form id="fei_create_form" method="POST">
                <div className="mb-8">
                  <h2 className="fr-h3 fr-mb-2w">Examinateur Initial</h2>
                  <input type="hidden" name={Prisma.FeiScalarFieldEnum.examinateur_initial_user_id} value={user.id} />
                  <div className="fr-fieldset__element">
                    <Input
                      label="Date de mise à mort et d'éviscération"
                      nativeInputProps={{
                        id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                        name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                        type: "date",
                        required: true,
                        autoComplete: "off",
                        suppressHydrationWarning: true,
                        defaultValue: dayjs().toISOString().split("T")[0],
                      }}
                    />
                  </div>
                  {/* <div className="fr-fieldset__element">
                    <InputVille
                      label="Commune de mise à mort"
                      nativeInputProps={{
                        id: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
                        name: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
                        type: "text",
                        required: true,
                        autoComplete: "off",
                        defaultValue: "",
                      }}
                    />
                  </div> */}
                  <UserNotEditable user={user} withCfei />
                </div>
                {/* <div className="mb-8">
                  <h2 className="fr-h3 fr-mb-2w">Premier Détenteur</h2>
                  <Checkbox
                    options={[
                      {
                        label: "Je suis aussi le Premier Détenteur des carcasses examinées",
                        nativeInputProps: {
                          name: Prisma.FeiScalarFieldEnum.premier_detenteur_user_id,
                          value: user.id,
                        },
                      },
                    ]}
                  />
                </div> */}
              </nouvelleFeiFetcher.Form>
              <div className="mb-16 ml-6 mt-6 md:mb-0">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
              {/* <div className="relative md:relative md:mt-16 bottom-0 left-0 w-full md:w-auto p-6 pb-2 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white"> */}
              <ButtonsGroup
                buttons={[
                  {
                    children: "Créer la FEI",
                    type: "submit",
                    nativeButtonProps: {
                      form: "fei_create_form",
                    },
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
