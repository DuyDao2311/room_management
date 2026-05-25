import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { NotificationProvider } from './contexts/NotificationContext.tsx'
import { FavoritesProvider } from './contexts/FavoritesContext.tsx'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <FavoritesProvider>
          <App />
        </FavoritesProvider>
      </NotificationProvider>
    </AuthProvider>
  </StrictMode>,
)
