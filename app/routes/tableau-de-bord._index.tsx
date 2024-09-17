import { redirect, json, type LoaderFunctionArgs } from "@remix-run/node";
// import { useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { getUserOnboardingRoute } from "~/utils/user-onboarded.server";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { Link, useLoaderData } from "@remix-run/react";
import { UserRoles } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";
import dayjs from "dayjs";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  const onboardingRoute = getUserOnboardingRoute(user);
  if (onboardingRoute) {
    throw redirect(onboardingRoute);
  }
  const feiAssigned = await prisma.fei.findMany({
    where: {
      OR: [
        {
          fei_current_owner_user_id: user.id,
        },
        {
          fei_next_owner_user_id: user.id,
        },
        {
          FeiNextEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
              },
            },
          },
        },
        {
          FeiCurrentEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
              },
            },
          },
        },
      ],
    },
    select: {
      numero: true,
      created_at: true,
      fei_current_owner_role: true,
    },
  });
  const feiDone = await prisma.fei.findMany({
    where: {
      created_by_user_id: user.id,
      svi_signed_at: {
        not: null,
      },
    },
    select: {
      numero: true,
      created_at: true,
      svi_signed_at: true,
    },
  });

  return json({ user, feiAssigned, feiDone });
}

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
            <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              {feiAssigned.length ? (
                <Table
                  bordered
                  caption="FEI assignées"
                  data={feiAssigned.map((fei) => [
                    <Link key={fei.numero} to={`/tableau-de-bord/fei/${fei.numero}`}>
                      {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                    </Link>,
                    <Link key={fei.numero} to={`/tableau-de-bord/fei/${fei.numero}`}>
                      {getUserRoleLabel(fei.fei_current_owner_role as UserRoles)}
                    </Link>,
                  ])}
                  headers={["Date de création", "Étape en cours"]}
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
            <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              {feiDone.length ? (
                <Table
                  bordered
                  caption="FEI archivées"
                  data={feiDone.map((fei) => [
                    <Link key={fei.numero} to={`/tableau-de-bord/fei/${fei.numero}`}>
                      {dayjs(fei.created_at).format("DD/MM/YYYY à HH:mm")}
                    </Link>,
                    <Link key={fei.numero} to={`/tableau-de-bord/fei/${fei.numero}`}>
                      {dayjs(fei.svi_signed_at).format("DD/MM/YYYY")}
                    </Link>,
                  ])}
                  headers={["Date de création", "Date de traitement SVI"]}
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
