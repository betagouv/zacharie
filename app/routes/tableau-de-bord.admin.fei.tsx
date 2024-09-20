import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { Table } from "@codegouvfr/react-dsfr/Table";
import dayjs from "dayjs";
import { Fragment } from "react";

export function meta() {
  return [
    {
      title: "Utilisateurs | Admin | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await getUserFromCookie(request);
  if (!admin?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }
  const users = await prisma.user.findMany();
  return json({ users });
}

export default function AdminUsers() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">FEI</h1>
          <section className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              <Table
                fixed
                noCaption
                className="[&_td]:h-px"
                data={users.map((user, index) => [
                  <div key={user.id} className="flex size-full flex-row items-start">
                    <span className="p-4">{index + 1}</span>
                    <Link
                      to={`/tableau-de-bord/admin/utilisateur/${user.id}`}
                      className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                      suppressHydrationWarning
                    >
                      Compte activé: {user.activated ? "✅" : "❌"}
                      <br />
                      Création: {dayjs(user.created_at).format("DD/MM/YYYY à HH:mm")}
                      <br />
                      Fin d'onboarding: {dayjs(user.onboarded_at).format("DD/MM/YYYY à HH:mm")}
                    </Link>
                  </div>,
                  <Link
                    key={user.id}
                    to={`/tableau-de-bord/admin/utilisateur/${user.id}`}
                    className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                  >
                    {user.prenom} {user.nom_de_famille}
                    <br />＠ {user.email}
                    <br />
                    ☎️ {user.telephone}
                    <br />
                    🏡 {user.addresse_ligne_1}
                    <br />
                    {user.addresse_ligne_2 && (
                      <>
                        <br />
                        {user.addresse_ligne_2}
                      </>
                    )}
                    {user.code_postal} {user.ville}
                  </Link>,
                  <Link
                    key={user.id}
                    to={`/tableau-de-bord/admin/utilisateur/${user.id}`}
                    className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                  >
                    {user.roles.map((role) => (
                      <Fragment key={role}>
                        {role}
                        <br />
                      </Fragment>
                    ))}
                  </Link>,
                ])}
                headers={["Dates", "Identité", "Roles"]}
              />
            </div>
            <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
