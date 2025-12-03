import useUser from '@app/zustand/user';
import { Checkbox, CheckboxProps } from '@codegouvfr/react-dsfr/Checkbox';
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
  const me = useUser((state) => state.user!);
  const [checkedRoles, setCheckedRoles] = useState(user?.roles || []);

  let canChange = me?.roles.includes(UserRoles.ADMIN);
  // if (!me.activated) {
  //   canChange = true;
  // }

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
    setCheckedRoles(nextRoles);
  };

  // type of option props of Checkbox component
  const options: CheckboxProps['options'] = [
    {
      label: 'Chasseur et/ou Examinateur Initial',
      hintText: <>Vous êtes chasseur et/ou vous avez été formé par votre fédération à l'examen initial.</>,
      nativeInputProps: {
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : me.activated
            ? 'pointer-events-none cursor-not-allowed opacity-50'
            : me.roles?.length > 0
              ? 'pointer-events-none cursor-not-allowed opacity-50'
              : '',
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
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : 'pointer-events-none cursor-not-allowed opacity-50',
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
        // il y a un nombre limité de ETG en France (26-27), et
        // chaque nouvel utilisateur ETG doit être invité par un membre de son entreprise/service
        // donc si un utilisateur est ETG, il ne peut pas changer son rôle
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : 'pointer-events-none cursor-not-allowed opacity-50',
      },
    },
    {
      label: 'Commerce de détail',
      hintText:
        'Boucherie, charcuterie, restaurant, traiteur, alimentation générale, supérette, grande et moyenne surface...',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ETG,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.COMMERCE_DE_DETAIL),
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : 'pointer-events-none cursor-not-allowed opacity-50',
      },
    },
    {
      label: 'Cantine ou restauration collective',
      hintText: 'Cantine, restauration collective, etc.',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE),
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : 'pointer-events-none cursor-not-allowed opacity-50',
      },
    },
    {
      label: 'Association caritative',
      hintText: 'Association caritative, etc.',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ASSOCIATION_CARITATIVE,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.ASSOCIATION_CARITATIVE),
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : 'pointer-events-none cursor-not-allowed opacity-50',
      },
    },
    {
      label: 'Repas de chasse ou associatif',
      hintText: 'Repas de chasse ou associatif, etc.',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF),
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : 'pointer-events-none cursor-not-allowed opacity-50',
      },
    },
    {
      label: 'Consommateur final',
      hintText: 'Je suis consommateur final et je chasse pour ma consommation personnelle',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.CONSOMMATEUR_FINAL,
        onChange: handleCheckboxChange,
        checked: checkedRoles.includes(UserRoles.CONSOMMATEUR_FINAL),
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : 'pointer-events-none cursor-not-allowed opacity-50',
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
        // chaque nouvel utilisateur SVI doit être invité par un membre de son service
        // donc si un utilisateur est SVI, il ne peut pas changer son rôle
        className: me?.roles.includes(UserRoles.ADMIN)
          ? ''
          : 'pointer-events-none cursor-not-allowed opacity-50',
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
        className: !me.activated ? 'pointer-events-none cursor-not-allowed opacity-50' : '',
      },
    },
  ];

  if (!withAdmin) {
    options.pop();
  }

  return (
    <>
      <Checkbox
        hintText="Vous ne pouvez pas cumuler plusieurs activités dans Zacharie."
        legend={canChange ? legend : 'Voici votre activité sur Zacharie'}
        // disabled={!canChange}
        className={!canChange ? 'pointer-events-none cursor-not-allowed opacity-50' : ''}
        options={options}
      />
    </>
  );
}
