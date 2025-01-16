import useUser from '@app/zustand/user';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Prisma, UserRoles, User } from '@prisma/client';
import { useState } from 'react';

export default function RolesCheckBoxes({
  user,
  legend = 'Sélectionnez tous les rôles qui vous correspondent',
  withAdmin = false,
}: {
  user?: User;
  legend?: string;
  withAdmin?: boolean;
}) {
  const me = useUser((state) => state.user);

  const [checkedRoles, setCheckedRoles] = useState(user?.roles || []);

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
      label: 'Examinateur Initial',
      hintText:
        "Vous avez été formé par votre fédération à l'examen initial. Munissez-vous de votre numéro d'attestation (de la forme CFEI-DEP-YY-001 ou  DEP-FREI-YY-001) pour l'étape suivante",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.EXAMINATEUR_INITIAL,
        onChange: handleCheckboxChange,
        disabled: !withAdmin && isSvi,
        defaultChecked: user?.roles.includes(UserRoles.EXAMINATEUR_INITIAL),
      },
    },
    {
      label: 'Premier Détenteur',
      hintText: 'Vous êtes un chasseur, une société, une association de chasse',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.PREMIER_DETENTEUR,
        onChange: handleCheckboxChange,
        disabled: !withAdmin && isSvi,
        defaultChecked: user?.roles.includes(UserRoles.PREMIER_DETENTEUR),
      },
    },
    {
      label: 'Collecteur Professionnel',
      hintText:
        'Vous récupérez les carcasses en peau auprès de plusieurs premiers détenteurs pour les livrer aux Établissements de Traitement du Gibier sauvage agréés (ETG). Le nom de l’établissement avec lequel vous travaillez sera demandé à l’étape suivante',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.COLLECTEUR_PRO,
        onChange: handleCheckboxChange,
        disabled: !withAdmin && isSvi,
        defaultChecked: user?.roles.includes(UserRoles.COLLECTEUR_PRO),
      },
    },
    {
      label: 'Établissement de Traitement du Gibier sauvage (ETG)',
      hintText: "Le nom de l'établissement pour lequel vous travaillez sera demandé à l'étape suivante",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ETG,
        onChange: handleCheckboxChange,
        disabled: !withAdmin && isSvi,
        defaultChecked: user?.roles.includes(UserRoles.ETG),
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
        defaultChecked: user?.roles.includes(UserRoles.SVI),
      },
    },
    {
      label: 'Administrateur',
      hintText: "Vous avez accès à la création d'entités et d'utilisateurs de Zacharie",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ADMIN,
        disabled: user?.roles.includes(UserRoles.ADMIN),
        onChange: handleCheckboxChange,
        defaultChecked: user?.roles.includes(UserRoles.ADMIN),
      },
    },
  ];

  if (!withAdmin) {
    options.pop();
  }

  const canChange = me?.roles.includes(UserRoles.ADMIN);

  return (
    <>
      <Checkbox
        hintText={
          canChange ? (
            ''
          ) : (
            <>
              Seul un administrateur de Zacharie peut modifier vos rôles pour le moment.{' '}
              <a href="mailto:contact@zacharie.beta.gouv.fr?subject=Une question à propos de mes rôles sur Zacharie">
                Cliquez ici pour nous contacter si besoin
              </a>
            </>
          )
        }
        legend={canChange ? legend : 'Voici vos rôles sur Zacharie'}
        disabled={!canChange}
        options={options}
      />
    </>
  );
}
