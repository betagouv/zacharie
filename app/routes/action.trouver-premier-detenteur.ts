import { Prisma, UserRoles } from "@prisma/client";
import { type ActionFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  console.log("formData", Object.fromEntries(formData.entries()));

  if (!formData.has(Prisma.UserScalarFieldEnum.email)) {
    return json({ ok: false, data: null, error: "L'email est obligatoire" }, { status: 400 });
  }
  if (!formData.has(Prisma.FeiScalarFieldEnum.numero)) {
    return json({ ok: false, data: null, error: "Le numéro de la FEI est obligatoire" }, { status: 400 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: formData.get(Prisma.FeiScalarFieldEnum.numero) as string,
      fei_next_owner_role: UserRoles.PREMIER_DETENTEUR,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "La FEI n'existe pas" }, { status: 400 });
  }
  const nextPremierDetenteur = await prisma.user.findUnique({
    where: {
      email: formData.get(Prisma.UserScalarFieldEnum.email) as string,
    },
  });
  if (!nextPremierDetenteur) {
    return json({ ok: false, data: null, error: "L'utilisateur n'existe pas" }, { status: 400 });
  }

  await prisma.fei.update({
    where: {
      numero: fei.numero,
    },
    data: {
      fei_next_owner_user_id: nextPremierDetenteur.id,
    },
  });

  return json({ ok: true, data: nextPremierDetenteur, error: null });
}

export default function ActionUser() {
  return null;
}
