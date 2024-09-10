import { useState } from "react";
import dayjs from "dayjs";
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Prisma, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  let feiNumero = params.fei_numero;
  const formData = await request.formData();

  if (!formData.get("commune_mise_a_mort")) {
    return json({ ok: false, data: null, error: "La commune de mise à mort est obligatoire" }, { status: 400 });
  }

  if (!formData.get("date_mise_a_mort")) {
    return json({ ok: false, data: null, error: "La date de mise à mort est obligatoire" }, { status: 400 });
  }

  const newId = (await prisma.fei.count()) + 1;
  const tenDigits = newId.toString().padStart(10, "0");
  const today = dayjs().format("YYYYMMDD");
  feiNumero = `ZACH-FEI-${today}-${tenDigits}`;

  // Create a new object with only the fields that are required and set
  const createData: Prisma.FeiCreateInput = {
    numero: feiNumero,
    commune_mise_a_mort: formData.get("commune_mise_a_mort") as string,
    date_mise_a_mort: new Date(formData.get("date_mise_a_mort") as string),
    FeiCreatedBy: {
      connect: {
        id: user.id,
      },
    },
  };

  const newFei = await prisma.fei.create({
    data: createData,
  });

  const nextFei = { ...newFei };

  if (formData.has("date_mise_a_mort")) {
    nextFei.date_mise_a_mort = new Date(formData.get("date_mise_a_mort") as string);
  }
  if (formData.has("commune_mise_a_mort")) {
    nextFei.commune_mise_a_mort = formData.get("commune_mise_a_mort") as string;
  }
  if (formData.has("approbation_mise_sur_le_marche_examinateur_initial")) {
    nextFei.approbation_mise_sur_le_marche_examinateur_initial =
      formData.get("approbation_mise_sur_le_marche_examinateur_initial") === "true" ? true : false;
  }
  if (formData.has("date_approbation_mise_sur_le_marche_examinateur_initial")) {
    nextFei.date_approbation_mise_sur_le_marche_examinateur_initial = new Date(
      formData.get("date_approbation_mise_sur_le_marche_examinateur_initial") as string
    );
  }
  const savedFei = await prisma.fei.update({
    where: { numero: feiNumero },
    data: nextFei,
  });

  console.log(formData.get("detenteur_initial_id"));
  if (formData.get("detenteur_initial_id")) {
    console.log("avec detenteur");
    await prisma.suiviFei.create({
      data: {
        fei_id: savedFei.id,
        suivi_par_user_id: user.id,
        suivi_par_user_role: UserRoles.DETENTEUR_INITIAL,
      },
    });
  }
  console.log(formData.get("examinateur_initial_id"));
  if (formData.get("examinateur_initial_id")) {
    console.log("avec examinateur");
    await prisma.suiviFei.create({
      data: {
        fei_id: savedFei.id,
        suivi_par_user_id: user.id,
        suivi_par_user_role: UserRoles.EXAMINATEUR_INITIAL,
      },
    });
  }

  if (formData.has("_redirect")) {
    return redirect(formData.get("_redirect") as string);
  }

  return json({ ok: true, data: savedFei, error: null });
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

  const [feiInitRoles, setFeiInitRoles] = useState<UserRoles[]>([]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={2} nextTitle="Vos partenaires" stepCount={4} title="Vos informations" />
          <h1 className="fr-h2 fr-mb-2w">Nouvelle FEI</h1>
          <CallOut title="📮 N'oubliez-pas d'assigner la FEI une fois remplie !" className="bg-white">
            Zacharie se chargera de notifier les personnes concernées.
          </CallOut>
          <div className="bg-white mb-6 md:shadow">
            <div className="p-4 md:p-8 md:pb-4">
              <Checkbox
                legend="Pour cette FEI vous êtes"
                hintText="Vous pouvez être à la fois Détenteur initial et Examinateur initial"
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
              <Form id="fei_create_form" method="POST">
                {feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL) && (
                  <div className="mb-8">
                    <h2 className="fr-h3 fr-mb-2w">Détenteur Initial</h2>
                    <div className="fr-fieldset__element">
                      <Select
                        label="Détenteur Initial"
                        hint="Sélectionnez le Détenteur Initial de pour cette FEI"
                        key={`${feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL)}`}
                        className="!mb-0 grow"
                        disabled
                        nativeSelectProps={{
                          id: "detenteur_initial_id",
                          name: "detenteur_initial_id",
                        }}
                      >
                        <option value={user.id} selected>
                          Vous ({user.prenom} {user.nom_de_famille} - {user.code_postal} {user.ville})
                        </option>
                      </Select>
                      <input type="hidden" name="detenteur_initial_id" value={user.id} />
                    </div>
                    <div className="fr-fieldset__element">
                      <Input
                        label="Date de mise à mort et d'éviscération"
                        nativeInputProps={{
                          id: "date_mise_a_mort",
                          name: "date_mise_a_mort",
                          type: "date",
                          autoComplete: "off",
                          required: true,
                          defaultValue: new Date().toISOString().split("T")[0],
                        }}
                      />
                    </div>
                    <div className="fr-fieldset__element">
                      <Input
                        label="Commune de mise à mort"
                        nativeInputProps={{
                          id: "commune_mise_a_mort",
                          name: "commune_mise_a_mort",
                          type: "text",
                          required: true,
                          autoComplete: "off",
                          defaultValue: "",
                        }}
                      />
                    </div>
                  </div>
                )}
                {feiInitRoles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
                  <div className="mb-8">
                    <h2 className="fr-h3 fr-mb-2w">Examinateur Initial</h2>
                    <div className="fr-fieldset__element">
                      <Select
                        label="Détenteur Initial"
                        hint="Sélectionnez le Détenteur Initial de pour cette FEI"
                        key={`${feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL)}`}
                        className="!mb-0 grow"
                        disabled
                        nativeSelectProps={{
                          name: "examineur_initial_id",
                          id: "examineur_initial_id",
                        }}
                      >
                        <option value={user.id} selected>
                          Vous ({user.prenom} {user.nom_de_famille} - {user.code_postal} {user.ville})
                        </option>
                      </Select>
                      <input type="hidden" name="examineur_initial_id" value={user.id} />
                    </div>
                    <div className="fr-fieldset__element">
                      <Input
                        label="Date de mise à mort et d'éviscération"
                        nativeInputProps={{
                          id: "date_mise_a_mort",
                          name: "date_mise_a_mort",
                          type: "date",
                          required: true,
                          autoComplete: "off",
                          defaultValue: new Date().toISOString().split("T")[0],
                        }}
                      />
                    </div>
                    <div className="fr-fieldset__element">
                      <Input
                        label="Commune de mise à mort"
                        nativeInputProps={{
                          id: "commune_mise_a_mort",
                          name: "commune_mise_a_mort",
                          type: "text",
                          required: true,
                          autoComplete: "off",
                          defaultValue: "",
                        }}
                      />
                    </div>
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
                      children: "Enregistrer",
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
