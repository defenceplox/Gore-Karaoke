import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Service worker is registered automatically by vite-plugin-pwa (registerType: 'autoUpdate')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
