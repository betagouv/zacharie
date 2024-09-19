import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Prisma, UserRoles, User } from "@prisma/client";
import { useState } from "react";
import { SerializeFrom } from "@remix-run/node";

export default function RolesCheckBoxes({
  user,
  legend = "Sélectionnez tous les rôles qui vous correspondent",
  withAdmin = false,
}: {
  user: SerializeFrom<User>;
  legend?: string;
  withAdmin?: boolean;
}) {
  const [checkedRoles, setCheckedRoles] = useState(user.roles);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setCheckedRoles((roles) => [...roles, e.target.value as UserRoles]);
    } else {
      setCheckedRoles((roles) => roles.filter((role) => role !== e.target.value));
    }
  };

  const isSvi = checkedRoles.includes(UserRoles.SVI);

  const options = [
    {
      label: "Examinateur Initial",
      hintText:
        "Vous avez été formé par votre fédération à l'examen initial. Munissez-vous de votre numéro d'attestation (de la forme CFEI-DEP-YY-001 ou  DEP-FREI-YY-001) pour l'étape suivante",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.EXAMINATEUR_INITIAL,
        onChange: handleCheckboxChange,
        disabled: !withAdmin && isSvi,
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
        disabled: !withAdmin && isSvi,
        defaultChecked: user.roles.includes(UserRoles.PREMIER_DETENTEUR),
      },
    },
    {
      label: "Centre de Collecte de Gibier (CCG)",
      hintText:
        "Vous avez/vous utilisez un CCG, un local réfrigéré où le gibier en entreposé. Le numéro DD(ec)PP sera demandé à l'étape suivante",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.CCG,
        onChange: handleCheckboxChange,
        disabled: !withAdmin && isSvi,
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
        disabled: !withAdmin && isSvi,
        defaultChecked: user.roles.includes(UserRoles.COLLECTEUR_PRO),
      },
    },
    {
      label: "Établissement de Traitement du Gibier sauvage (ETG)",
      hintText: "Le nom de l'établissement pour lequel vous travaillez sera demandé à l'étape suivante",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ETG,
        onChange: handleCheckboxChange,
        disabled: !withAdmin && isSvi,
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
        disabled: !withAdmin && !!checkedRoles.length && checkedRoles[0] !== UserRoles.SVI,
        defaultChecked: user.roles.includes(UserRoles.SVI),
      },
    },
    {
      label: "Administrateur",
      hintText: "Vous avez accès à toutes les fonctionnalités de Zacharie",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ADMIN,
        onChange: handleCheckboxChange,
        defaultChecked: user.roles.includes(UserRoles.ADMIN),
      },
    },
  ];

  if (!withAdmin) {
    options.pop();
  }

  return <Checkbox legend={legend} options={options} />;
}
