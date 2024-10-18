import { Button } from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { redirect, useLoaderData } from "@remix-run/react";
import { UserRoles } from "@prisma/client";
import { getUserRoleLabel } from "@app/utils/get-user-roles-label";
import dayjs from "dayjs";
import type { FeisLoaderData } from "@api/routes/api.loader.feis";
import type { FeisDoneLoaderData } from "@api/routes/api.loader.feis-done";
import { useIsOnline } from "@app/components/OfflineMode";
import { useEffect, useState } from "react";
import ResponsiveTable from "@app/components/TableResponsive";
import { loadFei } from "@app/db/fei.client";

export async function clientLoader() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/loader/feis`, {
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
    const allFeis = [...data.feisUnderMyResponsability, ...data.feisToTake, ...data.feisOngoing];
    for (const fei of allFeis) {
      loadFei(fei.numero);
    }

    const responseDone = await fetch(`${import.meta.env.VITE_API_URL}/api/loader/feis-done`, {
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
    // even if the data is not used here (it's used within a FEI, so in /api/fei/$fei_numero)
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
          <h1 className="fr-h2 fr-mb-2w">Mes fiches d'examen initial (FEI)</h1>
          <section className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-0">
              <h2 className="fr-h3">
                Fiches à compléter{feisAssigned.length > 0 ? ` (${feisAssigned.length})` : null}
              </h2>
            </div>
            {feisAssigned.length ? (
              <ResponsiveTable
                headers={["Numéro", "Créée le", "Par la chasse", "Commune", "Étape en cours"]}
                data={feisAssigned
                  .filter((fei) => fei !== null)
                  .map((fei) => ({
                    link: `/app/tableau-de-bord/fei/${fei.numero}`,
                    id: fei.numero,
                    rows: [
                      fei.numero!,
                      dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm"),
                      fei.premier_detenteur_name_cache!,
                      fei.commune_mise_a_mort!,
                      getUserRoleLabel(
                        fei.fei_next_owner_role && (fei.fei_next_owner_user_id || fei.fei_next_owner_entity_id)
                          ? fei.fei_next_owner_role
                          : fei.fei_current_owner_role!,
                      ),
                    ],
                  }))}
              />
            ) : (
              <p className="m-8">Pas de fiche assignée</p>
            )}
            <div className="my-4 flex flex-col items-start justify-between gap-4 bg-white px-8">
              <Button
                priority="tertiary"
                iconId="ri-refresh-line"
                disabled={!isOnline}
                onClick={() => window.location.reload()}
              >
                Mettre à jour
              </Button>
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
          </section>
          <section className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-0">
              <h2 className="fr-h3">
                Fiches en cours où j'ai eu une intervention{feisOngoing.length > 0 ? ` (${feisOngoing.length})` : null}
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
              <p className="m-8">Pas de fiche en cours</p>
            )}
            <div className="my-4 flex flex-col items-start justify-between gap-4 bg-white px-8">
              <Button
                priority="tertiary"
                iconId="ri-refresh-line"
                disabled={!isOnline}
                onClick={() => window.location.reload()}
              >
                Mettre à jour
              </Button>
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
          </section>
          <section className="mb-6 bg-white md:shadow">
            {!isOnline && (
              <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                Vous ne pouvez pas accéder au détail de vos fiches archivées sans connexion internet.
              </p>
            )}
            <div className="p-4 md:p-8 md:pb-0">
              <h2 className="fr-h3">Fiches archivées{feisDone.length > 0 ? ` (${feisDone.length})` : null}</h2>
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
                  <p className="m-8">Pas encore de fiche archivée</p>
                </>
              )}
            </div>
            <div className="my-4 flex flex-col items-start justify-between gap-4 bg-white px-8">
              <Button
                priority="tertiary"
                iconId="ri-refresh-line"
                disabled={!isOnline}
                onClick={() => window.location.reload()}
              >
                Mettre à jour
              </Button>
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
          </section>
          {user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && (
            <section className="mb-6 bg-white md:shadow">
              <div className="p-4 md:p-8 md:pb-0">
                <h2 className="fr-h3 fr-mb-2w">Nouvelle fiche</h2>
                <p className="fr-text--regular mb-4">Pour créer une nouvelle fiche, c'est par ici 👇</p>
                <div className="flex flex-col items-start bg-white [&_ul]:md:min-w-96">
                  <ButtonsGroup
                    buttons={[
                      {
                        children: "Nouvelle fiche",
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
        </div>
      </div>
    </div>
  );
}
