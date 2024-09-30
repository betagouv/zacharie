import { useEffect, useState } from "react";

export function useIsOnline() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    function handleOnline() {
      navigator.serviceWorker?.controller?.postMessage("manualSync");
      console.log("IS FUCKING ONLINE");
      setIsOnline(true);
    }
    function handleOffline() {
      console.log("IS FUCKING OFFLINE");
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return isOnline;
}

export default function OfflineMode() {
  const isOnline = useIsOnline();

  if (isOnline) {
    return null;
  }
  return (
    <p className="z-50 bg-action-high-blue-france px-4 py-2 text-sm text-white">
      Vous n'avez pas internet. Les FEI que vous créez/modifiez actuellement seront synchronisées automatiquement
      lorsque vous aurez retrouvé une connection.
    </p>
  );
}
