import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ACCESS_KEY, REFRESH_KEY } from '../api/client'
import { supabase, usaSupabase } from '../api/supabase'
import type { Usuario } from '../api/types'

interface AuthContextValue {
  user: Usuario | null
  cargando: boolean
  login: (identificador: string, password: string) => Promise<void>
  logout: () => void
  esAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function cargarPerfilSupabase(): Promise<Usuario> {
  if (!supabase) throw new Error('Falta configurar Supabase en las variables de entorno')

  // Obtener el usuario validado por Auth, nunca confiar en el email o rol del formulario.
  const { data: usuarioAuth, error: errorUsuario } = await supabase.auth.getUser()
  if (errorUsuario || !usuarioAuth.user) throw new Error('La sesión no es válida')

  // Solo se puede consultar el perfil propio gracias a la política RLS.
  const { data: perfil, error: errorPerfil } = await supabase
    .from('perfil')
    .select('id,nombre,rol,activo')
    .eq('id', usuarioAuth.user.id)
    .single()

  if (errorPerfil || !perfil) throw new Error('No se encontró un perfil autorizado para esta cuenta')
  if (!perfil.activo) throw new Error('La cuenta aún no ha sido habilitada por un administrador')

  return {
    id: 0, // Compatibilidad temporal con el tipo Usuario del frontend Django.
    username: perfil.nombre || usuarioAuth.user.email || 'Usuario',
    email: usuarioAuth.user.email ?? '',
    first_name: perfil.nombre ?? '',
    last_name: '',
    es_administrador: perfil.rol === 'ADMIN',
    es_superuser: false,
    grupos: [perfil.rol],
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    if (usaSupabase) {
      if (!supabase) {
        setCargando(false)
        return
      }
      const cliente = supabase

      async function comprobarSesion() {
        try {
          const { data: { session } } = await cliente.auth.getSession()
          if (!session) {
            if (vigente) setUser(null)
            return
          }
          const perfil = await cargarPerfilSupabase()
          if (vigente) setUser(perfil)
        } catch {
          if (vigente) setUser(null)
        } finally {
          if (vigente) setCargando(false)
        }
      }

      // Auth notifica también renovaciones y cierre desde otras pestañas.
      // Se difiere la consulta para no bloquear el callback de Auth.
      const { data: { subscription } } = cliente.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          if (vigente) {
            setUser(null)
            setCargando(false)
          }
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          window.setTimeout(() => { if (vigente) void comprobarSesion() }, 0)
        }
      })

      void comprobarSesion()
      return () => { vigente = false; subscription.unsubscribe() }
    }

    async function cargarDjango() {
      if (!localStorage.getItem(ACCESS_KEY)) {
        if (vigente) setCargando(false)
        return
      }
      try {
        const { data } = await api.get<Usuario>('/auth/me/')
        if (vigente) setUser(data)
      } catch {
        if (vigente) setUser(null)
      } finally {
        if (vigente) setCargando(false)
      }
    }
    void cargarDjango()
    return () => { vigente = false }
  }, [])

  async function login(identificador: string, password: string) {
    if (usaSupabase) {
      if (!supabase) throw new Error('Supabase no está configurado. Revise las variables VITE_')
      const { error } = await supabase.auth.signInWithPassword({ email: identificador, password })
      if (error) throw new Error('No fue posible iniciar sesión. Verifique el correo y la contraseña')
      try {
        const perfil = await cargarPerfilSupabase()
        setUser(perfil)
        setCargando(false)
      } catch (e) {
        await supabase.auth.signOut()
        setUser(null)
        throw e
      }
      return
    }

    const { data } = await api.post('/auth/token/', { username: identificador, password })
    localStorage.setItem(ACCESS_KEY, data.access)
    localStorage.setItem(REFRESH_KEY, data.refresh)
    const respuesta = await api.get<Usuario>('/auth/me/')
    setUser(respuesta.data)
    setCargando(false)
  }

  function logout() {
    if (usaSupabase) {
      if (supabase) void supabase.auth.signOut()
    } else {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    }
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
