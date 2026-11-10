import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import './index.css';

createRoot(document.body.appendChild(document.createElement('div'))).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
