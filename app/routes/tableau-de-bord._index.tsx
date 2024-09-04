import { json, LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  console.log(user);
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
