import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { EntityTypes, Prisma, User, UserEtgRoles } from '@prisma/client';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import type { EntitiesWorkingForResponse, UserConnexionResponse } from '@api/src/types/responses';
import type { EntitiesById } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import ListAndSelectEntities from '@app/components/ListAndSelectEntities';

export default function EtgOnboardingEntreprise() {
  const user = useUser((state) => state.user)!;
  const [allEntitiesById, setAllEntitiesById] = useState<EntitiesById>({});
  const [userEntitiesById, setUserEntitiesById] = useState<EntitiesById>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const etgsDone = Object.keys(userEntitiesById).length > 0;

  const [visibilityChecked, setVisibilityChecked] = useState(user.user_entities_vivible_checkbox === true);

  const navigate = useNavigate();

  useEffect(() => {
    API.get({ path: 'entite/working-for' })
      .then((res) => res as EntitiesWorkingForResponse)
      .then((res) => {
        if (res.ok) {
          setAllEntitiesById(res.data.allEntitiesByTypeAndId[EntityTypes.ETG]);
          setUserEntitiesById(res.data.userEntitiesByTypeAndId[EntityTypes.ETG]);
        }
      });
  }, [refreshKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleUserFormBlur = useCallback(
    async (event: React.FocusEvent<HTMLFormElement>) => {
      const formData = new FormData(event.currentTarget);
      const body: Partial<User> = Object.fromEntries(formData.entries());
      const response = await API.post({
        path: `/user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id]
  );

  return (
    <>
      <title>{`Entreprise | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Stepper
              currentStep={2}
              stepCount={2}
              title="Entreprise"
            />
            <h1 className="fr-h2 fr-mb-2w">Renseignez votre entreprise</h1>
            <CallOut
              title="✍️ Pour pouvoir remplir les fiches qui lui sont attribuées"
              className="bg-white"
            >
              Quelle est votre entreprise ?
              <br />
              Lorsqu'une fiche lui sera attribuée, vous pourrez la prendre en charge.
            </CallOut>
            <ListAndSelectEntities
              formId="onboarding-etape-2-etg-data"
              setRefreshKey={setRefreshKey}
              refreshKey={refreshKey}
              sectionLabel="Mon Établissement de Traitement du Gibier sauvage (ETG)"
              selectLabel={!etgsDone ? 'Sélectionnez un ETG' : ''}
              canChange={!etgsDone}
              allEntitiesById={allEntitiesById}
              userEntitiesById={userEntitiesById}
            >
              {etgsDone && (
                <form
                  id="etg_roles_form"
                  className="mt-8 px-4"
                  onChange={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const etgRole = formData.get(Prisma.UserScalarFieldEnum.etg_role) as UserEtgRoles;
                    const body: Partial<User> = { etg_role: etgRole as UserEtgRoles };
                    const response = await API.post({
                      path: `/user/${user.id}`,
                      body,
                    }).then((data) => data as UserConnexionResponse);
                    if (response.ok && response.data?.user?.id) {
                      useUser.setState({ user: response.data.user });
                    }
                  }}
                  onSubmit={(e) => e.preventDefault()}
                >
                  <RadioButtons
                    legend="Que faites-vous au sein de votre ETG ?"
                    key={user.etg_role}
                    options={[
                      {
                        label: 'Transport des carcasses uniquement',
                        hintText:
                          'Si vous cochez cette case, les futures fiches seront automatiquement réassignées à votre entreprise pour la réception ultérieure',
                        nativeInputProps: {
                          name: Prisma.UserScalarFieldEnum.etg_role,
                          value: UserEtgRoles.TRANSPORT,
                          defaultChecked: user.etg_role === UserEtgRoles.TRANSPORT,
                          form: 'etg_roles_form',
                        },
                      },
                      {
                        label: 'Réception des carcasses et gestion de la logistique',
                        hintText:
                          'En cochant cette case, vous pourrez réceptionner les carcasses, et vous pourrez aussi préciser le cas échéant que votre entreprise a également transporté les carcasses vers votre entreprise.',
                        nativeInputProps: {
                          name: Prisma.UserScalarFieldEnum.etg_role,
                          value: UserEtgRoles.RECEPTION,
                          defaultChecked: user.etg_role === UserEtgRoles.RECEPTION || !user.etg_role,
                          form: 'etg_roles_form',
                        },
                      },
                    ]}
                  />
                </form>
              )}
            </ListAndSelectEntities>
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <form
                  id="user_entities_vivible_checkbox"
                  method="POST"
                  onChange={handleUserFormBlur}
                  onSubmit={(e) => e.preventDefault()}
                  className="px-8"
                >
                  <Checkbox
                    options={[
                      {
                        label:
                          "Autoriser Zacharie à faire apparaître dans les champs de transmission des fiches les sociétés ou associations pour lesquelles l'utilisateur travaille ou auxquelles il appartient.",
                        hintText:
                          'Cette autorisation est obligatoire pour le bon fonctionnement de Zacharie, sans quoi les fiches ne pourront pas être attribuées à votre entreprise',
                        nativeInputProps: {
                          required: true,
                          name: Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox,
                          value: 'true',
                          onChange: () => setVisibilityChecked(!visibilityChecked),
                          checked: visibilityChecked,
                        },
                      },
                    ]}
                  />
                </form>
                <div className="mt-6 ml-6">
                  <a
                    className="fr-link fr-icon-arrow-up-fill fr-link--icon-left"
                    href="#top"
                  >
                    Haut de page
                  </a>
                </div>
              </div>
              <div className="fixed bottom-16 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:bottom-0 md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: 'Enregistrer et continuer',
                      disabled: !visibilityChecked,
                      type: 'button',
                      nativeButtonProps: {
                        onClick: () => {
                          navigate('/app/etg');
                        },
                      },
                    },
                    {
                      children: 'Modifier mes coordonnées',
                      linkProps: {
                        to: '/app/etg/onboarding/coordonnees',
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
    </>
  );
}
