import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { extraerError } from '../api/client'
import { usaSupabase } from '../api/supabase'
import { Boton, MensajeError } from '../components/ui'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(extraerError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 p-4 sm:p-8">
      <form
        onSubmit={enviar}
        className="w-full max-w-md space-y-6 rounded-3xl border border-white/20 bg-white p-7 shadow-2xl shadow-slate-950/40 sm:p-10"
      >
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-lg font-bold tracking-tight text-white shadow-lg shadow-emerald-800/20">SG</div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">SGIC-Terneros </div>
          <div className="text-sm text-slate-500">Gestión ganadera · Matus Company</div>
        </div>
        {error && <MensajeError mensaje={error} />}
        <label className="block">
          <span className="text-sm font-medium text-slate-600">{usaSupabase ? 'Correo electrónico' : 'Usuario'}</span>
          <input
            type={usaSupabase ? 'email' : 'text'}
            autoComplete={usaSupabase ? 'email' : 'username'}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <Boton tipo="submit" disabled={cargando} className="w-full">
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </Boton>
        <p className="pt-2 text-center text-xs text-slate-400">Acceso restringido a usuarios autorizados</p>
        {usaSupabase && <p className="text-center text-xs text-slate-500">Las cuentas requieren habilitación administrativa.</p>}
      </form>
    </div>
  )
}