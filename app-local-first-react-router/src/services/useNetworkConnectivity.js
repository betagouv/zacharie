import { useEffect, useState } from "react";
export const useNetworkConnectivity = (options = {}) => {
  const [isOnline, setIsOnline] = useState(typeof window !== "undefined" ? navigator.onLine : false);
  const handleOnline = () => {
    setIsOnline(true);
    options.onOnline && options.onOnline(true);
  };
  const handleOffline = () => {
    setIsOnline(false);
    options.onOffline && options.onOffline(false);
  };
  useEffect(() => {
    if (typeof window !== "undefined") {
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
};
