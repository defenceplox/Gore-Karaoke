import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certsDir  = path.resolve(__dirname, '../../certs');
const certFile  = path.join(certsDir, 'localhost.pem');
const keyFile   = path.join(certsDir, 'localhost-key.pem');
const hasCerts  = fs.existsSync(certFile) && fs.existsSync(keyFile);
const httpsOpts = hasCerts ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) } : undefined;

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
    host: '0.0.0.0',  // listen on all interfaces so phones on LAN can reach it
    port: 3002,
    https: httpsOpts,
    proxy: {
      '/api':    { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/peerjs': { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/socket.io': {
        target:       'https://localhost:3000',
        ws:           true,
        secure:       false,
        changeOrigin: true,
      },
    },
  },
});
