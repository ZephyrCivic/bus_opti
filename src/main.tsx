/**
 * src/main.tsx
 * Bootstraps the React application, wiring Tailwind styles and rendering the app shell.
 * Kept lightweight so feature pages can mount within the shared layout.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

type RootElement = HTMLElement & { dataset?: Record<string, string> };

const container = document.getElementById('root') as RootElement | null;

if (!container) {
  throw new Error('アプリのマウント先 #root が見つかりません。');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
