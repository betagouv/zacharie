import { ActionFunctionArgs, json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { UserRoles, Prisma, EntityTypes } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";

export function meta() {
  return [
    {
      title: "Nouvelle entité | Admin | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }

  const formData = await request.formData();
  console.log("formData tableau-de-bord.admin.entite.nouvelle", Object.fromEntries(formData));

  const createdEntity = await prisma.entity.create({
    data: {
      raison_sociale: formData.get(Prisma.EntityScalarFieldEnum.raison_sociale) as string,
      type: formData.get(Prisma.EntityScalarFieldEnum.type) as EntityTypes,
    },
  });

  return redirect(`/tableau-de-bord/admin/entite/${createdEntity.id}`);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }
  return json({ user });
}

export default function AdminNouvelleEntite() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <Form className="fr-container fr-container--fluid fr-my-md-14v" method="POST">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvelle Entité</h1>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <div className="fr-fieldset__element">
                <Input
                  label="Raison Sociale"
                  nativeInputProps={{
                    id: Prisma.EntityScalarFieldEnum.raison_sociale,
                    name: Prisma.EntityScalarFieldEnum.raison_sociale,
                    placeholder: "ETG de la Garenne",
                    required: true,
                    autoComplete: "off",
                  }}
                />
              </div>
              <div className="fr-fieldset__element">
                <RadioButtons
                  legend="Type d'entité"
                  options={[
                    {
                      nativeInputProps: {
                        required: true,
                        name: Prisma.EntityScalarFieldEnum.type,
                        value: EntityTypes.CCG,
                      },
                      label: getUserRoleLabel(EntityTypes.CCG),
                    },
                    {
                      nativeInputProps: {
                        required: true,
                        name: Prisma.EntityScalarFieldEnum.type,
                        value: EntityTypes.COLLECTEUR_PRO,
                      },
                      label: getUserRoleLabel(EntityTypes.COLLECTEUR_PRO),
                    },
                    {
                      nativeInputProps: {
                        required: true,
                        name: Prisma.EntityScalarFieldEnum.type,
                        value: EntityTypes.ETG,
                      },
                      label: getUserRoleLabel(EntityTypes.ETG),
                    },
                    {
                      nativeInputProps: {
                        required: true,
                        name: Prisma.EntityScalarFieldEnum.type,
                        value: EntityTypes.SVI,
                      },
                      label: getUserRoleLabel(EntityTypes.SVI),
                    },
                  ]}
                />
              </div>
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Créer",
                    type: "submit",
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </Form>
  );
}
