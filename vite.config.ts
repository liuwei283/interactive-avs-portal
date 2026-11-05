/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// BASE_PATH is the GitHub Pages subpath, e.g. "/interactive-avs-portal/".
// The deploy workflow sets it from the repository name; locally it is "/".
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let base = env.BASE_PATH || '/';
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return {
    base,
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
    },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.{ts,tsx,mjs}'],
      setupFiles: ['tests/unit/setup.ts'],
      env: {
        VITE_SUPABASE_URL: 'https://fake.supabase.test',
        VITE_SUPABASE_ANON_KEY: 'fake-anon-key',
        VITE_ADMIN_EMAIL: 'admin@example.org',
      },
    },
  };
});
