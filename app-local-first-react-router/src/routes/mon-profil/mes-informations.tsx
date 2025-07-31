import { useState, useCallback, useEffect, useMemo, Fragment } from 'react';

import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { EntityTypes, EntityRelationType, UserRoles, Prisma, User, Entity } from '@prisma/client';
import InputVille from '@app/components/InputVille';
import InputNotEditable from '@app/components/InputNotEditable';
import type { EntitiesWorkingForResponse, UserConnexionResponse } from '@api/src/types/responses';
import type { EntitiesByTypeAndId } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import { useNavigate } from 'react-router';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';

const empytEntitiesByTypeAndId: EntitiesByTypeAndId = {
  [EntityTypes.PREMIER_DETENTEUR]: {},
  [EntityTypes.CCG]: {},
  [EntityTypes.COLLECTEUR_PRO]: {},
  [EntityTypes.ETG]: {},
  [EntityTypes.SVI]: {},
};

export default function MesInformations() {
  const user = useUser((state) => state.user)!;
  const [allEntitiesByTypeAndId, setAllEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [userEntitiesByTypeAndId, setUserEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [refreshKey, setRefreshKey] = useState(0);

  const userAssociationsChasses = user.roles.includes(UserRoles.CHASSEUR)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.PREMIER_DETENTEUR])
    : [];
  const userCollecteursPro = user.roles.includes(UserRoles.COLLECTEUR_PRO)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.COLLECTEUR_PRO])
    : [];
  const userEtgs = user.roles.includes(UserRoles.ETG)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.ETG])
    : [];
  const userSvis = user.roles.includes(UserRoles.SVI)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.SVI])
    : [];

  const identityDone =
    !!user.nom_de_famille &&
    !!user.prenom &&
    !!user.telephone &&
    !!user.addresse_ligne_1 &&
    !!user.code_postal &&
    !!user.ville;

  const collecteursProDone = user.roles.includes(UserRoles.COLLECTEUR_PRO)
    ? userCollecteursPro.length > 0
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

  const skipCCG = useMemo(() => {
    if (!user.roles.includes(UserRoles.CHASSEUR)) {
      return true;
    }
    return false;
  }, [user.roles]);
  const nextTitle = skipCCG ? 'Vos notifications' : 'Vos Centres de Collectes du Gibier sauvage';
  const nextPage = skipCCG
    ? '/app/tableau-de-bord/mon-profil/mes-notifications'
    : '/app/tableau-de-bord/mon-profil/mes-ccgs';
  // const nextPage = skipCCG ? '/app/tableau-de-bord' : '/app/tableau-de-bord/mon-profil/mes-ccgs';
  const stepCount = skipCCG ? 3 : 4;

  const showEntrpriseVisibilityCheckbox =
    userAssociationsChasses.length > 0 ||
    user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
    user.roles.includes(UserRoles.ETG);

  const canChange = true;

  const needAddress = user.roles.includes(UserRoles.CHASSEUR);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Mes informations | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={2} nextTitle={nextTitle} stepCount={stepCount} title="Vos informations" />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos informations</h1>
          <CallOut title="✍️ Pour pouvoir remplir les fiches qui vont sont attribuées" className="bg-white">
            Qui êtes-vous ? À quelles entités êtes-vous rattaché ? <br />
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
                  <CompletedTag done={identityDone} />
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

                {user.roles.includes(UserRoles.CHASSEUR) && (
                  <Input
                    label="Numéro d'attestation de Chasseur Formé à l'Examen Initial"
                    hintText="De la forme CFEI-DEP-AA-123 ou DEP-FREI-YY-001"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.numero_cfei,
                      name: Prisma.UserScalarFieldEnum.numero_cfei,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: user.numero_cfei ?? '',
                    }}
                  />
                )}
              </form>
            </div>
          </div>
          {user.roles.includes(UserRoles.CHASSEUR) && (
            <ListAndSelectEntities
              formId="onboarding-etape-2-associations-data"
              setRefreshKey={setRefreshKey}
              sectionLabel="Vos associations / sociétés / domaines de chasse"
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
          )}

          {user.roles.includes(UserRoles.COLLECTEUR_PRO) && (
            <ListAndSelectEntities
              formId="onboarding-etape-2-collecteur-pro-data"
              setRefreshKey={setRefreshKey}
              sectionLabel="Vous pouvez traiter des carcasses pour un Collecteur Professionnel"
              addLabel={!collecteursProDone ? 'Ajouter un Collecteur Professionnel' : 'Vos entreprises'}
              selectLabel={!collecteursProDone ? 'Sélectionnez un Collecteur Professionnel' : ''}
              done={collecteursProDone}
              canChange={!collecteursProDone}
              entityType={EntityTypes.COLLECTEUR_PRO}
              allEntitiesByTypeAndId={allEntitiesByTypeAndId}
              userEntitiesByTypeAndId={userEntitiesByTypeAndId}
            />
          )}
          {user.roles.includes(UserRoles.ETG) && (
            <ListAndSelectEntities
              formId="onboarding-etape-2-etg-data"
              setRefreshKey={setRefreshKey}
              sectionLabel="Vous pouvez traiter des carcasses pour un Établissement de Traitement du Gibier sauvage (ETG)"
              addLabel={!etgsDone ? 'Ajouter un ETG' : 'Vos entreprises'}
              selectLabel={!etgsDone ? 'Sélectionnez un ETG' : ''}
              done={etgsDone}
              canChange={!etgsDone}
              entityType={EntityTypes.ETG}
              allEntitiesByTypeAndId={allEntitiesByTypeAndId}
              userEntitiesByTypeAndId={userEntitiesByTypeAndId}
            />
          )}
          {user.roles.includes(UserRoles.SVI) && (
            <ListAndSelectEntities
              formId="onboarding-etape-2-svi-data"
              setRefreshKey={setRefreshKey}
              sectionLabel="Vous travaillez pour un Service Vétérinaire d'Inspection (SVI)"
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
                            "J'autorise le fait que les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartient apparaissent dans les champs de transmission des fiches.",
                          hintText:
                            'Cette autorisation est obligatoire pour le bon fonctionnement de Zacharie, sans quoi les fiches ne pourront pas être attribuées à votre enreprise',
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
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: 'Enregistrer et Continuer',
                    disabled: showEntrpriseVisibilityCheckbox ? !visibilityChecked : false,
                    type: 'button',
                    nativeButtonProps: {
                      onClick: () => navigate(nextPage),
                    },
                  },
                  {
                    children: 'Modifier mes rôles',
                    linkProps: {
                      to: '/app/tableau-de-bord/mon-profil/mes-roles',
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
  done,
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
          <CompletedTag done={done} />
        </h3>
        {description}
        {userEntities
          .filter((entity) => entity.type === entityType)
          .map((entity) => {
            return (
              <Fragment key={entity.id}>
                {/* @ts-expect-error Type 'boolean' is not assignable to type 'true' */}
                <Notice
                  className="fr-text-default--grey fr-background-contrast--grey mb-4 [&_p.fr-notice\\\\_\\\\_title]:before:hidden"
                  style={{
                    boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
                  }}
                  isClosable={canChange ? true : false}
                  onClose={() => {
                    API.post({
                      path: `user/user-entity/${user.id}`,
                      body: {
                        _action: 'delete',
                        [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                        [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                      },
                    }).then((res) => {
                      if (res.ok) {
                        setRefreshKey((k) => k + 1);
                      }
                    });
                  }}
                  title={
                    <>
                      {entity.nom_d_usage}
                      <br />
                      {entity.code_postal} {entity.ville}
                    </>
                  }
                />
              </Fragment>
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

function CompletedTag({ done }: { done: boolean }) {
  if (done) {
    return null;
  }
  return (
    <span className="fr-background-contrast--grey fr-text-default--grey mr-6 inline-flex shrink-0 rounded-full px-3 py-1 text-xs">
      À compléter
    </span>
  );
}
