import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Prisma, User } from '@prisma/client';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import type { EntitiesWorkingForResponse, UserConnexionResponse } from '@api/src/types/responses';
import type { EntitiesById } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import ListAndSelectEntities from '@app/components/ListAndSelectEntities';

export default function CircuitCourtProfilEntreprise() {
  const user = useUser((state) => state.user)!;
  const [allEntitiesById, setAllEntitiesById] = useState<EntitiesById>({});
  const [userEntitiesById, setUserEntitiesById] = useState<EntitiesById>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const circuitCourtDone = Object.keys(userEntitiesById).length > 0;

  const [visibilityChecked, setVisibilityChecked] = useState(user.user_entities_vivible_checkbox === true);

  const navigate = useNavigate();

  useEffect(() => {
    API.get({ path: 'entite/working-for' })
      .then((res) => res as EntitiesWorkingForResponse)
      .then((res) => {
        if (res.ok) {
          // @ts-expect-error Property 'ADMIN' does not exist on type 'EntitiesByTypeAndId'
          setAllEntitiesById(res.data.allEntitiesByTypeAndId[user.roles[0]]);
          // @ts-expect-error Property 'ADMIN' does not exist on type 'EntitiesByTypeAndId'
          setUserEntitiesById(res.data.userEntitiesByTypeAndId[user.roles[0]]);
        }
      });
  }, [refreshKey, user.roles]);

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
            <h1 className="fr-h2 fr-mb-2w">Renseignez votre entreprise</h1>
            <CallOut title="✍️ Pour pouvoir remplir les fiches qui lui sont attribuées" className="bg-white">
              Quelle est votre entreprise ?
              <br />
              Lorsqu'une fiche lui sera attribuée, vous pourrez la prendre en charge.
            </CallOut>
            <ListAndSelectEntities
              formId="onboarding-etape-2-circuit-court-data"
              setRefreshKey={setRefreshKey}
              refreshKey={refreshKey}
              sectionLabel="Mon Entreprise"
              selectLabel={!circuitCourtDone ? 'Sélectionnez une entreprise' : ''}
              canChange={!circuitCourtDone}
              allEntitiesById={allEntitiesById}
              userEntitiesById={userEntitiesById}
            />
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
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
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
                          navigate('/app/circuit-court');
                        },
                      },
                    },
                    {
                      children: 'Modifier mes coordonnées',
                      linkProps: {
                        to: '/app/circuit-court/onboarding/coordonnees',
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
