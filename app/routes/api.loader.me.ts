import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: { user: null }, error: "Unauthorized" }, { status: 401 });
  }
  return json({
    ok: true,
    data: {
      user,
      latestVersion: __VITE_BUILD_ID__,
    },
    error: "",
  });
}

export type MeLoaderData = ExtractLoaderData<typeof loader>;
