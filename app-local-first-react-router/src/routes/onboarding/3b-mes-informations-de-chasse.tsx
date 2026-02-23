import { useState, useCallback, useEffect } from 'react';

import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { UserRoles, Prisma } from '@prisma/client';
import type { UserConnexionResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import { useNavigate, useSearchParams } from 'react-router';
import API from '@app/services/api';
import MesCCGs from './3-mes-ccgs';
import MesAssociationsDeChasse from './3-mes-associations-de-chasse';
import MesPartenaires from './3-mes-partenaires';
import { toast } from 'react-toastify';

export default function OnboardingMesInformationsDeChasse() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const user = useUser((state) => state.user)!;
  const navigate = useNavigate();

  const [visibilityChecked, setVisibilityChecked] = useState(user.user_entities_vivible_checkbox === true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleVisibilitySubmit = useCallback(
    async (visibilityChecked: boolean) => {
      const body: Record<string, string | null> = {};
      body.user_entities_vivible_checkbox = visibilityChecked ? 'true' : 'false';
      const response = await API.post({
        path: `/user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id],
  );

  const nextPage = '/app/tableau-de-bord/onboarding/mes-notifications';


  const handleSubmit = async () => {
    try {
      const response = await API.post({
        path: `/user/${user.id}`,
        body: { onboarding_chasse_info_done_at: new Date().toISOString() },
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
        navigate(redirect ?? nextPage);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'enregistrement des informations de chasse');
    }
  }


  const showEntrpriseVisibilityCheckbox =
    !!user.checked_has_asso_de_chasse ||
    user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
    user.roles.includes(UserRoles.ETG);

  const isChasseur = user.roles.includes(UserRoles.CHASSEUR);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>{`Mes informations de chasse | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper
            currentStep={3}
            nextTitle={undefined}
            stepCount={3}
            title="Informations de chasse"
          />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos informations de chasse</h1>
          <CallOut title="⚠️ Informations essentielles pour faire des fiches" className="bg-white">
            Ces informations seront reportées automatiquement sur chacune des fiches que vous allez créer.
          </CallOut>
          {isChasseur && <MesAssociationsDeChasse />}
          <MesCCGs />
          {isChasseur && <MesPartenaires />}
          <div className="mb-6 bg-white md:shadow-sm">
            <div className="p-4 md:p-8">
              {showEntrpriseVisibilityCheckbox && (
                <>
                  <form
                    id="user_data_form"
                    method="POST"
                    onSubmit={(e) => e.preventDefault()}
                    className="px-8"
                  >
                    <Checkbox
                      options={[
                        {
                          label:
                            "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens.",
                          hintText:
                            'Cette autorisation est obligatoire pour le bon fonctionnement de Zacharie, sans quoi les fiches ne pourront pas être attribuées à votre entreprise',
                          nativeInputProps: {
                            required: true,
                            name: Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox,
                            value: 'true',
                            onChange: () => {
                              setVisibilityChecked(!visibilityChecked);
                              handleVisibilitySubmit(!visibilityChecked);
                            },
                            checked: visibilityChecked,
                          },
                        },
                      ]}
                    />
                  </form>
                </>
              )}
              <div className="mt-6 ml-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
          </div>
          <div className="fixed bottom-16 left-0 z-50 flex w-full flex-col p-6 pb-2 shadow-2xl md:relative md:bottom-0 md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
            <ButtonsGroup
              inlineLayoutWhen="always"
              buttons={[
                {
                  children: redirect ? 'Retour' : 'Étape précédente',
                  linkProps: {
                    to:
                      redirect ??
                      (isChasseur
                        ? '/app/tableau-de-bord/onboarding/formation-examen-initial'
                        : '/app/tableau-de-bord/onboarding/mes-coordonnees'),
                    href: '#',
                  },
                  priority: 'secondary',
                },
                {
                  children: 'Enregistrer et continuer',
                  disabled: showEntrpriseVisibilityCheckbox ? !visibilityChecked : false,
                  type: 'button',
                  nativeButtonProps: {
                    onClick: () => handleSubmit(),
                  },
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
