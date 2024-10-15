export async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const swUrl = import.meta.env.DEV ? "/app/main-sw.ts" : "/main-sw.js";
      const registration = await navigator.serviceWorker.register(swUrl, {
        type: "module",
        // scope: "/", // Uncomment and adjust if you need a specific scope
      });
      console.log("ServiceWorker registration successful with scope:", registration.scope);

      // Handle updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version available
            if (confirm("Une nouvelle version est disponible. Mettre à jour maintenant ?")) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
              window.location.reload();
            }
          }
        });
      });
    } catch (error) {
      console.error("ServiceWorker registration failed:", error);
    }
  } else {
    console.log("ServiceWorker not supported");
  }
}
