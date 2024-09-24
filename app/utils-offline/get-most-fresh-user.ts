import type { User } from "@prisma/client";
import { getCacheItem, setCacheItem } from "~/services/indexed-db.client";
import type { MeLoaderData } from "~/routes/loader.me";

export async function getMostFreshUser() {
  const cachedUser = (await getCacheItem("user")) as User | null;
  if (typeof window === "undefined") {
    return cachedUser;
  }
  if (!window.navigator.onLine) {
    return cachedUser;
  }
  fetch(`${import.meta.env.VITE_API_URL}/loader/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      const userResponse = (await response.json()) as MeLoaderData;
      if (userResponse && userResponse.user) {
        await setCacheItem("user", userResponse.user);
      }
      return userResponse.user;
    })
    .catch(() => {
      return cachedUser;
    });
}
