// Visual-check build: the real app with the Supabase client swapped for an
// in-memory fake holding obviously-fake fixture data. Output goes to a
// directory you choose (never dist/). Not used by the production build.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  base: '/visual/',
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.supabase.test'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake'),
    'import.meta.env.VITE_ADMIN_EMAIL': JSON.stringify('admin@example.org'),
  },
  resolve: {
    alias: [{ find: /^\.{1,2}\/(?:\.\.\/)*(?:lib\/)?supabase$/, replacement: fileURLToPath(new URL('./visualSupabase.ts', import.meta.url)) }],
  },
});
