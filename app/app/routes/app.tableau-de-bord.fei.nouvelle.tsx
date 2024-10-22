import { getMostFreshUser } from "@app/utils-offline/get-most-fresh-user";
import { Prisma, UserRoles } from "@prisma/client";
import { redirect } from "@remix-run/react";
import dayjs from "dayjs";
import type { FeiActionData } from "@api/routes/api.fei.$fei_numero";

export async function clientLoader() {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }

  const newFeiNumero = `ZACH-FEI-${dayjs().format("YYYYMMDD")}-${user.id}-${dayjs().format("HHmmss")}`;
  const feiForm = new FormData();
  feiForm.set(Prisma.FeiScalarFieldEnum.numero, newFeiNumero);
  feiForm.set(Prisma.FeiScalarFieldEnum.created_by_user_id, user.id);
  feiForm.set(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id, user.id);
  feiForm.set(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id, user.id);
  feiForm.set(Prisma.FeiScalarFieldEnum.fei_current_owner_role, UserRoles.EXAMINATEUR_INITIAL);
  feiForm.set(Prisma.FeiScalarFieldEnum.date_mise_a_mort, dayjs().toISOString().split("T")[0]);

  const newFei = (await fetch(`${import.meta.env.VITE_API_URL}/api/fei/${newFeiNumero}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    body: feiForm,
  }).then((res) => res.json())) as FeiActionData;
  console.log({ newFei });
  if (newFei.data) {
    return redirect(`/app/tableau-de-bord/fei/${newFei.data.fei.numero}`);
  }
  return newFei;
}

export default function NullFunction() {
  return <div>Création de la nouvelle fiche en cours...</div>;
}
