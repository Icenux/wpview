import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Samostatná dev app: importuje wpview ze zdrojů, ne z buildu.
// Žádný backend — jen mock-items.ts.
export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: {
      '@wpview': resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 5173,
  },
});
