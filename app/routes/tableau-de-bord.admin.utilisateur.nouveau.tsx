import { ActionFunctionArgs, json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { UserRoles, Prisma } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import RolesCheckBoxes from "~/components/RolesCheckboxes";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";

export function meta() {
  return [
    {
      title: "Nouvel utilisateur | Admin | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }

  const formData = await request.formData();
  console.log("formData", Object.fromEntries(formData));

  const createdUser = await prisma.user.create({
    data: {
      email: formData.get(Prisma.UserScalarFieldEnum.email) as string,
      roles: formData.getAll(Prisma.UserScalarFieldEnum.roles) as UserRoles[],
    },
  });

  return redirect(`/tableau-de-bord/admin/utilisateur/${createdUser.id}`);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }
  return json({ user });
}

export default function MesInformations() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <Form className="fr-container fr-container--fluid fr-my-md-14v" method="POST">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvel Utilisateur</h1>
          <CallOut title="Conseil" className="bg-white">
            Si vous voulez gagner du temps, créez d'abord les nouvelles entités le cas échéant (Centre de COllecte, ETG,
            SVI, etc.)
          </CallOut>
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
              <RolesCheckBoxes withAdmin user={user} legend="Sélectionnez tous les rôles du nouvel utilisateur" />
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
