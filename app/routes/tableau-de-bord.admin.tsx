import { UserRoles } from "@prisma/client";
import { json, redirect, Outlet } from "@remix-run/react";
import { getMostFreshUser } from "~/utils-offline/get-most-fresh-user";

export async function clientLoader() {
  const user = await getMostFreshUser();
  if (!user?.roles?.includes(UserRoles.ADMIN)) {
    throw redirect("/connexion?type=compte-existant");
  }
  return json({ user });
}

export default function NullFunction() {
  return <Outlet />;
}
