import { useEffect, useState } from "react";

function isClient() {
  return typeof window !== "undefined";
}

function useNetworkConnectivity() {
  const [isOnline, setIsOnline] = useState(true);
  const handleOnline = () => {
    setIsOnline(true);
  };
  const handleOffline = () => {
    setIsOnline(false);
  };
  useEffect(() => {
    if (isClient()) {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return isOnline;
}

export default function OfflineMode() {
  const isOnline = useNetworkConnectivity();

  if (isOnline) {
    return null;
  }
  return (
    <p className="bg-action-high-blue-france text-white text-sm px-4 py-2 z-50">
      Vous n'avez pas internet. Les FEI que vous créez/modifiez actuellement seront synchronisées automatiquement
      lorsque vous aurez retrouvé une connection.
    </p>
  );
}
