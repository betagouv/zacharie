export async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const swUrl = import.meta.env.DEV ? "/app/main-sw.ts" : "/main-sw.js";
      const registration = await navigator.serviceWorker.register(swUrl, {
        type: "module",
        // scope: '/' // Uncomment and adjust if you need a specific scope
      });
      console.log("ServiceWorker registration successful with scope:", registration.scope);

      // Handle updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version available
            if (confirm("A new version is available. Update now?")) {
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
// ... rest of the file remains the same
export function clearCache() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.controller?.postMessage("clearCache");
    window.location.reload();
  }
}

export function requestNotificationPermission() {
  if ("Notification" in window) {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("Notification permission granted");
        subscribeToPushNotifications();
      }
    });
  }
}

function subscribeToPushNotifications() {
  navigator.serviceWorker.ready.then((registration) => {
    registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: "YOUR_PUBLIC_VAPID_KEY_HERE",
      })
      .then((subscription) => {
        // Send subscription to your server
        console.log("Push notification subscription:", subscription);
      })
      .catch((error) => {
        console.error("Push notification subscription failed:", error);
      });
  });
}
