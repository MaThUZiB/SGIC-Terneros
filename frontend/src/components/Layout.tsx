import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface ItemNav {
  to: string
  label: string
  soloAdmin?: boolean
}

interface GrupoNav {
  titulo: string
  items: ItemNav[]
}

const GRUPOS: GrupoNav[] = [
  { titulo: 'Principal', items: [{ to: '/', label: 'Dashboard' }] },
  {
    titulo: 'Ganadería',
    items: [
      { to: '/animales', label: 'Animales' },
      { to: '/lotes', label: 'Lotes' },
      { to: '/razas', label: 'Razas' },
    ],
  },
  {
    titulo: 'Inventario',
    items: [
      { to: '/productos', label: 'Productos' },
      { to: '/movimientos', label: 'Movimientos' },
      { to: '/categorias-productos', label: 'Categorías', soloAdmin: true },
      { to: '/unidades-medida', label: 'Unidades de medida', soloAdmin: true },
    ],
  },
  {
    titulo: 'Compras',
    items: [
      { to: '/compras-insumos', label: 'Compra de insumos' },
      { to: '/compras-animales', label: 'Compra de animales' },
      { to: '/proveedores', label: 'Proveedores', soloAdmin: true },
    ],
  },
  {
    titulo: 'Producción',
    items: [
      { to: '/consumos', label: 'Consumos' },
      { to: '/planes', label: 'Planes de alimentación', soloAdmin: true },
      { to: '/tratamientos', label: 'Tratamientos' },
    ],
  },
  {
    titulo: 'Ventas',
    items: [{ to: '/ventas', label: 'Ventas' }],
  },
  {
    titulo: 'Finanzas',
    items: [
      { to: '/gastos', label: 'Gastos' },
      { to: '/categorias-gastos', label: 'Categorías de gasto', soloAdmin: true },
    ],
  },
  { titulo: 'Sistema', items: [{ to: '/auditoria', label: 'Auditoría', soloAdmin: true }] },
]

export function Layout() {
  const { user, logout, esAdmin } = useAuth()
  const navigate = useNavigate()

  function salir() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="text-lg font-bold text-emerald-700">SGIC</div>
          <div className="text-xs text-slate-400">Gestión de terneros</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {GRUPOS.map((grupo) => {
            const items = grupo.items.filter((i) => !i.soloAdmin || esAdmin)
            if (items.length === 0) return null
            return (
              <div key={grupo.titulo} className="mb-4">
                <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {grupo.titulo}
                </div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-sm ${
                        isActive
                          ? 'bg-emerald-50 font-medium text-emerald-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="text-sm text-slate-500">Sistema de Gestión Integral de Crianza</div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium text-slate-700">{user?.username}</div>
              <div className="text-xs text-slate-400">{esAdmin ? 'Administrador' : 'Operador'}</div>
            </div>
            <button
              onClick={salir}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Salir
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}