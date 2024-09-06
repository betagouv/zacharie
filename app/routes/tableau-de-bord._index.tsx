import { redirect, json, type LoaderFunctionArgs } from "@remix-run/node";
// import { useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { getUserOnboardingRoute } from "~/utils/user-onboarded.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");
  const onboardingRoute = getUserOnboardingRoute(user);
  if (onboardingRoute) throw redirect(onboardingRoute);
  return json({ user });
}

export default function TableauDeBord() {
  return (
    <section className="fr-container min-h-[50vh] flex flex-col justify-center my-auto">
      <div className="fr-grid-row fr-grid-row--gutters fr-py-6w flex flex-col justify-center my-auto">
        <h1 className="fr-h1">Tableau de bord</h1>
      </div>
    </section>
  );
}
