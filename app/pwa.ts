import { registerSW } from "virtual:pwa-register";

if ("serviceWorker" in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(swScriptUrl: unknown) {
      console.log("SW registered: ", swScriptUrl);
    },
    onOfflineReady() {
      console.log("PWA application ready to work offline");
    },
  });
}
