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
    host: '0.0.0.0',
    port: 3001,
    https: httpsOpts,
    proxy: {
      '/api':    { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/peerjs': { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/songs':  { target: 'https://localhost:3000', secure: false, changeOrigin: true },
      '/socket.io': {
        target:       'https://localhost:3000',
        ws:           true,
        secure:       false,
        changeOrigin: true,
      },
    },
  },
});
