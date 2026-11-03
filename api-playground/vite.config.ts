import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

export default defineConfig({
  server: { port: 3236 },
  // le CSS du DSFR contient des hacks IE (`@media (min-width: 0\0)`) que lightningcss refuse
  css: { lightningcss: { errorRecovery: true } },
  plugins: [tanstackStart(), viteReact()],
});
