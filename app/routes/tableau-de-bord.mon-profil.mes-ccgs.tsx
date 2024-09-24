import { json, redirect, useFetcher, useLoaderData, type ClientActionFunctionArgs } from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { EntityTypes, EntityRelationType, Prisma } from "@prisma/client";
import { type UserCCGsLoaderData } from "~/routes/loader.user-ccgs";
import { getMostFreshUser } from "~/utils-offline/get-most-fresh-user";

export function meta() {
  return [
    {
      title: "Mes partenaires | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  const formData = await request.formData();
  const response = await fetch(`${import.meta.env.VITE_API_URL}/action/user-entity/${user.id}`, {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  });
  return response;
}

export async function clientLoader() {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  const userCCGs = (
    (await fetch(`${import.meta.env.VITE_API_URL}/loader/user-ccgs`, {
      method: "GET",
      credentials: "include",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
    }).then((res) => res.json())) as UserCCGsLoaderData
  ).userCCGs;

  return json({
    user,
    userCCGs,
  });
}

export default function MesCCGs() {
  const { user, userCCGs } = useLoaderData<typeof clientLoader>();
  const removeCCGFetcher = useFetcher({ key: "ccg-remove" });
  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper
            currentStep={3}
            stepCount={4}
            title="Vos Centres de Collectes du Gibier sauvage"
            nextTitle="Vos notifications"
          />
          <h1 className="fr-h2 fr-mb-2w">Identifiez vos CCGs</h1>
          <CallOut className="bg-white">
            Si vous utilisez un Centre de Collecte du Gibier sauvage (CCG) pour entreposer votre gibier, vous pouvez
            l'identifier ici.
          </CallOut>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              {!userCCGs.length && (
                <p className="fr-fieldset__element mb-4 text-lg font-bold">
                  Cette étape est facultative.
                  <br />
                  Vous pouvez la passer si vous n'avez aucun lien avec un CCG.
                  <br />
                  Vous pouvez aussi la faire plus tard.
                </p>
              )}
              {userCCGs.map((entity) => {
                return (
                  <div key={entity.id} className="fr-fieldset__element">
                    <Notice
                      className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice__title]:before:hidden"
                      style={{
                        boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
                      }}
                      isClosable
                      onClose={() => {
                        const form = new FormData();
                        form.append("_action", "delete");
                        form.append(Prisma.EntityRelationsScalarFieldEnum.owner_id, user.id);
                        form.append(Prisma.EntityRelationsScalarFieldEnum.entity_id, entity.id);
                        form.append("relation", EntityRelationType.WORKING_WITH);
                        removeCCGFetcher.submit(form, {
                          method: "POST",
                          preventScrollReset: true,
                        });
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
              <InputCCG />
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
                    children: "Modifier mes informations",
                    linkProps: {
                      to: "/tableau-de-bord/mon-profil/mes-informations",
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

function InputCCG() {
  const { user } = useLoaderData<typeof clientLoader>();
  const userCCGFetcher = useFetcher({ key: "ccg-new" });
  return (
    <userCCGFetcher.Form method="POST" className="fr-fieldset__element flex w-full flex-row items-end gap-4">
      <input type="hidden" name={Prisma.EntityRelationsScalarFieldEnum.owner_id} value={user.id} />
      <input type="hidden" name="_action" value="create" />
      <input
        type="hidden"
        name={Prisma.EntityRelationsScalarFieldEnum.relation}
        value={EntityRelationType.WORKING_WITH}
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
