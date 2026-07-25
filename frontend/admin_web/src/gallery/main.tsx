import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter/wght.css'
import '@fontsource/cormorant-garamond/600.css'

import '../styles/index.css'
import { Gallery } from './Gallery.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
