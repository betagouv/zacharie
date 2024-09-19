import { useState, useCallback, useEffect } from "react";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { EntityTypes, EntityRelationType, UserRoles, Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { sortEntitiesByTypeAndId, sortEntitiesRelationsByTypeAndId } from "~/utils/sort-things-by-type-and-id";
import InputVille from "~/components/InputVille";

export function meta() {
  return [
    {
      title: "Mes informations | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  const allEntities = await prisma.entity.findMany();
  const userEntitiesRelations = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
      relation: EntityRelationType.WORKING_FOR,
    },
  });

  const [allEntitiesIds, allEntitiesByTypeAndId] = sortEntitiesByTypeAndId(allEntities);
  const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(userEntitiesRelations, allEntitiesIds);

  const userCentresCollectes = user.roles.includes(UserRoles.CCG)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.CCG])
    : [];
  const userCollecteursPro = user.roles.includes(UserRoles.COLLECTEUR_PRO)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.COLLECTEUR_PRO])
    : [];
  const userEtgs = user.roles.includes(UserRoles.ETG) ? Object.values(userEntitiesByTypeAndId[EntityTypes.ETG]) : [];
  const userSvis = user.roles.includes(UserRoles.SVI) ? Object.values(userEntitiesByTypeAndId[EntityTypes.SVI]) : [];

  return json({
    user,
    allEntitiesByTypeAndId,
    userEntitiesByTypeAndId,
    identityDone:
      !!user.nom_de_famille &&
      !!user.prenom &&
      !!user.telephone &&
      !!user.addresse_ligne_1 &&
      !!user.code_postal &&
      !!user.ville,
    examinateurDone: !!user.numero_cfei,
    ccgsDone: user.roles.includes(UserRoles.CCG) ? userCentresCollectes.length > 0 : true,
    collecteursProDone: user.roles.includes(UserRoles.COLLECTEUR_PRO) ? userCollecteursPro.length > 0 : true,
    etgsDone: user.roles.includes(UserRoles.ETG) ? userEtgs.length > 0 : true,
    svisDone: user.roles.includes(UserRoles.SVI) ? userSvis.length > 0 : true,
    ccgSearched: null,
  });
}

export default function MesInformations() {
  const {
    user,
    // for accordions
    identityDone,
    examinateurDone,
    ccgsDone,
    collecteursProDone,
    etgsDone,
    svisDone,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const userFetcher = useFetcher({ key: "mon-profil-mes-informations" });
  const handleUserFormBlur = useCallback(
    (event: React.FocusEvent<HTMLFormElement>) => {
      const formData = new FormData(event.currentTarget);
      userFetcher.submit(formData, {
        method: "POST",
        action: `/action/user/${user.id}`,
        preventScrollReset: true, // Prevent scroll reset on submission
      });
    },
    [userFetcher, user.id],
  );

  const [identityExpanded, setIdentityExpanded] = useState(!identityDone);
  useEffect(() => {
    setIdentityExpanded(!identityDone);
  }, [identityDone]);
  const [examinateurExpanded, setExaminateurExpanded] = useState(!examinateurDone);
  useEffect(() => {
    setExaminateurExpanded(!examinateurDone);
  }, [examinateurDone]);

  const isOnlyExaminateurInitial = user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && user.roles.length === 1;
  const nextTitle = isOnlyExaminateurInitial ? "Vos notifications" : "Vos partenaires";
  const nextPage = isOnlyExaminateurInitial
    ? "/tableau-de-bord/mon-profil/mes-notifications"
    : "/tableau-de-bord/mon-profil/mes-partenaires";
  const stepCount = isOnlyExaminateurInitial ? 3 : 4;

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={2} nextTitle={nextTitle} stepCount={stepCount} title="Vos informations" />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos informations</h1>
          <CallOut title="✍️ Pour pouvoir remplir les FEI qui vont sont attribuées" className="bg-white">
            Qui êtes-vous ? À quelles entités êtes-vous rattaché ? <br />
            Lorsqu'une FEI sera attribuée à laquelle vous êtes rattachée, vous pourrez la prendre en charge.
          </CallOut>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <p className="fr-text--regular mb-4">Renseignez les informations de chacun de vos rôles</p>
              <userFetcher.Form
                id="user_data_form"
                method="POST"
                action={`/action/user/${user.id}`}
                onBlur={handleUserFormBlur}
                preventScrollReset
              >
                <Accordion
                  titleAs="h2"
                  expanded={identityExpanded}
                  onExpandedChange={setIdentityExpanded}
                  label={
                    <div className="inline-flex w-full items-center justify-start">
                      <CompletedTag done={identityDone} /> <span>Votre identité</span>
                    </div>
                  }
                >
                  <div className="fr-fieldset__element">
                    <Input
                      label="Nom"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.nom_de_famille,
                        name: Prisma.UserScalarFieldEnum.nom_de_famille,
                        autoComplete: "family-name",
                        required: true,
                        defaultValue: user.nom_de_famille ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Prénom"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.prenom,
                        name: Prisma.UserScalarFieldEnum.prenom,
                        autoComplete: "given-name",
                        required: true,
                        defaultValue: user.prenom ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Téléphone"
                      hintText="Format attendu : 01 22 33 44 55"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.telephone,
                        name: Prisma.UserScalarFieldEnum.telephone,
                        autoComplete: "tel",
                        required: true,
                        defaultValue: user.telephone ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Adresse"
                      hintText="Indication : numéro et voie"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.addresse_ligne_1,
                        name: Prisma.UserScalarFieldEnum.addresse_ligne_1,
                        autoComplete: "address-line1",
                        required: true,
                        defaultValue: user.addresse_ligne_1 ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Complément d'adresse (optionnel)"
                      hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.addresse_ligne_2,
                        name: Prisma.UserScalarFieldEnum.addresse_ligne_2,
                        autoComplete: "address-line2",
                        defaultValue: user.addresse_ligne_2 ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element fr-fieldset__element--inline fr-fieldset__element--postal flex">
                    <Input
                      label="Code postal"
                      hintText="Format attendu : 5 chiffres"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.code_postal,
                        name: Prisma.UserScalarFieldEnum.code_postal,
                        autoComplete: "postal-code",
                        required: true,
                        defaultValue: user.code_postal ?? "",
                      }}
                    />
                    <div className="fr-fieldset__element fr-fieldset__element--inline@md fr-fieldset__element--inline-grow">
                      <InputVille
                        postCode={user.code_postal ?? ""}
                        trimPostCode
                        label="Ville ou commune"
                        hintText="Exemple : Montpellier"
                        nativeInputProps={{
                          id: Prisma.UserScalarFieldEnum.ville,
                          name: Prisma.UserScalarFieldEnum.ville,
                          autoComplete: "address-level2",
                          required: true,
                          defaultValue: user.ville ?? "",
                        }}
                      />
                    </div>
                  </div>
                </Accordion>
                {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
                  <Accordion
                    titleAs="h2"
                    expanded={examinateurExpanded}
                    onExpandedChange={setExaminateurExpanded}
                    label={
                      <div className="inline-flex w-full items-center justify-start">
                        <CompletedTag done={examinateurDone} /> Vous êtes un Examinateur Initial Certifié
                      </div>
                    }
                  >
                    <div className="fr-fieldset__element">
                      <Input
                        label="Numéro d'attestation de Chasseur Formé à l'Examen Initial"
                        hintText="De la forme CFEI-DEP-AA-123 ou DEP-FREI-YY-001"
                        nativeInputProps={{
                          id: Prisma.UserScalarFieldEnum.numero_cfei,
                          name: Prisma.UserScalarFieldEnum.numero_cfei,
                          autoComplete: "off",
                          required: true,
                          defaultValue: user.numero_cfei ?? "",
                        }}
                      />
                    </div>
                  </Accordion>
                )}
              </userFetcher.Form>
              {user.roles.includes(UserRoles.CCG) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-ccg-data"
                  accordionLabel="Vos Centres de Collecte du Gibier sauvage (CCG) partenaires"
                  addLabel="Ajouter un Centre de Collecte du Gibier sauvage (CCG)"
                  selectLabel="Sélectionnez un Centre de Collecte du Gibier sauvage (CCG)"
                  done={ccgsDone}
                  entityType={EntityTypes.CCG}
                >
                  <InputCCG />
                </AccordionEntreprise>
              )}
              {user.roles.includes(UserRoles.COLLECTEUR_PRO) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-collecteur-pro-data"
                  accordionLabel="Vous êtes/travaillez pour un Collecteur Professionnel"
                  addLabel="Ajouter un Collecteur Professionnel"
                  selectLabel="Sélectionnez un Collecteur Professionnel"
                  done={collecteursProDone}
                  entityType={EntityTypes.COLLECTEUR_PRO}
                />
              )}
              {user.roles.includes(UserRoles.ETG) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-etg-data"
                  accordionLabel="Vous êtes/travaillez pour un Établissements de Traitement du Gibier sauvage (ETG)"
                  addLabel="Ajouter un ETG"
                  selectLabel="Sélectionnez un ETG"
                  done={etgsDone}
                  entityType={EntityTypes.ETG}
                />
              )}
              {user.roles.includes(UserRoles.SVI) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-svi-data"
                  accordionLabel="Vous êtes/travaillez pour un Service Vétérinaire d'Inspection (SVI)"
                  addLabel="Ajouter un SVI"
                  selectLabel="Sélectionnez un SVI"
                  done={svisDone}
                  entityType={EntityTypes.SVI}
                />
              )}
              <div className="mb-16 ml-6 mt-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Continuer",
                    linkProps: {
                      to: nextPage,
                      href: "#",
                    },
                  },
                  {
                    children: "Précédent",
                    type: "button",
                    nativeButtonProps: {
                      onClick: () => navigate(-1),
                    },
                    priority: "secondary",
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

interface AccordionEntrepriseProps {
  done: boolean;
  entityType: EntityTypes;
  addLabel: string;
  selectLabel: string;
  accordionLabel: string;
  fetcherKey: string;
  children?: React.ReactNode;
}

function AccordionEntreprise({
  done,
  entityType,
  addLabel,
  selectLabel,
  accordionLabel,
  fetcherKey,
  children,
}: AccordionEntrepriseProps) {
  const { user, allEntitiesByTypeAndId, userEntitiesByTypeAndId } = useLoaderData<typeof loader>();

  const userEntityFetcher = useFetcher({ key: fetcherKey });
  const userEntities = Object.values(userEntitiesByTypeAndId[entityType]);
  const remainingEntities = Object.values(allEntitiesByTypeAndId[entityType]).filter(
    (entity) => !userEntitiesByTypeAndId[entityType][entity.id],
  );

  return (
    <Accordion
      titleAs="h2"
      defaultExpanded={!done}
      label={
        <div className="inline-flex w-full items-center justify-start">
          <CompletedTag done={done} /> {accordionLabel}
        </div>
      }
    >
      {userEntities
        .filter((entity) => entity.type === entityType)
        .map((entity) => {
          return (
            <div key={entity.id} className="fr-fieldset__element">
              <Notice
                className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
                style={{
                  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
                }}
                isClosable
                onClose={() => {
                  userEntityFetcher.submit(
                    {
                      owner_id: user.id,
                      entity_id: entity.id,
                      _action: "delete",
                    },
                    {
                      method: "POST",
                      action: `/action/user-entity/${user.id}`,
                      preventScrollReset: true,
                    },
                  );
                }}
                title={
                  <>
                    {entity.raison_sociale}
                    <br />
                    {entity.code_postal} {entity.ville}
                  </>
                }
              />
            </div>
          );
        })}
      {children ?? (
        <userEntityFetcher.Form
          id={fetcherKey}
          className="fr-fieldset__element flex w-full flex-row items-end gap-4"
          method="POST"
          action={`/action/user-entity/${user.id}`}
          preventScrollReset
        >
          <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.owner_id} value={user.id} />
          <input type="hidden" name="_action" value="create" />
          <input
            type="hidden"
            name={Prisma.EntityRelationsScalarFieldEnum.relation}
            value={EntityRelationType.WORKING_FOR}
          />
          <Select
            label={addLabel}
            hint={selectLabel}
            className="!mb-0 grow"
            nativeSelectProps={{
              name: Prisma.EntityRelationsScalarFieldEnum.entity_id,
            }}
          >
            <option value="">{selectLabel}</option>
            {remainingEntities.map((entity) => {
              return (
                <option key={entity.id} value={entity.id}>
                  {entity.raison_sociale} - {entity.code_postal} {entity.ville}
                </option>
              );
            })}
          </Select>
          <Button type="submit" disabled={!remainingEntities.length}>
            Ajouter
          </Button>
        </userEntityFetcher.Form>
      )}
    </Accordion>
  );
}

function CompletedTag({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="fr-background-contrast--grey fr-text-default--grey mr-6 inline-flex rounded-full px-3 py-1 text-xs">
        ✅
      </span>
    );
  }
  return (
    <span className="fr-background-contrast--grey fr-text-default--grey mr-6 inline-flex shrink-0 rounded-full px-3 py-1 text-xs">
      À compléter
    </span>
  );
}

function InputCCG() {
  const { user } = useLoaderData<typeof loader>();
  const userCCGFetcher = useFetcher({ key: "ccg-data" });
  return (
    <userCCGFetcher.Form
      method="POST"
      className="fr-fieldset__element flex w-full flex-row items-end gap-4"
      action={`/action/user-entity/${user.id}`}
    >
      <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.owner_id} value={user.id} />
      <input type="hidden" name="_action" value="create" />
      <input
        type="hidden"
        name={Prisma.EntityRelationsScalarFieldEnum.relation}
        value={EntityRelationType.WORKING_FOR}
      />
      <input type="hidden" name={Prisma.EntityScalarFieldEnum.type} value={EntityTypes.CCG} />
      <Input
        label="Numéro du Centre de Collecte du Gibier sauvage (CCG)"
        className="!mb-0"
        nativeInputProps={{
          type: "text",
          required: true,
          name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
        }}
      />
      <Button type="submit">Ajouter</Button>
    </userCCGFetcher.Form>
  );
}
