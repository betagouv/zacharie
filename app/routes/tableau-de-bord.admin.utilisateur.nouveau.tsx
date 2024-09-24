import { Form, redirect, type ClientActionFunctionArgs } from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Prisma } from "@prisma/client";
import RolesCheckBoxes from "~/components/RolesCheckboxes";
import type { AdminNouveauUserLoaderData } from "~/routes/admin.action.utilisateur.nouveau";

export function meta() {
  return [
    {
      title: "Nouvel utilisateur | Admin | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  console.log("formData tableau-de-bord.admin.utilisateur.nouveau", Object.fromEntries(formData));
  const response = (await fetch(`${import.meta.env.VITE_API_URL}/admin/action/utilisateur/nouveau`, {
    method: "POST",
    credentials: "include",
    body: formData,
  }).then((response) => (response.json ? response.json() : response))) as AdminNouveauUserLoaderData;
  console.log("response tableau-de-bord.admin.utilisateur.nouveau", response);
  if (response.ok && response.data) {
    return redirect(`/tableau-de-bord/admin/utilisateur/${response.data.id}`);
  }
  return response;
}

export default function AdminNewUser() {
  return (
    <Form className="fr-container fr-container--fluid fr-my-md-14v" method="POST">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvel Utilisateur</h1>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <div className="fr-fieldset__element">
                <Input
                  label="Email"
                  nativeInputProps={{
                    id: Prisma.UserScalarFieldEnum.email,
                    name: Prisma.UserScalarFieldEnum.email,
                    required: true,
                    autoComplete: "off",
                  }}
                />
              </div>
              <RolesCheckBoxes withAdmin legend="Sélectionnez tous les rôles du nouvel utilisateur" />
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
