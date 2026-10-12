import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const modulos = [
  { nombre: 'Ganadería', descripcion: 'Animales, DIIO, lotes y pesajes.' },
  { nombre: 'Inventario', descripcion: 'Productos, kardex, compras y PMP.' },
  { nombre: 'Producción', descripcion: 'Alimentación, consumos y sanidad.' },
  { nombre: 'Finanzas', descripcion: 'Ventas, gastos, costos y rentabilidad.' },
]

/** Portal de transición: no muestra cifras ficticias ni ejecuta CRUD de Django. */
export function CloudWorkspacePage() {
  const { user, esAdmin, logout } = useAuth()
  const navigate = useNavigate()

  function salir() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-800">
      <header className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-800 font-bold text-white">SG</div>
            <div>
              <div className="text-base font-bold tracking-tight">SGIC-Terneros</div>
              <div className="text-xs text-slate-500">Plataforma de gestión ganadera</div>
            </div>
          </div>
          <button onClick={salir} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-7 px-5 py-10">
        <section className="rounded-3xl bg-gradient-to-br from-emerald-950 to-teal-800 px-7 py-9 text-white shadow-lg sm:px-10">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Espacio de trabajo</div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Acceso autorizado
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-100">
            La autenticación y los permisos de la nueva plataforma funcionan con Supabase.
            Los módulos operativos permanecen en migración y estarán disponibles después de
            validar sus transacciones y controles de auditoría.
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cuenta</h2>
            <div className="mt-4 text-lg font-semibold">{user?.username}</div>
            <div className="mt-1 text-sm text-slate-500">{user?.email}</div>
            <div className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {esAdmin ? 'Administrador' : 'Operador'}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estado de la plataforma</h2>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              Identidad y perfil verificados
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-600">
              Operaciones de inventario, ventas y costos: habilitación pendiente de pruebas.
            </div>
          </section>
        </div>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Módulos del sistema</h2>
              <p className="mt-1 text-sm text-slate-500">Preparados para su incorporación progresiva.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">En migración</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modulos.map((modulo) => (
              <div key={modulo.nombre} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
                  </svg>
                </div>
                <h3 className="font-semibold">{modulo.nombre}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{modulo.descripcion}</p>
                <div className="mt-5 text-xs font-medium text-amber-800">Próximamente</div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs leading-6 text-slate-500">
          Este entorno valida el acceso a Supabase, pero no reemplaza todavía los procesos operativos
          de Django. No debe utilizarse para registrar movimientos empresariales reales.
        </p>
      </main>
    </div>
  )
}
