import { redirect } from "@remix-run/react";

export async function clientLoader() {
  throw redirect("/tableau-de-bord/mon-profil/mes-roles");
}

export default function NullFunction() {
  return null;
}
