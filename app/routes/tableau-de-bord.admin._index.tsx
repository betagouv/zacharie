import { redirect } from "@remix-run/node";

export async function loader() {
  throw redirect("/tableau-de-bord");
}

export default function NullFunction() {
  return null;
}
