import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { initPwaInstall } from './features/pwa/usePwaInstall';
import { initSentry } from './shared/logging/sentry';
import { useThemeStore } from './stores/theme.store';
import './styles.css';

initSentry();
useThemeStore.getState(); // apply saved / system theme before first paint

// Catch Chromium's one-shot install event before any room UI mounts.
initPwaInstall();

// Production / preview only (plugin disables SW in `vite` DEV).
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
