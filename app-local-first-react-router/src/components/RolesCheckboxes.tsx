import useUser from '@app/zustand/user';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Prisma, UserRoles, User } from '@prisma/client';
import { useState } from 'react';

export default function RolesCheckBoxes({
  user,
  legend = "Sélectionnez l'activité qui vous correspond",
  withAdmin = false,
}: {
  user?: User;
  legend?: string;
  withAdmin?: boolean;
}) {
  const me = useUser((state) => state.user!);
  const [selectedRole, setSelectedRole] = useState<UserRoles | null>(user?.roles[0] || null);
  const [isAdmin, setIsAdmin] = useState(user?.isZacharieAdmin || false);

  const canChange = me?.isZacharieAdmin;
  // if (!me.activated) {
  //   canChange = true;
  // }

  const handleRoleChange = (role: UserRoles) => {
    setSelectedRole(role);
  };

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsAdmin(e.target.checked);
  };

  const radioButtonsClass = !canChange ? 'pointer-events-none cursor-not-allowed opacity-50' : '';

  const roleOptions = [
    {
      label: 'Chasseur et/ou Examinateur Initial',
      hintText: <>Vous êtes chasseur et/ou vous avez été formé par votre fédération à l\'examen initial.</>,
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.CHASSEUR,
        onChange: () => handleRoleChange(UserRoles.CHASSEUR),
        checked: selectedRole === UserRoles.CHASSEUR,
      },
    },
    {
      label: 'Collecteur Professionnel Indépendant',
      hintText: "Vous êtes salarié ou responsable d'un établissement qui transporte du gibier sauvage",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.COLLECTEUR_PRO,
        onChange: () => handleRoleChange(UserRoles.COLLECTEUR_PRO),
        checked: selectedRole === UserRoles.COLLECTEUR_PRO,
      },
    },
    {
      label: 'Établissement de Traitement du Gibier sauvage (ETG)',
      hintText: "Vous êtes salarié ou responsable d'un établissement qui peut traiter et transporter du gibier sauvage",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ETG,
        onChange: () => handleRoleChange(UserRoles.ETG),
        checked: selectedRole === UserRoles.ETG,
      },
    },
    {
      label: 'Commerce de détail',
      hintText:
        'Boucherie, charcuterie, restaurant, traiteur, alimentation générale, supérette, grande et moyenne surface...',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.COMMERCE_DE_DETAIL,
        onChange: () => handleRoleChange(UserRoles.COMMERCE_DE_DETAIL),
        checked: selectedRole === UserRoles.COMMERCE_DE_DETAIL,
      },
    },
    {
      label: 'Cantine ou restauration collective',
      hintText: 'Cantine, restauration collective, etc.',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE,
        onChange: () => handleRoleChange(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE),
        checked: selectedRole === UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE,
      },
    },
    {
      label: 'Association caritative',
      hintText: 'Association caritative, etc.',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ASSOCIATION_CARITATIVE,
        onChange: () => handleRoleChange(UserRoles.ASSOCIATION_CARITATIVE),
        checked: selectedRole === UserRoles.ASSOCIATION_CARITATIVE,
      },
    },
    {
      label: 'Repas de chasse ou associatif',
      hintText: 'Repas de chasse ou associatif, etc.',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF,
        onChange: () => handleRoleChange(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF),
        checked: selectedRole === UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF,
      },
    },
    {
      label: 'Consommateur final',
      hintText: 'Consommateur final chassant pour sa consommation personnelle',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.CONSOMMATEUR_FINAL,
        onChange: () => handleRoleChange(UserRoles.CONSOMMATEUR_FINAL),
        checked: selectedRole === UserRoles.CONSOMMATEUR_FINAL,
      },
    },
    {
      label: "Service Vétérinaire d'Inspection (SVI)",
      hintText: "Vous êtes agréé par l'État pour effectuer des inspections vétérinaires",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.SVI,
        onChange: () => handleRoleChange(UserRoles.SVI),
        checked: selectedRole === UserRoles.SVI,
      },
    },
  ];

  return (
    <>
      <RadioButtons
        hintText="Vous ne pouvez pas cumuler plusieurs activités dans Zacharie."
        legend={canChange ? legend : 'Voici votre activité sur Zacharie'}
        className={radioButtonsClass}
        options={roleOptions}
      />
      {withAdmin && (
        <Checkbox
          className="mb-8"
          options={[
            {
              label: 'Administrateur',
              nativeInputProps: {
                name: Prisma.UserScalarFieldEnum.isZacharieAdmin,
                onChange: handleAdminChange,
                checked: isAdmin,
              },
            },
          ]}
        />
      )}
    </>
  );
}
