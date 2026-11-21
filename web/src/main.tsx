import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* the fonts ship with the package: the app works offline */
import '@fontsource-variable/instrument-sans/index.css'
import '@fontsource-variable/geist-mono/index.css'
import './i18n'
import './style/theme.css'
import './style/themeMode'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
