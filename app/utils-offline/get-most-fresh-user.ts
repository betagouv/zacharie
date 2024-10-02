import type { User } from "@prisma/client";
import { getCacheItem, setCacheItem } from "~/services/indexed-db.client";
import type { MeLoaderData } from "~/routes/api.loader.me";

export async function getMostFreshUser() {
  const cachedUser = (await getCacheItem("user")) as User | null;
  if (typeof window === "undefined") {
    return cachedUser;
  }
  if (!window.navigator.onLine) {
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
      if (userResponse && userResponse.user) {
        window.localStorage.setItem("user", JSON.stringify(userResponse.user));
        await setCacheItem("user", userResponse.user);
      }
      return userResponse.user;
    })
    .catch(() => {
      return null;
    });
}
