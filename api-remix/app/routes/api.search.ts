import { UserRoles } from "@prisma/client";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const searchQuery = searchParams.get("q");

  if (!searchQuery) {
    return json({ ok: false, data: null, error: "" });
  }

  const carcasse = await prisma.carcasse.findFirst({
    where: {
      numero_bracelet: searchQuery,
    },
  });

  if (carcasse) {
    return json({
      ok: true,
      data: {
        searchQuery,
        redirectUrl: `/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.numero_bracelet}`,
      },
      error: "",
    });
  }

  const fei = await prisma.fei.findFirst({
    where: {
      numero: searchQuery,
    },
  });

  if (fei) {
    return json({
      ok: true,
      data: {
        searchQuery,
        redirectUrl: `/app/tableau-de-bord/fei/${fei.numero}`,
      },
      error: "",
    });
  }

  return json({
    ok: true,
    data: {
      searchQuery,
      redirectUrl: "",
    },
    error: "Aucun élément ne correspond à votre recherche",
  });
}

export type FeiSearchData = ExtractLoaderData<typeof loader>;
