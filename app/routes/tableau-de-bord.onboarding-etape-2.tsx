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
import { EntityTypes, UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");
  const userEntities = await prisma.entityRelations.findMany({
    where: {
      owner_id: user.id,
    },
    select: {
      Related: true,
    },
  });
  const centresCollectes = user.roles.includes(UserRoles.EXPLOITANT_CENTRE_COLLECTE)
    ? userEntities.filter((entity) => entity.Related.type === EntityTypes.EXPLOITANT_CENTRE_COLLECTE)
    : [];
  const collecteursPro = user.roles.includes(UserRoles.COLLECTEUR_PRO)
    ? userEntities.filter((entity) => entity.Related.type === EntityTypes.COLLECTEUR_PRO)
    : [];
  const etgs = user.roles.includes(UserRoles.ETG)
    ? userEntities.filter((entity) => entity.Related.type === EntityTypes.ETG)
    : [];
  const svis = user.roles.includes(UserRoles.SVI)
    ? userEntities.filter((entity) => entity.Related.type === EntityTypes.SVI)
    : [];
  const allEntities = await prisma.entity.findMany();

  return json({
    user,
    centresCollectes,
    collecteursPro,
    etgs,
    svis,
    allEntities,
    identityDone:
      !!user.nom_de_famille &&
      !!user.prenom &&
      !!user.telephone &&
      !!user.addresse_ligne_1 &&
      !!user.code_postal &&
      !!user.ville,
    examinateurDone: !!user.numero_cfei || !!user.numero_frei,
    centresCollectesDone: user.roles.includes(UserRoles.EXPLOITANT_CENTRE_COLLECTE)
      ? centresCollectes.length > 0
      : true,
    collecteursProDone: user.roles.includes(UserRoles.COLLECTEUR_PRO) ? collecteursPro.length > 0 : true,
    etgsDone: user.roles.includes(UserRoles.ETG) ? etgs.length > 0 : true,
    svisDone: user.roles.includes(UserRoles.SVI) ? svis.length > 0 : true,
  });
}

export default function TableauDeBord() {
  const {
    user,
    // user data
    centresCollectes,
    // collecteursPro,
    // etgs,
    // svis,
    // for accordions
    identityDone,
    examinateurDone,
    centresCollectesDone,
    // collecteursProDone,
    // etgsDone,
    // svisDone,
    // for selectors
    allEntities,
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

  const userEntityFetcher = useFetcher({ key: "onboarding-etape-2-entities-data" });
  const handleEntitiesFormChange = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    // Remove the preventDefault() call to allow the form to submit normally
    const formData = new FormData(event.currentTarget);
    console.log("FormData entries:");
    for (const [key, value] of formData.entries()) {
      console.log(key, value);
    }
    // Remove the manual submission using userEntityFetcher
    // The form will submit naturally
  }, []);

  const [identityExpanded, setIdentityExpanded] = useState(!identityDone);
  useEffect(() => {
    setIdentityExpanded(!identityDone);
  }, [identityDone]);
  const [examinateurExpanded, setExaminateurExpanded] = useState(!examinateurDone);
  useEffect(() => {
    setExaminateurExpanded(!examinateurDone);
  }, [examinateurDone]);

  return (
    <main role="main" id="content">
      <input type="hidden" name="_redirect" value="/tableau-de-bord/onboarding-etape-3" />
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10">
            <div className="fr-background-alt--blue-france p-4 md:p-16 pb-32 md:pb-0">
              <userFetcher.Form
                id="user_data_form"
                method="POST"
                action={`/action/user/${user.id}`}
                onBlur={handleUserFormBlur}
                preventScrollReset
              >
                <Stepper currentStep={2} nextTitle="Vos partenaires" stepCount={3} title="Vos informations" />
                <Accordion
                  titleAs="h2"
                  expanded={identityExpanded}
                  onExpandedChange={setIdentityExpanded}
                  label={
                    <div className="inline-flex items-center justify-between md:justify-start w-full">
                      <span>Votre identité</span> <CompletedTag done={identityDone} />
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
                      <div className="inline-flex items-center justify-between md:justify-start w-full">
                        Vous êtes un Examinateur Initial Certifié <CompletedTag done={examinateurDone} />
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
                <Accordion
                  titleAs="h2"
                  defaultExpanded={centresCollectesDone}
                  label={
                    <div className="inline-flex items-center justify-between md:justify-start w-full">
                      Vous êtes un Exploitant de Centre de Collecte <CompletedTag done={centresCollectesDone} />
                    </div>
                  }
                >
                  {centresCollectes.map((entity) => {
                    return (
                      <Notice
                        key={entity.Related.id}
                        className="fr-fieldset__element [&_p.fr-notice\_\_title]:before:hidden fr-text-default--grey"
                        isClosable
                        onClose={() => {
                          userEntityFetcher.submit(
                            {
                              owner_id: user.id,
                              entity_id: entity.Related.id,
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
                            {entity.Related.raison_sociale}
                            <br />
                            {entity.Related.code_postal} {entity.Related.ville}
                          </>
                        }
                      />
                    );
                  })}
                  <userEntityFetcher.Form
                    id="user_centre_collecte_form"
                    className="fr-fieldset__element flex flex-row items-end gap-4 w-full"
                    method="POST"
                    action={`/action/user-entity/${user.id}`}
                    onSubmit={handleEntitiesFormChange}
                    preventScrollReset
                  >
                    <input type="hidden" name="owner_id" value={user.id} />
                    <input type="hidden" name="_action" value="create" />
                    <Select
                      label="Ajouter un Centre de Collecte"
                      hint="Sélectionnez un Centre de Collecte"
                      className="!mb-0 grow"
                      nativeSelectProps={{
                        name: "entity_id",
                      }}
                    >
                      <option value="">Selectionnez un centre de collecte</option>
                      {allEntities
                        .filter((entity) => {
                          if (entity.type !== EntityTypes.EXPLOITANT_CENTRE_COLLECTE) return false;
                          if (centresCollectes.find((ec) => ec.Related.id === entity.id)) return false;
                          return true;
                        })
                        .map((entity) => {
                          return (
                            <option key={entity.id} value={entity.id}>
                              {entity.raison_sociale} - {entity.code_postal} {entity.ville}
                            </option>
                          );
                        })}
                    </Select>
                    <Button type="submit">Ajouter</Button>
                  </userEntityFetcher.Form>
                </Accordion>
              )}
              <div className="mt-6 ml-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
              <div className="fixed md:relative md:mt-16 bottom-0 left-0 w-full p-6 bg-white md:bg-transparent drop-shadow-xl z-50">
                <ButtonsGroup
                  buttons={[
                    {
                      children: "Continuer",
                      linkProps: {
                        to: "/tableau-de-bord/onboarding-etape-3",
                      },
                    },
                    {
                      children: "Précédent",
                      linkProps: {
                        to: "/tableau-de-bord/onboarding-etape-1",
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
    </main>
  );
}

function CompletedTag({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="ml-6 px-3 fr-background-contrast--grey fr-text-default--grey inline-flex text-xs py-1 rounded-full">
        ✅
      </span>
    );
  }
  return (
    <span className="shrink-0 ml-6 px-3 fr-background-contrast--grey fr-text-default--grey inline-flex text-xs py-1 rounded-full">
      À compléter
    </span>
  );
}
