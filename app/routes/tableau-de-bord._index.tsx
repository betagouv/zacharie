import { json, LoaderFunctionArgs } from "@remix-run/node";
import { redirect, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  console.log("user in tableau de bord", user?.id);
  if (!user?.roles?.length) {
    console.log("redirecting to onboarding");
    throw redirect("/tableau-de-bord/onboarding-etape-1");
  }
  return json({ user });
}

export default function TableauDeBord() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <section className="fr-container min-h-[50vh] flex flex-col justify-center my-auto">
      <div className="fr-grid-row fr-grid-row--gutters fr-py-6w flex flex-col justify-center my-auto">
        <h1 className="fr-h1">Tableau de bord</h1>
      </div>
    </section>
  );
}
