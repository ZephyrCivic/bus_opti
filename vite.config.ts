/**
 * vite.config.ts
 * Configures Vite for the React 19 + TypeScript stack with shared path aliases.
 * Keeps plugin surface minimal while enabling Tailwind and shadcn component imports.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
