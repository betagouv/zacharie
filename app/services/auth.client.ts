import { type User } from "@prisma/client";
import { getCacheItem } from "./indexed-db.client";

type SessionData = {
  userId: string;
  userEmail: string;
  userRoles: string;
};

// Shared function to retrieve and parse the session cookie
const getSessionData = (request: Request): SessionData | null => {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookies(cookieHeader);
  const sessionCookie = cookies["Zacharie_session"];

  if (!sessionCookie) {
    return null;
  }

  try {
    const sessionData = JSON.parse(atob(sessionCookie.split(".")[1]));
    return sessionData;
  } catch (error) {
    console.error("Error parsing session cookie:", error);
    return null;
  }
};

export const getUserIdFromCookieClient = (request: Request): User["id"] | null => {
  const sessionData = getSessionData(request);

  return sessionData?.userId ?? null;
};

export const getUserRolesFromCookieClient = (request: Request): User["roles"] | null => {
  const sessionData = getSessionData(request);

  return (sessionData?.userRoles.split(",") as User["roles"]) ?? null;
};

export const getUserFromClient = async (request: Request): Promise<User | null> => {
  const sessionData = getSessionData(request);

  if (!sessionData) {
    return null;
  }

  const user = await getCacheItem("user");
  return user ?? null;
};

// Helper function to parse cookies
function parseCookies(cookieHeader: string) {
  return cookieHeader.split(";").reduce(
    (cookies, cookie) => {
      const [name, value] = cookie.split("=").map((c) => c.trim());
      cookies[name] = value;
      return cookies;
    },
    {} as Record<string, string>,
  );
}
