import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Prisma, UserRoles, User } from '@prisma/client';
import { useState } from 'react';

export default function RolesCheckBoxes({
  user,
  legend = 'Sélectionnez l’activité qui vous correspond',
  withAdmin = false,
}: {
  user?: User;
  legend?: string;
  withAdmin?: boolean;
}) {
  const [checkedRoles, setCheckedRoles] = useState(user?.roles || []);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value as UserRoles;
    const currentRoles = checkedRoles;
    if (!e.target.checked) {
      setCheckedRoles((roles) => roles.filter((role) => role !== e.target.value));
      return;
    }
    let nextRoles: Array<UserRoles> = [nextValue];
    if (currentRoles.includes(UserRoles.ADMIN)) {
      nextRoles.push(UserRoles.ADMIN);
    }
    console.log({ nextRoles });
    setCheckedRoles(nextRoles);
  };

  const options = [
    {
      label: 'Chasseur et/ou Examinateur Initial',
      hintText: <>Vous êtes chasseur et/ou vous avez été formé par votre fédération à l'examen initial.</>,
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.CHASSEUR,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.CHASSEUR),
      },
    },
    {
      label: 'Collecteur Professionnel Indépendant',
      hintText: 'Vous êtes salarié ou responsable d’un établissement qui transporte du gibier sauvage',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.COLLECTEUR_PRO,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.COLLECTEUR_PRO),
      },
    },
    {
      label: 'Établissement de Traitement du Gibier sauvage (ETG)',
      hintText:
        'Vous êtes salarié ou responsable d’un établissement qui peut traiter et transporter du gibier sauvage',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ETG,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.ETG),
      },
    },
    {
      label: "Service Vétérinaire d'Inspection (SVI)",
      hintText: "Vous êtes agréé par l'État pour effectuer des inspections vétérinaires",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.SVI,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.SVI),
      },
    },
    {
      label: 'Administrateur',
      hintText: "Vous avez accès à la création d'entités et d'utilisateurs de Zacharie",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ADMIN,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.ADMIN),
      },
    },
  ];

  if (!withAdmin) {
    options.pop();
  }

  // const canChange = me?.roles.includes(UserRoles.ADMIN);
  const canChange = true;

  return (
    <>
      <Checkbox
        hintText="Vous ne pouvez pas cumuler plusieurs activités dans Zacharie."
        legend={canChange ? legend : 'Voici votre activité sur Zacharie'}
        disabled={!canChange}
        options={options}
      />
    </>
  );
}
