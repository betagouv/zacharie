import { Button } from "@codegouvfr/react-dsfr/Button";
import { usePWAManager } from "~/services/usePWAManager";

// https://remix-pwa.run/docs/main/offline#service-worker-update
export default function InstallApp() {
  const stuff = usePWAManager();
  if (!stuff.userInstallChoice) {
    return null;
  }
  return (
    <p className="bg-white text-sm px-4 py-2 z-50 text-center flex flex-col items-center gap-2">
      Nouvelle version disponible
      <Button
        type="button"
        onClick={() => {
          stuff.promptInstall(() => console.log("app installed baby"));
        }}
      >
        Installer l'app
      </Button>
    </p>
  );
}
