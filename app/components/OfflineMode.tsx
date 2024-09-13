import { useNetworkConnectivity } from "@remix-pwa/client";

import { useState } from "react";

export default function OfflineMode() {
  const [isOffline, setIsOffline] = useState(false);
  useNetworkConnectivity({
    onOnline: () => {
      setIsOffline(false);
    },

    onOffline: () => {
      setIsOffline(true);
    },
  });

  if (!isOffline) {
    return false;
  }
  return (
    <p className="bg-action-high-blue-france text-white text-sm px-4 py-2 z-50">
      Vous n'avez pas internet. Les FEI que vous créez/modifiez actuellement seront synchronisées automatiquement
      lorsque vous aurez retrouvé une connection.
    </p>
  );
}
