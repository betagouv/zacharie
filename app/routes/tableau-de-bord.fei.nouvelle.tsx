import { useState } from "react";
import dayjs from "dayjs";
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Prisma, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import UserNotEditable from "~/components/UserNotEditable";
import InputVille from "~/components/InputVille";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  let feiNumero = params.fei_numero;
  const formData = await request.formData();

  const newId = (await prisma.fei.count()) + 1;
  const today = dayjs().format("YYYYMMDD");
  feiNumero = `ZACH-FEI-${today}-${newId.toString().padStart(9, "0")}`;

  // Create a new object with only the fields that are required and set
  const createData: Prisma.FeiCreateInput = {
    numero: feiNumero,
    FeiCurrentUser: {
      connect: {
        id: user.id,
      },
    },
    FeiCreatedByUser: {
      connect: {
        id: user.id,
      },
    },
  };

  if (formData.get(Prisma.FeiScalarFieldEnum.detenteur_initial_user_id)) {
    createData.FeiDetenteurInitialUser = {
      connect: {
        id: user.id,
      },
    };
    createData.fei_current_owner_role = UserRoles.DETENTEUR_INITIAL;
  }
  if (formData.get(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
    if (!formData.get(Prisma.FeiScalarFieldEnum.commune_mise_a_mort)) {
      return json({ ok: false, data: null, error: "La commune de mise à mort est obligatoire" }, { status: 400 });
    }

    if (!formData.get(Prisma.FeiScalarFieldEnum.date_mise_a_mort)) {
      return json({ ok: false, data: null, error: "La date de mise à mort est obligatoire" }, { status: 400 });
    }

    createData.date_mise_a_mort = new Date(formData.get(Prisma.FeiScalarFieldEnum.date_mise_a_mort) as string);
    createData.commune_mise_a_mort = formData.get(Prisma.FeiScalarFieldEnum.commune_mise_a_mort) as string;
    createData.FeiExaminateurInitialUser = {
      connect: {
        id: user.id,
      },
    };
    createData.fei_current_owner_role = UserRoles.EXAMINATEUR_INITIAL;
  }

  const fei = await prisma.fei.create({
    data: createData,
  });

  return redirect(`/tableau-de-bord/fei/${fei.numero}`);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  return json({ user });
}

export default function NouvelleFEI() {
  const { user } = useLoaderData<typeof loader>();

  const [feiInitRoles, setFeiInitRoles] = useState<UserRoles[]>(() => {
    if (!user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      return [UserRoles.DETENTEUR_INITIAL];
    }
    if (!user.roles.includes(UserRoles.DETENTEUR_INITIAL)) {
      return [UserRoles.EXAMINATEUR_INITIAL];
    }
    return [];
  });

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvelle FEI</h1>
          <CallOut title="📮 N'oubliez-pas d'assigner la FEI une fois remplie !" className="bg-white">
            Zacharie se chargera de notifier les personnes concernées.
          </CallOut>
          <div className="bg-white mb-6 md:shadow">
            <div className="p-4 md:p-8 md:pb-4">
              {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) &&
                user.roles.includes(UserRoles.DETENTEUR_INITIAL) && (
                  <Checkbox
                    legend="Pour cette FEI vous êtes"
                    options={[
                      {
                        label: "Détenteur initial",
                        nativeInputProps: {
                          name: "fei-init-roles",
                          value: UserRoles.DETENTEUR_INITIAL,
                          defaultChecked: feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL),
                          onChange: (event) => {
                            if (event.target.checked) {
                              setFeiInitRoles((prev) => [...prev, UserRoles.DETENTEUR_INITIAL]);
                            } else {
                              setFeiInitRoles((prev) => prev.filter((role) => role !== UserRoles.DETENTEUR_INITIAL));
                            }
                          },
                        },
                      },
                      {
                        label: "Examinateur initial",
                        nativeInputProps: {
                          name: "fei-init-roles",
                          value: UserRoles.EXAMINATEUR_INITIAL,
                          defaultChecked: feiInitRoles.includes(UserRoles.EXAMINATEUR_INITIAL),
                          onChange: (event) => {
                            if (event.target.checked) {
                              setFeiInitRoles((prev) => [...prev, UserRoles.EXAMINATEUR_INITIAL]);
                            } else {
                              setFeiInitRoles((prev) => prev.filter((role) => role !== UserRoles.EXAMINATEUR_INITIAL));
                            }
                          },
                        },
                      },
                    ]}
                  />
                )}
              <Form id="fei_create_form" method="POST">
                {feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL) && (
                  <div className="mb-8">
                    <h2 className="fr-h3 fr-mb-2w">Détenteur Initial</h2>
                    <input type="hidden" name={Prisma.FeiScalarFieldEnum.detenteur_initial_user_id} value={user.id} />
                    <UserNotEditable user={user} />
                  </div>
                )}
                {feiInitRoles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
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
                          defaultValue: new Date().toISOString().split("T")[0],
                        }}
                      />
                    </div>
                    <div className="fr-fieldset__element">
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
                    </div>
                    <UserNotEditable user={user} withCfei />
                  </div>
                )}
              </Form>
              {!!feiInitRoles.length && (
                <div className="mt-6 ml-6 mb-16 md:mb-0">
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                    Haut de page
                  </a>
                </div>
              )}
            </div>
            {!!feiInitRoles.length && (
              <div className="fixed md:relative bottom-0 left-0 w-full md:w-auto p-6 pb-2 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white shadow-2xl md:shadow-none">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
