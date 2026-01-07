import { useState, useCallback, useEffect } from 'react';

import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { UserRoles, Prisma } from '@prisma/client';
import type { UserConnexionResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import { useNavigate, useSearchParams } from 'react-router';
import API from '@app/services/api';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import MesCCGs from './3-mes-ccgs';
import MesAssociationsDeChasse from './3-mes-associations-de-chasse';
import MesPartenaires from './3-mes-partenaires';
import { toast } from 'react-toastify';

type InformationsDeChasseProps = {
  withExaminateurInitial?: boolean;
  withAssociationsDeChasse?: boolean;
  withPartenaires?: boolean;
  withCCGs?: boolean;
};

export default function MesInformationsDeChasse({
  withExaminateurInitial = false,
  withAssociationsDeChasse = false,
  withPartenaires = false,
  withCCGs = false,
}: InformationsDeChasseProps) {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  let withEverything = withExaminateurInitial && withAssociationsDeChasse && withCCGs && withPartenaires;

  const user = useUser((state) => state.user)!;

  const [isExaminateurInitial, setIsExaminateurInitial] = useState(user.est_forme_a_l_examen_initial);
  const [numeroCfei, setNumeroCfei] = useState(user.numero_cfei ?? '');
  const [visibilityChecked, setVisibilityChecked] = useState(user.user_entities_vivible_checkbox === true);

  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = () => {
    toast.success('Informations de chasse enregistrées');
  };

  const handleUserSubmit = useCallback(
    async ({
      isExaminateurInitial,
      numeroCfei,
      visibilityChecked,
    }: {
      isExaminateurInitial: boolean | null;
      numeroCfei: string;
      visibilityChecked: boolean;
    }) => {
      const body: Record<string, string | null> = {};
      if (isExaminateurInitial) {
        body.est_forme_a_l_examen_initial = 'true';
        body.numero_cfei = numeroCfei || null;
      } else {
        body.est_forme_a_l_examen_initial = 'false';
        body.numero_cfei = null;
      }
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

  const showEntrpriseVisibilityCheckbox =
    !!user.checked_has_asso_de_chasse ||
    user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
    user.roles.includes(UserRoles.ETG);

  let title = '';
  if (withEverything) {
    title = 'Mes informations de chasse';
  } else if (withAssociationsDeChasse) {
    title = 'Mes associations de chasse';
  } else if (withPartenaires) {
    title = 'Mes partenaires';
  } else if (withCCGs) {
    title = 'Mes chambres froides (CCGs)';
  }

  let calloutTitle = '';
  if (withEverything) {
    calloutTitle = 'Renseignez vos informations de chasse';
  } else if (withAssociationsDeChasse) {
    calloutTitle = 'Renseignez vos associations de chasse';
  } else if (withPartenaires) {
    calloutTitle = 'Renseignez vos partenaires';
  } else if (withCCGs) {
    calloutTitle = 'Renseignez vos chambres froides (CCGs)';
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>{`${title} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">{calloutTitle}</h1>
          <CallOut title="⚠️ Informations essentielles pour faire des fiches" className="bg-white">
            Ces informations seront reportées automatiquement sur chacune des fiches que vous allez créer.
          </CallOut>
          {withExaminateurInitial && user.roles.includes(UserRoles.CHASSEUR) && (
            <>
              <div className="mb-6 bg-white md:shadow-sm">
                <div className="p-4 md:p-8">
                  <form id="user_data_form" method="POST" onSubmit={(e) => e.preventDefault()}>
                    {/* <h3 className="inline-flex items-center text-lg font-semibold text-gray-900">
                      <span>Examen initial</span>
                    </h3> */}
                    <RadioButtons
                      legend="Êtes-vous formé à l'examen initial ? *"
                      orientation="horizontal"
                      options={[
                        {
                          nativeInputProps: {
                            required: true,
                            checked: isExaminateurInitial === true,
                            name: Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial,
                            onChange: () => {
                              setIsExaminateurInitial(true);
                              handleUserSubmit({ isExaminateurInitial: true, numeroCfei, visibilityChecked });
                            },
                          },
                          label: 'Oui',
                        },
                        {
                          nativeInputProps: {
                            required: true,
                            checked: isExaminateurInitial === false,
                            name: 'pas_forme_a_l_examen_initial',
                            onChange: () => {
                              if (
                                !user.numero_cfei ||
                                window.confirm("N'êtes vous vraiment pas formé à l'examen initial ?")
                              ) {
                                setIsExaminateurInitial(false);
                                handleUserSubmit({
                                  isExaminateurInitial: false,
                                  numeroCfei,
                                  visibilityChecked,
                                });
                              }
                            },
                          },
                          label: 'Non',
                        },
                      ]}
                    />
                    {user.roles.includes(UserRoles.CHASSEUR) && isExaminateurInitial && (
                      <Input
                        label="Numéro d'attestation de Chasseur Formé à l'Examen Initial *"
                        hintText="De la forme CFEI-DEP-AA-123"
                        key={isExaminateurInitial ? 'true' : 'false'}
                        nativeInputProps={{
                          id: Prisma.UserScalarFieldEnum.numero_cfei,
                          name: Prisma.UserScalarFieldEnum.numero_cfei,
                          onBlur: () =>
                            handleUserSubmit({ isExaminateurInitial, numeroCfei, visibilityChecked }),
                          autoComplete: 'off',
                          required: true,
                          value: numeroCfei,
                          onChange: (e) => {
                            setNumeroCfei(e.currentTarget.value);
                          },
                        }}
                      />
                    )}
                  </form>
                </div>
              </div>
            </>
          )}

          {withAssociationsDeChasse && (
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <h3
                  className="mb-8 text-lg font-semibold text-gray-900"
                  id={`onboarding-etape-2-associations-data-title`}
                >
                  Mon association / société / domaine de chasse
                </h3>
                <MesAssociationsDeChasse />
              </div>
            </div>
          )}

          {withCCGs && <MesCCGs />}

          {withPartenaires && (
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <h3
                  className="mb-8 text-lg font-semibold text-gray-900"
                  id={`onboarding-etape-2-associations-data-title`}
                >
                  Mes partenaires
                </h3>
                <MesPartenaires />
              </div>
            </div>
          )}
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
                              handleUserSubmit({
                                isExaminateurInitial,
                                numeroCfei,
                                visibilityChecked: !visibilityChecked,
                              });
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
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: redirect ? 'Enregistrer et Continuer' : 'Enregistrer',
                    disabled: showEntrpriseVisibilityCheckbox ? !visibilityChecked : false,
                    type: 'button',
                    nativeButtonProps: {
                      onClick: () => (redirect ? navigate(redirect) : handleSubmit()),
                    },
                  },
                  ...(redirect
                    ? [
                        {
                          children: 'Retour',
                          linkProps: {
                            to: redirect,
                            href: '#',
                          },
                          priority: 'secondary' as const,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
