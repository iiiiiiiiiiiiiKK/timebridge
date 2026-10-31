import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base: './'` keeps every asset URL relative, so the same build works on
// GitHub Pages sub-paths, Cloudflare Pages, Vercel and a plain file server.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
