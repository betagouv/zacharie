export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      console.log('import.meta.env.DEV', import.meta.env.DEV);
      const swUrl = import.meta.env.DEV ? '/src/service-worker.ts' : '/service-worker.js';
      const registration = await navigator.serviceWorker.register(swUrl, {
        type: 'module',
        // scope: "/", // Uncomment and adjust if you need a specific scope
      });
      console.log('ServiceWorker registration successful with scope:', registration.scope);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            // BE CAREFUL: right now, we don't touch the service worker's code
            // so there is never any update necessary
            // if there are critical tasks in the future, we should add a way to notify the user like below
            /* 
            if (confirm('Une nouvelle version est disponible. Mettre à jour maintenant ?')) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
            */
          }
        });
      });
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  } else {
    console.log('ServiceWorker not supported');
  }
}
