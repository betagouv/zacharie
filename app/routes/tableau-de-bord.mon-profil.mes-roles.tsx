import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Prisma, UserRoles } from "@prisma/client";
import { useState } from "react";

export function meta() {
  return [
    {
      title: "Mes rôles | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  return json({ user });
}

export default function MesRoles() {
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher({ key: "mon-profil-mes-roles" });
  const [checkedRoles, setCheckedRoles] = useState(user.roles);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setCheckedRoles((roles) => [...roles, e.target.value as UserRoles]);
    } else {
      setCheckedRoles((roles) => roles.filter((role) => role !== e.target.value));
    }
  };

  const isSvi = checkedRoles.includes(UserRoles.SVI);

  return (
    <fetcher.Form id="user_roles_form" method="POST" action={`/action/user/${user.id}`}>
      <input type="hidden" name="_redirect" value="/tableau-de-bord/mon-profil/mes-informations" />
      <input type="hidden" name="onboarding_finished" value="true" />
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
            <div className="bg-white mb-6 md:shadow">
              <div className="p-4 md:p-8 pb-32 md:pb-0">
                <Checkbox
                  legend="Sélectionnez tous les rôles qui vous correspondent"
                  options={[
                    {
                      label: "Examinateur Initial",
                      hintText:
                        "Vous avez été formé par votre fédération à l'examen initial. Munissez-vous de votre numéro d'attestation (de la forme CFEI-DEP-YY-001) pour l'étape suivante",
                      nativeInputProps: {
                        name: Prisma.UserScalarFieldEnum.roles,
                        value: UserRoles.EXAMINATEUR_INITIAL,
                        onChange: handleCheckboxChange,
                        disabled: isSvi,
                        defaultChecked: user.roles.includes(UserRoles.EXAMINATEUR_INITIAL),
                      },
                    },
                    {
                      label: "Premier Détenteur",
                      hintText: "Vous êtes un chasseur, une société de chasse, une association de chasse",
                      nativeInputProps: {
                        name: Prisma.UserScalarFieldEnum.roles,
                        value: UserRoles.PREMIER_DETENTEUR,
                        onChange: handleCheckboxChange,
                        disabled: isSvi,
                        defaultChecked: user.roles.includes(UserRoles.PREMIER_DETENTEUR),
                      },
                    },
                    {
                      label: "Centre de Collecte de Gibier (CCG)",
                      hintText:
                        "Vous avez/vous utilisez un CCG, un local réfrigéré où le gibier en entreposé. Un nom du centre et le numéro DD(ec)PP sera demandé à l'étape suivante",
                      nativeInputProps: {
                        name: Prisma.UserScalarFieldEnum.roles,
                        value: UserRoles.CCG,
                        onChange: handleCheckboxChange,
                        disabled: isSvi,
                        defaultChecked: user.roles.includes(UserRoles.CCG),
                      },
                    },
                    {
                      label: "Collecteur Professionnel",
                      hintText:
                        "Vous récupèrez les carcasses et les livrez aux ETGs. Le nom de l'établissement pour lequel vous travaillez sera demandé à l'étape suivante",
                      nativeInputProps: {
                        name: Prisma.UserScalarFieldEnum.roles,
                        value: UserRoles.COLLECTEUR_PRO,
                        onChange: handleCheckboxChange,
                        disabled: isSvi,
                        defaultChecked: user.roles.includes(UserRoles.COLLECTEUR_PRO),
                      },
                    },
                    {
                      label: "Établissement de Traitement du Gibier (ETG)",
                      hintText: "Le nom de l'établissement pour lequel vous travaillez sera demandé à l'étape suivante",
                      nativeInputProps: {
                        name: Prisma.UserScalarFieldEnum.roles,
                        value: UserRoles.ETG,
                        onChange: handleCheckboxChange,
                        disabled: isSvi,
                        defaultChecked: user.roles.includes(UserRoles.ETG),
                      },
                    },
                    {
                      label: "Service Vétérinaire d'Inspection (SVI)",
                      hintText: "Le nom de l'établissement pour lequel vous travaillez sera demandé à l'étape suivante",
                      nativeInputProps: {
                        name: Prisma.UserScalarFieldEnum.roles,
                        value: UserRoles.SVI,
                        onChange: handleCheckboxChange,
                        disabled: !!checkedRoles.length && checkedRoles[0] !== UserRoles.SVI,
                        defaultChecked: user.roles.includes(UserRoles.SVI),
                      },
                    },
                  ]}
                />
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
              <div className="fixed md:relative bottom-0 left-0 w-full md:w-auto p-6 pb-2 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white shadow-2xl md:shadow-none">
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
