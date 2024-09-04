import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import * as Sentry from "@sentry/remix";
import type { User } from "@prisma/client";

const sessionExpirationTime = 1000 * 60 * 60 * 24 * 365; // 10 years

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
  { failureRedirect = "/", successRedirect = null, optional = false } = {}
) => {
  const userId = await getUserIdFromCookie(request, { optional: true });
  if (!userId) {
    if (optional) return null;
    throw redirect(failureRedirect);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (user && !user.deletedAt) {
    Sentry.setUser({
      id: userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastSeenAt: new Date(),
      },
    });
    if (successRedirect) throw redirect(successRedirect);
    return user;
  }
  if (optional) return null;
  throw redirect(failureRedirect);
};

export const getUserIdFromCookie = async (
  request: Request,
  { failureRedirect = "/", optional = false } = {}
) => {
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

export const getUserEmailFromCookie = async (
  request: Request,
  { failureRedirect = "/", optional = false } = {}
) => {
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

export const getUnauthentifiedUserFromCookie = (request: Request) =>
  getUserFromCookie(request, { optional: true });

export const createUserSession = async (request: Request, user: User, failureRedirect: string) => {
  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", user.id);
  session.set("userEmail", user.email);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  if (!failureRedirect) return await commitSession(session);
  throw redirect(failureRedirect, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
};
