import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRoutes } from './app/AppRoutes'
import './styles/index.css'
import './styles/app-theme.css'
import { loadSettings } from './utils/storage'

// Apply the saved theme before first paint so sign-in and plans honor it too.
try {
  const theme = loadSettings(localStorage).theme
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
} catch { /* storage unavailable: App applies the system default */ }
createRoot(document.getElementById('root')!).render(<StrictMode><AppRoutes /></StrictMode>)
