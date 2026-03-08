import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import https from 'https';

const devAgent = new https.Agent({ rejectUnauthorized: false });

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Karaoke Remote',
        short_name: 'Karaoke',
        description: 'Control the karaoke queue from your phone',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/remote/',
        scope: '/remote/',
        icons: [
          { src: '/remote/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/remote/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  base: '/remote/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api':    { target: 'https://localhost:3000', secure: false, changeOrigin: true, agent: devAgent },
      '/peerjs': { target: 'https://localhost:3000', secure: false, changeOrigin: true, agent: devAgent },
      '/socket.io': {
        target:      'https://localhost:3000',
        ws:          true,
        secure:      false,
        changeOrigin: true,
        agent:       devAgent,
      },
    },
  },
});
