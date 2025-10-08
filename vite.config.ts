/**
 * vite.config.ts
 * Configures Vite for the React 19 + TypeScript stack with shared path aliases.
 * Keeps plugin surface minimal while enabling Tailwind and shadcn component imports.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    // GitHub Pages（ZephyrCivic/bus_opti）に合わせたベースパス。開発時は `/` に戻す。
    base: isProduction ? '/bus_opti/' : '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    build: {
      sourcemap: true,
    },
  };
});
