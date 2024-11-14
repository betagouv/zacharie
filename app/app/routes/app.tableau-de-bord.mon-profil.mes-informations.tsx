import { useState, useCallback, useEffect, useMemo } from "react";
import {
  json,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  type ClientActionFunctionArgs,
} from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { EntityTypes, EntityRelationType, UserRoles, Prisma } from "@prisma/client";
import InputVille from "@app/components/InputVille";
import InputNotEditable from "@app/components/InputNotEditable";
import { type EntitiesLoaderData } from "@api/routes/api.loader.entites";
import { setCacheItem } from "@app/services/indexed-db.client";
import { getMostFreshUser } from "@app/utils-offline/get-most-fresh-user";
import { getFormData } from "@app/utils/getFormData";

export function meta() {
  return [
    {
      title: "Mes informations | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }
  const formData = await getFormData(request);
  const route = formData.get("route") as string;
  if (!route) {
    return json({ ok: false, data: null, error: "Route is required" }, { status: 400 });
  }
  console.log(`${import.meta.env.VITE_API_URL}${route}`);
  const response = await fetch(`${import.meta.env.VITE_API_URL}${route}`, {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json());
  if (response.ok && response.data?.id) {
    await setCacheItem("user", response.data);
    return redirect("/app/tableau-de-bord/mon-profil/mes-informations");
  }
  return response;
}

export async function clientLoader() {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }

  const response = (await fetch(`${import.meta.env.VITE_API_URL}/api/loader/entites`, {
    method: "GET",
    credentials: "include",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
  }).then((res) => res.json())) as EntitiesLoaderData;
  const { allEntitiesByTypeAndId, userEntitiesByTypeAndId } = response.data!;

  const userAssociationsChasses = user.roles.includes(UserRoles.PREMIER_DETENTEUR)
    ? Object.values(userEntitiesByTypeAndId[EntityTypes.PREMIER_DETENTEUR])
    : [];
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
    userAssociationsChasses,
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
    userAssociationsChasses,
    // for accordions
    identityDone,
    examinateurDone,
    collecteursProDone,
    etgsDone,
    svisDone,
  } = useLoaderData<typeof clientLoader>();
  const [visibilityChecked, setVisibilityChecked] = useState(user.user_entities_vivible_checkbox === true);

  const navigate = useNavigate();

  const userFetcher = useFetcher({ key: "mon-profil-mes-informations" });
  const handleUserFormBlur = useCallback(
    (event: React.FocusEvent<HTMLFormElement>) => {
      const formData = new FormData(event.currentTarget);
      formData.append("route", `/api/action/user/${user.id}`);
      userFetcher.submit(formData, {
        method: "POST",
        preventScrollReset: true, // Prevent scroll reset on submission
      });
    },
    [userFetcher, user.id],
  );

  const [identityExpanded, setIdentityExpanded] = useState(!identityDone || !user.onboarded_at);
  useEffect(() => {
    setIdentityExpanded(!identityDone || !user.onboarded_at);
  }, [identityDone, user.onboarded_at]);
  const [examinateurExpanded, setExaminateurExpanded] = useState(!examinateurDone || !user.onboarded_at);
  useEffect(() => {
    setExaminateurExpanded(!examinateurDone || !user.onboarded_at);
  }, [examinateurDone, user.onboarded_at]);

  const skipCCG = useMemo(() => {
    if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      if (user.roles.length === 1) {
        return true;
      }
    }
    if (user.roles.includes(UserRoles.SVI)) {
      return true;
    }
    return false;
  }, [user.roles]);
  const nextTitle = skipCCG ? "Vos notifications" : "Vos Centres de Collectes du Gibier sauvage";
  const nextPage = skipCCG
    ? "/app/tableau-de-bord/mon-profil/mes-notifications"
    : "/app/tableau-de-bord/mon-profil/mes-ccgs";
  const stepCount = skipCCG ? 3 : 4;

  const showEntrpriseVisibilityCheckbox =
    userAssociationsChasses.length > 0 ||
    user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
    user.roles.includes(UserRoles.ETG) ||
    user.roles.includes(UserRoles.SVI);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={2} nextTitle={nextTitle} stepCount={stepCount} title="Vos informations" />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos informations</h1>
          <CallOut title="✍️ Pour pouvoir remplir les fiches qui vont sont attribuées" className="bg-white">
            Qui êtes-vous ? À quelles entités êtes-vous rattaché ? <br />
            Lorsqu'une fiche sera attribuée à laquelle vous êtes rattachée, vous pourrez la prendre en charge.
          </CallOut>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <p className="fr-text--regular mb-4">Renseignez les informations de chacun de vos rôles</p>
              <userFetcher.Form id="user_data_form" method="POST" onBlur={handleUserFormBlur} preventScrollReset>
                <input type="hidden" name="route" value={`/api/action/user/${user.id}`} />
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
                    <InputNotEditable
                      label="Email"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.email,
                        name: Prisma.UserScalarFieldEnum.email,
                        required: true,
                        defaultValue: user.email ?? "",
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
                  <div className="fr-fieldset__element fr-fieldset__element--inline fr-fieldset__element--postal flex flex-col md:flex-row">
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
              {(user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) ||
                user.roles.includes(UserRoles.PREMIER_DETENTEUR)) && (
                <AccordionEntreprise
                  fetcherKey="onboarding-etape-2-associations-data"
                  accordionLabel="Vos associations de chasse / repas associatifs"
                  addLabel="Ajouter une association de chasse"
                  selectLabel="Sélectionnez une association de chasse"
                  done
                  entityType={EntityTypes.PREMIER_DETENTEUR}
                />
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
              {showEntrpriseVisibilityCheckbox && (
                <userFetcher.Form
                  id="user_entities_vivible_checkbox"
                  method="POST"
                  onChange={handleUserFormBlur}
                  preventScrollReset
                  className="fr-fieldset__element p-8"
                >
                  <input type="hidden" name="route" value={`/api/action/user/${user.id}`} />
                  <Checkbox
                    options={[
                      {
                        label:
                          "J'autorise le fait que les sociétés ou associations pour lesquelles je travaille ou auxquelles j'appartient apparaissent dans les champs de transmission des fiches.",
                        hintText:
                          "Cette autorisation est obligatoire pour le bon fonctionnement de Zacharie, sans quoi les fiches ne pourront pas être attribuées à votre enreprise",
                        nativeInputProps: {
                          required: true,
                          name: Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox,
                          value: "true",
                          onChange: () => setVisibilityChecked(!visibilityChecked),
                          checked: visibilityChecked,
                        },
                      },
                    ]}
                  />
                </userFetcher.Form>
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
                    children: "Enregistrer et Continuer",
                    disabled: showEntrpriseVisibilityCheckbox ? !visibilityChecked : false,
                    type: "button",
                    nativeButtonProps: {
                      onClick: () => navigate(nextPage),
                    },
                  },
                  {
                    children: "Modifier mes rôles",
                    linkProps: {
                      to: "/app/tableau-de-bord/mon-profil/mes-roles",
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
  children?: React.ReactNode;
  description?: React.ReactNode;
}

function AccordionEntreprise({
  done,
  entityType,
  addLabel,
  selectLabel,
  accordionLabel,
  fetcherKey,
  children,
  description,
}: AccordionEntrepriseProps) {
  const { user, allEntitiesByTypeAndId, userEntitiesByTypeAndId } = useLoaderData<typeof clientLoader>();

  const userEntityFetcher = useFetcher({ key: fetcherKey });
  const userEntities = Object.values(userEntitiesByTypeAndId[entityType]);
  const remainingEntities = Object.values(allEntitiesByTypeAndId[entityType]).filter(
    (entity) => !userEntitiesByTypeAndId[entityType][entity.id],
  );

  return (
    <Accordion
      titleAs="h2"
      defaultExpanded={!done || !user.onboarded_at}
      label={
        <div className="inline-flex w-full items-center justify-start">
          <CompletedTag done={done} /> {accordionLabel}
        </div>
      }
    >
      {description}
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
                  const form = new FormData();
                  form.append("_action", "delete");
                  form.append(Prisma.EntityRelationsScalarFieldEnum.owner_id, user.id);
                  form.append(Prisma.EntityRelationsScalarFieldEnum.entity_id, entity.id);
                  form.append("relation", EntityRelationType.WORKING_FOR);
                  form.append("route", `/api/action/user-entity/${user.id}`);
                  userEntityFetcher.submit(form, {
                    method: "POST",
                    preventScrollReset: true,
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
            </div>
          );
        })}
      {children ?? (
        <userEntityFetcher.Form
          id={fetcherKey}
          className="fr-fieldset__element flex w-full flex-row items-end gap-4"
          method="POST"
          preventScrollReset
        >
          <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.owner_id} value={user.id} />
          <input type="hidden" name="_action" value="create" />
          <input type="hidden" name="route" value={`/api/action/user-entity/${user.id}`} />
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
            <hr />
            {remainingEntities.map((entity) => {
              return (
                <option key={entity.id} value={entity.id}>
                  {entity.nom_d_usage} - {entity.code_postal} {entity.ville}
                </option>
              );
            })}
          </Select>
          <Button
            type="submit"
            nativeButtonProps={{ form: fetcherKey }}
            onClick={(e) => {
              console.log("submit");
              e.preventDefault();
              console.log(Object.entries(new FormData(e.currentTarget.form as HTMLFormElement)));
              const form = new FormData(e.currentTarget.form as HTMLFormElement);
              console.log("submitted");
              userEntityFetcher.submit(form, {
                method: "POST",
                preventScrollReset: true,
              });
            }}
            disabled={!remainingEntities.length}
          >
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
