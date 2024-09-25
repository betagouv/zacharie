import type { User } from "@prisma/client";
import { getCacheItem, setCacheItem } from "~/services/indexed-db.client";
import type { MeLoaderData } from "~/routes/loader.me";

export async function getMostFreshUser() {
  const cachedUser = (await getCacheItem("user")) as User | null;
  console.log("CACHED USER", cachedUser);
  if (typeof window === "undefined") {
    console.log("RETURNING CACHED USER", cachedUser);
    return cachedUser;
  }
  console.log("ONLINE", window.navigator.onLine);
  if (!window.navigator.onLine) {
    console.log("RETURNING CACHED USER OFFLINE", cachedUser);
    return cachedUser;
  }
  return fetch(`${import.meta.env.VITE_API_URL}/loader/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      const userResponse = (await response.json()) as MeLoaderData;
      console.log("USER RESPONSE", userResponse);
      if (userResponse && userResponse.user) {
        console.log("SETTING CACHED USER", userResponse.user);
        await setCacheItem("user", userResponse.user);
      }
      console.log("RETURNING USER", userResponse.user);
      return userResponse.user;
    })
    .catch(() => {
      return cachedUser;
    });
}
