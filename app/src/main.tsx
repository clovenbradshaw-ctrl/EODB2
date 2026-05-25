import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setNamespace } from './foundation/operators.js';
import { App } from './App';
import './styles.css';

setNamespace('com.amino.eodb');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the app-shell service worker so the unlock screen and last
// known data load offline. The worker is network-first for app assets
// and never touches /_matrix/ — see public/sw.js.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Relative path resolves against the document's location so the same
    // build works at GitHub Pages' subpath and at a localhost root.
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('[sw] registration failed:', err));
  });
}
