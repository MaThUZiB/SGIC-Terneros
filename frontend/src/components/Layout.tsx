import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface ItemNav {
  to: string
  label: string
  soloAdmin?: boolean
}

interface GrupoNav {
  id: string
  label: string
  icono: string
  items: ItemNav[]
}

const GRUPOS: GrupoNav[] = [
  {
    id: 'ganaderia',
    label: 'Ganadería',
    icono: 'map',
    items: [
      { to: '/animales', label: 'Animales' },
      { to: '/lotes', label: 'Lotes' },
      { to: '/pesajes', label: 'Pesajes' },
      { to: '/razas', label: 'Razas' },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icono: 'archive',
    items: [
      { to: '/productos', label: 'Productos' },
      { to: '/presentaciones', label: 'Presentaciones' },
      { to: '/conversiones', label: 'Conversiones' },
      { to: '/movimientos', label: 'Movimientos' },
      { to: '/categorias-productos', label: 'Categorías', soloAdmin: true },
      { to: '/unidades-medida', label: 'Unidades de medida', soloAdmin: true },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    icono: 'bolsa',
    items: [
      { to: '/compras-insumos', label: 'Compra de insumos' },
      { to: '/compras-animales', label: 'Compra de animales' },
      { to: '/proveedores', label: 'Proveedores', soloAdmin: true },
    ],
  },
  {
    id: 'produccion',
    label: 'Producción',
    icono: 'rayo',
    items: [
      { to: '/consumos', label: 'Consumos' },
      { to: '/planes', label: 'Planes de alimentación', soloAdmin: true },
      { to: '/tratamientos', label: 'Tratamientos' },
    ],
  },
  {
    id: 'ventas',
    label: 'Ventas',
    icono: 'dolar',
    items: [{ to: '/ventas', label: 'Ventas' }],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icono: 'grafico',
    items: [
      { to: '/gastos', label: 'Gastos' },
      { to: '/categorias-gastos', label: 'Categorías de gasto', soloAdmin: true },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icono: 'ajuste',
    items: [{ to: '/auditoria', label: 'Auditoría', soloAdmin: true }],
  },
]

const ICONOS: Record<string, string> = {
  home: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  map: 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z',
  archive:
    'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  bolsa:
    'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z',
  rayo: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  dolar:
    'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.107-.879-1.107-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  grafico:
    'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  ajuste:
    'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 01-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

function Icono({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <svg className={className ?? 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONOS[nombre] ?? ICONOS.home} />
    </svg>
  )
}

function Navegacion({ onNavegar }: { onNavegar?: () => void }) {
  const { esAdmin } = useAuth()
  const { pathname } = useLocation()

  const grupoActivo = GRUPOS.find((g) =>
    g.items.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to))),
  )?.id

  const [abiertos, setAbiertos] = useState<string[]>(() => (grupoActivo ? [grupoActivo] : []))

  useEffect(() => {
    if (grupoActivo) {
      setAbiertos((a) => (a.includes(grupoActivo) ? a : [...a, grupoActivo]))
    }
  }, [grupoActivo])

  function toggle(id: string) {
    setAbiertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2.5 py-4">
      <NavLink
        to="/"
        end
        onClick={onNavegar}
        className={({ isActive }) =>
          `mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
            isActive
              ? 'bg-emerald-600 font-semibold text-white shadow-sm shadow-emerald-600/30'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`
        }
      >
        <Icono nombre="home" />
        Dashboard
      </NavLink>

      {GRUPOS.map((grupo) => {
        const items = grupo.items.filter((i) => !i.soloAdmin || esAdmin)
        if (items.length === 0) return null
        const abierto = abiertos.includes(grupo.id)
        const activoGrupo = grupo.id === grupoActivo
        return (
          <div key={grupo.id} className="mb-0.5">
            <button
              onClick={() => toggle(grupo.id)}
              aria-expanded={abierto}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activoGrupo ? 'text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icono nombre={grupo.icono} />
              <span className="flex-1 text-left">{grupo.label}</span>
              <svg
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  abierto ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              className={`ml-[1.6rem] overflow-hidden border-l border-slate-200 transition-all duration-200 ${
                abierto ? 'max-h-96' : 'max-h-0 border-transparent'
              }`}
            >
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavegar}
                  className={({ isActive }) =>
                    `ml-3 mt-0.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'bg-emerald-50 font-semibold text-emerald-700'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

export function Layout() {
  const { user, logout, esAdmin } = useAuth()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)

  function salir() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            SG
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">SGIC</div>
            <div className="text-[11px] text-slate-400">Gestión de terneros</div>
          </div>
        </div>
        <Navegacion />
      </aside>

      {/* Sidebar móvil */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMenuAbierto(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
                  SG
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">SGIC</div>
                  <div className="text-[11px] text-slate-400">Gestión de terneros</div>
                </div>
              </div>
              <button
                onClick={() => setMenuAbierto(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>
            <Navegacion onNavegar={() => setMenuAbierto(false)} />
            <div className="border-t border-slate-100 p-3">
              <button
                onClick={salir}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-5">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="hidden text-sm text-slate-500 sm:block">Sistema de Gestión Integral de Crianza</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-slate-700">{user?.username}</div>
              <div className="text-[11px] text-emerald-600">
                {esAdmin ? 'Administrador' : 'Operador'}
              </div>
            </div>
            <button
              onClick={salir}
              className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 sm:inline-flex"
            >
              Salir
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}