import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { redirect, useLoaderData } from "@remix-run/react";
import { UserRoles } from "@prisma/client";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";
import dayjs from "dayjs";
import type { FeisLoaderData } from "~/routes/api.loader.fei";
import type { FeisDoneLoaderData } from "~/routes/api.loader.fei-done";
import { useIsOnline } from "~/components/OfflineMode";
import { useEffect, useState } from "react";
import ResponsiveTable from "~/components/TableResponsive";

export async function clientLoader() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/loader/fei`, {
      method: "GET",
      credentials: "include",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return redirect("/app/connexion?type=compte-existant");
      }
      throw new Error("Failed to fetch data");
    }

    const data = (await response.json()) as FeisLoaderData;

    const responseDone = await fetch(`${import.meta.env.VITE_API_URL}/api/loader/fei-done`, {
      method: "GET",
      credentials: "include",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return redirect("/app/connexion?type=compte-existant");
      }
      throw new Error("Failed to fetch data");
    }
    const doneData = (await responseDone.json()) as FeisDoneLoaderData;

    // we call myRelations here because
    // even if the data is not used here (it's used within a FEI, so in /api/loader/fei/$fei_numero)
    // we want to cache the data before the user goes to the FEI page
    // for the offline mode to work properly
    fetch(`${import.meta.env.VITE_API_URL}/api/loader/my-relations`, {
      method: "GET",
      credentials: "include",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
    });

    return {
      ...data,
      ...doneData,
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    // If fetch fails (e.g., offline), the service worker will handle serving cached data
    return null;
  }
}

clientLoader.hydrate = true; // (2)

export default function TableauDeBordIndex() {
  const data = useLoaderData<typeof clientLoader>()!;
  const user = data.user!;
  const { feisDone, feisOngoing, feisToTake, feisUnderMyResponsability } = data;
  const feisAssigned = [...feisUnderMyResponsability, ...feisToTake].sort((a, b) => {
    return b.updated_at < a.updated_at ? -1 : 1;
  });
  const [showBackOnlineRefresh, setShowBackOnlineRefresh] = useState(false);
  const isOnline = useIsOnline(() => {
    setShowBackOnlineRefresh(true);
  });

  useEffect(() => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "TABLEAU_DE_BORD_OPEN" });
    }
  }, [user]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          {showBackOnlineRefresh && (
            <button
              className="block bg-action-high-blue-france px-4 py-2 text-sm text-white"
              onClick={() => {
                window.location.reload();
                setShowBackOnlineRefresh(false);
              }}
              type="button"
            >
              Vous êtes de retour en ligne. Cicquez <u>ici</u> pour rafraichir les données.
            </button>
          )}
          <h1 className="fr-h2 fr-mb-2w">Mes FEI</h1>
          <CallOut title="🖥️ Toutes vos FEI centralisées" className="bg-white">
            Retrouvez ici toutes vos FEI - en cours, validées, refusées - et les actions à mener.
          </CallOut>
          {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
            <section className="mb-6 bg-white md:shadow">
              <div className="p-4 md:p-8 md:pb-0">
                <h2 className="fr-h3 fr-mb-2w">Nouvelle FEI</h2>
                <p className="fr-text--regular mb-4">Pour créer une nouvelle FEI, c'est par ici 👇</p>
                <div className="flex flex-col items-start bg-white [&_ul]:md:min-w-96">
                  <ButtonsGroup
                    buttons={[
                      {
                        children: "Nouvelle FEI",
                        linkProps: {
                          to: "/app/tableau-de-bord/fei/nouvelle",
                          href: "#",
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            </section>
          )}
          <section className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-0">
              <h2 className="fr-h3">FEI assignées{feisAssigned.length > 0 ? ` (${feisAssigned.length})` : null}</h2>
            </div>
            {feisAssigned.length ? (
              <ResponsiveTable
                headers={["Numéro", "Créée le", "Modifiée le", "Commune", "Étape en cours"]}
                data={feisAssigned
                  .filter((fei) => fei !== null)
                  .map((fei) => ({
                    link: `/app/tableau-de-bord/fei/${fei.numero}`,
                    id: fei.numero,
                    rows: [
                      fei.numero!,
                      dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm"),
                      dayjs(fei.updated_at).format("DD/MM/YYYY à HH:mm"),
                      fei.commune_mise_a_mort!,
                      getUserRoleLabel(
                        fei.fei_next_owner_role && (fei.fei_next_owner_user_id || fei.fei_next_owner_user_id)
                          ? fei.fei_next_owner_role
                          : fei.fei_current_owner_role!,
                      ),
                    ],
                  }))}
              />
            ) : (
              <p className="m-8">Pas de FEI assignée</p>
            )}
            <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Rafraichir",
                    disabled: !isOnline,
                    nativeButtonProps: {
                      onClick: () => {
                        window.location.reload();
                      },
                    },
                  },
                ]}
              />
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
          </section>
          <section className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-0">
              <h2 className="fr-h3">
                FEI en cours où j'ai eu une intervention{feisOngoing.length > 0 ? ` (${feisOngoing.length})` : null}
              </h2>
            </div>
            {feisOngoing.length ? (
              <ResponsiveTable
                headers={["Numéro", "Créée le", "Modifiée le", "Commune", "Étape en cours"]}
                data={feisOngoing
                  .filter((fei) => fei !== null)
                  .map((fei) => ({
                    link: `/app/tableau-de-bord/fei/${fei.numero}`,
                    id: fei.numero,
                    rows: [
                      fei.numero!,
                      dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm"),
                      dayjs(fei.updated_at).format("DD/MM/YYYY à HH:mm"),
                      fei.commune_mise_a_mort!,
                      getUserRoleLabel(fei.fei_next_owner_role ?? (fei.fei_current_owner_role as UserRoles)),
                    ],
                  }))}
              />
            ) : (
              <p className="m-8">Pas de FEI en cours</p>
            )}
            <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Rafraichir",
                    disabled: !isOnline,
                    nativeButtonProps: {
                      onClick: () => {
                        window.location.reload();
                      },
                    },
                  },
                ]}
              />
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
          </section>
          <section className="mb-6 bg-white md:shadow">
            {!isOnline && (
              <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                Vous ne pouvez pas accéder au détail de vos FEI archivées sans connexion internet.
              </p>
            )}
            <div className="p-4 md:p-8 md:pb-0">
              <h2 className="fr-h3">FEI archivées{feisDone.length > 0 ? ` (${feisDone.length})` : null}</h2>
            </div>
            <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              {feisDone.length ? (
                <ResponsiveTable
                  headers={["Numéro", "Créée le", "Commune", "Inspection SVI le"]}
                  data={feisDone
                    .filter((fei) => fei !== null)
                    .map((fei) => ({
                      link: `/app/tableau-de-bord/fei/${fei.numero}`,
                      id: fei.numero,
                      rows: [
                        fei.numero!,
                        dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm"),
                        fei.commune_mise_a_mort!,
                        dayjs(fei.svi_signed_at).format("DD/MM/YYYY à HH:mm"),
                      ],
                    }))}
                />
              ) : (
                <>
                  <p className="m-8">Pas encore de FEI archivée</p>
                </>
              )}
            </div>
            <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Rafraichir",
                    disabled: !isOnline,
                    nativeButtonProps: {
                      onClick: () => {
                        window.location.reload();
                      },
                    },
                  },
                ]}
              />
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
