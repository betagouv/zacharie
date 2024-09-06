import { redirect } from "@remix-run/node";

export async function loader() {
  throw redirect("/tableau-de-bord/mon-profil/mes-roles");
}

export default function NullFunction() {
  return null;
}
