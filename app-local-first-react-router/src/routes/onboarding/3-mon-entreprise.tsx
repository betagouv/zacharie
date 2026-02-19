import { useState, useCallback, useEffect } from 'react';

import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import {
  EntityTypes,
  EntityRelationType,
  UserRoles,
  Prisma,
  User,
  UserEtgRoles,
  EntityRelationStatus,
} from '@prisma/client';
import type { EntitiesWorkingForResponse, UserConnexionResponse } from '@api/src/types/responses';
import type { EntitiesByTypeAndId } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import { Link, useNavigate } from 'react-router';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';
import RelationEntityUser from '@app/components/RelationEntityUser';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';

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

export default function MonEntreprise() {
  const user = useUser((state) => state.user)!;
  const [allEntitiesByTypeAndId, setAllEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [userEntitiesByTypeAndId, setUserEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [refreshKey, setRefreshKey] = useState(0);

  const userCollecteursPro = user.roles.includes(UserRoles.COLLECTEUR_PRO)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.COLLECTEUR_PRO])
    : [];
  const userEtgs = user.roles.includes(UserRoles.ETG)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.ETG])
    : [];
  const userSvis = user.roles.includes(UserRoles.SVI)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.SVI])
    : [];
  const userCommerceDeDetail = user.roles.includes(UserRoles.COMMERCE_DE_DETAIL)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.COMMERCE_DE_DETAIL])
    : [];
  const userCantineOuRestaurationCollective = user.roles.includes(
    UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE,
  )
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE])
    : [];
  const userAssociationCaritative = user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.ASSOCIATION_CARITATIVE])
    : [];
  const userRepasDeChasseOuAssociatif = user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF])
    : [];
  const collecteursProDone = user.roles.includes(UserRoles.COLLECTEUR_PRO)
    ? userCollecteursPro.length > 0
    : true;
  const commerceDeDetailDone = user.roles.includes(UserRoles.COMMERCE_DE_DETAIL)
    ? userCommerceDeDetail.length > 0
    : true;
  const cantineOuRestaurationCollectiveDone = user.roles.includes(
    UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE,
  )
    ? userCantineOuRestaurationCollective.length > 0
    : true;
  const associationCaritativeDone = user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE)
    ? userAssociationCaritative.length > 0
    : true;
  const repasDeChasseOuAssociatifDone = user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF)
    ? userRepasDeChasseOuAssociatif.length > 0
    : true;

  const etgsDone = user.roles.includes(UserRoles.ETG) ? userEtgs.length > 0 : true;
  const svisDone = user.roles.includes(UserRoles.SVI) ? userSvis.length > 0 : true;

  const [visibilityChecked, setVisibilityChecked] = useState(user.user_entities_vivible_checkbox === true);

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
    [user.id],
  );

  const nextTitle = 'Mes notifications';
  const nextPage = '/app/tableau-de-bord/onboarding/mes-notifications';

  const showEntrpriseVisibilityCheckbox =
    user.roles.includes(UserRoles.COLLECTEUR_PRO) || user.roles.includes(UserRoles.ETG);

  const title = user.roles.includes(UserRoles.SVI) ? 'Mon service' : 'Mon entreprise';

  return (
    <>
      <title>{`${title} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Stepper currentStep={3} nextTitle={nextTitle} stepCount={4} title={title} />
            <h1 className="fr-h2 fr-mb-2w">
              {'Renseignez ' + (user.roles.includes(UserRoles.SVI) ? 'votre service' : 'votre entreprise')}
            </h1>
            <CallOut title="✍️ Pour pouvoir remplir les fiches qui lui sont attribuées" className="bg-white">
              {user.roles.includes(UserRoles.SVI)
                ? "Quel est votre service vétérinaire d'inspection (SVI) ?"
                : 'Quelle est votre entreprise ?'}
              <br />
              Lorsqu'une fiche lui sera attribuée, vous pourrez la prendre en charge.
            </CallOut>

            {user.roles.includes(UserRoles.COLLECTEUR_PRO) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-collecteur-pro-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Collecteur Professionnel Indépendant"
                addLabel={!collecteursProDone ? 'Ajouter un Collecteur Professionnel' : 'Mon entreprise'}
                selectLabel={!collecteursProDone ? 'Sélectionnez un Collecteur Professionnel' : ''}
                done={collecteursProDone}
                canChange={!collecteursProDone}
                entityType={EntityTypes.COLLECTEUR_PRO}
                allEntitiesByTypeAndId={allEntitiesByTypeAndId}
                userEntitiesByTypeAndId={userEntitiesByTypeAndId}
              />
            )}
            {user.roles.includes(UserRoles.COMMERCE_DE_DETAIL) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-collecteur-pro-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Commerce de Détail"
                addLabel={!commerceDeDetailDone ? 'Ajouter un Commerce de Détail' : 'Mon entreprise'}
                selectLabel="Cherchez un autre Commerce de Détail"
                done={commerceDeDetailDone}
                canChange
                entityType={EntityTypes.COMMERCE_DE_DETAIL}
                allEntitiesByTypeAndId={allEntitiesByTypeAndId}
                userEntitiesByTypeAndId={userEntitiesByTypeAndId}
              />
            )}
            {user.roles.includes(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-collecteur-pro-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Cantine ou Restauration Collective"
                addLabel={
                  !cantineOuRestaurationCollectiveDone
                    ? 'Ajouter un Cantine ou Restauration Collective'
                    : 'Mon entreprise'
                }
                selectLabel="Cherchez une autre Cantine ou Restauration Collective"
                done={cantineOuRestaurationCollectiveDone}
                canChange
                entityType={EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE}
                allEntitiesByTypeAndId={allEntitiesByTypeAndId}
                userEntitiesByTypeAndId={userEntitiesByTypeAndId}
              />
            )}
            {user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-collecteur-pro-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Association Caritative"
                addLabel={
                  !associationCaritativeDone ? 'Ajouter une Association Caritative' : 'Mon entreprise'
                }
                selectLabel="Cherchez une autre Association Caritative"
                done={associationCaritativeDone}
                canChange
                entityType={EntityTypes.ASSOCIATION_CARITATIVE}
                allEntitiesByTypeAndId={allEntitiesByTypeAndId}
                userEntitiesByTypeAndId={userEntitiesByTypeAndId}
              />
            )}
            {user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-collecteur-pro-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Repas de Chasse ou Associatif"
                addLabel={
                  !repasDeChasseOuAssociatifDone
                    ? 'Ajouter un Repas de Chasse ou Associatif'
                    : 'Mon entreprise'
                }
                selectLabel="Cherchez un autre Repas de Chasse ou Associatif"
                done={repasDeChasseOuAssociatifDone}
                canChange
                entityType={EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF}
                allEntitiesByTypeAndId={allEntitiesByTypeAndId}
                userEntitiesByTypeAndId={userEntitiesByTypeAndId}
              />
            )}
            {user.roles.includes(UserRoles.ETG) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-etg-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Établissement de Traitement du Gibier sauvage (ETG)"
                addLabel={!etgsDone ? 'Ajouter un ETG' : 'Mon entreprise'}
                selectLabel={!etgsDone ? 'Sélectionnez un ETG' : ''}
                done={etgsDone}
                canChange={!etgsDone}
                entityType={EntityTypes.ETG}
                allEntitiesByTypeAndId={allEntitiesByTypeAndId}
                userEntitiesByTypeAndId={userEntitiesByTypeAndId}
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
                          label: 'Je peux seulement transporter les carcasses',
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
                          label: 'Je peux réceptionner les carcasses et gérer la logistique',
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
            )}
            {user.roles.includes(UserRoles.SVI) && (
              <ListAndSelectEntities
                formId="onboarding-etape-2-svi-data"
                setRefreshKey={setRefreshKey}
                refreshKey={refreshKey}
                sectionLabel="Mon Service Vétérinaire d'Inspection (SVI)"
                addLabel="Ajouter un SVI"
                selectLabel="Sélectionnez un SVI"
                done={svisDone}
                canChange={!svisDone}
                entityType={EntityTypes.SVI}
                allEntitiesByTypeAndId={allEntitiesByTypeAndId}
                userEntitiesByTypeAndId={userEntitiesByTypeAndId}
              />
            )}
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                {showEntrpriseVisibilityCheckbox && (
                  <>
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
                              "J'autorise Zacharie à faire apparaître dans les champs de transmission des fiches, les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartiens.",
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
                  </>
                )}
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
                      disabled: showEntrpriseVisibilityCheckbox ? !visibilityChecked : false,
                      type: 'button',
                      nativeButtonProps: {
                        onClick: () => {
                          navigate(nextPage);
                        },
                      },
                    },
                    {
                      children: 'Modifier mes coordonnées',
                      linkProps: {
                        to: '/app/tableau-de-bord/onboarding/mes-coordonnees',
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

interface ListAndSelectEntitiesProps {
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  refreshKey: number;
  canChange: boolean;
  done: boolean;
  entityType: EntityTypes;
  addLabel: string;
  selectLabel: string;
  sectionLabel: string;
  formId: string;
  description?: React.ReactNode;
  allEntitiesByTypeAndId: EntitiesByTypeAndId;
  userEntitiesByTypeAndId: EntitiesByTypeAndId;
  children?: React.ReactNode;
}

function ListAndSelectEntities({
  setRefreshKey,
  refreshKey,
  entityType,
  selectLabel,
  sectionLabel,
  formId,
  description,
  allEntitiesByTypeAndId,
  userEntitiesByTypeAndId,
  children,
  canChange,
}: ListAndSelectEntitiesProps) {
  const user = useUser((state) => state.user)!;
  const userEntities = Object.values(userEntitiesByTypeAndId[entityType]);
  const remainingEntities = Object.values(allEntitiesByTypeAndId[entityType]).filter(
    (entity) => !userEntitiesByTypeAndId[entityType][entity.id],
  );

  const [entityId, setEntityId] = useState<string | null>(null);

  return (
    <div className="mb-6 bg-white md:shadow-sm">
      <div className="p-4 md:p-8">
        <h3 className="mb-8 text-lg font-semibold text-gray-900" id={`${formId}-title`}>
          {sectionLabel}
        </h3>
        {description}
        {userEntities
          .filter((entity) => entity.type === entityType)
          .map((entity) => {
            const relation = entity.EntityRelationsWithUsers.find(
              (relation) =>
                relation.owner_id === user.id &&
                relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            );
            if (!relation) return null;
            return (
              <RelationEntityUser
                key={relation.id}
                relationType={EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY}
                entity={entity}
                user={user}
                enableUsersView={relation.status === EntityRelationStatus.ADMIN}
                displayEntity={true}
                displayUser={false}
                onChange={() => {
                  setRefreshKey((k) => k + 1);
                }}
                refreshKey={refreshKey}
                canDelete
              />
            );
          })}
        {canChange && (
          <form id={formId} className="flex w-full flex-col gap-4" method="POST">
            <p className="py-5 pr-5">
              Vous pouvez en ajouter d'autre via la liste ci-dessous.
              <br />
              Si vous ne trouvez pas votre entreprise, veuillez nous contacter via{' '}
              <Link to="/app/tableau-de-bord/contact">le formulaire de contact</Link>.
            </p>
            <div className="flex w-full flex-col gap-4 md:flex-row [&_.fr-select-group]:mb-0">
              <SelectCustom
                options={remainingEntities.map((entity) => ({
                  label: `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`,
                  value: entity.id,
                }))}
                placeholder={selectLabel}
                value={
                  entityId
                    ? {
                      label: remainingEntities
                        .filter((entity) => entity.id === entityId)
                        .map(
                          (entity) => `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`,
                        )?.[0],
                      value: entityId,
                    }
                    : null
                }
                getOptionLabel={(f) => f.label!}
                getOptionValue={(f) => f.value}
                onChange={(f) => (f ? setEntityId(f.value) : setEntityId(null))}
                isClearable={!!entityId}
                inputId={`select-${formId}`}
                classNamePrefix={`select-${formId}`}
                className="basis-2/3"
              />
              <Button
                type="submit"
                className="flex basis-1/3 items-center justify-center"
                nativeButtonProps={{ form: formId }}
                onClick={(e) => {
                  e.preventDefault();
                  API.post({
                    path: `/user/user-entity/${user.id}`,
                    body: {
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                      _action: 'create',
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.relation]:
                        EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entityId,
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.status]: EntityRelationStatus.REQUESTED,
                    },
                  }).then((res) => {
                    if (res.ok) {
                      setRefreshKey((k) => k + 1);
                      setEntityId(null);
                    }
                  });
                }}
                disabled={!remainingEntities.length}
              >
                Ajouter
              </Button>
            </div>
          </form>
        )}
        {children}
      </div>
    </div>
  );
}
