import { useCallback, useEffect, useMemo } from 'react';

import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { UserRoles, Prisma, User } from '@prisma/client';
import InputVille from '@app/components/InputVille';
import InputNotEditable from '@app/components/InputNotEditable';
import type { UserConnexionResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import { useNavigate } from 'react-router';
import API from '@app/services/api';

export default function MesCoordonnees() {
  const user = useUser((state) => state.user)!;

  const navigate = useNavigate();

  const handleUserFormBlur = useCallback(
    async (event: React.FocusEvent<HTMLFormElement>) => {
      const formData = new FormData(event.currentTarget);
      const body: Partial<User> = Object.fromEntries(formData.entries());
      const response = await API.post({
        path: `user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id],
  );

  const nextTitle = useMemo(() => {
    if (user.roles.includes(UserRoles.CHASSEUR)) {
      return 'Mes informations de chasse';
    }
    if (user.roles.includes(UserRoles.SVI)) {
      return 'Mon service';
    }
    return 'Mon entreprise';
  }, [user.roles]);
  const nextPage = useMemo(() => {
    if (user.roles.includes(UserRoles.CHASSEUR)) {
      return '/app/tableau-de-bord/mon-profil/mes-informations-de-chasse';
    }
    return '/app/tableau-de-bord/mon-profil/mon-entreprise';
  }, [user.roles]);

  const needAddress = user.roles.includes(UserRoles.CHASSEUR);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Mes coordonnées | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={2} nextTitle={nextTitle} stepCount={4} title="Mes coordonnées" />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos coordonnées</h1>
          <CallOut title="✍️ Pour pouvoir remplir les fiches qui vont sont attribuées" className="bg-white">
            Qui êtes-vous ?<br />
            Lorsqu'une fiche sera attribuée à laquelle vous êtes rattachée, vous pourrez la prendre en charge.
          </CallOut>
          <div className="mb-6 bg-white md:shadow-sm">
            <div className="p-4 md:p-8">
              <form
                id="user_data_form"
                method="POST"
                onBlur={handleUserFormBlur}
                onSubmit={(e) => e.preventDefault()}
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  <span>Votre identité</span>
                </h3>
                <p className="mb-5 text-sm text-gray-500">
                  * Les champs marqués d'un astérisque (*) sont obligatoires.
                </p>
                <Input
                  label="Nom *"
                  nativeInputProps={{
                    id: Prisma.UserScalarFieldEnum.nom_de_famille,
                    name: Prisma.UserScalarFieldEnum.nom_de_famille,
                    autoComplete: 'family-name',
                    required: true,
                    defaultValue: user.nom_de_famille ?? '',
                  }}
                />
                <Input
                  label="Prénom *"
                  nativeInputProps={{
                    id: Prisma.UserScalarFieldEnum.prenom,
                    name: Prisma.UserScalarFieldEnum.prenom,
                    autoComplete: 'given-name',
                    required: true,
                    defaultValue: user.prenom ?? '',
                  }}
                />
                <InputNotEditable
                  label="Email *"
                  nativeInputProps={{
                    id: Prisma.UserScalarFieldEnum.email,
                    name: Prisma.UserScalarFieldEnum.email,
                    required: true,
                    defaultValue: user.email ?? '',
                  }}
                />
                <Input
                  label="Téléphone *"
                  hintText="Format attendu : 01 22 33 44 55"
                  nativeInputProps={{
                    id: Prisma.UserScalarFieldEnum.telephone,
                    name: Prisma.UserScalarFieldEnum.telephone,
                    autoComplete: 'tel',
                    required: true,
                    defaultValue: user.telephone ?? '',
                  }}
                />
                <Input
                  label={needAddress ? 'Adresse *' : 'Adresse'}
                  hintText="Indication : numéro et voie"
                  nativeInputProps={{
                    id: Prisma.UserScalarFieldEnum.addresse_ligne_1,
                    name: Prisma.UserScalarFieldEnum.addresse_ligne_1,
                    autoComplete: 'address-line1',
                    required: needAddress,
                    defaultValue: user.addresse_ligne_1 ?? '',
                  }}
                />
                <Input
                  label="Complément d'adresse (optionnel)"
                  hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                  nativeInputProps={{
                    id: Prisma.UserScalarFieldEnum.addresse_ligne_2,
                    name: Prisma.UserScalarFieldEnum.addresse_ligne_2,
                    autoComplete: 'address-line2',
                    defaultValue: user.addresse_ligne_2 ?? '',
                  }}
                />
                <div className="flex w-full flex-col gap-x-4 md:flex-row">
                  <Input
                    label={needAddress ? 'Code postal *' : 'Code postal'}
                    hintText="5 chiffres"
                    className="shrink-0 md:basis-1/5"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.code_postal,
                      name: Prisma.UserScalarFieldEnum.code_postal,
                      autoComplete: 'postal-code',
                      required: needAddress,
                      defaultValue: user.code_postal ?? '',
                    }}
                  />
                  <div className="basis-4/5">
                    <InputVille
                      postCode={user.code_postal ?? ''}
                      trimPostCode
                      label={needAddress ? 'Ville ou commune *' : 'Ville ou commune'}
                      hintText="Exemple : Montpellier"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.ville,
                        name: Prisma.UserScalarFieldEnum.ville,
                        autoComplete: 'address-level2',
                        required: needAddress,
                        defaultValue: user.ville ?? '',
                      }}
                    />
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="mb-6 bg-white md:shadow-sm">
            <div className="p-4 md:p-8">
              <div className="mt-6 ml-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: 'Enregistrer et Continuer',
                    type: 'button',
                    nativeButtonProps: {
                      onClick: () => navigate(nextPage),
                    },
                  },
                  {
                    children: 'Modifier mes rôles',
                    linkProps: {
                      to: '/app/tableau-de-bord/mon-profil/mon-activite',
                      href: '#',
                    },
                    priority: 'secondary',
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
