import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Spinner } from './ui'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <Spinner texto="Verificando sesión..." />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}