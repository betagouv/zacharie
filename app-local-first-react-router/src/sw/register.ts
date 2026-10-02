import { showNewVersionPrompt } from './new-version-prompt';

export async function registerServiceWorker() {
  // Un chunk introuvable signifie que l'onglet tourne sur un bundle dont les fichiers ont été remplacés.
  window.addEventListener('vite:preloadError', () => showNewVersionPrompt());

  if ('serviceWorker' in navigator) {
    // Le service worker fait skipWaiting + clients.claim : un changement de contrôleur alors que la
    // page en avait déjà un signifie qu'une nouvelle version est installée. Le premier contrôleur
    // (première visite) n'est pas une mise à jour.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) showNewVersionPrompt();
    });

    try {
      console.log('import.meta.env.DEV', import.meta.env.DEV);
      const swUrl = import.meta.env.DEV ? '/src/service-worker.ts' : '/service-worker.js';
      const registration = await navigator.serviceWorker.register(swUrl, {
        type: 'module',
        // scope: "/", // Uncomment and adjust if you need a specific scope
      });
      console.log('ServiceWorker registration successful with scope:', registration.scope);
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  } else {
    console.log('ServiceWorker not supported');
  }
}
