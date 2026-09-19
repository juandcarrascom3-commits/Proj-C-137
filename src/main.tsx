// Asegurar compatibilidad en entornos iframe / sandbox donde window.fetch solo expone un getter
if (typeof window !== 'undefined') {
  try {
    const origFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined;
    let activeFetch = origFetch;
    Object.defineProperty(window, 'fetch', {
      get() {
        return activeFetch;
      },
      set(fn) {
        activeFetch = fn;
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Si ya está configurado o no es redefinible, continuar
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
