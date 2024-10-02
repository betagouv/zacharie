import { Link, redirect, useLoaderData } from "@remix-run/react";
import { Table } from "@codegouvfr/react-dsfr/Table";
import dayjs from "dayjs";
import { Fragment } from "react";
import type { AdminFeisLoaderData } from "~/routes/api.admin.loader.fei";

export function meta() {
  return [
    {
      title: "FEIs | Admin | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientLoader() {
  const response = (await fetch(`${import.meta.env.VITE_API_URL}/api/admin/loader/fei`, {
    method: "GET",
    credentials: "include",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
  }).then((res) => res.json())) as AdminFeisLoaderData;
  if (!response.ok) {
    throw redirect("/");
  }
  return response.data!;
}

export default function AdminFeis() {
  const { users } = useLoaderData<typeof clientLoader>();

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
                      to={`/app/tableau-de-bord/admin/utilisateur/${user.id}`}
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
                    to={`/app/tableau-de-bord/admin/utilisateur/${user.id}`}
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
                    to={`/app/tableau-de-bord/admin/utilisateur/${user.id}`}
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
