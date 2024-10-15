import { Button } from "@codegouvfr/react-dsfr/Button";
import { usePWAManager } from "@app/services/usePWAManager";

// https://remix-pwa.run/docs/main/offline#service-worker-update
export default function InstallApp() {
  const stuff = usePWAManager();
  if (!stuff.userInstallChoice) {
    return null;
  }
  return (
    <p className="z-50 flex flex-col items-center gap-2 bg-white px-4 py-2 text-center text-sm">
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
