import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import * as Sentry from "@sentry/remix";
import type { User } from "@prisma/client";

const sessionExpirationTime = 1000 * 60 * 60 * 24 * 365; // 10 years

console.log("process.env.SECRET auth", process.env.SECRET);

export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: `Zacharie_session`,
    secrets: [process.env.SECRET ?? "not-so-secret"],
    sameSite: "lax",
    path: "/",
    maxAge: sessionExpirationTime / 1000,
    httpOnly: process.env.NODE_ENV === "production",
    secure: process.env.NODE_ENV === "production",
  },
});

export const getUserFromCookie = async (
  request: Request,
  { failureRedirect = "/connexion?type=compte-existant", successRedirect = null, optional = false, debug = false } = {}
) => {
  const userId = await getUserIdFromCookie(request, { optional: true });
  if (debug) console.log("get userid from cookie", userId);
  if (!userId) {
    if (debug) console.log("no user id");
    if (debug) console.log("optional", optional);
    if (optional) return null;
    if (debug) console.log("throw redirect", failureRedirect);
    throw redirect(failureRedirect);
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
    if (debug) console.log("successRedirect", successRedirect);
    if (successRedirect) throw redirect(successRedirect);
    if (debug) console.log("return user", user);
    return user;
  }
  if (debug) console.log("user deleted", user);
  if (optional) return null;
  const session = await getSession(request.headers.get("Cookie"));
  throw redirect(failureRedirect, {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};

export const getUserIdFromCookie = async (request: Request, { failureRedirect = "/", optional = false } = {}) => {
  const session = await getSession(request.headers.get("Cookie"));
  if (!session) {
    if (optional) return null;
    throw redirect(failureRedirect);
  }
  const userId = session.get("userId");
  if (!userId) {
    if (optional) return null;
    throw redirect(failureRedirect);
  }
  Sentry.setUser({ id: userId });
  return userId;
};

export const getUserEmailFromCookie = async (request: Request, { failureRedirect = "/", optional = false } = {}) => {
  const session = await getSession(request.headers.get("Cookie"));
  if (!session) {
    if (optional) return null;
    throw redirect(failureRedirect);
  }
  const userEmail = session.get("userEmail");
  if (!userEmail) {
    if (optional) return null;
    throw redirect(failureRedirect);
  }
  Sentry.setUser({ email: userEmail });
  return userEmail;
};

export const getUnauthentifiedUserFromCookie = (request: Request) => getUserFromCookie(request, { optional: true });

export const createUserSession = async (request: Request, user: User, failureRedirect: string) => {
  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", user.id);
  session.set("userEmail", user.email);
  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });
  if (!failureRedirect) return await commitSession(session);
  throw redirect(failureRedirect, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
};
