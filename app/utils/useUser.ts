import { User } from "@prisma/client";
import { useMatches } from "@remix-run/react";
import { useMemo } from "react";

export function useUser() {
  const matches = useMatches();
  const user = useMemo(() => {
    for (const match of matches) {
      // @ts-expect-error - we know this is a user
      if (match.data?.user) {
        // @ts-expect-error - we know this is a user
        return match.data?.user as User;
      }
    }
    return null;
  }, [matches]);
  return user;
}
