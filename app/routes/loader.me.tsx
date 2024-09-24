import { type LoaderFunctionArgs } from "@remix-run/node";
import { json } from "react-router-dom";

import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, user: null });
  }
  return json({ ok: true, user });
}

export type MeLoaderData = ExtractLoaderData<typeof loader>;
