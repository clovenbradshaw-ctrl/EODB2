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
