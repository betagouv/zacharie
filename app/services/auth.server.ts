/* eslint-disable curly */
import { createCookieSessionStorage, redirect, json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import * as Sentry from "@sentry/remix";
import type { User } from "@prisma/client";

const sessionExpirationTime = 1000 * 60 * 60 * 24 * 365; // 10 years

export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: `Zacharie_session`,
    // domain: process.env.NODE_ENV === "production" ? "zacharie.beta.gouv.fr" : "localhost:3232",
    secrets: [process.env.SECRET ?? "not-so-secret"],
    sameSite: "none",
    path: "/",
    maxAge: sessionExpirationTime / 1000,
    httpOnly: true,
    secure: true,
  },
});

export const getUserFromCookie = async (
  request: Request,
  { failureRedirect = "/connexion?type=compte-existant", optional = false, debug = false } = {},
) => {
  if (process.env.NODE_ENV === "development") {
    // because ios cookie in dev not working
    return JSON.parse(import.meta.env.VITE_COOKIE_USER);
  }
  const userId = await getUserIdFromCookie(request, { optional: true });
  if (debug) console.log("get userid from cookie", userId);
  if (!userId) {
    if (debug) console.log("no user id");
    if (debug) console.log("optional", optional);
    if (optional) return null;
    if (debug) console.log("throw redirect", failureRedirect);
    return logoutAndRedirect(request, failureRedirect);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (debug) console.log("user", !!user);
  if (user && !user.deleted_at) {
    Sentry.setUser({
      id: userId,
      firstName: user.prenom,
      lastName: user.nom_de_famille,
      email: user.email ?? "",
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        last_seen_at: new Date(),
      },
    });
    if (debug) console.log("user not deleted", user);
    if (debug) console.log("return user", user);
    return user;
  }
  if (debug) console.log("user deleted", user);
  if (optional) return null;
  return logoutAndRedirect(request, failureRedirect);
};

export const getUserIdFromCookie = async (request: Request, { failureRedirect = "/", optional = false } = {}) => {
  const session = await getSession(request.headers.get("Cookie"));
  if (!session) {
    if (optional) return null;
    return logoutAndRedirect(request, failureRedirect);
  }
  const userId = session.get("userId");
  if (!userId) {
    if (optional) return null;
    return logoutAndRedirect(request, failureRedirect);
  }
  Sentry.setUser({ id: userId });
  return userId;
};

export const getUserEmailFromCookie = async (request: Request, { failureRedirect = "/", optional = false } = {}) => {
  const session = await getSession(request.headers.get("Cookie"));
  if (!session) {
    if (optional) return null;
    return logoutAndRedirect(request, failureRedirect);
  }
  const userEmail = session.get("userEmail");
  if (!userEmail) {
    if (optional) return null;
    return logoutAndRedirect(request, failureRedirect);
  }
  const userRoles = session.get("userRoles");
  if (!userRoles) {
    if (optional) return null;
    return logoutAndRedirect(request, failureRedirect);
  }
  Sentry.setUser({ email: userEmail, roles: userRoles });
  return userEmail;
};

export const getUnauthentifiedUserFromCookie = (request: Request) => getUserFromCookie(request, { optional: true });

export const createUserSession = async (request: Request, user: User) => {
  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", user.id);
  session.set("userEmail", user.email);
  session.set("userRoles", user.roles.join(","));
  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });
  const cookieValue = await commitSession(session);
  return json(
    { ok: true, error: null, data: user },
    {
      headers: {
        "Set-Cookie": cookieValue,
        // "Access-Control-Allow-Credentials": "true",
        // "Access-Control-Allow-Origin": import.meta.env.DEV ? "http://localhost:3232" : "https://zacharie.beta.gouv.fr",
        // "Access-Control-Allow-Origin": "https://zacharie.beta.gouv.fr",
      },
    },
  );
};

const logoutAndRedirect = async (request: Request, failureRedirectPathname: string) => {
  console.log("destroying brother");
  const session = await getSession(request.headers.get("Cookie"));
  if (session) {
    session.set("userId", "");
    session.set("userEmail", "");
    session.set("userRoles", "");
    // get the origin and append the failureRedirectPathname
    const origin = new URL(request.url).origin;
    const failureRedirect = `${origin}${failureRedirectPathname}`;
    redirect(failureRedirect, {
      headers: {
        "Set-Cookie": await destroySession(session),
      },
    });
  }
  return null;
};
