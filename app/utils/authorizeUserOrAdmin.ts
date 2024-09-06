import { UserRoles } from "@prisma/client";
import { type ActionFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";

export async function authorizeUserOrAdmin({ request, params }: ActionFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) return { ok: false, data: null, error: "Unauthorized" };

  const isAdmin = user.roles.includes(UserRoles.ADMIN);
  const userId = params.user_id;

  if (!userId) {
    // only admins can create new users this way
    if (!isAdmin) return { ok: false, user: null, error: "Unauthorized" };
  }

  if (userId !== user.id && !isAdmin) {
    return { ok: false, user: null, error: "Unauthorized" };
  }
  return { ok: true, user, error: null };
}
