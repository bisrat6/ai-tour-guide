import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted so the build has no runtime network dependency.
import '@fontsource-variable/inter/wght.css'
import '@fontsource/cormorant-garamond/600.css'

import './styles/index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
