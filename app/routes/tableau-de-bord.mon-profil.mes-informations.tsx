import { useCallback, useEffect, useState } from "react";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { EntityTypes, EntityRelationType, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { sortEntitiesByTypeAndId, sortEntitiesRelationsByTypeAndId } from "~/utils/sort-things-by-type-and-id";

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

  const userCentresCollectes = user.roles.includes(UserRoles.EXPLOITANT_CENTRE_COLLECTE)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.EXPLOITANT_CENTRE_COLLECTE])
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
    examinateurDone: !!user.numero_cfei || !!user.numero_frei,
    centresCollectesDone: user.roles.includes(UserRoles.EXPLOITANT_CENTRE_COLLECTE)
      ? userCentresCollectes.length > 0
      : true,
    collecteursProDone: user.roles.includes(UserRoles.COLLECTEUR_PRO) ? userCollecteursPro.length > 0 : true,
    etgsDone: user.roles.includes(UserRoles.ETG) ? userEtgs.length > 0 : true,
    svisDone: user.roles.includes(UserRoles.SVI) ? userSvis.length > 0 : true,
  });
}

export default function MesInformations() {
  const {
    user,
    // for accordions
    identityDone,
    examinateurDone,
    centresCollectesDone,
    collecteursProDone,
    etgsDone,
    svisDone,
  } = useLoaderData<typeof loader>();

  const userFetcher = useFetcher({ key: "onboarding-etape-2-user-data" });
  const handleUserFormBlur = useCallback(
    (event: React.FocusEvent<HTMLFormElement>) => {
      const formData = new FormData(event.currentTarget);
      userFetcher.submit(formData, {
        method: "POST",
        action: `/action/user/${user.id}`,
        preventScrollReset: true, // Prevent scroll reset on submission
      });
    },
    [userFetcher, user.id]
  );

  const [identityExpanded, setIdentityExpanded] = useState(!identityDone);
  useEffect(() => {
    setIdentityExpanded(!identityDone);
  }, [identityDone]);
  const [examinateurExpanded, setExaminateurExpanded] = useState(!examinateurDone);
  useEffect(() => {
    setExaminateurExpanded(!examinateurDone);
  }, [examinateurDone]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={2} nextTitle="Vos partenaires" stepCount={4} title="Vos informations" />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos informations</h1>
          <div className="bg-white mb-6 md:shadow">
            <div className="p-4 md:p-8 pb-32 md:pb-0">
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
                    <div className="inline-flex items-center justify-start w-full">
                      <CompletedTag done={identityDone} /> <span>Votre identité</span>
                    </div>
                  }
                >
                  <div className="fr-fieldset__element">
                    <Input
                      label="Nom"
                      nativeInputProps={{
                        id: "nom_de_famille",
                        name: "nom_de_famille",
                        autoComplete: "family-name",
                        defaultValue: user.nom_de_famille ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Prénom"
                      nativeInputProps={{
                        id: "prenom",
                        name: "prenom",
                        autoComplete: "given-name",
                        defaultValue: user.prenom ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Téléphone"
                      hintText="Format attendu : 01 22 33 44 55"
                      nativeInputProps={{
                        id: "telephone",
                        name: "telephone",
                        autoComplete: "tel",
                        defaultValue: user.telephone ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Adresse"
                      hintText="Indication : numéro et voie"
                      nativeInputProps={{
                        id: "addresse_ligne_1",
                        name: "addresse_ligne_1",
                        autoComplete: "address-line1",
                        defaultValue: user.addresse_ligne_1 ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <Input
                      label="Complément d'adresse (optionnel)"
                      hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                      nativeInputProps={{
                        id: "addresse_ligne_2",
                        name: "addresse_ligne_2",
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
                        id: "code_postal",
                        name: "code_postal",
                        autoComplete: "postal-code",
                        defaultValue: user.code_postal ?? "",
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element fr-fieldset__element--inline@md fr-fieldset__element--inline-grow">
                    <Input
                      label="Ville ou commune"
                      hintText="Exemple : Montpellier"
                      nativeInputProps={{
                        id: "ville",
                        name: "ville",
                        autoComplete: "address-level2",
                        defaultValue: user.ville ?? "",
                      }}
                    />
                  </div>
                </Accordion>
                {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
                  <Accordion
                    titleAs="h2"
                    expanded={examinateurExpanded}
                    onExpandedChange={setExaminateurExpanded}
                    label={
                      <div className="inline-flex items-center justify-start w-full">
                        <CompletedTag done={examinateurDone} /> Vous êtes un Examinateur Initial Certifié
                      </div>
                    }
                  >
                    <div className="fr-fieldset__element">
                      <Input
                        label="Numéro d'attestation de Chasseur Formé à l'Examen Initial"
                        hintText="De la forme CFEI-DEP-AA-123"
                        nativeInputProps={{
                          id: "numero_cfei",
                          name: "numero_cfei",
                          autoComplete: "off",
                          defaultValue: user.numero_cfei ?? "",
                        }}
                      />
                    </div>
                    <div className="fr-fieldset__element">
                      <Input
                        label="Numéro d'attestation de Formateur Référent Examen Initial"
                        hintText="De la forme DEP-FREI-YY-001"
                        nativeInputProps={{
                          id: "numero_frei",
                          name: "numero_frei",
                          autoComplete: "off",
                          defaultValue: user.numero_frei ?? "",
                        }}
                      />
                    </div>
                  </Accordion>
                )}
              </userFetcher.Form>
              {user.roles.includes(UserRoles.EXPLOITANT_CENTRE_COLLECTE) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-centre-collecte-data"
                  accordionLabel="Vous êtes un Exploitant de Centre de Collecte"
                  addLabel="Ajouter un Centre de Collecte"
                  selectLabel="Sélectionnez un Centre de Collecte"
                  done={centresCollectesDone}
                  entityType={EntityTypes.EXPLOITANT_CENTRE_COLLECTE}
                />
              )}
              {user.roles.includes(UserRoles.COLLECTEUR_PRO) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-collecteur-pro-data"
                  accordionLabel="Vous êtes un Collecteur Professionnel"
                  addLabel="Ajouter un Collecteur Professionnel"
                  selectLabel="Sélectionnez un Collecteur Professionnel"
                  done={collecteursProDone}
                  entityType={EntityTypes.COLLECTEUR_PRO}
                />
              )}
              {user.roles.includes(UserRoles.ETG) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-etg-data"
                  accordionLabel="Vous êtes un Établissement de Transformation des Gibiers (ETG)"
                  addLabel="Ajouter un ETG"
                  selectLabel="Sélectionnez un ETG"
                  done={etgsDone}
                  entityType={EntityTypes.ETG}
                />
              )}
              {user.roles.includes(UserRoles.SVI) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-svi-data"
                  accordionLabel="Vous êtes un Service Vétérinaire d'Inspection (SVI)"
                  addLabel="Ajouter un SVI"
                  selectLabel="Sélectionnez un SVI"
                  done={svisDone}
                  entityType={EntityTypes.SVI}
                />
              )}
              <div className="mt-6 ml-6 mb-16">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            <div className="fixed md:relative bottom-0 left-0 w-full md:w-auto p-6 pb-2 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white shadow-2xl md:shadow-none">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Continuer",
                    linkProps: {
                      to: "/tableau-de-bord/mon-profil/mes-partenaires",
                      href: "#",
                    },
                  },
                  {
                    children: "Précédent",
                    linkProps: {
                      to: "/tableau-de-bord/mon-profil/mes-roles",
                      href: "#",
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
}

function AccordionEntreprise({
  done,
  entityType,
  addLabel,
  selectLabel,
  accordionLabel,
  fetcherKey,
}: AccordionEntrepriseProps) {
  const { user, allEntitiesByTypeAndId, userEntitiesByTypeAndId } = useLoaderData<typeof loader>();

  const userEntityFetcher = useFetcher({ key: fetcherKey });
  const userEntities = Object.values(userEntitiesByTypeAndId[entityType]);
  const remainingEntities = Object.values(allEntitiesByTypeAndId[entityType]).filter(
    (entity) => !userEntitiesByTypeAndId[entityType][entity.id]
  );

  return (
    <Accordion
      titleAs="h2"
      defaultExpanded={!done}
      label={
        <div className="inline-flex items-center justify-start w-full">
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
                className="fr-fieldset__element [&_p.fr-notice\_\_title]:before:hidden fr-text-default--grey fr-background-contrast--grey"
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
                    }
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
      <userEntityFetcher.Form
        id={fetcherKey}
        className="fr-fieldset__element flex flex-row items-end gap-4 w-full"
        method="POST"
        action={`/action/user-entity/${user.id}`}
        preventScrollReset
      >
        <input type="hidden" name="owner_id" value={user.id} />
        <input type="hidden" name="_action" value="create" />
        <input type="hidden" name="relation" value={EntityRelationType.WORKING_FOR} />
        <Select
          label={addLabel}
          hint={selectLabel}
          className="!mb-0 grow"
          nativeSelectProps={{
            name: "entity_id",
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
    </Accordion>
  );
}

function CompletedTag({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="mr-6 px-3 fr-background-contrast--grey fr-text-default--grey inline-flex text-xs py-1 rounded-full">
        ✅
      </span>
    );
  }
  return (
    <span className="shrink-0 mr-6 px-3 fr-background-contrast--grey fr-text-default--grey inline-flex text-xs py-1 rounded-full">
      À compléter
    </span>
  );
}
