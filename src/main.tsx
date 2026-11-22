import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Analytics } from '@vercel/analytics/react'

// Visitor counts (Vercel Web Analytics, no cookies). Only the page path is
// sent: share links carry the whole script in the #hash and sign-in returns
// carry a ?code, so both are stripped.
const stripUrl = <T extends { url: string }>(e: T): T => {
  const u = new URL(e.url)
  return { ...e, url: u.origin + u.pathname }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics beforeSend={stripUrl} />
  </StrictMode>,
)

// Install as an app (PWA). Only in production builds so dev reloads stay fresh.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// iOS Safari ignores user-scalable=no; block pinch zoom there too.
for (const ev of ['gesturestart', 'gesturechange']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
}
