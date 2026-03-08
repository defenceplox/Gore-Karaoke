import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html}'],
      },
      manifest: false, // No mobile manifest needed for display
    }),
  ],
  base: '/display/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api':    { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/peerjs': { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/songs':  { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/socket.io': {
        target:      'https://localhost:3000',
        ws:          true,
        secure:      false,
        changeOrigin: true,
      },
    },
  },
});
