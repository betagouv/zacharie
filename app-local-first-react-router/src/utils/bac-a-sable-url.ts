// bac à sable de l'API (api-playground) : jamais en production
const BAC_A_SABLE_URL: Record<string, string | null> = {
  prod: null,
  test: 'https://api-playground.zacharie.incubateur.net',
};

// VITE_BAC_A_SABLE_URL : posée par le workflow review-app sur le front d'une review app
export const bacASableUrl = import.meta.env.VITE_BAC_A_SABLE_URL
  ? (import.meta.env.VITE_BAC_A_SABLE_URL as string)
  : import.meta.env.VITE_ENV in BAC_A_SABLE_URL
    ? BAC_A_SABLE_URL[import.meta.env.VITE_ENV]
    : 'http://localhost:3236';
