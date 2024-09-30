import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { destroySession, getSession } from "~/services/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  throw redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}
