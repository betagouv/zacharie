import type { User } from "@prisma/client";
import * as Sentry from "@sentry/remix";
import { getCacheItem, setCacheItem } from "@app/services/indexed-db.client";
import type { MeLoaderData } from "@api/routes/api.loader.me";

export async function getMostFreshUser() {
  const cachedUser = (await getCacheItem("user")) as User | null;
  if (typeof window === "undefined") {
    return cachedUser;
  }
  if (!window.navigator.onLine) {
    if (cachedUser) {
      Sentry.setUser({
        email: cachedUser.email!,
        id: cachedUser.id,
      });
    }
    window.localStorage.setItem("user", JSON.stringify(cachedUser));
    return cachedUser;
  }
  return fetch(`${import.meta.env.VITE_API_URL}/api/loader/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      const userResponse = (await response.json()) as MeLoaderData;
      if (userResponse?.ok && userResponse.data?.user) {
        if (cachedUser) {
          Sentry.setUser({
            email: cachedUser.email!,
            id: cachedUser.id,
          });
        }
        window.localStorage.setItem("user", JSON.stringify(userResponse.data.user));
        await setCacheItem("user", userResponse.data.user);
      }
      return userResponse.data?.user;
    })
    .catch(() => {
      return null;
    });
}
