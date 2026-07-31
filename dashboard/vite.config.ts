import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // shared is a source-only workspace package; point Vite straight at the TS.
      '@route402/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.DASHBOARD_PORT) || 5173,
    proxy: {
      '/v1': { target: 'http://localhost:4000', changeOrigin: true, ws: true },
      '/health': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  preview: {
    // Deployed dashboard is reached through a host Vite doesn't know ahead of time
    // (Railway's generated domain) — the router side of this is CORS (see router/src/index.ts).
    allowedHosts: true,
  },
});
