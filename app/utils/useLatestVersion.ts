import { useMatches } from "@remix-run/react";
import { useMemo } from "react";

export function useLatestVersion() {
  const matches = useMatches();
  const latestVersion = useMemo(() => {
    for (const match of matches) {
      // @ts-expect-error - we know this is a latestVersion
      if (match.data?.latestVersion) {
        // @ts-expect-error - we know this is a latestVersion
        return match.data?.latestVersion as string;
      }
    }
    return null;
  }, [matches]);
  return latestVersion;
}
