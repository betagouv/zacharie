import { UserRoles } from "@prisma/client";
import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }
  return json({ user });
}

export default function NullFunction() {
  return <Outlet />;
}
