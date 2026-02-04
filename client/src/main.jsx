import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@styles/index.css';
import App from './App.jsx';

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('SW Registered!', reg.scope))
        .catch(err => console.log('SW Failed:', err));
    });
  } else {
    // In development, force unregister to avoid caching issues/HMR conflicts
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for(let registration of registrations) {
        registration.unregister();
        console.log('SW Unregistered (Dev Mode)');
      }
    });
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
