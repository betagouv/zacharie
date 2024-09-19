import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { EntityTypes, EntityRelationType, UserRoles, Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import {
  sortEntitiesByTypeAndId,
  sortEntitiesRelationsByTypeAndId,
  sortUsersByRoleAndId,
  sortUsersRelationsByRoleAndId,
} from "~/utils/sort-things-by-type-and-id";

export function meta() {
  return [
    {
      title: "Mes partenaires | Zacharie | Ministère de l'Agriculture",
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
      relation: EntityRelationType.WORKING_WITH,
    },
  });
  const userRelationsWithOtherUsers = await prisma.userRelations.findMany({
    where: {
      owner_id: user.id,
    },
  });
  const allUsers = await prisma.user.findMany({
    where: {
      roles: {
        hasSome: [UserRoles.PREMIER_DETENTEUR, UserRoles.EXAMINATEUR_INITIAL],
      },
      id: {
        not: user.id,
      },
    },
    select: {
      prenom: true,
      nom_de_famille: true,
      id: true,
      code_postal: true,
      ville: true,
      roles: true,
    },
  });

  const [allEntitiesIds, allEntitiesByTypeAndId] = sortEntitiesByTypeAndId(allEntities);
  const userEntitiesByTypeAndId = sortEntitiesRelationsByTypeAndId(userEntitiesRelations, allEntitiesIds);

  const [allUsersIds, allUsersByRole] = sortUsersByRoleAndId(allUsers);
  const userRelatedUsersByRoleAndId = sortUsersRelationsByRoleAndId(userRelationsWithOtherUsers, allUsersIds);

  return json({
    user,
    allUsersByRole,
    userRelatedUsersByRoleAndId,
    allEntitiesByTypeAndId,
    userEntitiesByTypeAndId,
  });
}

export default function MesPartenaires() {
  const navigate = useNavigate();

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper currentStep={3} stepCount={4} title="Vos partenaires" nextTitle="Vos notifications" />
          <h1 className="fr-h2 fr-mb-2w">Renseignez vos partenaires</h1>
          <CallOut title="🖱️ Envoyez les FEI en un clic" className="bg-white">
            Avec qui travaillez-vous ? <br />
            On pourra ainsi vous préremplir lorsqu'il s'agira de transmettre une FEI.
          </CallOut>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <p className="fr-text--regular mb-4">Sélectionnez vos différents partenaires</p>
              <AccordionEntreprise
                fetcherKey="onboarding-etape-2-ccg-data"
                accordionLabel="Vous êtes/travaillez pour un Centre de Collecte de Gibier (CCG)"
                addLabel="Ajouter un Centre de Collecte de Gibier (CCG)"
                selectLabel="Sélectionnez un Centre de Collecte de Gibier (CCG)"
                entityType={EntityTypes.CCG}
              >
                <InputCCG />
              </AccordionEntreprise>
              <AccordionEntreprise
                fetcherKey="mes-partenaires-collecteur-pro-data"
                accordionLabel="Vos Collecteurs Professionnels"
                addLabel="Ajouter un Collecteur Professionnel"
                selectLabel="Sélectionnez un Collecteur Professionnel"
                entityType={EntityTypes.COLLECTEUR_PRO}
              />
              <AccordionEntreprise
                fetcherKey="mes-partenaires-etg-data"
                accordionLabel="Vos Établissements de Traitement du Gibier sauvage (ETG)"
                addLabel="Ajouter un ETG"
                selectLabel="Sélectionnez un ETG"
                entityType={EntityTypes.ETG}
              />
              {/* <AccordionEntreprise
                fetcherKey="mes-partenaires-svi-data"
                accordionLabel="Vos Services Vétérinaire d'Inspection (SVI)"
                addLabel="Ajouter un SVI"
                selectLabel="Sélectionnez un SVI"
                entityType={EntityTypes.SVI}
              /> */}
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
                      to: "/tableau-de-bord/mon-profil/mes-notifications",
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
  entityType: EntityTypes;
  addLabel: string;
  selectLabel: string;
  accordionLabel: string;
  fetcherKey: string;
  children?: React.ReactNode;
}

function AccordionEntreprise({
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
      defaultExpanded={!userEntities.length}
      label={
        <div className="inline-flex w-full items-center justify-between gap-4 md:justify-start">
          {accordionLabel}
          <NumberTag number={userEntities.length} />
        </div>
      }
    >
      {userEntities
        .filter((entity) => entity.type === entityType)
        .map((entity) => {
          return (
            <div key={entity.id} className="fr-fieldset__element">
              <Notice
                className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice__title]:before:hidden"
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
            value={EntityRelationType.WORKING_WITH}
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

function NumberTag({ number }: { number: number }) {
  if (number) {
    return (
      <Tag pressed className="fr-background-action-high--blue-france fr-text-inverted--blue-france shrink-0">
        {number}
      </Tag>
    );
  }
  return null;
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
        value={EntityRelationType.WORKING_WITH}
      />
      <input type="hidden" name={Prisma.EntityScalarFieldEnum.type} value={EntityTypes.CCG} />
      <Input
        label="Numéro de DD(ec)PP du Centre de Collecte de Gibier (CCG)"
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
