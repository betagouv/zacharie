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
  const [checkedRoles, setCheckedRoles] = useState(user?.roles || []);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value as UserRoles;
    const currentRoles = checkedRoles;
    if (!e.target.checked) {
      setCheckedRoles((roles) => roles.filter((role) => role !== e.target.value));
      return;
    }
    let nextRoles: Array<UserRoles> = [nextValue];
    switch (nextValue) {
      case UserRoles.EXAMINATEUR_INITIAL:
        if (currentRoles.includes(UserRoles.PREMIER_DETENTEUR)) {
          nextRoles.push(UserRoles.PREMIER_DETENTEUR);
        }
        break;
      case UserRoles.PREMIER_DETENTEUR:
        if (currentRoles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
          nextRoles.push(UserRoles.EXAMINATEUR_INITIAL);
        }
        break;
      case UserRoles.COLLECTEUR_PRO:
        if (currentRoles.includes(UserRoles.ETG)) {
          nextRoles.push(UserRoles.ETG);
        }
        break;
      case UserRoles.ETG:
        if (currentRoles.includes(UserRoles.COLLECTEUR_PRO)) {
          nextRoles.push(UserRoles.COLLECTEUR_PRO);
        }
        break;
      default:
      case UserRoles.SVI:
        break;
    }
    if (currentRoles.includes(UserRoles.ADMIN)) {
      nextRoles.push(UserRoles.ADMIN);
    }
    setCheckedRoles(nextRoles);
  };

  const isSvi = user?.roles.includes(UserRoles.SVI);
  const isExamOrPremDet =
    user?.roles.includes(UserRoles.EXAMINATEUR_INITIAL) || user?.roles.includes(UserRoles.PREMIER_DETENTEUR);
  const isCollecteurProOrEtg =
    user?.roles.includes(UserRoles.COLLECTEUR_PRO) || user?.roles.includes(UserRoles.ETG);

  const options = [
    {
      label: 'Examinateur Initial',
      hintText:
        "Vous avez été formé par votre fédération à l'examen initial. Munissez-vous de votre numéro d'attestation (de la forme CFEI-DEP-YY-001 ou  DEP-FREI-YY-001) pour l'étape suivante",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.EXAMINATEUR_INITIAL,
        onChange: handleCheckboxChange,
        disabled: withAdmin ? false : isCollecteurProOrEtg || isSvi,
        checked: checkedRoles.includes(UserRoles.EXAMINATEUR_INITIAL),
      },
    },
    {
      label: 'Premier Détenteur',
      hintText: 'Vous êtes un chasseur, une société, une association de chasse',
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.PREMIER_DETENTEUR,
        onChange: handleCheckboxChange,
        disabled: withAdmin ? false : isCollecteurProOrEtg || isSvi,
        checked: checkedRoles.includes(UserRoles.PREMIER_DETENTEUR),
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
        disabled: withAdmin ? false : isExamOrPremDet || isSvi,
        checked: checkedRoles.includes(UserRoles.COLLECTEUR_PRO),
      },
    },
    {
      label: 'Établissement de Traitement du Gibier sauvage (ETG)',
      hintText: "Le nom de l'établissement pour lequel vous travaillez sera demandé à l'étape suivante",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.ETG,
        onChange: handleCheckboxChange,
        disabled: withAdmin ? false : isExamOrPremDet || isSvi,
        checked: checkedRoles.includes(UserRoles.ETG),
      },
    },
    {
      label: "Service Vétérinaire d'Inspection (SVI)",
      hintText: "Le nom de l'établissement pour lequel vous travaillez sera demandé à l'étape suivante",
      nativeInputProps: {
        name: Prisma.UserScalarFieldEnum.roles,
        value: UserRoles.SVI,
        onChange: handleCheckboxChange,
        disabled: withAdmin ? false : isCollecteurProOrEtg || isExamOrPremDet || isSvi,
        checked: checkedRoles.includes(UserRoles.SVI),
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
        hintText="Vous pouvez cumuler Examinateur Initial et Premier Détenteur, ou bien Collecteur Professionnel et ETG, mais ce sont les seuls rôles que vous pouvez cumuler."
        legend={canChange ? legend : 'Voici vos rôles sur Zacharie'}
        disabled={!canChange}
        options={options}
      />
    </>
  );
}
