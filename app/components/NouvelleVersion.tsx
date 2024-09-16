import { Button } from "@codegouvfr/react-dsfr/Button";
import { usePWAManager } from "~/services/usePWAManager";

const messageSW = (e: ServiceWorker, message: { type: string }) => {
  e.postMessage(message);
};
const sendSkipWaitingMessage = (e: ServiceWorker) => {
  messageSW(e, { type: "SKIP_WAITING" });
};
// https://remix-pwa.run/docs/main/offline#service-worker-update
export default function NouvelleVersion() {
  const stuff = usePWAManager();
  if (!stuff.swUpdate.isUpdateAvailable) {
    return null;
  }
  return (
    <p className="bg-white text-sm px-4 py-2 z-50 text-center flex flex-col items-center gap-2">
      Nouvelle version disponible
      <Button
        type="button"
        onClick={() => {
          sendSkipWaitingMessage(stuff.swUpdate.newWorker!);
          window.location.reload();
        }}
      >
        Mettre à jour
      </Button>
    </p>
  );
}
