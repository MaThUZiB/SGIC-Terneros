import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ACCESS_KEY, REFRESH_KEY } from '../api/client'
import type { Usuario } from '../api/types'

interface AuthContextValue {
  user: Usuario | null
  cargando: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  esAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)

  async function cargarUsuario() {
    try {
      const { data } = await api.get<Usuario>('/auth/me/')
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (localStorage.getItem(ACCESS_KEY)) {
      void cargarUsuario()
    } else {
      setCargando(false)
    }
  }, [])

  async function login(username: string, password: string) {
    const { data } = await api.post('/auth/token/', { username, password })
    localStorage.setItem(ACCESS_KEY, data.access)
    localStorage.setItem(REFRESH_KEY, data.refresh)
    await cargarUsuario()
  }

  function logout() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    setUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, cargando, login, logout, esAdmin: user?.es_administrador ?? false }),
    [user, cargando],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}