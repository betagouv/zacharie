import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { json, Link, redirect, useLoaderData } from "@remix-run/react";
import { UserRoles } from "@prisma/client";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";
import dayjs from "dayjs";
import { getCacheItem, setCacheItem } from "~/services/indexed-db.client";
import type { FeisLoaderData } from "~/routes/loader.fei";

let isInitialRequest = true;

export async function clientLoader() {
  console.log("clientLoader");
  const isOnline = window.navigator.onLine;

  console.log("isOnline", isOnline);

  if (isInitialRequest) {
    isInitialRequest = false;
    const response = await fetch(`${import.meta.env.VITE_API_URL}/loader/fei`, {
      method: "GET",
      credentials: "include",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch data");
    }
    if (response.redirected) {
      throw redirect(response.url);
    }
    console.log("response", response);
    const serverData = (await response.json()) as FeisLoaderData;
    setCacheItem("user", serverData.user);
    setCacheItem("feiAssigned", serverData.feiAssigned);
    setCacheItem("feiDone", serverData.feiDone);
    return serverData;
  }

  const cachedUser = await getCacheItem("user");
  const cachedFeiAssigned = await getCacheItem("feiAssigned");
  const cachedFeiDone = await getCacheItem("feiDone");
  if (cachedUser && cachedFeiAssigned && cachedFeiDone) {
    return json({ user: cachedUser, feiAssigned: cachedFeiAssigned, feiDone: cachedFeiDone });
  }

  const response = await fetch(`${import.meta.env.VITE_API_URL}/loader/fei`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }
  if (response.redirected) {
    throw redirect(response.url);
  }
  const serverData = (await response.json()) as FeisLoaderData;
  setCacheItem("user", serverData.user);
  setCacheItem("feiAssigned", serverData.feiAssigned);
  setCacheItem("feiDone", serverData.feiDone);
  return serverData;
}

clientLoader.hydrate = true; // (2)

export default function TableauDeBordIndex() {
  const { user, feiAssigned, feiDone } = useLoaderData<typeof loader>();

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
                          to: "/tableau-de-bord/fei/nouvelle",
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
              {feiAssigned.length ? (
                <Table
                  bordered
                  caption="FEI assignées"
                  className="[&_td]:h-px"
                  data={feiAssigned.map((fei) => [
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                    >
                      {fei.numero}
                    </Link>,
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                      suppressHydrationWarning
                    >
                      {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                    </Link>,
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                      suppressHydrationWarning
                    >
                      {dayjs(fei.updated_at).format("DD/MM/YYYY à HH:mm")}
                    </Link>,
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                    >
                      {fei.commune_mise_a_mort}
                    </Link>,
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
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
                    linkProps: {
                      to: "/tableau-de-bord/",
                      href: "#",
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
              {feiDone.length ? (
                <Table
                  bordered
                  className="[&_td]:h-px"
                  caption="FEI archivées"
                  data={feiDone.map((fei) => [
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                    >
                      {fei.numero}
                    </Link>,
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                      suppressHydrationWarning
                    >
                      {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                    </Link>,
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                      suppressHydrationWarning
                    >
                      {dayjs(fei.updated_at).format("DD/MM/YYYY à HH:mm")}
                    </Link>,
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                    >
                      {fei.commune_mise_a_mort}
                    </Link>,
                    <Link
                      className="!inline-flex size-full items-center justify-start !bg-none !no-underline"
                      key={fei.numero}
                      suppressHydrationWarning
                      to={`/tableau-de-bord/fei/${fei.numero}`}
                    >
                      {dayjs(fei.svi_signed_at).format("DD/MM/YYYY")}
                    </Link>,
                  ])}
                  headers={["Numéro", "Date de création", "Dernière mise à jour", "Commune", "Étape en cours"]}
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
                    linkProps: {
                      to: "/tableau-de-bord/",
                      href: "#",
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
