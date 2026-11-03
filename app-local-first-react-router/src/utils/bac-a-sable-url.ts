// bac à sable de l'API (api-playground) : jamais en production
const BAC_A_SABLE_URL: Record<string, string | null> = {
  prod: null,
  test: 'https://api-playground.zacharie.incubateur.net',
};

export const bacASableUrl =
  import.meta.env.VITE_ENV in BAC_A_SABLE_URL
    ? BAC_A_SABLE_URL[import.meta.env.VITE_ENV]
    : 'http://localhost:3236';
