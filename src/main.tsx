import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

// Apply the saved theme before first paint so a paper-mode user never sees a
// dark flash. The default (no/invalid value) is Dark Neon = the :root defaults.
try {
  if (localStorage.getItem('groove-theme') === 'paper') {
    document.documentElement.dataset.theme = 'paper'
  }
} catch {
  // localStorage unavailable — fall back to the default dark theme
}

const root = document.getElementById('app')
if (!root) throw new Error('Root element #app not found')

createRoot(root).render(<App />)
