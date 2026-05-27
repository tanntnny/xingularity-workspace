import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installGlobalButtonRipple } from './lib/buttonRipple'
import { AppPlatformProvider } from './platform'

installGlobalButtonRipple()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppPlatformProvider>
      <App />
    </AppPlatformProvider>
  </StrictMode>
)
