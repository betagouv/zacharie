// vite-env.d.ts
declare const __VITE_BUILD_ID__: string;
declare const VITE_COOKIE_USER: string;
declare const SPA_MODE: string;

declare const QueuedResponse = {
  ok: false,
  error: "queued",
  data: null,
};
