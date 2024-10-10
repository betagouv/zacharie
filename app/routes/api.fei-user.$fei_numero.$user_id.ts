import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import type { FeiUser } from "~/db/user.server";
import { prisma } from "~/db/prisma.server";
import { userFeiSelect } from "~/db/user.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  if (!params.fei_numero) {
    return json({ ok: false, data: null, error: "Missing fei_numero" }, { status: 401 });
  }
  const fei = await prisma.fei.findUnique({
    where: {
      numero: params.fei_numero as string,
      deleted_at: null,
    },
  });
  if (!fei) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  if (!params.user_id) {
    return json({ ok: false, data: null, error: "Missing user_id" }, { status: 400 });
  }
  const feiUser = await prisma.user.findUnique({
    where: {
      id: params.user_id,
    },
    select: userFeiSelect,
  });
  if (!feiUser) {
    return json({
      ok: true,
      data: {
        user: {
          id: params.user_id,
          prenom: "Jean",
          nom_de_famille: "Le Chasseur",
          telephone: "0123456789",
          email: "jean@lechasseur.com",
          addresse_ligne_1: "1 rue de la forêt",
          addresse_ligne_2: "",
          code_postal: "12345",
          ville: "La Forêt",
          numero_cfei: "1234567890123456",
        } satisfies FeiUser,
      },
      error: "",
    });
  }

  return json({
    ok: true,
    data: {
      user: feiUser satisfies FeiUser,
    },
    error: "",
  });
}

export type FeiUserLoaderData = ExtractLoaderData<typeof loader>;
