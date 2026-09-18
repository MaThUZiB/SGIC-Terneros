import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { extraerError } from '../api/client'
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-700">SGIC-Terneros </div>
          <div className="text-sm text-slate-400">Matus Company</div>
        </div>
        {error && <MensajeError mensaje={error} />}
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Usuario</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <Boton tipo="submit" disabled={cargando} className="w-full">
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </Boton>
      </form>
    </div>
  )
}