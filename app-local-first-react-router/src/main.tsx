import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startReactDsfr } from '@codegouvfr/react-dsfr/spa';
import { BrowserRouter, Link } from 'react-router';
import tailwind from './tailwind.css?url';
import App from './App.tsx';
import dsfrCss from '@codegouvfr/react-dsfr/main.css?url';
import dsfrColorCss from '@codegouvfr/react-dsfr/dsfr/utility/colors/colors.min.css?url';
import { registerServiceWorker } from './sw/register.ts';
import '@af-utils/scrollend-polyfill';

startReactDsfr({
  // defaultColorScheme: "system",
  defaultColorScheme: 'light',
  Link,
});

registerServiceWorker();

//Only in TypeScript projects
declare module '@codegouvfr/react-dsfr/spa' {
  interface RegisterLink {
    Link: typeof Link;
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <link rel="shortcut icon" href="/favicon.svg" type="image/x-icon" />
    <link rel="stylesheet" href={dsfrCss} />
    <link rel="stylesheet" href={dsfrColorCss} />
    <link rel="stylesheet" href={tailwind} />

    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
