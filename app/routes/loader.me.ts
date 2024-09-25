import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return cors(request, json({ ok: false, user: null }), {
      origin: "https://zacharie.cleverapps.io",
      credentials: true,
    });
  }
  return cors(request, json({ ok: true, user }), { origin: "https://zacharie.cleverapps.io", credentials: true });
}

export type MeLoaderData = ExtractLoaderData<typeof loader>;
