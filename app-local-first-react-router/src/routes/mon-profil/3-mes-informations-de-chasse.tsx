import { useState, useCallback, useEffect } from 'react';

import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import {
  EntityTypes,
  EntityRelationType,
  UserRoles,
  Prisma,
  Entity,
  EntityRelationStatus,
} from '@prisma/client';
import InputVille from '@app/components/InputVille';
import type { EntitiesWorkingForResponse, UserConnexionResponse } from '@api/src/types/responses';
import type { EntitiesByTypeAndId } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import { useNavigate, useSearchParams } from 'react-router';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';
import RelationEntityUser from '@app/components/RelationEntityUser';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import type { UserCCGsResponse, UserEntityResponse } from '@api/src/types/responses';

const empytEntitiesByTypeAndId: EntitiesByTypeAndId = {
  [EntityTypes.PREMIER_DETENTEUR]: {},
  [EntityTypes.CCG]: {},
  [EntityTypes.COLLECTEUR_PRO]: {},
  [EntityTypes.ETG]: {},
  [EntityTypes.SVI]: {},
};

export default function MesCoordonnees() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const user = useUser((state) => state.user)!;
  const [allEntitiesByTypeAndId, setAllEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [userEntitiesByTypeAndId, setUserEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isExaminateurInitial, setIsExaminateurInitial] = useState(
    user.est_forme_a_l_examen_initial === true,
  );
  const [numeroCfei, setNumeroCfei] = useState(user.numero_cfei ?? '');
  const [visibilityChecked, setVisibilityChecked] = useState(user.user_entities_vivible_checkbox === true);

  const userAssociationsChasses = user.roles.includes(UserRoles.CHASSEUR)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.PREMIER_DETENTEUR])
    : [];

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

  const handleUserSubmit = useCallback(
    async ({
      isExaminateurInitial,
      numeroCfei,
      visibilityChecked,
    }: {
      isExaminateurInitial: boolean;
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
        path: `user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id],
  );

  const [assoExpanded, setAssoExpanded] = useState(false);
  const [assoPostalCode, setAssoPostalCode] = useState('');
  const handleEntitySubmit = useCallback(async (event: React.FocusEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body: Partial<Entity> = Object.fromEntries(formData.entries());
    const response = await API.post({
      path: 'entite/association-de-chasse',
      body,
    }).then((data) => data as UserConnexionResponse);
    if (response.ok) {
      setRefreshKey((prev) => prev + 1);
      setAssoPostalCode('');
      setAssoExpanded(false);
      document
        .getElementById('onboarding-etape-2-associations-data-title')
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const nextTitle = 'Mes notifications';
  const nextPage = '/app/tableau-de-bord/mon-profil/mes-notifications';

  const showEntrpriseVisibilityCheckbox =
    userAssociationsChasses.length > 0 ||
    user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
    user.roles.includes(UserRoles.ETG);

  const canChange = true;

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Mes Informations de chasse | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={3} nextTitle={nextTitle} stepCount={4} title="Mes informations de chasse" />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos informations de chasse</h1>
          <CallOut title="✍️ Pour pouvoir remplir les fiches qui vont sont attribuées" className="bg-white">
            Votre numéro d'examen initial, votre chambre froide, votre association / société / domaine de
            chasse, etc.
          </CallOut>
          <div className="mb-6 bg-white md:shadow-sm">
            <div className="p-4 md:p-8">
              <form id="user_data_form" method="POST" onSubmit={(e) => e.preventDefault()}>
                <h3 className="inline-flex items-center text-lg font-semibold text-gray-900">
                  <span>Examen initial</span>
                </h3>
                <p className="mb-5 text-sm text-gray-500">
                  * Les champs marqués d'un astérisque (*) sont obligatoires.
                </p>
                <RadioButtons
                  legend="Êtes-vous formé à l'examen initial ? *"
                  orientation="horizontal"
                  options={[
                    {
                      nativeInputProps: {
                        required: true,
                        checked: isExaminateurInitial,
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
                        checked: !isExaminateurInitial,
                        name: 'pas_forme_a_l_examen_initial',
                        onChange: () => {
                          if (
                            !user.numero_cfei ||
                            window.confirm("N'êtes vous vraiment pas formé à l'examen initial ?")
                          ) {
                            setIsExaminateurInitial(false);
                            handleUserSubmit({ isExaminateurInitial: false, numeroCfei, visibilityChecked });
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
                      onBlur: () => handleUserSubmit({ isExaminateurInitial, numeroCfei, visibilityChecked }),
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

          <ListAndSelectEntities
            formId="onboarding-etape-2-associations-data"
            setRefreshKey={setRefreshKey}
            refreshKey={refreshKey}
            sectionLabel="Mon association / société / domaine de chasse"
            addLabel=""
            selectLabel={canChange ? 'Cherchez ici une entité existante' : ''}
            done
            canChange
            entityType={EntityTypes.PREMIER_DETENTEUR}
            allEntitiesByTypeAndId={allEntitiesByTypeAndId}
            userEntitiesByTypeAndId={userEntitiesByTypeAndId}
          >
            <div className="mt-8">
              {!assoExpanded ? (
                <>
                  {!userAssociationsChasses.length && (
                    <>
                      Votre entité n'est pas encore enregistrée dans Zacharie ?<br />
                    </>
                  )}
                  <Button
                    priority="secondary"
                    className="mt-4"
                    nativeButtonProps={{
                      onClick: () => setAssoExpanded(true),
                    }}
                  >
                    Enregistrer mon entité
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-gray-300 px-8 py-6">
                  <p className="font-semibold">
                    Enregistrer une nouvelle association / société / domaine de chasse
                  </p>
                  <p className="mb-5 text-sm text-gray-500">
                    * Les champs marqués d'un astérisque (*) sont obligatoires.
                  </p>
                  <form id="association_data_form" method="POST" onSubmit={handleEntitySubmit}>
                    <Input
                      label="Raison Sociale *"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.raison_sociale,
                        name: Prisma.EntityScalarFieldEnum.raison_sociale,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: '',
                      }}
                    />
                    <Input
                      label="SIRET"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.siret,
                        name: Prisma.EntityScalarFieldEnum.siret,
                        autoComplete: 'off',
                        defaultValue: '',
                      }}
                    />
                    <Input
                      label="Adresse *"
                      hintText="Indication : numéro et voie"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.address_ligne_1,
                        name: Prisma.EntityScalarFieldEnum.address_ligne_1,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: '',
                      }}
                    />
                    <Input
                      label="Complément d'adresse (optionnel)"
                      hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.address_ligne_2,
                        name: Prisma.EntityScalarFieldEnum.address_ligne_2,
                        autoComplete: 'off',
                        defaultValue: '',
                      }}
                    />

                    <div className="flex w-full flex-col gap-x-4 md:flex-row">
                      <Input
                        label="Code postal *"
                        hintText="5 chiffres"
                        className="shrink-0 md:basis-1/5"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.code_postal,
                          name: Prisma.EntityScalarFieldEnum.code_postal,
                          autoComplete: 'off',
                          required: true,
                          value: assoPostalCode,
                          onChange: (e) => {
                            setAssoPostalCode(e.currentTarget.value);
                          },
                        }}
                      />
                      <div className="basis-4/5">
                        <InputVille
                          postCode={assoPostalCode}
                          trimPostCode
                          label="Ville ou commune *"
                          hintText="Exemple : Montpellier"
                          nativeInputProps={{
                            id: Prisma.EntityScalarFieldEnum.ville,
                            name: Prisma.EntityScalarFieldEnum.ville,
                            autoComplete: 'off',
                            required: true,
                            defaultValue: '',
                          }}
                        />
                      </div>
                    </div>
                    <Button type="submit" nativeButtonProps={{ form: 'association_data_form' }}>
                      Enregistrer
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </ListAndSelectEntities>

          <MesCCGs />
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
                    children: 'Enregistrer et Continuer',
                    disabled: showEntrpriseVisibilityCheckbox ? !visibilityChecked : false,
                    type: 'button',
                    nativeButtonProps: {
                      onClick: () => navigate(redirect ?? nextPage),
                    },
                  },
                  {
                    children: 'Modifier mes coordonnées',
                    linkProps: {
                      to: redirect ?? '/app/tableau-de-bord/mon-profil/mes-coordonnees',
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
          <form
            id={formId}
            className="flex w-full flex-col gap-4 md:flex-row [&_.fr-select-group]:mb-0"
            method="POST"
          >
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
                  path: `user/user-entity/${user.id}`,
                  body: {
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                    _action: 'create',
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.relation]:
                      EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entityId,
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
          </form>
        )}
        {children}
      </div>
    </div>
  );
}

function MesCCGs() {
  // const removeCCGFetcher = useFetcher({ key: 'ccg-remove' });
  const [userCCGs, setUserCCGs] = useState<Array<Entity>>([]);
  const user = useUser((state) => state.user)!;

  function refreshUserCCGs() {
    API.get({ path: 'user/my-ccgs' })
      .then((res) => res as UserCCGsResponse)
      .then((res) => {
        if (res.ok) {
          setUserCCGs(res.data.userCCGs);
        }
      });
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    refreshUserCCGs();
  }, []);

  const [newCCGExpanded, setNewCCGExpanded] = useState(false);
  const [ccgPostalCode, setCCGPostalCode] = useState('');
  const handleNewCCGSubmit = useCallback(async (event: React.FocusEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body: Partial<Entity> = Object.fromEntries(formData.entries());
    const response = await API.post({
      path: 'entite/ccg',
      body,
    }).then((response) => response as UserConnexionResponse);
    if (response.ok) {
      refreshUserCCGs();
      setCCGPostalCode('');
      setNewCCGExpanded(false);
      document.getElementById('onboarding-etape-2-ccgs-data')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  function RegisterCCG() {
    return (
      <p className="mt-4 text-sm">
        <br />
        Le CCG identifié dans Zacharie peut être utilisé pour entreposer du gibier. Toutefois, il est
        important de reconnaître officiellement le CCG en procédant à son enregistrement auprès de la
        direction départementale en charge de la protection des populations (DDPP/DDETSPP) du département
        d’implantation du CCG.
        <br />
        Pour déclarer l’activité du CCG, il vous suffit de suivre la procédure suivante&nbsp;:
        <ol className="list-inside list-decimal">
          <li>
            Remplir le formulaire de déclaration d’activité à télécharger sur le lien suivant&nbsp;:{' '}
            <a
              target="_blank"
              rel="noreferrer noopener"
              href="https://mesdemarches.agriculture.gouv.fr/demarches/association-ou-organisation-de/assurer-une-activite-de-76/article/declarer-la-manipulation-de"
            >
              https://mesdemarches.agriculture.gouv.fr/demarches/association-ou-organisation-de/assurer-une-activite-de-76/article/declarer-la-manipulation-de
            </a>
            <br />
            Un document d’aide au remplissage du formulaire est accessible{' '}
            <a
              href="https://scribehow.com/shared/Declarer_un_centre_de_collecte_de_gibier_CCG__f9XrNsQYQx68Mk-WDBJr0w"
              target="_blank"
              rel="noreferrer noopener"
            >
              ici
            </a>
            .
          </li>
          <li>
            Envoyer la déclaration d’activité remplie, datée et signée à la DDPP/DDETSPP compétente par
            courrier postal.
            <br />
            Les coordonnées des DDPP/DDETSPP sont accessibles via le lien suivant&nbsp;:
            <a
              href="https://agriculture.gouv.fr/ddpp-et-ddets-pp-tous-les-contacts-des-services-deconcentres"
              target="_blank"
              rel="noreferrer noopener"
            >
              https://agriculture.gouv.fr/ddpp-et-ddets-pp-tous-les-contacts-des-services-deconcentres
            </a>
          </li>
          <li>
            Attendre l’accusé de réception. Un numéro d’identification unique sera attribué au CCG permettant
            d’assurer la traçabilité et faciliter la valorisation des viandes.
          </li>
          <li>Le numéro d’identification est automatiquement enregistré dans Zacharie.</li>
        </ol>
      </p>
    );
  }

  return (
    <div className="mb-6 bg-white md:shadow-sm" id="onboarding-etape-2-ccgs-data">
      <div className="p-4 md:p-8">
        <h3 className="inline-flex items-center text-lg font-semibold text-gray-900">
          <span>Centres de collecte du gibier sauvage</span>
        </h3>
        <CallOut className="bg-white">
          <strong>Qu’est ce qu’un centre de collecte du gibier sauvage (CCG) ?</strong>
          <br />
          <br />
          C’est une chambre froide utilisée par les chasseurs pour déposer le gibier prélevé dans de bonnes
          conditions d’hygiène et de conservation avant sa cession.
        </CallOut>
        {!userCCGs.length && (
          <p className="mb-4 text-lg font-bold">
            Cette étape est facultative.
            <br />
            Vous pouvez la passer si vous n'avez aucun lien avec un CCG.
            <br />
            Vous pouvez aussi la faire plus tard.
          </p>
        )}
        {userCCGs.map((entity) => {
          return (
            <Notice
              className="fr-text-default--grey fr-background-contrast--grey mb-4 [&_p.fr-notice__title]:before:hidden"
              style={{
                boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
              }}
              isClosable
              onClose={() => {
                API.post({
                  path: `user/user-entity/${user.id}`,
                  body: {
                    _action: 'delete',
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                    relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
                  },
                }).then((res) => {
                  if (res.ok) {
                    setUserCCGs((prev) => prev.filter((ccg) => ccg.id !== entity.id));
                  }
                });
              }}
              title={
                <>
                  {entity.numero_ddecpp}
                  <br />
                  {entity.nom_d_usage}
                  <br />
                  {entity.code_postal} {entity.ville}
                  {entity.ccg_status === 'Pré-enregistré dans Zacharie' && (
                    <>
                      <RegisterCCG />
                      <p className="mt-4 text-sm">
                        Si vous avez déjà fait la démarche, vous pouvez ignorer ce message.
                      </p>
                    </>
                  )}
                </>
              }
            />
          );
        })}
        <InputCCG addCCG={(ccg) => setUserCCGs([...userCCGs, ccg])} />
        <div className="mt-8">
          {!newCCGExpanded ? (
            <>
              Si vous utilisez un CCG non encore enregistré auprès des services de l’Etat, vous pouvez
              l’identifier ici.
              <br />
              <Button
                priority="secondary"
                className="mt-4"
                nativeButtonProps={{
                  onClick: () => setNewCCGExpanded(true),
                }}
              >
                Pré-enregistrer mon CCG
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-gray-300 px-8 py-6">
              <p className="font-semibold">Pré-enregistrer un nouveau Centre de Collecte</p>
              <p className="mb-5 text-sm text-gray-500">
                * Les champs marqués d'un astérisque (*) sont obligatoires.
              </p>
              <form id="association_data_form" method="POST" onSubmit={handleNewCCGSubmit}>
                <Input
                  label="Nom usuel *"
                  nativeInputProps={{
                    id: Prisma.EntityScalarFieldEnum.nom_d_usage,
                    name: Prisma.EntityScalarFieldEnum.nom_d_usage,
                    autoComplete: 'off',
                    required: true,
                    defaultValue: '',
                  }}
                />
                <Input
                  label="SIRET"
                  hintText="Si vous n'en n'avez pas, laissez vide."
                  nativeInputProps={{
                    id: Prisma.EntityScalarFieldEnum.siret,
                    name: Prisma.EntityScalarFieldEnum.siret,
                    autoComplete: 'off',
                    defaultValue: '',
                  }}
                />
                <Input
                  label="Numéro d'identification du CCG"
                  hintText="De la forme 03-CCG-123. Si vous ne le connaissez pas, laissez vide."
                  nativeInputProps={{
                    id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                    name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                    autoComplete: 'off',
                    defaultValue: '',
                  }}
                />
                <Input
                  label="Adresse *"
                  hintText="Indication : numéro et voie"
                  nativeInputProps={{
                    id: Prisma.EntityScalarFieldEnum.address_ligne_1,
                    name: Prisma.EntityScalarFieldEnum.address_ligne_1,
                    autoComplete: 'off',
                    required: true,
                    defaultValue: '',
                  }}
                />
                <Input
                  label="Complément d'adresse (optionnel)"
                  hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                  nativeInputProps={{
                    id: Prisma.EntityScalarFieldEnum.address_ligne_2,
                    name: Prisma.EntityScalarFieldEnum.address_ligne_2,
                    autoComplete: 'off',
                    defaultValue: '',
                  }}
                />

                <div className="flex w-full flex-col gap-x-4 md:flex-row">
                  <Input
                    label="Code postal *"
                    hintText="5 chiffres"
                    className="shrink-0 md:basis-1/5"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.code_postal,
                      name: Prisma.EntityScalarFieldEnum.code_postal,
                      autoComplete: 'off',
                      required: true,
                      value: ccgPostalCode,
                      onChange: (e) => {
                        setCCGPostalCode(e.currentTarget.value);
                      },
                    }}
                  />
                  <div className="basis-4/5">
                    <InputVille
                      postCode={ccgPostalCode}
                      trimPostCode
                      label="Ville ou commune *"
                      hintText="Exemple : Montpellier"
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.ville,
                        name: Prisma.EntityScalarFieldEnum.ville,
                        autoComplete: 'off',
                        required: true,
                        defaultValue: '',
                      }}
                    />
                  </div>
                </div>
                <p className="my-4">
                  Ceci ne remplace pas la déclaration officielle du centre de collecte du gibier sauvage
                  (CCG). Cela permet simplement de pouvoir en faire référence dans Zacharie, en attendant son
                  enregistrement (voir ci-dessous).
                </p>
                <Button type="submit" nativeButtonProps={{ form: 'association_data_form' }}>
                  Enregistrer
                </Button>
                <RegisterCCG />
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InputCCG({ addCCG }: { addCCG: (ccg: Entity) => void }) {
  const user = useUser((state) => state.user)!;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      method="POST"
      className="flex w-full flex-row items-end gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        API.post({
          path: `user/user-entity/${user.id}`,
          body: {
            _action: 'create',
            [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
            relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            [Prisma.EntityScalarFieldEnum.numero_ddecpp]: formData.get(
              Prisma.EntityScalarFieldEnum.numero_ddecpp,
            ),
            [Prisma.EntityScalarFieldEnum.type]: EntityTypes.CCG,
          },
        })
          .then((res) => res as UserEntityResponse)
          .then((res) => {
            setIsSubmitting(false);
            if (res.ok && res.data.entity) {
              setError('');
              addCCG(res.data.entity);
            }
            if (res.error) {
              setError(res.error);
            }
          });
      }}
    >
      <Input
        label="Si vous utilisez un CCG enregistré auprès des services de l'Etat, renseignez ici son numéro d'identification."
        className="mb-0!"
        state={error ? 'error' : 'default'}
        stateRelatedMessage={error}
        nativeInputProps={{
          type: 'text',
          placeholder: 'Exemples : 03-CCG-123, ou encore 03.564.345',
          required: true,
          name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
        }}
      />
      <Button type="submit" disabled={isSubmitting}>
        {!isSubmitting ? 'Ajouter' : 'Recherche en cours...'}
      </Button>
    </form>
  );
}
