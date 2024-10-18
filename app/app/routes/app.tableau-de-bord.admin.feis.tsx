import { UserRoles } from "@prisma/client";
import { Link, redirect, useLoaderData } from "@remix-run/react";
import dayjs from "dayjs";
import ResponsiveTable from "@app/components/TableResponsive";
import type { AdminFeisLoaderData } from "@api/routes/api.admin.loader.feis";
import { getUserRoleLabel } from "@app/utils/get-user-roles-label";

export function meta() {
  return [
    {
      title: "FEIs | Admin | Zacharie | Ministère de l'Agriculture",
    },
  ];
}

export async function clientLoader() {
  const response = (await fetch(`${import.meta.env.VITE_API_URL}/api/admin/loader/feis`, {
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
  const feis = useLoaderData<typeof clientLoader>();

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">FEI</h1>
          <section className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-0">
              <h2 className="fr-h3">FEIs ({feis.length})</h2>
            </div>
            <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              <ResponsiveTable
                headers={["Numéro", "Créée le", "Responsabilités", "Intervenants"]}
                // @ts-expect-error Element or null
                data={feis
                  .filter((fei) => fei !== null)
                  .map((fei) => ({
                    link: `/app/tableau-de-bord/fei/${fei.numero}`,
                    id: fei.numero,
                    rows: [
                      fei.numero!,
                      <>
                        Créée le
                        <br />
                        {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                        <br />
                        Modifiée le
                        <br />
                        {dayjs(fei.updated_at).format("DD/MM/YYYY à HH:mm")}
                        <br />
                        Commune: {fei.commune_mise_a_mort}
                      </>,
                      fei.responsabilites!.map((responsable, index) => {
                        return (
                          <li key={index}>
                            {/* // @ts-expect-error intervenants is not null */}
                            {responsable.type}&nbsp;:
                            <br />
                            {responsable.role ? getUserRoleLabel(responsable.role as UserRoles) : "N/A"}&nbsp;:{" "}
                            {responsable.role ? (responsable.email! ?? responsable?.raison_sociale ?? "Inconnu") : ""}
                            <br />
                          </li>
                        );
                      }),
                      fei.intervenants!.map((intervenant, index) => {
                        if (!intervenant.email && !intervenant.raison_sociale) {
                          return null;
                        }
                        return (
                          <li key={index}>
                            {/* // @ts-expect-error intervenants is not null */}
                            {intervenant.type}: {intervenant.email! ?? intervenant?.raison_sociale}
                            <br />
                          </li>
                        );
                      }),
                    ],
                  }))}
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
