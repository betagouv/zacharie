import { useState, useEffect } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { EntityTypes, UserRoles } from '@prisma/client';
import type { EntitiesWorkingForResponse } from '@api/src/types/responses';
import type { EntitiesByTypeAndId } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import { useNavigate } from 'react-router';
import API from '@app/services/api';
import ListAndSelectEntities from '@app/components/ListAndSelectEntities';

const empytEntitiesByTypeAndId: EntitiesByTypeAndId = {
  [EntityTypes.PREMIER_DETENTEUR]: {},
  [EntityTypes.CCG]: {},
  [EntityTypes.COLLECTEUR_PRO]: {},
  [EntityTypes.COMMERCE_DE_DETAIL]: {},
  [EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE]: {},
  [EntityTypes.ASSOCIATION_CARITATIVE]: {},
  [EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF]: {},
  [EntityTypes.CONSOMMATEUR_FINAL]: {},
  [EntityTypes.ETG]: {},
  [EntityTypes.SVI]: {},
};

export default function CircuitCourtOnboardingEntreprise() {
  const user = useUser((state) => state.user)!;
  const [allEntitiesByTypeAndId, setAllEntitiesByTypeAndId] = useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [userEntitiesByTypeAndId, setUserEntitiesByTypeAndId] = useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    API.get({ path: 'entite/working-for' })
      .then((res) => res as EntitiesWorkingForResponse)
      .then((res) => {
        if (res.ok) {
          setAllEntitiesByTypeAndId(res.data.allEntitiesByTypeAndId);
          setUserEntitiesByTypeAndId(res.data.userEntitiesByTypeAndId);
        }
      });
  }, [refreshKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <title>{`Mon entreprise | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Stepper
              currentStep={2}
              stepCount={2}
              title="Entreprise"
            />
            <h1 className="fr-h2 fr-mb-2w">{'Renseignez votre entreprise'}</h1>
            <CallOut
              title="✍️ Pour pouvoir remplir les fiches qui lui sont attribuées"
              className="bg-white"
            >
              Quelle est votre entreprise ?
              <br />
              Lorsqu'une fiche lui sera attribuée, vous pourrez la prendre en charge.
            </CallOut>
            {user.roles.includes(UserRoles.COMMERCE_DE_DETAIL) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-circuit-court-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Commerce de Détail"
                selectLabel="Cherchez un autre Commerce de Détail"
                canChange={false}
                allEntitiesById={allEntitiesByTypeAndId[EntityTypes.COMMERCE_DE_DETAIL]}
                userEntitiesById={userEntitiesByTypeAndId[EntityTypes.COMMERCE_DE_DETAIL]}
              />
            )}
            {user.roles.includes(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-circuit-court-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Ma Cantine ou Restauration Collective"
                selectLabel="Cherchez une autre Cantine ou Restauration Collective"
                canChange={false}
                allEntitiesById={allEntitiesByTypeAndId[EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE]}
                userEntitiesById={userEntitiesByTypeAndId[EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE]}
              />
            )}
            {user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-circuit-court-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Association Caritative"
                selectLabel="Cherchez une autre Association Caritative"
                canChange={false}
                allEntitiesById={allEntitiesByTypeAndId[EntityTypes.ASSOCIATION_CARITATIVE]}
                userEntitiesById={userEntitiesByTypeAndId[EntityTypes.ASSOCIATION_CARITATIVE]}
              />
            )}
            {user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-circuit-court-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Repas de Chasse ou Associatif"
                selectLabel="Cherchez un autre Repas de Chasse ou Associatif"
                canChange={false}
                allEntitiesById={allEntitiesByTypeAndId[EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF]}
                userEntitiesById={userEntitiesByTypeAndId[EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF]}
              />
            )}
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
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
                      disabled: false,
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
