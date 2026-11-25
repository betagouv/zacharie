import { showNewVersionPrompt } from './new-version-prompt';

export async function registerServiceWorker() {
  window.addEventListener('vite:preloadError', () => showNewVersionPrompt());
  window.addEventListener('zacharie-new-native-bundle', () => showNewVersionPrompt());

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !window.ReactNativeWebView) showNewVersionPrompt();
    });

    try {
      console.log('import.meta.env.DEV', import.meta.env.DEV);
      const swUrl = import.meta.env.DEV ? '/src/service-worker.ts' : '/service-worker.js';
      const registration = await navigator.serviceWorker.register(swUrl, {
        type: 'module',
      });
      console.log('ServiceWorker registration successful with scope:', registration.scope);
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  } else {
    console.log('ServiceWorker not supported');
  }
}
