import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { Link, redirect, useLoaderData } from "@remix-run/react";
import { UserRoles } from "@prisma/client";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";
import dayjs from "dayjs";
import { getCacheItem, setCacheItem } from "~/services/indexed-db.client";
import type { FeisLoaderData } from "~/routes/api.loader.fei";
import { useIsOnline } from "~/components/OfflineMode";
import { setFeisToCache } from "~/utils/caches";
import { useEffect } from "react";
import { registerServiceWorker } from "~/sw/registerServiceWorker";

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
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    // If fetch fails (e.g., offline), the service worker will handle serving cached data
    return null;
  }
}

clientLoader.hydrate = true; // (2)

export default function TableauDeBordIndex() {
  const data = useLoaderData<FeisLoaderData>();
  const user = data.user!;
  const { feisOngoing, feisToTake, feisUnderMyResponsability } = data;
  const feisAssigned = [...feisUnderMyResponsability, ...feisToTake];
  const isOnline = useIsOnline();

  useEffect(() => {
    if (user) {
      registerServiceWorker();
    }
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "APP_OPENED" });
    }
  }, [user]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Mes FEI</h1>
          <CallOut title="🖥️ Toutes vos FEI centralisées" className="bg-white">
            Retrouvez ici toutes vos FEI - en cours, validées, refusées - et les actions à mener.
          </CallOut>
          {(user.roles.includes(UserRoles.PREMIER_DETENTEUR) || user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) && (
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
            <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              {feisAssigned.length ? (
                <Table
                  bordered
                  caption="FEI assignées"
                  className="[&_td]:h-px"
                  data={feisAssigned
                    .filter((fei) => fei !== null)
                    .map((fei) => [
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {fei.numero}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                        suppressHydrationWarning
                      >
                        {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                        suppressHydrationWarning
                      >
                        {dayjs(fei.updated_at).format("DD/MM/YYYY à HH:mm")}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {fei.commune_mise_a_mort}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {getUserRoleLabel(fei.fei_next_owner_role ?? (fei.fei_current_owner_role as UserRoles))}
                      </Link>,
                    ])}
                  headers={["Numéro", "Date de création", "Dernière mise à jour", "Commune", "Étape en cours"]}
                />
              ) : (
                <>
                  <h2 className="fr-h3 fr-mb-2w">FEI assignées</h2>
                  <p className="my-8">Pas encore de donnée</p>
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
          <section className="mb-6 bg-white md:shadow">
            <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              {feisOngoing.length ? (
                <Table
                  bordered
                  caption="FEI en cours où j'ai eu une intervention"
                  className="[&_td]:h-px"
                  data={feisOngoing
                    .filter((fei) => fei !== null)
                    .map((fei) => [
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {fei.numero}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                        suppressHydrationWarning
                      >
                        {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                        suppressHydrationWarning
                      >
                        {dayjs(fei.updated_at).format("DD/MM/YYYY à HH:mm")}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {fei.commune_mise_a_mort}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {getUserRoleLabel(fei.fei_next_owner_role ?? (fei.fei_current_owner_role as UserRoles))}
                      </Link>,
                    ])}
                  headers={["Numéro", "Date de création", "Dernière mise à jour", "Commune", "Étape en cours"]}
                />
              ) : (
                <>
                  <h2 className="fr-h3 fr-mb-2w">FEI en cours où j'ai eu une intervention</h2>
                  <p className="my-8">Pas encore de donnée</p>
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
          {/* <section className="mb-6 bg-white md:shadow">
            <div className="px-4 py-2 md:px-8 md:pb-0 md:pt-2 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              {feisDone.length ? (
                <Table
                  bordered
                  className="[&_td]:h-px"
                  caption="FEI archivées"
                  data={feisDone
                    .filter((fei) => fei !== null)
                    .map((fei) => [
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {fei.numero}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                        suppressHydrationWarning
                      >
                        {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {fei.commune_mise_a_mort}
                      </Link>,
                      <Link
                        className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                        key={fei.numero}
                        suppressHydrationWarning
                        to={`/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                      </Link>,
                    ])}
                  headers={["Numéro", "Date de création", "Commune", "Inspection SVI le"]}
                />
              ) : (
                <>
                  <h2 className="fr-h3 fr-mb-2w">FEI archivées</h2>
                  <p className="my-8">Pas encore de donnée</p>
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
          </section> */}
        </div>
      </div>
    </div>
  );
}
