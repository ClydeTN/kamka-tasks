import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev server proxies /api to the local api container. in production nginx
// does the same thing, so the frontend only ever talks to its own origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
